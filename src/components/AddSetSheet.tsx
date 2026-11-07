import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getQuickAddSets, quickAddSet } from "../api/collection";
import type { QuickAddRequest, QuickAddResult, QuickAddSet } from "../api/types";
import { MinusIcon, PlusIcon } from "./icons";
import { StatusView } from "./StatusView";

/** Comme sur le site : de quoi couvrir un set en playsets, sans plus. */
const MAX_COPIES = 20;
const PREVIEW_DELAY_MS = 300;
const LANGUAGES = ["EN", "FR", "IT", "ZH", "JA", "KO"] as const;

/**
 * Ajout d'une extension entière à la collection personnelle : le nombre
 * d'exemplaires, « en ajouter N » (par défaut) ou « compléter jusqu'à N », le
 * set de jeu ou le set maître, les raretés, la langue et le foil. Un aperçu
 * calculé par le serveur dit ce qui sera écrit avant de l'écrire ; l'ajout
 * renvoie un lot que l'écran propose d'annuler.
 */
export function AddSetSheet({
  gameSlug,
  initialSetCode,
  onClose,
  onAdded,
}: {
  gameSlug: string;
  /** L'extension filtrée à l'écran, proposée d'office. */
  initialSetCode?: string;
  onClose: () => void;
  onAdded: (result: QuickAddResult) => void;
}) {
  const { t } = useTranslation();
  const [sets, setSets] = useState<QuickAddSet[] | null>(null);
  const [setsError, setSetsError] = useState<string | null>(null);
  const [setsTick, setSetsTick] = useState(0);

  const [setCode, setSetCode] = useState(initialSetCode ?? "");
  const [copies, setCopies] = useState(1);
  const [mode, setMode] = useState<QuickAddRequest["mode"]>("add");
  const [scope, setScope] = useState<QuickAddRequest["scope"]>("game");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [language, setLanguage] = useState<string>("EN");
  const [foil, setFoil] = useState(false);

  const [plan, setPlan] = useState<QuickAddResult | null>(null);
  const [planning, setPlanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSetsError(null);
    getQuickAddSets(gameSlug)
      .then(({ sets: list }) => {
        if (cancelled) return;
        setSets(list);
        setSetCode((current) => (list.some((set) => set.setCode === current) ? current : ""));
      })
      .catch((err: unknown) => {
        if (!cancelled) setSetsError(err instanceof Error ? err.message : t("quickAdd.error"));
      });
    return () => {
      cancelled = true;
    };
  }, [gameSlug, setsTick, t]);

  const selected = sets?.find((set) => set.setCode === setCode);

  const request = useMemo<QuickAddRequest | null>(() => {
    if (!selected) return null;
    const kept = selected.rarities.filter((rarity) => !excluded.includes(rarity));
    return {
      setCode: selected.setCode,
      copies,
      mode,
      scope,
      // Toutes cochées : rien à envoyer, pour qu'une carte sans rareté reste comprise.
      ...(kept.length < selected.rarities.length ? { rarities: kept } : {}),
      ...(language ? { language } : {}),
      foil,
    };
  }, [selected, copies, mode, scope, excluded, language, foil]);

  useEffect(() => {
    if (!request) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    setPlanning(true);
    const timer = window.setTimeout(() => {
      quickAddSet(gameSlug, request, true)
        .then((result) => !cancelled && setPlan(result))
        .catch(() => !cancelled && setPlan(null))
        .finally(() => !cancelled && setPlanning(false));
    }, PREVIEW_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setPlanning(false);
    };
  }, [gameSlug, request]);

  const submit = async () => {
    if (!request) return;
    setBusy(true);
    setError(null);
    try {
      onAdded(await quickAddSet(gameSlug, request, false));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("quickAdd.error"));
      setBusy(false);
    }
  };

  const option = (
    active: boolean,
    onPick: () => void,
    title: string,
    text: string,
    name: string,
  ) => (
    <label className={`option-card${active ? " option-card--active" : ""}`}>
      <input type="radio" name={name} checked={active} onChange={onPick} />
      <span>
        <span className="option-card__title">{title}</span>
        <span className="option-card__text">{text}</span>
      </span>
    </label>
  );

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("quickAdd.title")}</h2>
          <p className="muted" style={{ margin: 0 }}>{t("quickAdd.description")}</p>

          {!sets && (
            <StatusView
              loading={!setsError}
              error={setsError}
              onRetry={() => setSetsTick((tick) => tick + 1)}
            />
          )}

          {sets && (
            <>
              <div className="card-filters__row">
                <label className="field field--inline">
                  <span className="field__label">{t("quickAdd.set")}</span>
                  <select value={setCode} onChange={(e) => setSetCode(e.currentTarget.value)}>
                    <option value="">{t("quickAdd.setPlaceholder")}</option>
                    {sets.map((set) => (
                      <option key={set.setCode} value={set.setCode}>
                        {set.name ? `${set.setCode} · ${set.name}` : set.setCode}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field">
                  <span className="field__label">{t("quickAdd.copies")}</span>
                  <div className="qty-stepper">
                    <button
                      type="button"
                      className="qty-stepper__btn"
                      disabled={copies <= 1}
                      onClick={() => setCopies((n) => Math.max(1, n - 1))}
                      aria-label={t("quickAdd.fewer")}
                    >
                      <MinusIcon size={14} />
                    </button>
                    <span className="qty-stepper__value">{copies}</span>
                    <button
                      type="button"
                      className="qty-stepper__btn"
                      disabled={copies >= MAX_COPIES}
                      onClick={() => setCopies((n) => Math.min(MAX_COPIES, n + 1))}
                      aria-label={t("quickAdd.more")}
                    >
                      <PlusIcon size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="field">
                <span className="field__label">{t("quickAdd.modeLabel")}</span>
                <div className="option-list">
                  {option(
                    mode === "add",
                    () => setMode("add"),
                    t("quickAdd.modeAdd", { count: copies }),
                    t("quickAdd.modeAddText"),
                    "quick-add-mode",
                  )}
                  {option(
                    mode === "fill",
                    () => setMode("fill"),
                    t("quickAdd.modeFill", { count: copies }),
                    t("quickAdd.modeFillText", { count: copies }),
                    "quick-add-mode",
                  )}
                </div>
              </div>

              <div className="field">
                <span className="field__label">{t("quickAdd.scopeLabel")}</span>
                <div className="option-list">
                  {option(
                    scope === "game",
                    () => setScope("game"),
                    t("quickAdd.scopeGame", { count: selected?.gameTotal ?? 0 }),
                    t("quickAdd.scopeGameText"),
                    "quick-add-scope",
                  )}
                  {option(
                    scope === "master",
                    () => setScope("master"),
                    t("quickAdd.scopeMaster", { count: selected?.masterTotal ?? 0 }),
                    t("quickAdd.scopeMasterText"),
                    "quick-add-scope",
                  )}
                </div>
              </div>

              {selected && selected.rarities.length > 1 && (
                <div className="field">
                  <span className="field__label">{t("quickAdd.rarities")}</span>
                  <div className="chip-set">
                    {selected.rarities.map((rarity) => {
                      const on = !excluded.includes(rarity);
                      return (
                        <button
                          key={rarity}
                          type="button"
                          className={`chip-filter${on ? " chip-filter--active" : ""}`}
                          aria-pressed={on}
                          onClick={() =>
                            setExcluded((list) =>
                              on ? [...list, rarity] : list.filter((other) => other !== rarity),
                            )
                          }
                        >
                          {rarity}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="card-filters__row" style={{ alignItems: "flex-end" }}>
                <label className="field field--inline">
                  <span className="field__label">{t("quickAdd.language")}</span>
                  <select value={language} onChange={(e) => setLanguage(e.currentTarget.value)}>
                    <option value="">{t("quickAdd.noLanguage")}</option>
                    {LANGUAGES.map((code) => (
                      <option key={code} value={code}>
                        {t(`quickAdd.languages.${code}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field field--inline" style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 12 }}>
                  <input type="checkbox" checked={foil} onChange={(e) => setFoil(e.currentTarget.checked)} />
                  <span>{t("quickAdd.foil")}</span>
                </label>
              </div>

              <div className="preview-tiles">
                <div className="preview-tile">
                  <span className="preview-tile__value">{plan?.copies ?? "–"}</span>
                  <span className="preview-tile__label">{t("quickAdd.previewCopies")}</span>
                </div>
                <div className="preview-tile">
                  <span className="preview-tile__value">{plan?.cards ?? "–"}</span>
                  <span className="preview-tile__label">{t("quickAdd.previewCards")}</span>
                </div>
                {mode === "fill" && (
                  <div className="preview-tile preview-tile--ok">
                    <span className="preview-tile__value">{plan?.unchanged ?? "–"}</span>
                    <span className="preview-tile__label">
                      {t("quickAdd.previewUnchanged", { count: copies })}
                    </span>
                  </div>
                )}
              </div>

              {error && <p className="form-error">{error}</p>}

              <button
                className="btn btn--grad btn--block"
                onClick={submit}
                disabled={busy || planning || !plan || plan.copies === 0}
              >
                {busy
                  ? t("common.saving")
                  : plan && plan.copies > 0
                    ? t("quickAdd.submit", { count: plan.copies })
                    : t("quickAdd.nothing")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
