import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getDeck, getDeckCards, updateDeck } from "../api/decks";
import { getGame } from "../api/games";
import type { Card, Deck, DeckGuideSection, DeckMatchup, DeckMatchupRating } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { DeckCardPickerSheet } from "../components/DeckCardPickerSheet";
import { DeckLegalityBadge, DeckSizeLabel } from "../components/DeckBadges";
import { MinusIcon, PlusIcon, TrashIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { ApiError } from "../api/client";
import { useApi } from "../hooks/useApi";
import {
  changeCardQuantity,
  deckCardIds,
  zoneCount,
  zoneEntries,
  type DeckCardInfo,
  type DeckCards,
} from "../lib/deck-contents";
import {
  defaultDeckZone,
  getDeckZones,
  zoneCounterLabel,
  type DeckZoneKey,
} from "../lib/deck-zones";

const MATCHUP_RATINGS: DeckMatchupRating[] = ["favorable", "even", "unfavorable"];

/**
 * La version du deck qui nous a devancés, lue dans le corps d'un `409`.
 *
 * Le corps d'une `ApiError` est `unknown` : le serveur promet
 * `{ error: "conflict", deck }`, mais un intermédiaire peut rendre autre chose,
 * et un `as` à l'aveugle ferait planter l'écran au lieu d'afficher le conflit.
 */
function readConflictVersion(body: unknown): number | null {
  if (typeof body !== "object" || body === null || !("deck" in body)) return null;
  const deck = (body as { deck: unknown }).deck;
  if (typeof deck !== "object" || deck === null || !("version" in deck)) return null;
  const version = (deck as { version: unknown }).version;
  return typeof version === "number" ? version : null;
}

/**
 * L'édition d'un deck sur téléphone.
 *
 * L'éditeur du web tient en trois colonnes — catalogue, zones, panneaux
 * d'analyse — qui ne se transposent pas. Ici : **une zone à la fois**, ses
 * cartes en lignes avec un −/+ par ligne, et la recherche du catalogue ouverte
 * à la demande. C'est le geste d'ajustement, celui d'après-tournoi, qui fait
 * tout l'intérêt d'éditer depuis un téléphone ; construire un deck entier passe
 * par la liste collée, sur la fiche.
 *
 * Le guide et les confrontations s'éditent en dessous, dans le même écran :
 * séparer trois écrans pour trois champs ferait trois allers-retours là où il y
 * a un seul enregistrement.
 *
 * **Concurrence** : l'écran renvoie `expectedVersion` — la version lue au
 * chargement, puis celle que le serveur rend à chaque enregistrement. Un
 * enregistrement parti d'un état devancé ne s'applique pas : le serveur rend un
 * `409` portant l'état frais, la saisie reste à l'écran, et la version fraîche
 * est adoptée pour qu'un second enregistrement impose la sienne — délibérément.
 * La garde sert à faire remarquer, pas à interdire.
 */
export function DeckEditScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { deckId = "" } = useParams();

  const loaded = useApi(() => getDeck(deckId), [deckId]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState("");
  const [notes, setNotes] = useState("");
  const [cards, setCards] = useState<DeckCards>({});
  const [guide, setGuide] = useState<DeckGuideSection[]>([]);
  const [matchups, setMatchups] = useState<DeckMatchup[]>([]);

  const [zone, setZone] = useState<DeckZoneKey | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Le formulaire ne se remplit qu'une fois **par deck** : le recopier à chaque
  // rafraîchissement effacerait la saisie en cours, mais un simple « déjà
  // rempli » garderait le deck précédent. `/decks/:deckId/edit` est une seule
  // route : React Router ne remonte pas l'écran quand seul le paramètre change,
  // et le formulaire enregistrerait alors les valeurs d'un deck sur un autre.
  // D'où la mémoire de *quel* deck l'a rempli, plutôt qu'un booléen.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  useEffect(() => {
    const deck: Deck | null = loaded.data ?? null;
    if (!deck || deck.id === hydratedFor) return;
    setName(deck.name);
    setDescription(deck.description ?? "");
    setFormat(deck.format ?? "");
    setNotes(deck.notes ?? "");
    setCards(deck.cards ?? {});
    setGuide(deck.guide ?? []);
    setMatchups(deck.matchups ?? []);
    versionRef.current = deck.version ?? 1;
    setHydratedFor(deck.id);
  }, [loaded.data, hydratedFor]);

  /**
   * La version serveur, telle qu'on l'a lue — puis telle que le serveur la
   * renvoie à chaque enregistrement.
   *
   * Une ref plutôt qu'un état : elle ne redessine rien, et `loaded.data` ne
   * bouge pas après un `PATCH` — `useApi` garde sa réponse.
   */
  const versionRef = useRef(1);

  // Le deck chargé est-il bien celui de l'adresse ? Entre deux decks, la
  // réponse précédente reste un instant en mémoire : on n'affiche pas un
  // formulaire qui porterait l'ancien.
  const hydrated = hydratedFor !== null && hydratedFor === loaded.data?.id;

  const game = useApi(
    () => (loaded.data?.gameId ? getGame(loaded.data.gameId) : Promise.resolve(null)),
    [loaded.data?.gameId],
  );
  const zones = useMemo(() => getDeckZones(game.data?.slug), [game.data?.slug]);
  const currentZone = zones.find((z) => z.key === zone) ?? zones.find((z) => z.key === defaultDeckZone(zones)) ?? zones[0];

  const cardIds = useMemo(() => deckCardIds(cards), [cards]);
  const catalog = useApi(
    () =>
      loaded.data?.gameId && cardIds.length > 0
        ? getDeckCards(loaded.data.gameId, cardIds)
        : Promise.resolve<DeckCardInfo[]>([]),
    [loaded.data?.gameId, cardIds.join(",")],
  );
  const cardsById = useMemo(
    () => new Map((catalog.data ?? []).map((card) => [card.id, card])),
    [catalog.data],
  );

  function bump(cardId: string, delta: number) {
    if (!currentZone) return;
    setCards((current) => changeCardQuantity(current, currentZone.key, cardId, delta));
  }

  function addPicked(card: Card) {
    if (!currentZone) return;
    setCards((current) => changeCardQuantity(current, currentZone.key, card.id, 1));
    setPicking(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await updateDeck(deckId, {
        name: name.trim(),
        description,
        format: format.trim() || undefined,
        notes,
        cards,
        // Une section sans titre ne se relit pas : elle est écartée à
        // l'enregistrement plutôt que refusée par le serveur.
        guide: guide.filter((section) => section.title.trim()),
        matchups: matchups.filter((matchup) => matchup.name.trim()),
        expectedVersion: versionRef.current,
      });
      versionRef.current = saved.version ?? versionRef.current;
      navigate(`/decks/${deckId}`, { replace: true });
    } catch (err: unknown) {
      // Le deck a été enregistré ailleurs — l'autre appareil, ou le site.
      // Rien n'a été écrit : la saisie reste à l'écran, et son auteur décide.
      // La version fraîche est adoptée, si bien qu'un second enregistrement
      // impose la sienne — délibérément, cette fois.
      if (err instanceof ApiError && err.status === 409) {
        const fresh = readConflictVersion(err.body);
        if (fresh !== null) versionRef.current = fresh;
        setError(t("decks.edit.conflict"));
        setSaving(false);
        return;
      }

      setError(err instanceof Error ? err.message : t("common.error"));
      setSaving(false);
    }
  }

  const entries = currentZone ? zoneEntries(cards, currentZone.key) : [];

  return (
    <div className="screen">
      <BackHeader title={t("decks.edit.title")} />
      <StatusView
        loading={loaded.loading || game.loading}
        error={loaded.error ?? game.error}
        onRetry={() => {
          loaded.reload();
          game.reload();
        }}
      />

      {hydrated && currentZone && (
        <>
          <label className="field">
            <span className="field__label">{t("decks.create.name")}</span>
            <input value={name} maxLength={100} onChange={(e) => setName(e.currentTarget.value)} />
          </label>

          <label className="field">
            <span className="field__label">{t("decks.edit.format")}</span>
            <input
              value={format}
              maxLength={80}
              placeholder={t("decks.edit.formatPlaceholder")}
              onChange={(e) => setFormat(e.currentTarget.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">{t("decks.edit.description")}</span>
            <textarea
              value={description}
              maxLength={2000}
              rows={4}
              onChange={(e) => setDescription(e.currentTarget.value)}
            />
          </label>

          <div className="chip-row">
            <DeckSizeLabel cards={cards} zones={zones} />
            <DeckLegalityBadge cards={cards} zones={zones} />
          </div>

          <p className="section-label">{t("decks.edit.contents")}</p>
          <div className="deck-editor__zone-picker">
            {zones.map((z) => (
              <button
                key={z.key}
                className={`chip-filter${currentZone.key === z.key ? " chip-filter--active" : ""}`}
                onClick={() => setZone(z.key)}
              >
                {t(`decks.zones.${z.key}`)} {zoneCounterLabel(z, zoneCount(cards, z.key))}
              </button>
            ))}
          </div>

          {entries.length === 0 ? (
            <p className="status muted">{t("decks.edit.emptyZone")}</p>
          ) : (
            entries.map((entry) => {
              const card = cardsById.get(entry.cardId);
              return (
                <div key={entry.cardId} className="list-row">
                  <div className="list-row__body">
                    <p className="list-row__title">{card?.name ?? t("decks.unknownCard")}</p>
                    <p className="list-row__sub">
                      {[card?.setCode, card?.collectorNumber].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="list-row__actions">
                    <div className="stepper">
                      <button
                        className="stepper__btn"
                        onClick={() => bump(entry.cardId, -1)}
                        aria-label={t("decks.edit.decrease")}
                      >
                        <MinusIcon size={14} />
                      </button>
                      <span className="stepper__value">{entry.quantity}</span>
                      <button
                        className="stepper__btn"
                        onClick={() => bump(entry.cardId, 1)}
                        aria-label={t("decks.edit.increase")}
                      >
                        <PlusIcon size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <button
            className="btn btn--outline btn--block"
            style={{ marginTop: 10 }}
            onClick={() => setPicking(true)}
          >
            <PlusIcon size={16} />
            {t("decks.edit.addCard")}
          </button>

          <p className="section-label" style={{ marginTop: 18 }}>
            {t("decks.guide")}
          </p>
          {guide.map((section, index) => (
            <div key={index} className="card deck-guide-section">
              <input
                value={section.title}
                maxLength={120}
                placeholder={t("decks.edit.sectionTitle")}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setGuide((current) =>
                    current.map((item, i) => (i === index ? { ...item, title: value } : item)),
                  );
                }}
              />
              <textarea
                value={section.body}
                maxLength={4000}
                rows={4}
                placeholder={t("decks.edit.sectionBody")}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setGuide((current) =>
                    current.map((item, i) => (i === index ? { ...item, body: value } : item)),
                  );
                }}
              />
              <button
                className="btn btn--outline"
                onClick={() => setGuide((current) => current.filter((_, i) => i !== index))}
              >
                <TrashIcon size={14} />
                {t("common.remove")}
              </button>
            </div>
          ))}
          <button
            className="btn btn--outline btn--block"
            disabled={guide.length >= 20}
            onClick={() => setGuide((current) => [...current, { title: "", body: "" }])}
          >
            <PlusIcon size={16} />
            {t("decks.edit.addSection")}
          </button>

          <p className="section-label" style={{ marginTop: 18 }}>
            {t("decks.matchups")}
          </p>
          {matchups.map((matchup, index) => (
            <div key={index} className="card deck-matchup-edit">
              <input
                value={matchup.name}
                maxLength={120}
                placeholder={t("decks.edit.matchupName")}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setMatchups((current) =>
                    current.map((item, i) => (i === index ? { ...item, name: value } : item)),
                  );
                }}
              />
              <div className="chip-row" style={{ flexWrap: "wrap", marginBottom: 0 }}>
                {MATCHUP_RATINGS.map((rating) => (
                  <button
                    key={rating}
                    className={`chip-filter${matchup.rating === rating ? " chip-filter--active" : ""}`}
                    onClick={() =>
                      setMatchups((current) =>
                        current.map((item, i) => (i === index ? { ...item, rating } : item)),
                      )
                    }
                  >
                    {t(`decks.matchup.${rating}`)}
                  </button>
                ))}
                <button
                  className="btn btn--outline"
                  onClick={() => setMatchups((current) => current.filter((_, i) => i !== index))}
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            </div>
          ))}
          <button
            className="btn btn--outline btn--block"
            disabled={matchups.length >= 40}
            onClick={() =>
              setMatchups((current) => [...current, { name: "", rating: "even" }])
            }
          >
            <PlusIcon size={16} />
            {t("decks.edit.addMatchup")}
          </button>

          <label className="field" style={{ marginTop: 18 }}>
            <span className="field__label">{t("decks.notes")}</span>
            <textarea
              value={notes}
              maxLength={4000}
              rows={3}
              placeholder={t("decks.edit.notesPlaceholder")}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button
            className="btn btn--grad btn--block"
            style={{ marginTop: 14 }}
            disabled={saving || name.trim().length === 0}
            onClick={save}
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </>
      )}

      {picking && currentZone && loaded.data && (
        <DeckCardPickerSheet
          gameSlugOrId={game.data?.slug ?? loaded.data.gameId ?? ""}
          zoneLabel={t(`decks.zones.${currentZone.key}`)}
          onPick={addPicked}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
