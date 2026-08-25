import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { resolveDeckCardsByName, updateDeck } from "../api/decks";
import type { Deck } from "../api/types";
import type { DeckCardInfo } from "../lib/deck-contents";
import { applyDeckText, parseDeckText, stringifyDeckText } from "../lib/deck-text";
import type { DeckZone } from "../lib/deck-zones";

/**
 * Le contenu d'un deck en texte : « Deck principal : » puis « 2 Nom » par ligne.
 *
 * C'est le mode d'entrée principal de l'application. Un joueur construit
 * ailleurs — sur le web, dans un client de jeu, sur un autre site — et recopie ;
 * l'éditeur à trois colonnes du web ne se transpose pas sur un téléphone, mais
 * coller une liste, si. En lecture, la même vue sert à recopier le deck d'un
 * autre vers une conversation.
 *
 * L'appariement des noms se fait côté serveur : l'application n'a pas le
 * catalogue du jeu. Ce qu'aucune carte ne porte est dit, pas passé sous
 * silence — une liste collée de travers ne doit pas remplacer un deck à moitié
 * sans le dire.
 */
export function DeckTextSheet({
  deck,
  zones,
  cardsById,
  gameSlugOrId,
  editable,
  onSaved,
  onClose,
}: {
  deck: Deck;
  zones: DeckZone[];
  cardsById: Map<string, DeckCardInfo>;
  gameSlugOrId: string;
  editable: boolean;
  onSaved: (deck: Deck) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const [text, setText] = useState(() =>
    stringifyDeckText(deck.cards, zones, (cardId) => cardsById.get(cardId)?.name),
  );
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unmatched, setUnmatched] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier indisponible : on sélectionne la liste pour que le geste
      // de copie du système prenne le relais, plutôt que de ne rien faire.
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }

  async function apply() {
    setError(null);
    setUnmatched([]);

    const parsed = parseDeckText(text, zones);

    if (parsed.lines.length === 0) {
      // Un champ vidé vide le deck : c'est la modification qu'on ferait en
      // retirant chaque carte. Un texte qu'on n'a pas su lire, lui, n'est pas
      // une liste vide — l'effacer emporterait le deck et la saisie qui le
      // corrigeait.
      if (text.trim() !== "") {
        setUnmatched(parsed.ignored);
        setError(t("decks.text.failed"));
        return;
      }

      setApplying(true);
      try {
        onSaved(await updateDeck(deck.id, { cards: {} }));
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t("common.error"));
      } finally {
        setApplying(false);
      }
      return;
    }

    setApplying(true);
    try {
      const names = [...new Set(parsed.lines.map((line) => line.name))];
      const matches = await resolveDeckCardsByName(gameSlugOrId, names);

      // Lecture par propriété propre, plutôt qu'un accès direct : les clés sont
      // des noms de cartes venus du texte, et « constructor » ou « toString » y
      // trouveraient une valeur héritée d'`Object.prototype` au lieu d'être
      // signalés comme introuvables. Le serveur prend la même précaution à
      // l'écriture, en sérialisant un objet sans prototype.
      const own = (name: string) =>
        Object.prototype.hasOwnProperty.call(matches, name) ? matches[name] : undefined;

      const applied = applyDeckText(parsed, (name) => own(name)?.id);

      setUnmatched([...applied.unmatched, ...parsed.ignored]);

      // Même raison qu'une liste illisible : une liste dont pas une ligne n'a
      // trouvé sa carte ne vaut pas un deck vide.
      if (applied.matched === 0) {
        setError(t("decks.text.noMatch"));
        return;
      }

      onSaved(await updateDeck(deck.id, { cards: applied.cards }));
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{deck.name}</h2>
          <p className="muted" style={{ marginBottom: 10 }}>
            {editable ? t("decks.text.hint") : t("decks.text.readOnlyHint")}
          </p>

          <textarea
            ref={textareaRef}
            className="trade-text__area"
            value={text}
            readOnly={!editable}
            spellCheck={false}
            rows={12}
            placeholder={t("decks.text.placeholder")}
            aria-label={deck.name}
            onChange={(e) => setText(e.currentTarget.value)}
          />

          {unmatched.length > 0 && (
            <div className="trade-text__report">
              <p className="trade-text__report-title">
                {t("decks.text.unmatched", { count: unmatched.length })}
              </p>
              <ul className="trade-text__unmatched">
                {unmatched.map((line, index) => (
                  <li key={`${line}-${index}`}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          {editable && (
            <button
              className="btn btn--grad btn--block"
              style={{ marginTop: 12 }}
              disabled={applying}
              onClick={apply}
            >
              {applying ? t("decks.text.applying") : t("decks.text.apply")}
            </button>
          )}
          <button
            className="btn btn--outline btn--block"
            style={{ marginTop: 10 }}
            onClick={copy}
          >
            {copied ? t("decks.text.copied") : t("decks.text.copy")}
          </button>
          <button
            className="btn btn--outline btn--block"
            style={{ marginTop: 10 }}
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
