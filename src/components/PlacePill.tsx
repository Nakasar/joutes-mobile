import { useTranslation } from "react-i18next";
import { CaretIcon, PinIcon } from "./icons";
import { placeName, type SavedPlace } from "../lib/saved-place";

/**
 * La ville qu'on regarde, et son rayon — à toucher pour en changer.
 * Sans ville, la pastille pose la question.
 */
export function PlacePill({
  place,
  onOpen,
  active = true,
}: {
  place: SavedPlace | null;
  onOpen: () => void;
  active?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`chip-filter place-pill${active && place ? " chip-filter--active" : ""}`}
      onClick={onOpen}
    >
      <PinIcon size={13} />
      {place ? `${placeName(place)} · ${place.radiusKm} km` : t("place.choose")}
      <CaretIcon size={12} />
    </button>
  );
}
