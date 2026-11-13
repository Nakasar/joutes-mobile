import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  addBoosterCard,
  addBoosterToCollection,
  deleteBooster,
  getBooster,
  recomputeBoosterValue,
  removeBoosterCard,
  removeBoosterFromCollection,
  setBoosterCardFoil,
  updateBooster,
  type Booster,
  type BoosterCardInput,
} from "../api/boosters";
import { searchCards } from "../api/cards";
import { getGame } from "../api/games";
import type { Card } from "../api/types";
import { getMyPermissions } from "../api/users";
import { BackHeader } from "../components/BackHeader";
import { BoosterScanner } from "../components/BoosterScanner";
import { CardImage } from "../components/CardImage";
import { PlusIcon, RefreshIcon, ScanIcon, StarIcon, TrashIcon, XIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useBoosterTypeLabel } from "../hooks/useBoosterTypeLabel";
import { currentLocale } from "../i18n";
import { formatMoney } from "../lib/prices";

const SEARCH_DELAY_MS = 300;
/** Longueur maximale d'une note, comme `BOOSTER_NOTE_MAX_LENGTH` du site. */
const BOOSTER_NOTE_MAX_LENGTH = 500;

function toInput(card: Card, foil: boolean): BoosterCardInput {
  return {
    cardId: card.id,
    name: card.name,
    setCode: card.setCode ?? "",
    collectorNumber: String(card.collectorNumber ?? ""),
    image: card.image ?? "",
    lang: card.lang,
    foil,
  };
}

/**
 * Un booster ouvert : ses cartes, sa valeur, et de quoi le remplir — au scan
 * de la caméra, carte après carte, ou par nom. Une fois complet, il se verse
 * dans la collection d'un geste. Portage de `BoosterEditor` du site, sans le
 * changement d'édition en masse ni les filtres du contenu.
 */
export function BoosterScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { gameSlug = "", boosterId = "" } = useParams();
  const game = useApi(() => getGame(gameSlug), [gameSlug]);
  const permissions = useApi(() => getMyPermissions().catch(() => null), []);
  const typeLabel = useBoosterTypeLabel(game.data);

  const [booster, setBooster] = useState<Booster | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanFoil, setScanFoil] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Card[]>([]);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  const canUseAiScan =
    permissions.data?.isAdmin === true || (permissions.data?.permissions ?? []).includes("scanner:ai");

  function reload(): Promise<void> {
    return getBooster(boosterId).then(
      (data) => {
        setBooster(data);
        setLoadError(null);
      },
      (err: unknown) => setLoadError(err instanceof Error ? err.message : t("boosters.errors.generic")),
    );
  }

  useEffect(() => {
    void reload().then(() => undefined);
  }, [boosterId]);

  useEffect(() => {
    if (booster) {
      setNote(booster.note ?? "");
      setNoteSaved(true);
    }
  }, [booster?.id]);

  // Recherche par nom, limitée à l'extension et à la langue du booster.
  useEffect(() => {
    const text = query.trim();
    if (!booster || text.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchCards(gameSlug, { searchQuery: text, setCode: booster.setCode, lang: booster.lang, limit: 12 })
        .then((data) => !cancelled && setResults(data.cards ?? []))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setSearching(false));
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, booster?.setCode, booster?.lang, gameSlug]);

  function run(key: string, action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(key);
    setError(null);
    action()
      .then(() => reload())
      .catch((err: unknown) => setError(err instanceof Error ? err.message : t("boosters.errors.generic")))
      .finally(() => setBusy(null));
  }

  async function addFromScan(card: BoosterCardInput): Promise<{ ok: boolean; entryId?: string }> {
    try {
      const result = await addBoosterCard(boosterId, card);
      void reload();
      return { ok: true, entryId: result.entryId };
    } catch {
      return { ok: false };
    }
  }

  async function undoFromScan(entryId: string): Promise<boolean> {
    try {
      await removeBoosterCard(boosterId, entryId);
      void reload();
      return true;
    } catch {
      return false;
    }
  }

  function addFromSearch(card: Card, foil: boolean) {
    run(`add:${card.id}`, () => addBoosterCard(boosterId, toInput(card, foil)));
    setQuery("");
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  if (!booster) {
    return (
      <div className="screen">
        <BackHeader title={t("boosters.editorTitle")} />
        <StatusView loading={!loadError} error={loadError} onRetry={() => void reload()} />
      </div>
    );
  }

  const value = booster.estimatedValue;
  const title = `${booster.setCode} · ${booster.lang.toUpperCase()} · ${typeLabel(booster.type)}`;
  const cards = [...booster.cards].reverse();

  return (
    <div className="screen">
      <BackHeader title={title} />

      <section className="card booster-summary">
        <div className="booster-summary__row">
          <div>
            <p className="booster-summary__label">{t("boosters.value")}</p>
            <p className="booster-summary__value">{value ? formatMoney(value) : "—"}</p>
            <p className="list-meta">
              {value
                ? `${t("boosters.valueBreakdown", { count: value.pricedCards, total: value.cardCount })} · ${t(
                    "boosters.valueComputedAt",
                    { date: new Date(value.computedAt).toLocaleDateString(currentLocale()) },
                  )}`
                : t("boosters.valueNeverComputed")}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => run("value", () => recomputeBoosterValue(boosterId))}
            disabled={busy !== null}
            aria-label={t("boosters.recomputeValue")}
          >
            <RefreshIcon size={18} />
          </button>
        </div>
        {booster.addedToCollection ? (
          <button
            type="button"
            className="btn btn--outline btn--block"
            disabled={busy !== null}
            onClick={() => run("collection", () => removeBoosterFromCollection(boosterId))}
          >
            {t("boosters.removeFromCollection")}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--grad btn--block"
            disabled={busy !== null || booster.cards.length === 0}
            onClick={() => run("collection", () => addBoosterToCollection(boosterId))}
          >
            {t("boosters.addToCollection")}
          </button>
        )}
        {booster.addedToCollection && <p className="list-meta">{t("boosters.inCollectionHint")}</p>}
      </section>

      {error && <p className="form-error">{error}</p>}

      <button type="button" className="btn btn--grad btn--block booster-scan" onClick={() => setScanning(true)}>
        <ScanIcon size={18} />
        {t("boosters.scanner.open")}
      </button>
      <p className="list-meta booster-scan__hint">{t("boosters.scanner.openHint")}</p>

      <p className="section-label">{t("boosters.addCards")}</p>
      <label className="field">
        <span className="visually-hidden">{t("boosters.searchPlaceholder")}</span>
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder={t("boosters.searchPlaceholder")}
          autoCorrect="off"
        />
      </label>
      {searching && <p className="list-meta">{t("common.loading")}</p>}
      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <p className="list-meta">{t("boosters.noResults")}</p>
      )}
      {results.map((card) => (
        <div key={card.id} className="booster-card booster-card--result">
          <CardImage src={card.image} orientation={card.orientation} alt="" className="booster-card__img" loading="lazy" />
          <div className="booster-card__body">
            <p className="booster-card__name">{card.name}</p>
            <p className="list-meta">
              {card.setCode}-{card.collectorNumber}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => addFromSearch(card, true)}
            disabled={busy !== null}
            aria-label={t("boosters.addFoil", { name: card.name })}
          >
            <StarIcon size={18} />
          </button>
          <button
            type="button"
            className="icon-button icon-button--primary"
            onClick={() => addFromSearch(card, false)}
            disabled={busy !== null}
            aria-label={t("boosters.addCard", { name: card.name })}
          >
            <PlusIcon size={18} />
          </button>
        </div>
      ))}

      <p className="section-label">{t("boosters.contents", { count: booster.cards.length })}</p>
      {booster.cards.length === 0 && <p className="list-meta">{t("boosters.emptyBooster")}</p>}
      {cards.map((card) => (
        <div key={card.id} className="booster-card">
          <CardImage src={card.image} alt="" className="booster-card__img" loading="lazy" />
          <div className="booster-card__body">
            <p className="booster-card__name">{card.name}</p>
            <p className="list-meta">
              {card.setCode}-{card.collectorNumber}
              {card.printingName ? ` · ${card.printingName}` : ""}
              {card.marketPrice ? ` · ${formatMoney(card.marketPrice)}` : ""}
            </p>
            {card.newInCollection && <span className="chip chip--accent">{t("boosters.firstCopy")}</span>}
          </div>
          <button
            type="button"
            className={`icon-button${card.foil ? " icon-button--primary" : ""}`}
            onClick={() => run(`foil:${card.id}`, () => setBoosterCardFoil(boosterId, card.id, !card.foil))}
            disabled={busy !== null}
            aria-pressed={card.foil === true}
            aria-label={t("boosters.toggleFoil")}
          >
            <StarIcon size={18} filled={card.foil === true} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => run(`remove:${card.id}`, () => removeBoosterCard(boosterId, card.id))}
            disabled={busy !== null}
            aria-label={t("boosters.removeCard")}
          >
            <XIcon size={18} />
          </button>
        </div>
      ))}

      <p className="section-label">{t("boosters.note")}</p>
      <label className="field">
        <span className="visually-hidden">{t("boosters.note")}</span>
        <textarea
          rows={3}
          maxLength={BOOSTER_NOTE_MAX_LENGTH}
          value={note}
          onChange={(e) => {
            setNote(e.currentTarget.value);
            setNoteSaved(false);
          }}
          placeholder={t("boosters.notePlaceholder")}
        />
      </label>
      <p className="list-meta">{t("boosters.noteHint")}</p>
      {!noteSaved && (
        <button
          type="button"
          className="btn btn--outline btn--block"
          disabled={busy !== null}
          onClick={() =>
            run("note", () =>
              updateBooster(boosterId, { note: note.trim() || null }).then(() => setNoteSaved(true)),
            )
          }
        >
          {t("boosters.saveNote")}
        </button>
      )}

      <div className="booster-danger">
        {confirmDelete ? (
          <button
            type="button"
            className="btn btn--danger btn--block"
            disabled={busy !== null}
            onClick={() => {
              setBusy("delete");
              deleteBooster(boosterId)
                .then(() => navigate(`/collection/${gameSlug}/boosters`, { replace: true }))
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : t("boosters.errors.generic"));
                  setBusy(null);
                });
            }}
          >
            {t("boosters.deleteConfirm")}
          </button>
        ) : (
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setConfirmDelete(true)}>
            <TrashIcon size={16} />
            {t("boosters.delete")}
          </button>
        )}
      </div>

      {scanning && (
        <BoosterScanner
          gameSlug={gameSlug}
          setCode={booster.setCode}
          lang={booster.lang}
          canUseAiScan={canUseAiScan}
          foil={scanFoil}
          onFoilChange={setScanFoil}
          boosterCardCount={booster.cards.length}
          onAdd={(card, foil) =>
            addFromScan({
              cardId: card.id,
              name: card.name,
              setCode: card.setCode,
              collectorNumber: card.collectorNumber,
              image: card.image,
              lang: card.lang,
              foil: card.foil === true || foil,
            })
          }
          onUndo={undoFromScan}
          onSearchByName={(name) => {
            setScanning(false);
            setQuery(name);
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}
