import { useState } from "react";
import { useTranslation } from "react-i18next";
import { listSets } from "../api/cards";
import type { SetCompletion } from "../api/types";
import { useApi } from "../hooks/useApi";
import { CaretIcon } from "./icons";

/**
 * Avancement extension par extension, comme la page « Extensions » de la
 * collection du site : la master set (toutes les versions, foils comprises)
 * et la game set (une copie de chaque carte). Les chiffres viennent du même
 * calcul que le total du jeu (`stats.sets` de la collection) ; seuls les noms
 * des extensions sont lus à part, et le code suffit s'ils manquent.
 *
 * Toucher une extension filtre la liste de cartes dessous sur elle.
 */
export function SetCompletionList({
  gameSlug,
  sets,
  activeSetCode,
  onSelect,
}: {
  gameSlug: string;
  sets: SetCompletion[];
  activeSetCode?: string;
  onSelect: (setCode: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const names = useApi(
    () => (open ? listSets(gameSlug) : Promise.resolve([])),
    [open, gameSlug],
  );
  const nameOf = (code: string) =>
    names.data?.find((s) => s.setCode.toUpperCase() === code.toUpperCase())?.name;

  if (sets.length === 0) return null;

  return (
    <section className="card set-completion">
      <button
        type="button"
        className="set-completion__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="card__title" style={{ margin: 0 }}>
          {t("collection.sets.title")}
        </span>
        <span className="muted set-completion__count">
          {t("collection.sets.count", { count: sets.length })}
        </span>
        <CaretIcon size={16} style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>

      {open && (
        <>
          <p className="muted set-completion__hint">{t("collection.sets.hint")}</p>
          <ul className="set-completion__list">
            {sets.map((set) => (
              <li key={set.setCode}>
                <button
                  type="button"
                  className={`set-completion__item${activeSetCode?.toUpperCase() === set.setCode.toUpperCase() ? " set-completion__item--active" : ""}`}
                  onClick={() => onSelect(set.setCode)}
                >
                  <span className="set-completion__name">
                    <span className="chip set-completion__code">{set.setCode}</span>
                    {nameOf(set.setCode)}
                  </span>
                  <Bar label={t("collection.sets.master")} owned={set.masterOwned} total={set.masterTotal} />
                  <Bar label={t("collection.sets.game")} owned={set.gameOwned} total={set.gameTotal} tone="game" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Bar({
  label,
  owned,
  total,
  tone,
}: {
  label: string;
  owned: number;
  total: number;
  tone?: "game";
}) {
  const percent = total > 0 ? Math.round((owned / total) * 100) : 0;
  return (
    <span className="set-completion__bar">
      <span className="set-completion__bar-head">
        <span>{label}</span>
        <span className="set-completion__bar-value">
          {owned}/{total} · {percent}%
        </span>
      </span>
      <span className="progress">
        <span
          className={`progress__bar${tone === "game" ? " set-completion__fill--game" : ""}`}
          style={{ width: `${percent}%`, display: "block" }}
        />
      </span>
    </span>
  );
}
