import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { resolveDeckCardsByName } from "../../api/decks";
import { CopyIcon } from "../icons";
import type { DeckCardEntry, DeckCardInfo, DeckCards } from "../../lib/deck-contents";
import { routeCardToZone } from "../../lib/deck-routing";
import {
  applyDeckText,
  keptDeckCards,
  mergeDeckText,
  parseDeckText,
} from "../../lib/deck-text";
import { defaultDeckZone, type DeckZone, type DeckZoneKey } from "../../lib/deck-zones";

/**
 * L'onglet « Texte » : la liste du deck, à recopier ou à remplacer par une
 * liste collée — l'onglet Texte du site.
 *
 * Appliquer ne touche qu'au deck en mémoire : rien ne part au serveur avant
 * « Enregistrer », comme pour un ajout de carte. Les zones nommées par un
 * en-tête sont remplacées ; des lignes sans en-tête remplacent le deck
 * principal, en rangeant légendes, runes et champion à leur place.
 */
export function DeckEditorText({
  value,
  onValueChange,
  zones,
  gameSlug,
  currentCards,
  onApply,
}: {
  value: string;
  onValueChange: (value: string) => void;
  zones: DeckZone[];
  gameSlug: string;
  currentCards: DeckCards;
  onApply: (cards: DeckCards, learned: DeckCardInfo[]) => void;
}) {
  const { t } = useTranslation();
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unmatched, setUnmatched] = useState<string[]>([]);

  const parsed = useMemo(() => parseDeckText(value, zones), [value, zones]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier indisponible : la liste reste sélectionnable à la main.
    }
  }

  async function apply() {
    setError(null);
    setUnmatched([]);

    if (parsed.lines.length === 0) {
      setUnmatched(parsed.ignored);
      setError(value.trim() === "" ? t("decks.editor.text.empty") : t("decks.text.failed"));
      return;
    }

    setApplying(true);
    try {
      const names = [...new Set(parsed.lines.map((line) => line.name))];
      const matches = await resolveDeckCardsByName(gameSlug, names);
      // Lecture par propriété propre : « constructor » trouverait sinon une
      // valeur héritée d'`Object.prototype`.
      const own = (name: string) =>
        Object.prototype.hasOwnProperty.call(matches, name) ? matches[name] : undefined;
      const infoById = new Map(Object.values(matches).map((card) => [card.id, card]));

      // Le rangement voit ce qui restera du deck : un champion choisi déjà en
      // place n'est pas une place libre, une zone que la liste remplace l'est.
      const context = keptDeckCards(currentCards, parsed, zones);
      const applied = applyDeckText(
        parsed,
        (name) => own(name)?.id,
        (cardId, soFar) => {
          const card = infoById.get(cardId);
          return card ? routeCardToZone(card, zones, combine(context, soFar)) : defaultDeckZone(zones);
        },
      );

      setUnmatched([...applied.unmatched, ...parsed.ignored]);
      if (applied.matched === 0) {
        setError(t("decks.text.noMatch"));
        return;
      }

      onApply(mergeDeckText(currentCards, applied.cards, parsed, zones), [...infoById.values()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <div className="deck-editor__body">
        <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45 }}>
          {t("decks.editor.text.hint")}
        </p>
        <textarea
          className="deck-text-tab__area"
          value={value}
          spellCheck={false}
          rows={16}
          maxLength={20000}
          placeholder={t("decks.text.placeholder")}
          aria-label={t("decks.editor.tabs.text")}
          onChange={(e) => onValueChange(e.currentTarget.value)}
        />
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          {t("decks.editor.text.read", {
            count: parsed.lines.length,
            sections:
              parsed.sections.map((key) => t(`decks.zones.${key}`)).join(", ") ||
              t("decks.editor.text.noSection"),
          })}
        </p>
        {(unmatched.length > 0 || error) && (
          <div className="deck-text-tab__report" role="alert">
            <span>
              {error && <b>{error} </b>}
              {unmatched.length > 0 && (
                <>
                  <b>{t("decks.text.unmatched", { count: unmatched.length })} : </b>
                  {unmatched.slice(0, 8).join(", ")}
                </>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="deck-editor__bar">
        <button className="btn btn--outline" onClick={copy}>
          <CopyIcon size={16} />
          {copied ? t("decks.text.copied") : t("decks.text.copy")}
        </button>
        <button className="btn btn--grad" style={{ flex: 1.4 }} disabled={applying} onClick={apply}>
          {applying ? t("decks.text.applying") : t("decks.editor.text.apply")}
        </button>
      </div>
    </>
  );
}

/** Deux contenus de deck réunis zone par zone, pour le contexte du rangement. */
function combine(a: DeckCards, b: DeckCards): DeckCards {
  const combined: DeckCards = { ...a };
  for (const [key, entries] of Object.entries(b) as [DeckZoneKey, DeckCardEntry[]][]) {
    combined[key] = [...(a[key] ?? []), ...entries];
  }
  return combined;
}
