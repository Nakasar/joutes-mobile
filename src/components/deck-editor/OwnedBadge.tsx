import { useTranslation } from "react-i18next";

/**
 * Exemplaires possédés d'une carte, comme la pastille de l'éditeur du site.
 *
 * Avec `needed` (une carte du deck), « 2/3 » : vert si la collection couvre le
 * deck, or s'il en manque une partie, rouge s'il n'y en a aucun. Sans (une
 * carte du catalogue), « ×2 ».
 */
export function OwnedBadge({ owned, needed }: { owned: number; needed?: number }) {
  const { t } = useTranslation();

  if (needed === undefined) {
    return (
      <span
        className={`owned-badge${owned === 0 ? " owned-badge--zero" : ""}`}
        aria-label={t("decks.editor.ownedLabel", { count: owned })}
      >
        ×{owned}
      </span>
    );
  }

  const tone = owned >= needed ? "" : owned > 0 ? " owned-badge--part" : " owned-badge--none";
  return (
    <span
      className={`owned-badge${tone}`}
      aria-label={t("decks.editor.ownedOfLabel", { owned, needed })}
    >
      {owned}/{needed}
    </span>
  );
}
