import { useTranslation } from "react-i18next";
import { CardImage } from "../CardImage";
import { MinusIcon, MoreIcon, PlusIcon } from "../icons";
import { OwnedBadge } from "./OwnedBadge";
import { zoneRuleText } from "./zone-rule";
import {
  zoneEntries,
  zoneRuleCount,
  type DeckCardInfo,
  type DeckCards,
} from "../../lib/deck-contents";
import {
  isZoneCompliant,
  zoneCounterLabel,
  type DeckZone,
  type DeckZoneKey,
} from "../../lib/deck-zones";

export type DeckEditorView = "grid" | "list";

/** Ce que l'écran sait d'une carte pour en régler les exemplaires. */
export type DeckEditorCardState = {
  /** Exemplaires possédés ; absent = collection inconnue. */
  owned?: number;
  /** Exemplaires demandés par le deck, toutes zones confondues. */
  needed: number;
  /** Le + est-il permis (zone pleine, plafond d'exemplaires atteint) ? */
  canAdd: boolean;
};

/**
 * Les zones du deck, toutes à la fois, comme la colonne centrale du site : en
 * grille, l'illustration porte le −/+, la pastille des possédées et le « ⋯ » ;
 * en liste, une ligne par carte.
 *
 * Le glisser-déposer du site n'a pas d'équivalent au pouce : le « ⋯ » ouvre le
 * menu « Déplacer vers », comme le clavier sur le site.
 */
export function DeckEditorZones({
  zones,
  cards,
  cardsById,
  view,
  stateOf,
  onChange,
  onActions,
  onAddToZone,
}: {
  zones: DeckZone[];
  cards: DeckCards;
  cardsById: Map<string, DeckCardInfo>;
  view: DeckEditorView;
  stateOf: (zone: DeckZoneKey, cardId: string) => DeckEditorCardState;
  onChange: (zone: DeckZoneKey, cardId: string, delta: number) => void;
  onActions: (zone: DeckZoneKey, cardId: string) => void;
  onAddToZone: (zone: DeckZoneKey) => void;
}) {
  // La légende et le champion choisi, une carte chacun, se partagent une
  // rangée en grille : deux sections pleine largeur pour une vignette seule
  // feraient défiler pour rien.
  const paired =
    view === "grid"
      ? zones.filter(
          (zone) =>
            (zone.key === "legend" || zone.key === "champions") &&
            zone.max === 1 &&
            zoneEntries(cards, zone.key).length <= 1,
        )
      : [];
  const pairedKeys = paired.length === 2 ? new Set(paired.map((zone) => zone.key)) : new Set();

  const section = (zone: DeckZone, single = false) => (
    <DeckEditorZone
      key={zone.key}
      zone={zone}
      zones={zones}
      cards={cards}
      cardsById={cardsById}
      view={view}
      single={single}
      stateOf={stateOf}
      onChange={onChange}
      onActions={onActions}
      onAddToZone={onAddToZone}
    />
  );

  return (
    <>
      {pairedKeys.size === 2 && <div className="deck-editor__pair">{paired.map((zone) => section(zone, true))}</div>}
      {zones.filter((zone) => !pairedKeys.has(zone.key)).map((zone) => section(zone))}
    </>
  );
}

function DeckEditorZone({
  zone,
  zones,
  cards,
  cardsById,
  view,
  single,
  stateOf,
  onChange,
  onActions,
  onAddToZone,
}: {
  zone: DeckZone;
  zones: DeckZone[];
  cards: DeckCards;
  cardsById: Map<string, DeckCardInfo>;
  view: DeckEditorView;
  single: boolean;
  stateOf: (zone: DeckZoneKey, cardId: string) => DeckEditorCardState;
  onChange: (zone: DeckZoneKey, cardId: string, delta: number) => void;
  onActions: (zone: DeckZoneKey, cardId: string) => void;
  onAddToZone: (zone: DeckZoneKey) => void;
}) {
  const { t } = useTranslation();
  const entries = zoneEntries(cards, zone.key);
  const { count, contributed } = zoneRuleCount(cards, zones, zone);
  const compliant = isZoneCompliant(zone, count);
  const label = t(`decks.zones.${zone.key}`);
  const missing = zone.min !== undefined && count < zone.min ? zone.min - count : 0;

  return (
    <section
      className={`deck-edit-zone${compliant ? "" : " deck-edit-zone--off"}${single ? " deck-edit-zone--single" : ""}`}
      aria-label={label}
    >
      <div className="deck-edit-zone__head">
        <div className="deck-edit-zone__title">
          <h3 className="deck-edit-zone__name">{label}</h3>
          {!single && <span className="deck-edit-zone__count">{zoneCounterLabel(zone, count, contributed)}</span>}
        </div>
        <span className={`chip${compliant ? " chip--accent" : " chip--danger"}`}>
          {single
            ? zoneCounterLabel(zone, count, contributed)
            : compliant
              ? t("decks.editor.compliant")
              : missing > 0
                ? t("decks.editor.missing", { count: missing })
                : t("decks.editor.toAdjust")}
        </span>
      </div>
      <p className="deck-edit-zone__rule">{zoneRuleText(t, zone, zones)}</p>

      {entries.length === 0 ? (
        <p className="deck-edit-zone__empty">{t("decks.editor.emptyZone")}</p>
      ) : view === "grid" ? (
        <div className="deck-edit-grid">
          {entries.map((entry) => (
            <GridCard
              key={entry.cardId}
              card={cardsById.get(entry.cardId)}
              cardId={entry.cardId}
              quantity={entry.quantity}
              state={stateOf(zone.key, entry.cardId)}
              onChange={(delta) => onChange(zone.key, entry.cardId, delta)}
              onActions={() => onActions(zone.key, entry.cardId)}
            />
          ))}
        </div>
      ) : (
        <div className="deck-edit-list">
          {entries.map((entry) => (
            <ListCard
              key={entry.cardId}
              card={cardsById.get(entry.cardId)}
              quantity={entry.quantity}
              state={stateOf(zone.key, entry.cardId)}
              onChange={(delta) => onChange(zone.key, entry.cardId, delta)}
              onActions={() => onActions(zone.key, entry.cardId)}
            />
          ))}
        </div>
      )}

      {(entries.length === 0 || missing > 0) && (
        <button className="deck-edit-zone__add" onClick={() => onAddToZone(zone.key)}>
          + {t("decks.editor.addToZone", { zone: label })}
        </button>
      )}
    </section>
  );
}

function Stepper({
  quantity,
  name,
  canAdd,
  onChange,
}: {
  quantity: number;
  name: string;
  canAdd: boolean;
  onChange: (delta: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <button onClick={() => onChange(-1)} aria-label={t("decks.editor.decrease", { name })}>
        <MinusIcon size={14} strokeWidth={2.4} />
      </button>
      <span>{quantity}</span>
      <button onClick={() => onChange(1)} disabled={!canAdd} aria-label={t("decks.editor.increase", { name })}>
        <PlusIcon size={14} strokeWidth={2.4} />
      </button>
    </>
  );
}

function GridCard({
  card,
  cardId,
  quantity,
  state,
  onChange,
  onActions,
}: {
  card: DeckCardInfo | undefined;
  cardId: string;
  quantity: number;
  state: DeckEditorCardState;
  onChange: (delta: number) => void;
  onActions: () => void;
}) {
  const { t } = useTranslation();
  const name = card?.name ?? t("decks.unknownCard");

  return (
    <div className="deck-edit-card">
      <div className="deck-edit-card__art">
        {card?.image ? (
          <CardImage src={card.image} orientation={card.orientation} alt={name} loading="lazy" cached />
        ) : (
          <span className="deck-edit-card__placeholder">{name}</span>
        )}
        <div className="deck-edit-card__stepper">
          <Stepper quantity={quantity} name={name} canAdd={state.canAdd} onChange={onChange} />
        </div>
        {state.owned !== undefined && <OwnedBadge owned={state.owned} needed={state.needed} />}
        <button
          className="deck-edit-card__more"
          onClick={onActions}
          aria-label={t("decks.editor.actions", { name })}
        >
          <MoreIcon size={16} />
        </button>
      </div>
      <p className="deck-edit-card__name">{name}</p>
      <p className="deck-edit-card__ref">{cardReference(card) ?? cardId}</p>
    </div>
  );
}

function ListCard({
  card,
  quantity,
  state,
  onChange,
  onActions,
}: {
  card: DeckCardInfo | undefined;
  quantity: number;
  state: DeckEditorCardState;
  onChange: (delta: number) => void;
  onActions: () => void;
}) {
  const { t } = useTranslation();
  const name = card?.name ?? t("decks.unknownCard");
  const reference = cardReference(card);

  return (
    <div className="deck-edit-row">
      <div className="deck-edit-row__thumb">
        {card?.image && (
          <CardImage src={card.image} orientation={card.orientation} alt="" loading="lazy" cached />
        )}
      </div>
      <div className="deck-edit-row__body">
        <p className="deck-edit-row__name">{name}</p>
        <p className="deck-edit-row__sub">
          {reference && <span className="deck-edit-card__ref">{reference}</span>}
          {card?.cost !== undefined && <span>{t("decks.editor.cost", { cost: card.cost })}</span>}
          {state.owned !== undefined && <OwnedBadge owned={state.owned} needed={state.needed} />}
        </p>
      </div>
      <div className="stepper">
        <button className="stepper__btn" onClick={() => onChange(-1)} aria-label={t("decks.editor.decrease", { name })}>
          <MinusIcon size={14} />
        </button>
        <span className="stepper__value">{quantity}</span>
        <button
          className="stepper__btn"
          onClick={() => onChange(1)}
          disabled={!state.canAdd}
          aria-label={t("decks.editor.increase", { name })}
        >
          <PlusIcon size={14} />
        </button>
      </div>
      <button className="deck-edit-row__more" onClick={onActions} aria-label={t("decks.editor.actions", { name })}>
        <MoreIcon size={18} />
      </button>
    </div>
  );
}

/** « OGN-202 » : l'extension et le numéro, comme sur le site. */
export function cardReference(card: DeckCardInfo | undefined): string | undefined {
  if (!card?.setCode && !card?.collectorNumber) return undefined;
  return [card.setCode, card.collectorNumber].filter(Boolean).join("-");
}
