import { useTranslation } from "react-i18next";
import { CardImage } from "../CardImage";
import { EyeIcon, ImageIcon, MinusIcon, PlusIcon, TrashIcon } from "../icons";
import { cardReference } from "./DeckEditorZones";
import { zoneCount, type DeckCardInfo, type DeckCards } from "../../lib/deck-contents";
import type { DeckZone, DeckZoneKey } from "../../lib/deck-zones";

/**
 * Le menu « ⋯ » d'une carte du deck — celui du site, en feuille : régler le
 * nombre d'exemplaires, la déplacer vers une autre zone (un exemplaire ou
 * tous), en faire la couverture, ouvrir sa fiche.
 *
 * Une zone pleine reste dans la liste, grisée avec sa raison : la voir
 * disparaître ferait chercher où elle est passée.
 */
export function DeckCardActionsSheet({
  card,
  zone,
  zones,
  cards,
  quantity,
  owned,
  needed,
  canAdd,
  isCover,
  onChange,
  onMove,
  onCover,
  onView,
  onClose,
}: {
  card: DeckCardInfo | undefined;
  zone: DeckZone;
  zones: DeckZone[];
  cards: DeckCards;
  quantity: number;
  owned?: number;
  needed: number;
  canAdd: boolean;
  isCover: boolean;
  onChange: (delta: number) => void;
  onMove: (to: DeckZoneKey, quantity?: number) => void;
  onCover: () => void;
  onView: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const name = card?.name ?? t("decks.unknownCard");
  const reference = cardReference(card);
  const details = [
    reference,
    card?.type,
    card?.cost !== undefined ? t("decks.editor.cost", { cost: card.cost }) : undefined,
    card?.domain?.join(", "),
  ].filter(Boolean);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={name} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body">
          <div className="deck-card-sheet__top">
            <div className="deck-card-sheet__art">
              {card?.image && <CardImage src={card.image} orientation={card.orientation} alt={name} cached />}
            </div>
            <div className="deck-card-sheet__info">
              <h2 className="form-sheet__title" style={{ margin: 0 }}>
                {name}
              </h2>
              {details.length > 0 && <p>{details.join(" · ")}</p>}
              {owned !== undefined && (
                <p className={owned < needed ? "deck-card-sheet__owned--short" : undefined}>
                  {t("decks.editor.ownedOf", { owned, needed })}
                </p>
              )}
              <div className="deck-card-sheet__stepper">
                <button onClick={() => onChange(-1)} aria-label={t("decks.editor.decrease", { name })}>
                  <MinusIcon size={16} strokeWidth={2.4} />
                </button>
                <span>{quantity}</span>
                <button
                  onClick={() => onChange(1)}
                  disabled={!canAdd}
                  aria-label={t("decks.editor.increase", { name })}
                >
                  <PlusIcon size={16} strokeWidth={2.4} />
                </button>
              </div>
              <p>{t("decks.editor.inZone", { zone: t(`decks.zones.${zone.key}`) })}</p>
            </div>
          </div>

          {quantity > 0 && zones.length > 1 && (
            <>
              <p className="section-label">{t("decks.editor.moveTo")}</p>
              {zones
                .filter((other) => other.key !== zone.key)
                .map((other) => {
                  const held = zoneCount(cards, other.key);
                  const room = other.max === undefined ? Infinity : Math.max(0, other.max - held);
                  const label = t(`decks.zones.${other.key}`);
                  return (
                    <div
                      key={other.key}
                      className={`deck-card-sheet__move${room === 0 ? " deck-card-sheet__move--full" : ""}`}
                    >
                      <div>
                        <p>{label}</p>
                        <small>
                          {room === 0
                            ? t("decks.editor.zoneFull", { count: other.max })
                            : other.max !== undefined
                              ? `${held} / ${other.max}`
                              : String(held)}
                        </small>
                      </div>
                      <button
                        disabled={room === 0}
                        onClick={() => onMove(other.key, 1)}
                        aria-label={t("decks.editor.moveOneTo", { zone: label })}
                      >
                        {t("decks.editor.moveOne")}
                      </button>
                      {quantity > 1 && room > 1 && (
                        <button
                          onClick={() => onMove(other.key)}
                          aria-label={t("decks.editor.moveAllTo", { zone: label })}
                        >
                          {t("decks.editor.moveAll", { count: Math.min(quantity, room) })}
                        </button>
                      )}
                    </div>
                  );
                })}
            </>
          )}

          <div style={{ marginTop: 14 }}>
            {card?.image && (
              <button className="deck-card-sheet__action" onClick={onCover} disabled={isCover}>
                <ImageIcon size={18} />
                {isCover ? t("decks.editor.isCover") : t("decks.editor.useAsCover")}
              </button>
            )}
            <button className="deck-card-sheet__action" onClick={onView}>
              <EyeIcon size={18} />
              {t("decks.editor.viewCard")}
            </button>
            {quantity > 0 && (
              <button
                className="deck-card-sheet__action deck-card-sheet__action--danger"
                onClick={() => onChange(-quantity)}
              >
                <TrashIcon size={18} />
                {t("decks.editor.removeAll", { count: quantity })}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
