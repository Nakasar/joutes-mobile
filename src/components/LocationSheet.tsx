import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { searchPlaces } from "../api/geo";
import type { Place } from "../api/types";
import { CheckIcon, PinIcon, SearchIcon } from "./icons";
import {
  DEFAULT_RADIUS_KM,
  PLACE_RADII,
  placeName,
  type SavedPlace,
} from "../lib/saved-place";

const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;

/**
 * « Où êtes-vous ? » — une ville tapée, choisie dans la liste du géocodeur,
 * et un rayon. Pas de GPS : voir `src/lib/saved-place.ts`.
 *
 * La ville déjà mémorisée reste sélectionnée à l'ouverture : on vient souvent
 * ne changer que le rayon.
 */
export function LocationSheet({
  initial,
  onSave,
  onClear,
  onClose,
}: {
  initial: SavedPlace | null;
  onSave: (place: SavedPlace) => void;
  onClear?: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const [input, setInput] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Place | null>(initial);
  const [radiusKm, setRadiusKm] = useState<number>(initial?.radiusKm ?? DEFAULT_RADIUS_KM);

  useEffect(() => {
    if (!initial) inputRef.current?.focus();
  }, [initial]);

  useEffect(() => {
    const q = input.trim();
    if (q.length < MIN_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      setSearching(true);
      setError(null);
      searchPlaces(q, i18n.resolvedLanguage ?? i18n.language).then(
        (places) => {
          if (id !== requestId.current) return;
          setResults(places);
          setSearching(false);
        },
        (err: unknown) => {
          if (id !== requestId.current) return;
          setError(err instanceof Error ? err.message : t("common.error"));
          setSearching(false);
        },
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, i18n.resolvedLanguage, i18n.language, t]);

  const canSave =
    selected !== null &&
    (selected.id !== initial?.id || radiusKm !== initial?.radiusKm || initial === null);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("place.title")}</h2>
          <p className="muted form-sheet__note" style={{ marginTop: -8 }}>
            {t("place.hint")}
          </p>

          <div className="search-field">
            <SearchIcon size={18} className="search-field__icon" />
            <input
              ref={inputRef}
              type="search"
              value={input}
              placeholder={t("place.searchPlaceholder")}
              onChange={(e) => setInput(e.currentTarget.value)}
              autoCapitalize="words"
              autoCorrect="off"
            />
          </div>

          {searching && <p className="muted">{t("common.loading")}</p>}
          {error && <p className="form-error">{error}</p>}
          {!searching && input.trim().length >= MIN_LENGTH && results.length === 0 && !error && (
            <p className="muted">{t("place.noResult")}</p>
          )}

          {results.length > 0 && (
            <ul className="place-results">
              {results.map((place) => (
                <li key={place.id}>
                  <button
                    className={`place-results__item${
                      selected?.id === place.id ? " place-results__item--active" : ""
                    }`}
                    onClick={() => {
                      setSelected(place);
                      setInput("");
                      setResults([]);
                    }}
                  >
                    <PinIcon size={16} />
                    <span>{place.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selected && (
            <div className="place-selected">
              <CheckIcon size={16} />
              <span>
                <strong>{placeName(selected)}</strong>
                <span className="muted"> · {selected.label}</span>
              </span>
            </div>
          )}

          <div className="field">
            <span className="field__label">{t("place.radius")}</span>
            <div className="chip-set">
              {PLACE_RADII.map((value) => (
                <button
                  key={value}
                  className={`chip-filter${radiusKm === value ? " chip-filter--active" : ""}`}
                  onClick={() => setRadiusKm(value)}
                >
                  {value} km
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn--grad btn--block"
            disabled={!canSave}
            onClick={() => selected && onSave({ ...selected, radiusKm })}
          >
            {t("common.save")}
          </button>
          {initial && onClear && (
            <button
              className="btn btn--ghost btn--block"
              onClick={() => {
                onClear();
                onClose();
              }}
            >
              {t("place.forget")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
