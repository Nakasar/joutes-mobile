import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { Worker as TesseractWorker } from "tesseract.js";
// Le moteur de lecture est servi par l'app elle-même : la CSP n'autorise aucun
// script venu d'ailleurs, et le scan doit marcher sans dépendre d'un CDN pour le code.
import tesseractWorkerUrl from "tesseract.js/dist/worker.min.js?url";
import tesseractCoreUrl from "tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url";
import { aiMatchCard, getScannerSetCards, type ScannerSetCard } from "../api/boosters";
import { CardImage } from "./CardImage";
import { CrossIcon, FlashlightIcon, PlusIcon, SparklesIcon, StarIcon } from "./icons";
import { CARD_ASPECT, captureCardImageDataUrl, cardGuide, drawCard } from "../lib/scanner-frame";
import {
  createNameMatcher,
  normalizeCollectorNumber,
  pickScannedCard,
  readCollectorNumbers,
} from "../lib/scanner-booster";

const SCAN_INTERVAL_MS = 500;
// La carte entière est lue : au-delà, Tesseract ralentit sans lire mieux.
const OCR_MAX_WIDTH = 900;
// Images sans nom reconnu avant de considérer que la carte a quitté le cadre :
// la même carte peut alors être ajoutée à nouveau (deux exemplaires d'une
// commune dans le même booster).
const FRAMES_BEFORE_CARD_LEFT = 3;
// Lectures consécutives du même nom avant d'ajouter la carte.
const FRAMES_TO_CONFIRM = 2;
// Lectures du même nom sans numéro départageant ses variantes avant de
// demander au joueur de choisir.
const FRAMES_BEFORE_DOUBT = 3;
const FRAME = { cardAspect: CARD_ASPECT } as const;

type Phase = "loading" | "scanning" | "doubt" | "ai" | "error";
type Added = { entryId: string; card: ScannerSetCard; foil: boolean };

type Props = {
  gameSlug: string;
  setCode: string;
  lang: string;
  canUseAiScan: boolean;
  /** Le foil reste choisi d'une carte à l'autre, et d'un scan à l'autre. */
  foil: boolean;
  onFoilChange: (foil: boolean) => void;
  boosterCardCount: number;
  /** Ajoute la carte au booster. `entryId` permet de l'annuler ; il peut manquer alors que l'ajout a réussi. */
  onAdd: (card: ScannerSetCard, foil: boolean) => Promise<{ ok: boolean; entryId?: string }>;
  /** Retire l'exemplaire du booster ; `false` s'il y est resté. */
  onUndo: (entryId: string) => Promise<boolean>;
  onSearchByName: (name: string) => void;
  onClose: () => void;
};

/**
 * Scan des cartes d'un booster à la caméra, comme sur le site
 * (`BoosterScanner.tsx` de joutes-app) : chaque carte reconnue est ajoutée
 * aussitôt, et la dernière peut être annulée.
 *
 * Le texte lu n'est comparé qu'aux noms de l'extension du booster, en mémoire ;
 * l'identification par IA ne sert qu'en repli.
 */
export function BoosterScanner({
  gameSlug,
  setCode,
  lang,
  canUseAiScan,
  foil,
  onFoilChange,
  boosterCardCount,
  onAdd,
  onUndo,
  onSearchByName,
  onClose,
}: Props) {
  const { t } = useTranslation();

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cards, setCards] = useState<ScannerSetCard[] | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [workerReady, setWorkerReady] = useState(false);
  const [lastRead, setLastRead] = useState("");
  const [added, setAdded] = useState<Added[]>([]);
  const [undoing, setUndoing] = useState(false);
  const [doubt, setDoubt] = useState<{ name: string; candidates: ScannerSetCard[] } | null>(null);
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<TesseractWorker | null>(null);
  const foilRef = useRef(foil);
  foilRef.current = foil;
  // L'écran du booster se redessine à chaque ajout : la boucle de lecture ne
  // doit pas repartir pour autant.
  const onAddRef = useRef(onAdd);
  onAddRef.current = onAdd;
  const tRef = useRef(t);
  tRef.current = t;
  // État de la boucle de lecture, hors React : elle tourne entre deux rendus.
  const lastAddedNameRef = useRef<string | null>(null);
  const missesRef = useRef(0);
  const stableRef = useRef<{ name: string; count: number }>({ name: "", count: 0 });
  const doubtRef = useRef<{ name: string; count: number }>({ name: "", count: 0 });

  const byName = useMemo(() => {
    const map = new Map<string, ScannerSetCard[]>();
    for (const card of cards ?? []) {
      const key = card.name.toLowerCase();
      map.set(key, [...(map.get(key) ?? []), card]);
    }
    return map;
  }, [cards]);
  const matchName = useMemo(
    () =>
      createNameMatcher([
        ...new Map((cards ?? []).map((card) => [card.name.toLowerCase(), card.name])).values(),
      ]),
    [cards],
  );

  const fail = useCallback((message: string) => {
    setError(message);
    setPhase("error");
  }, []);

  // Cartes de l'extension, caméra et moteur de lecture se préparent ensemble.
  useEffect(() => {
    let cancelled = false;
    const tr = tRef.current;

    async function loadCards() {
      try {
        const list = await getScannerSetCards(gameSlug, setCode, lang || undefined);
        if (!cancelled) setCards(list);
      } catch (err) {
        console.error("Booster scanner cards load error", err);
        if (!cancelled) fail(tr("boosters.scanner.errors.cards"));
      }
    }

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        fail(tr("boosters.scanner.errors.cameraUnsupported"));
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const [track] = stream.getVideoTracks();
        const capabilities = track?.getCapabilities?.() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        setTorch({ supported: Boolean(capabilities?.torch), on: false });
        setStreamReady(true);
      } catch (err) {
        console.error("Booster scanner camera error", err);
        if (!cancelled) fail(tr("boosters.scanner.errors.cameraAccess"));
      }
    }

    async function startWorker() {
      try {
        const { createWorker, PSM } = await import("tesseract.js");
        const worker = await createWorker("eng", undefined, {
          workerPath: tesseractWorkerUrl,
          corePath: tesseractCoreUrl,
          // Un worker lancé depuis un blob: ne pourrait pas charger le moteur
          // servi par l'app (CSP `script-src 'self'`).
          workerBlobURL: false,
        });
        // Le nom n'est pas au même endroit d'un jeu à l'autre : toute la
        // carte est lue, comme du texte épars.
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        if (cancelled) {
          void worker.terminate();
          return;
        }
        workerRef.current = worker;
        setWorkerReady(true);
      } catch (err) {
        console.error("Booster scanner OCR start error", err);
        if (!cancelled) fail(tr("boosters.scanner.errors.generic"));
      }
    }

    void loadCards();
    void startCamera();
    void startWorker();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      void workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [gameSlug, setCode, lang, fail]);

  // La <video> n'existe qu'une fois rendue : le flux s'y attache ici.
  useEffect(() => {
    const video = videoRef.current;
    if (!streamReady || !video || !streamRef.current || video.srcObject === streamRef.current) return;
    video.srcObject = streamRef.current;
    void video.play().catch((err) => console.error("Booster scanner video play error", err));
  }, [streamReady, phase]);

  useEffect(() => {
    if (phase === "loading" && cards && streamReady && workerReady) {
      if (cards.length > 0) {
        setPhase("scanning");
      } else {
        fail(tRef.current("boosters.scanner.noCards", { setCode }));
      }
    }
  }, [phase, cards, streamReady, workerReady, setCode, fail]);

  // Taille affichée de la vidéo, pour poser le cadre de visée sur la zone lue.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      setBoxSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [streamReady]);

  const addCard = useCallback(async (card: ScannerSetCard) => {
    // Posé avant l'ajout : la boucle continue de lire la même carte pendant
    // que la requête part.
    lastAddedNameRef.current = card.name.toLowerCase();
    doubtRef.current = { name: "", count: 0 };
    setNotice(null);
    const { ok, entryId } = await onAddRef.current(card, foilRef.current);
    if (!ok) {
      lastAddedNameRef.current = null;
      setNotice(tRef.current("boosters.scanner.errors.add"));
    } else if (entryId) {
      // Une carte toujours foil l'est quel que soit le bouton.
      setAdded((prev) => [...prev, { entryId, card, foil: card.foil === true || foilRef.current }]);
    }
  }, []);

  const handleText = useCallback(
    async (text: string) => {
      const hit = matchName(text);
      if (!hit) {
        missesRef.current += 1;
        if (missesRef.current >= FRAMES_BEFORE_CARD_LEFT) lastAddedNameRef.current = null;
        stableRef.current = { name: "", count: 0 };
        setLastRead("");
        return;
      }
      missesRef.current = 0;
      setLastRead(hit.name);

      const key = hit.name.toLowerCase();
      const stable = stableRef.current.name === key ? stableRef.current.count + 1 : 1;
      stableRef.current = { name: key, count: stable };
      if (stable < FRAMES_TO_CONFIRM || key === lastAddedNameRef.current) return;

      const candidates = byName.get(key) ?? [];
      const card = pickScannedCard(candidates, readCollectorNumbers(text, setCode));
      if (card) {
        await addCard(card);
        return;
      }

      const count = doubtRef.current.name === key ? doubtRef.current.count + 1 : 1;
      doubtRef.current = { name: key, count };
      if (count >= FRAMES_BEFORE_DOUBT) {
        setDoubt({ name: hit.name, candidates });
        setPhase("doubt");
      }
    },
    [matchName, byName, setCode, addCard],
  );

  useEffect(() => {
    if (phase !== "scanning") return;
    let stopped = false;

    async function loop() {
      while (!stopped) {
        const video = videoRef.current;
        const worker = workerRef.current;
        canvasRef.current ??= document.createElement("canvas");
        if (
          video &&
          worker &&
          video.readyState >= 2 &&
          drawCard(video, canvasRef.current, { ...FRAME, maxWidth: OCR_MAX_WIDTH })
        ) {
          try {
            const result = await worker.recognize(canvasRef.current);
            if (stopped) break;
            await handleText(result.data.text ?? "");
          } catch (err) {
            console.error("Booster scanner OCR error", err);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, SCAN_INTERVAL_MS));
      }
    }

    void loop();
    return () => {
      stopped = true;
    };
  }, [phase, handleText]);

  const pickCandidate = async (card: ScannerSetCard) => {
    setDoubt(null);
    setPhase("scanning");
    await addCard(card);
  };

  const resume = () => {
    setDoubt(null);
    setNotice(null);
    doubtRef.current = { name: "", count: 0 };
    setPhase("scanning");
  };

  const identifyWithAi = async () => {
    const video = videoRef.current;
    const image = video ? captureCardImageDataUrl(video, FRAME) : null;
    if (!image) return;
    const previous = phase;
    setPhase("ai");
    setNotice(null);
    try {
      const data = await aiMatchCard(gameSlug, image);
      // L'IA peut renvoyer la carte dans une autre langue que celle du
      // booster : faute d'identifiant identique, son nom et son numéro la retrouvent.
      const name = typeof data.match?.name === "string" ? data.match.name : "";
      const sameName = byName.get(name.toLowerCase()) ?? [];
      const number = data.identification?.collectorNumber;
      const card =
        (cards ?? []).find((c) => c.id === data.match?.id) ??
        pickScannedCard(
          sameName,
          typeof number === "string"
            ? [...readCollectorNumbers(number, setCode), normalizeCollectorNumber(number)]
            : [],
        );
      if (card) {
        setDoubt(null);
        setPhase("scanning");
        await addCard(card);
        return;
      }
      if (sameName.length > 1) {
        setDoubt({ name, candidates: sameName });
        setPhase("doubt");
        return;
      }
      setNotice(t("boosters.scanner.aiNoMatch"));
    } catch (err) {
      console.error("Booster scanner AI error", err);
      setNotice(t("boosters.scanner.errors.generic"));
    }
    setPhase(previous === "doubt" ? "doubt" : "scanning");
  };

  const undoLast = async () => {
    const last = added[added.length - 1];
    if (!last) return;
    setUndoing(true);
    try {
      if (await onUndo(last.entryId)) {
        setAdded((prev) => prev.filter((entry) => entry.entryId !== last.entryId));
      } else {
        setNotice(t("boosters.scanner.errors.undo"));
      }
    } finally {
      setUndoing(false);
    }
  };

  const toggleTorch = async () => {
    const [track] = streamRef.current?.getVideoTracks() ?? [];
    if (!track) return;
    const next = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch({ supported: true, on: next });
    } catch {
      setTorch({ supported: false, on: false });
    }
  };

  // Rectangle affiché de la vidéo (`object-fit: contain`) puis cadre de la carte dedans.
  const guideStyle = useMemo(() => {
    if (!videoSize.width || !boxSize.width) return null;
    const videoAspect = videoSize.width / videoSize.height;
    const width = Math.min(boxSize.width, boxSize.height * videoAspect);
    const height = width / videoAspect;
    const guide = cardGuide(videoSize.width, videoSize.height, FRAME);
    return {
      left: (boxSize.width - width) / 2 + guide.left * width,
      top: (boxSize.height - height) / 2 + guide.top * height,
      width: guide.width * width,
      height: guide.height * height,
    };
  }, [videoSize, boxSize]);

  const last = added[added.length - 1];
  const readSize = (video: HTMLVideoElement) =>
    setVideoSize({ width: video.videoWidth, height: video.videoHeight });

  return createPortal(
    <div
      className="booster-scanner"
      role="dialog"
      aria-modal="true"
      aria-label={t("boosters.scanner.title", { setCode })}
    >
      <header className="booster-scanner__head">
        <button
          type="button"
          className="booster-scanner__round"
          aria-label={t("boosters.scanner.close")}
          onClick={onClose}
        >
          <CrossIcon size={20} />
        </button>
        <div className="booster-scanner__titles">
          <span className="booster-scanner__title">{t("boosters.scanner.title", { setCode })}</span>
          <span className="booster-scanner__subtitle">{t("boosters.scanner.subtitle")}</span>
        </div>
        {torch.supported ? (
          <button
            type="button"
            className={`booster-scanner__round${torch.on ? " booster-scanner__round--on" : ""}`}
            aria-label={torch.on ? t("boosters.scanner.torchOff") : t("boosters.scanner.torchOn")}
            aria-pressed={torch.on}
            onClick={() => void toggleTorch()}
          >
            <FlashlightIcon size={20} filled={torch.on} />
          </button>
        ) : (
          <span className="booster-scanner__round booster-scanner__round--empty" aria-hidden="true" />
        )}
      </header>

      <div ref={boxRef} className="booster-scanner__view">
        {phase !== "error" && (
          <>
            <video
              ref={videoRef}
              className="booster-scanner__video"
              muted
              playsInline
              onLoadedMetadata={(e) => readSize(e.currentTarget)}
              // Le téléphone qu'on tourne échange largeur et hauteur de l'image.
              onResize={(e) => readSize(e.currentTarget)}
            />
            {guideStyle && (
              <div
                className={`booster-scanner__guide${phase === "doubt" ? " booster-scanner__guide--doubt" : ""}`}
                style={guideStyle}
              />
            )}
          </>
        )}

        {phase === "loading" && (
          <div className="booster-scanner__overlay">
            <span className="spinner" aria-hidden="true" />
            {t("boosters.scanner.loading")}
          </div>
        )}

        {phase === "error" && (
          <div className="booster-scanner__overlay">
            <p>{error}</p>
            <button type="button" className="btn btn--outline" onClick={onClose}>
              {t("boosters.scanner.close")}
            </button>
          </div>
        )}

        {phase === "scanning" && (
          <div className="booster-scanner__status" aria-live="polite">
            {lastRead ? t("boosters.scanner.reading", { name: lastRead }) : t("boosters.scanner.aim")}
          </div>
        )}

        {phase === "ai" && (
          <div className="booster-scanner__overlay booster-scanner__overlay--dim">
            <span className="spinner" aria-hidden="true" />
            {t("boosters.scanner.aiProcessing")}
          </div>
        )}
      </div>

      {phase === "doubt" && doubt ? (
        <div className="booster-scanner__panel booster-scanner__panel--doubt">
          <div>
            <h2 className="booster-scanner__panel-title">{t("boosters.scanner.doubtTitle")}</h2>
            <p className="muted">{t("boosters.scanner.doubtDescription", { name: doubt.name })}</p>
          </div>
          <ul className="booster-scanner__candidates">
            {doubt.candidates.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  className="booster-card booster-card--result"
                  onClick={() => void pickCandidate(card)}
                  aria-label={t("boosters.scanner.addCandidate", {
                    name: card.name,
                    number: card.collectorNumber,
                  })}
                >
                  <CardImage src={card.image} alt="" className="booster-card__img" />
                  <span className="booster-card__body">
                    <span className="booster-card__name">{card.name}</span>
                    <span className="muted">
                      {card.setCode}-{card.collectorNumber}
                      {card.rarity ? ` · ${card.rarity}` : ""}
                    </span>
                  </span>
                  <PlusIcon size={18} />
                </button>
              </li>
            ))}
          </ul>
          {notice && <p className="form-error">{notice}</p>}
          {canUseAiScan && (
            <button type="button" className="btn btn--outline btn--block" onClick={() => void identifyWithAi()}>
              <SparklesIcon size={16} />
              {t("boosters.scanner.aiIdentify")}
            </button>
          )}
          <div className="booster-scanner__row">
            <button type="button" className="btn btn--outline" onClick={resume}>
              {t("boosters.scanner.resume")}
            </button>
            <button type="button" className="btn btn--outline" onClick={() => onSearchByName(doubt.name)}>
              {t("boosters.scanner.searchByName")}
            </button>
          </div>
        </div>
      ) : (
        phase !== "error" && (
          <div className="booster-scanner__panel">
            {last && (
              <div className="booster-scanner__added" aria-live="polite">
                <CardImage src={last.card.image} alt="" className="booster-card__img" />
                <div className="booster-card__body">
                  <span className="booster-card__name">
                    {t("boosters.scanner.added", { name: last.card.name })}
                  </span>
                  <span className="muted">
                    {t("boosters.scanner.addedDetail", {
                      code: `${last.card.setCode}-${last.card.collectorNumber}${
                        last.foil ? ` · ${t("boosters.scanner.foil")}` : ""
                      }`,
                      count: added.length,
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => void undoLast()}
                  disabled={undoing}
                >
                  {t("boosters.scanner.undo")}
                </button>
              </div>
            )}
            {notice && <p className="form-error">{notice}</p>}
            <div className="booster-scanner__row">
              <button
                type="button"
                className={`btn ${foil ? "btn--grad" : "btn--outline"}`}
                aria-pressed={foil}
                onClick={() => onFoilChange(!foil)}
              >
                <StarIcon size={16} filled={foil} />
                {t("boosters.scanner.foil")}
              </button>
              {canUseAiScan && (
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => void identifyWithAi()}
                  disabled={phase !== "scanning"}
                >
                  <SparklesIcon size={16} />
                  {t("boosters.scanner.aiShort")}
                </button>
              )}
              <button type="button" className="btn btn--grad booster-scanner__done" onClick={onClose}>
                {t("boosters.scanner.done")}
              </button>
            </div>
            <p className="muted booster-scanner__count">
              {t("boosters.scanner.count", { count: boosterCardCount })}
            </p>
          </div>
        )
      )}
    </div>,
    document.body,
  );
}
