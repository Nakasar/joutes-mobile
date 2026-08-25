import { useTranslation } from "react-i18next";
import type { DeckVisibility } from "../api/types";
import type { DeckCards } from "../lib/deck-contents";
import { countNonCompliantZones, deckSize } from "../lib/deck-contents";
import type { DeckZone } from "../lib/deck-zones";
import { LockIcon } from "./icons";

/**
 * Ce qu'un deck annonce de lui-même en une ligne : sa visibilité, sa taille et
 * sa conformité.
 *
 * Les trois se dérivent du contenu courant, jamais d'une valeur enregistrée —
 * un deck dont on vient de retirer dix cartes ne doit pas continuer à se dire
 * légal parce que le serveur le pensait à l'enregistrement.
 */

export function DeckVisibilityBadge({ visibility }: { visibility?: DeckVisibility }) {
  const { t } = useTranslation();
  if (!visibility || visibility === "public") return null;

  return (
    <span className="chip">
      <LockIcon size={13} />
      {t(`decks.visibility.${visibility}.label`)}
    </span>
  );
}

/**
 * L'état de légalité du deck.
 *
 * Un deck vide n'est pas « non conforme » : il n'est pas encore construit, et
 * le dire illégal ferait passer un deck qu'on vient de créer pour un deck raté.
 */
export function DeckLegalityBadge({
  cards,
  zones,
}: {
  cards: DeckCards | undefined;
  zones: DeckZone[];
}) {
  const { t } = useTranslation();
  const size = deckSize(cards, zones);
  if (size === 0) return null;

  const off = countNonCompliantZones(cards, zones);

  return off === 0 ? (
    <span className="chip chip--accent">{t("decks.legal")}</span>
  ) : (
    <span className="chip chip--danger">{t("decks.zonesToAdjust", { count: off })}</span>
  );
}

export function DeckSizeLabel({
  cards,
  zones,
}: {
  cards: DeckCards | undefined;
  zones: DeckZone[];
}) {
  const { t } = useTranslation();
  return <span className="chip">{t("decks.cardsCount", { count: deckSize(cards, zones) })}</span>;
}
