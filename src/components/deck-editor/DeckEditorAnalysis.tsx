import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CaretIcon } from "../icons";
import {
  collectionCoverage,
  costCurve,
  deckLegality,
  maxCopies,
  typeSplit,
  type DeckCardInfo,
  type DeckCards,
} from "../../lib/deck-contents";
import { zoneCounterLabel, type DeckZone } from "../../lib/deck-zones";

/**
 * L'onglet « Analyse » : les panneaux de la colonne de droite du site —
 * statistiques, légalité zone par zone, couverture par la collection, version.
 * Tout se recalcule à chaque changement : un panneau qui commenterait le deck
 * d'avant le dernier ajout ne servirait à rien.
 */
export function DeckEditorAnalysis({
  cards,
  zones,
  cardsById,
  ownedByCardId,
  copyLimit,
  version,
  updatedAt,
}: {
  cards: DeckCards;
  zones: DeckZone[];
  cardsById: Map<string, DeckCardInfo>;
  /** Absent = collection inconnue (hors connexion, erreur). */
  ownedByCardId?: Map<string, number>;
  copyLimit?: number;
  version: number;
  updatedAt?: string;
}) {
  const { t, i18n } = useTranslation();

  const buckets = costCurve(cards, zones, cardsById);
  const playable = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const weighted = buckets.reduce((sum, bucket, cost) => sum + bucket.count * cost, 0);
  const types = typeSplit(cards, zones, cardsById);
  const legality = deckLegality(cards, zones);
  const off = legality.filter((row) => !row.compliant).length;
  const copies = maxCopies(cards, zones);
  const coverage = ownedByCardId ? collectionCoverage(cards, zones, ownedByCardId) : undefined;
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });

  return (
    <>
      <Panel
        title={t("decks.editor.analysis.stats")}
        summary={t("decks.editor.analysis.playable", { count: playable })}
        defaultOpen
      >
        {playable > 0 && (
          <div className="deck-curve" style={{ marginBottom: 6 }}>
            {buckets.map((bucket) => (
              <div key={bucket.label} className="deck-curve__col">
                <span className="deck-curve__count">{bucket.count || ""}</span>
                <div
                  className="deck-curve__bar"
                  style={{ height: `${Math.round(bucket.ratio * 100)}%`, minHeight: 2 }}
                  aria-hidden="true"
                />
                <span className="deck-curve__label">{bucket.label}</span>
              </div>
            ))}
          </div>
        )}
        {types.map((row) => (
          <div key={row.label} className="deck-panel__row">
            <span>{row.label}</span>
            <span>{row.count}</span>
          </div>
        ))}
        {playable > 0 && (
          <div className="deck-panel__row">
            <span>{t("decks.editor.analysis.averageCost")}</span>
            <span>{number.format(weighted / playable)}</span>
          </div>
        )}
      </Panel>

      <Panel
        title={t("decks.editor.analysis.legality")}
        summary={off === 0 ? t("decks.legal") : t("decks.zonesToAdjust", { count: off })}
        summaryOff={off > 0}
        defaultOpen
      >
        {legality.map((row) => (
          <div key={row.zone.key} className={`deck-panel__row${row.compliant ? "" : " deck-panel__row--off"}`}>
            <span>{t(`decks.zones.${row.zone.key}`)}</span>
            <span>
              {zoneCounterLabel(row.zone, row.count, row.contributed)}{" "}
              {row.compliant ? <span className="deck-panel__ok">✓</span> : "✕"}
            </span>
          </div>
        ))}
        {copyLimit !== undefined && (
          <div
            className={`deck-panel__row deck-panel__rule${copies > copyLimit ? " deck-panel__row--off" : ""}`}
          >
            <span>{t("decks.editor.analysis.maxCopies")}</span>
            <span>
              {copies} / {copyLimit}{" "}
              {copies <= copyLimit ? <span className="deck-panel__ok">✓</span> : "✕"}
            </span>
          </div>
        )}
      </Panel>

      <Panel
        title={t("decks.editor.analysis.collection")}
        summary={
          coverage
            ? t("decks.editor.analysis.ownedSummary", {
                owned: coverage.owned,
                total: coverage.owned + coverage.missing,
              })
            : t("decks.editor.analysis.collectionUnknown")
        }
        defaultOpen={Boolean(coverage && coverage.missing > 0)}
      >
        {coverage ? (
          coverage.missingCards.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              {t("decks.editor.analysis.allOwned")}
            </p>
          ) : (
            coverage.missingCards.map((row) => (
              <div key={row.cardId} className="deck-panel__row">
                <span>{cardsById.get(row.cardId)?.name ?? t("decks.unknownCard")}</span>
                <span style={{ color: "var(--gold-text)" }}>
                  {t("decks.editor.analysis.missing", { count: row.missing })}
                </span>
              </div>
            ))
          )
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {t("decks.editor.analysis.collectionUnknown")}
          </p>
        )}
      </Panel>

      <Panel title={t("decks.editor.analysis.versions")} summary={`v${version}${updatedAt ? ` · ${updatedAt}` : ""}`}>
        <div className="deck-panel__row">
          <span>{t("decks.editor.analysis.current", { version })}</span>
          <span>{updatedAt}</span>
        </div>
      </Panel>
    </>
  );
}

function Panel({
  title,
  summary,
  summaryOff,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary: string;
  summaryOff?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="deck-panel">
      <button
        className={`deck-panel__head${open ? " deck-panel__head--open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>
          <span className="deck-panel__title">{title}</span>
          <span className={`deck-panel__summary${summaryOff ? " deck-panel__summary--off" : ""}`}>{summary}</span>
        </span>
        <CaretIcon size={16} />
      </button>
      {open && <div className="deck-panel__body">{children}</div>}
    </section>
  );
}
