import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  copyDeck,
  deleteDeck,
  getDeck,
  getDeckCards,
  setDeckFavorite,
} from "../api/decks";
import { getGame } from "../api/games";
import type { Deck } from "../api/types";
import { UserMarkdown } from "../components/UserMarkdown";
import { BackHeader } from "../components/BackHeader";
import { DeckCostCurve } from "../components/DeckCostCurve";
import { DeckLegalityBadge, DeckSizeLabel, DeckVisibilityBadge } from "../components/DeckBadges";
import { DeckTextSheet } from "../components/DeckTextSheet";
import { DeckVisibilitySheet } from "../components/DeckVisibilitySheet";
import { DeckZoneCards } from "../components/DeckZoneCards";
import { StarIcon, TextListIcon, TrashIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useSearchParamState } from "../hooks/useSearchParamState";
import { deckCardIds, type DeckCardInfo } from "../lib/deck-contents";
import { getDeckZones } from "../lib/deck-zones";
import { useAuth } from "../store/auth";

const TABS = ["description", "guide", "cards"] as const;
type Tab = (typeof TABS)[number];

/**
 * La fiche d'un deck : ce qu'il contient, comment il se joue, et ce qu'on peut
 * en faire.
 *
 * Un seul écran pour l'auteur et pour le visiteur, contrairement au web qui en
 * tient deux : sur un téléphone, la différence tient à quelques boutons, pas à
 * une mise en page. Ce qui distingue l'auteur, c'est l'édition — visibilité,
 * liste, suppression — et ses notes, que l'API ne sert qu'à lui.
 *
 * Rien de ce qui s'affiche n'est lu d'un champ enregistré : taille, légalité et
 * courbe se dérivent du contenu courant et des zones du jeu.
 */
export function DeckDetailScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { deckId = "" } = useParams();

  const [tab, setTab] = useSearchParamState<Tab>("tab", TABS, "description");
  const [deck, setDeck] = useState<Deck | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);

  const loaded = useApi(() => getDeck(deckId), [deckId]);
  useEffect(() => {
    if (loaded.data) setDeck(loaded.data);
  }, [loaded.data]);

  // Le jeu du deck décide de son découpage en zones. Sans lui, on ne sait pas
  // quelles zones montrer — on attend donc, plutôt que d'afficher un
  // découpage générique qui serait faux pour Riftbound.
  const game = useApi(
    () => (deck?.gameId ? getGame(deck.gameId) : Promise.resolve(null)),
    [deck?.gameId],
  );
  const zones = useMemo(() => getDeckZones(game.data?.slug), [game.data?.slug]);

  const cardIds = useMemo(() => deckCardIds(deck?.cards), [deck?.cards]);
  const catalog = useApi(
    () =>
      deck?.gameId && cardIds.length > 0
        ? getDeckCards(deck.gameId, cardIds)
        : Promise.resolve<DeckCardInfo[]>([]),
    [deck?.gameId, cardIds.join(",")],
  );
  const cardsById = useMemo(
    () => new Map((catalog.data ?? []).map((card) => [card.id, card])),
    [catalog.data],
  );

  const isAuthor = Boolean(deck?.playerId && user?.id && deck.playerId === user.id);
  const isFavorite = Boolean(user?.id && deck?.favoritedBy?.includes(user.id));

  async function toggleFavorite() {
    if (!deck) return;
    setBusy(true);
    setActionError(null);
    try {
      setDeck(await setDeckFavorite(deck.id, !isFavorite));
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!deck) return;
    setBusy(true);
    setActionError(null);
    try {
      const copied = await copyDeck(deck.id);
      navigate(`/decks/${copied.id}`, { replace: true });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t("common.error"));
      setBusy(false);
    }
  }

  async function remove() {
    if (!deck) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteDeck(deck.id);
      navigate("/decks", { replace: true });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t("common.error"));
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <BackHeader title={deck?.name ?? t("decks.detailTitle")} />
      <StatusView
        loading={loaded.loading || game.loading}
        error={loaded.error ?? game.error}
        onRetry={() => {
          loaded.reload();
          game.reload();
        }}
      />

      {deck && (
        <>
          <div className="deck-hero">
            <div className="chip-row" style={{ marginBottom: 6 }}>
              <DeckSizeLabel cards={deck.cards} zones={zones} />
              <DeckLegalityBadge cards={deck.cards} zones={zones} />
              <DeckVisibilityBadge visibility={deck.visibility} />
            </div>
            <p className="muted">
              {[deck.legendName, deck.format, deck.creatorName].filter(Boolean).join(" · ") ||
                t("decks.noLegend")}
            </p>
          </div>

          <div className="segmented" style={{ margin: "12px 0" }}>
            {TABS.map((key) => (
              <button
                key={key}
                className={`segmented__item${tab === key ? " segmented__item--active" : ""}`}
                onClick={() => setTab(key)}
              >
                {t(`decks.tabs2.${key}`)}
              </button>
            ))}
          </div>

          {tab === "description" && (
            <>
              {deck.description ? (
                <div className="card">
                  <UserMarkdown>{deck.description}</UserMarkdown>
                </div>
              ) : (
                <p className="status muted">{t("decks.noDescription")}</p>
              )}

              {deck.matchups && deck.matchups.length > 0 && (
                <section className="card">
                  <h3 className="section-label">{t("decks.matchups")}</h3>
                  {/* Deux confrontations peuvent porter le même nom : c'est un
                      champ libre, et l'éditeur ne l'interdit pas. Sans l'index,
                      les clés se confondraient et React réconcilierait de
                      travers. Le modèle de l'API ne porte pas d'identifiant. */}
                  {deck.matchups.map((matchup, index) => (
                    <div key={`${matchup.name}-${index}`} className="deck-matchup">
                      <span>{matchup.name}</span>
                      <span className={`chip deck-matchup--${matchup.rating}`}>
                        {t(`decks.matchup.${matchup.rating}`)}
                      </span>
                    </div>
                  ))}
                </section>
              )}

              {/* Les notes sont l'aide-mémoire de l'auteur : l'API ne les sert
                  qu'à lui, et l'écran ne les montre donc qu'à lui non plus. */}
              {isAuthor && deck.notes && (
                <section className="card">
                  <h3 className="section-label">{t("decks.notes")}</h3>
                  <p style={{ whiteSpace: "pre-wrap" }}>{deck.notes}</p>
                </section>
              )}

              <DeckCostCurve cards={deck.cards} zones={zones} cardsById={cardsById} />
            </>
          )}

          {tab === "guide" &&
            (deck.guide && deck.guide.length > 0 ? (
              // Même raison que pour les confrontations : deux sections
              // peuvent porter le même titre.
              deck.guide.map((section, index) => (
                <section key={`${section.title}-${index}`} className="card">
                  <h3 className="section-label">{section.title}</h3>
                  <UserMarkdown>{section.body}</UserMarkdown>
                </section>
              ))
            ) : (
              <p className="status muted">{t("decks.noGuide")}</p>
            ))}

          {tab === "cards" && (
            <>
              <StatusView loading={catalog.loading} error={catalog.error} onRetry={catalog.reload} />
              {zones.map((zone) => (
                <DeckZoneCards
                  key={zone.key}
                  zone={zone}
                  cards={deck.cards}
                  cardsById={cardsById}
                />
              ))}
              {cardIds.length === 0 && !catalog.loading && (
                <p className="status muted">{t("decks.noCards")}</p>
              )}
            </>
          )}

          {actionError && <p className="form-error">{actionError}</p>}

          <div className="deck-actions">
            <button className="btn btn--outline btn--block" disabled={busy} onClick={toggleFavorite}>
              <StarIcon size={16} filled={isFavorite} />
              {isFavorite ? t("decks.favorite.remove") : t("decks.favorite.add")}
            </button>

            <button
              className="btn btn--outline btn--block"
              onClick={() => setTextOpen(true)}
            >
              <TextListIcon size={16} />
              {isAuthor ? t("decks.text.edit") : t("decks.text.view")}
            </button>

            {isAuthor ? (
              <>
                <Link to={`/decks/${deck.id}/edit`} className="btn btn--grad btn--block">
                  {t("decks.build")}
                </Link>
                <button
                  className="btn btn--outline btn--block"
                  onClick={() => setVisibilityOpen(true)}
                >
                  {t("decks.visibility.action")}
                </button>
                <button className="btn btn--danger btn--block" disabled={busy} onClick={remove}>
                  <TrashIcon size={16} />
                  {t("decks.delete")}
                </button>
              </>
            ) : (
              <button className="btn btn--grad btn--block" disabled={busy} onClick={copy}>
                {t("decks.copyToMine")}
              </button>
            )}
          </div>
        </>
      )}

      {textOpen && deck && (
        <DeckTextSheet
          deck={deck}
          zones={zones}
          cardsById={cardsById}
          gameSlugOrId={game.data?.slug ?? deck.gameId ?? ""}
          editable={isAuthor}
          onSaved={setDeck}
          onClose={() => setTextOpen(false)}
        />
      )}

      {visibilityOpen && deck && (
        <DeckVisibilitySheet
          deck={deck}
          onSaved={setDeck}
          onClose={() => setVisibilityOpen(false)}
        />
      )}
    </div>
  );
}
