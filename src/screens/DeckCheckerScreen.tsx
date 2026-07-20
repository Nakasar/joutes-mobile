import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { checkDeck } from "../api/deck-checker";
import type { DeckCheckResponse, DeckList, DeckListCard } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { CardDetailModal } from "../components/CardDetailModal";
import {
  AlertTriangleIcon,
  ChevronIcon,
  ExternalLinkIcon,
} from "../components/icons";

/** Carte à prévisualiser en modale (image + détails + erratas). */
type PreviewCard = { cardId: string; name: string; image?: string };

// Règles de construction Riftbound (reprises du vérificateur web).
type SectionRule = { min: number; max: number };
const RULES: Partial<Record<keyof DeckList, SectionRule>> = {
  legends: { min: 1, max: 1 },
  champions: { min: 1, max: 1 },
  maindeck: { min: 39, max: 39 },
  sideboard: { min: 0, max: 8 },
  runes: { min: 12, max: 12 },
};

const SECTIONS: { key: keyof DeckList; label: string }[] = [
  { key: "legends", label: "Légende" },
  { key: "champions", label: "Champion" },
  { key: "battlefields", label: "Champs de bataille" },
  { key: "runes", label: "Runes" },
  { key: "maindeck", label: "Deck principal" },
  { key: "sideboard", label: "Réserve" },
];

function total(cards: DeckListCard[]): number {
  return cards.reduce((sum, c) => sum + (c.quantity ?? 0), 0);
}

function ruleNote(rule: SectionRule): string {
  return rule.min === rule.max
    ? `${rule.min} requis`
    : `${rule.min} à ${rule.max}`;
}

function DeckCard({
  card,
  gameSlug,
  onPreview,
}: {
  card: DeckListCard;
  gameSlug: string;
  onPreview: (card: PreviewCard) => void;
}) {
  const navigate = useNavigate();
  const clickable = card.recognized !== false && card.cardId;
  const hasErratas = (card.erratas?.length ?? 0) > 0;

  return (
    <div
      className={`deck-card${clickable ? " deck-card--link" : ""}`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={
        clickable
          ? () => navigate(`/games/${gameSlug}/cards/${card.cardId}`)
          : undefined
      }
    >
      <span className="deck-card__qty">{card.quantity}×</span>
      <span
        className={`deck-card__name${card.recognized === false ? " deck-card__name--unknown" : ""}`}
      >
        {card.name}
      </span>
      {card.banned && (
        <span className="deck-badge deck-badge--banned">Bannie</span>
      )}
      {card.recognized === false && (
        <span className="deck-badge deck-badge--unknown">Inconnue</span>
      )}
      {hasErratas && card.cardId && (
        <button
          className="deck-alert"
          aria-label="Erratas / rulings à lire"
          title="Erratas / rulings à lire"
          onClick={(e) => {
            e.stopPropagation();
            onPreview({
              cardId: card.cardId!,
              name: card.name,
              image: card.image,
            });
          }}
        >
          <AlertTriangleIcon size={18} />
        </button>
      )}
      {clickable && (
        <span className="chevron">
          <ChevronIcon size={16} />
        </span>
      )}
    </div>
  );
}

function DeckResult({
  result,
  gameSlug,
  onPreview,
}: {
  result: DeckCheckResponse;
  gameSlug: string;
  onPreview: (card: PreviewCard) => void;
}) {
  const deck = result.deck;
  const allCards = SECTIONS.flatMap((s) => deck[s.key] ?? []);
  const banned = allCards.filter((c) => c.banned);
  const unrecognized = allCards.filter((c) => c.recognized === false);

  const sectionInvalid = SECTIONS.some(({ key }) => {
    const rule = RULES[key];
    if (!rule) return false;
    const t = total(deck[key] ?? []);
    return t < rule.min || t > rule.max;
  });

  const legal = !sectionInvalid && banned.length === 0 && unrecognized.length === 0;

  return (
    <>
      <div className={`deck-summary${legal ? " deck-summary--ok" : " deck-summary--ko"}`}>
        <span className="deck-summary__icon">{legal ? "✓" : "✕"}</span>
        <div>
          <p className="deck-summary__title">
            {legal ? "Deck valide" : "Deck non conforme"}
          </p>
          <p className="deck-summary__sub">
            {legal
              ? "Toutes les règles de construction sont respectées."
              : [
                  sectionInvalid ? "sections hors quota" : null,
                  banned.length > 0 ? `${banned.length} carte(s) bannie(s)` : null,
                  unrecognized.length > 0
                    ? `${unrecognized.length} non reconnue(s)`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </div>
      </div>

      {(result.link || result.code) && (
        <div className="deck-links">
          {result.link && (
            <a
              className="header-link"
              href={result.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              Piltover Archive
              <ExternalLinkIcon size={14} />
            </a>
          )}
          {result.code && <span className="chip">{result.code}</span>}
        </div>
      )}

      {SECTIONS.map(({ key, label }) => {
        const cards = deck[key] ?? [];
        const rule = RULES[key];
        if (cards.length === 0 && (!rule || rule.min === 0)) return null;
        const t = total(cards);
        const invalid = rule ? t < rule.min || t > rule.max : false;
        return (
          <section key={key} className="deck-section">
            <div className="deck-section__head">
              <h2 className="deck-section__title">{label}</h2>
              <span
                className={`deck-section__count${invalid ? " deck-section__count--bad" : ""}`}
              >
                {t}
              </span>
              {rule && (
                <span className="deck-section__rule">{ruleNote(rule)}</span>
              )}
              {invalid && (
                <span className="deck-badge deck-badge--banned">Hors quota</span>
              )}
            </div>
            {cards.map((card, i) => (
              <DeckCard
                key={`${card.name}-${i}`}
                card={card}
                gameSlug={gameSlug}
                onPreview={onPreview}
              />
            ))}
          </section>
        );
      })}
    </>
  );
}

export function DeckCheckerScreen() {
  const { gameSlug = "" } = useParams();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<DeckCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewCard | null>(null);

  function submit() {
    const value = input.trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    checkDeck(gameSlug, value)
      .then((res) => setResult(res))
      .catch((err: unknown) => {
        setResult(null);
        setError(err instanceof Error ? err.message : "Vérification impossible.");
      })
      .finally(() => setLoading(false));
  }

  return (
    <div className="screen">
      <BackHeader title="Vérificateur de deck" />

      <p className="screen-subtitle" style={{ marginBottom: 12 }}>
        Collez une liste, un code de deck ou un lien Piltover Archive.
      </p>

      <textarea
        className="deck-input"
        placeholder={"1 Immortal Phoenix\n3 Blazing Scorcher\n…\n\nou un lien / code Piltover"}
        value={input}
        onChange={(e) => setInput(e.currentTarget.value)}
        rows={6}
      />
      <button
        className="btn btn--grad btn--block"
        style={{ marginTop: 12 }}
        onClick={submit}
        disabled={loading || input.trim().length === 0}
      >
        {loading ? "Vérification…" : "Vérifier le deck"}
      </button>

      {error && (
        <p className="form-error" style={{ marginTop: 14 }}>
          {error}
        </p>
      )}

      {result && (
        <div style={{ marginTop: 18 }}>
          <DeckResult
            result={result}
            gameSlug={gameSlug}
            onPreview={setPreview}
          />
        </div>
      )}

      {preview && (
        <CardDetailModal
          gameSlug={gameSlug}
          cardId={preview.cardId}
          fallbackName={preview.name}
          fallbackImage={preview.image}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
