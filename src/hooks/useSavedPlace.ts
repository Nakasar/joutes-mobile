import { useEffect, useState } from "react";
import {
  clearSavedPlace,
  PLACE_CHANGED_EVENT,
  readSavedPlace,
  writeSavedPlace,
  type SavedPlace,
} from "../lib/saved-place";

/**
 * La ville mémorisée, partagée entre les écrans qui en parlent : changer de
 * ville sur les événements change aussi celle de l'accueil.
 */
export function useSavedPlace(): {
  place: SavedPlace | null;
  save: (place: SavedPlace) => void;
  clear: () => void;
} {
  const [place, setPlace] = useState<SavedPlace | null>(() => readSavedPlace());

  useEffect(() => {
    const sync = () => setPlace(readSavedPlace());
    window.addEventListener(PLACE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PLACE_CHANGED_EVENT, sync);
  }, []);

  return { place, save: writeSavedPlace, clear: clearSavedPlace };
}
