import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { deleteDeck, getDeck, getDeckCards, updateDeck } from "../api/decks";
import { getOwnershipByName } from "../api/collection";
import { getGame } from "../api/games";
import { ApiError } from "../api/client";
import type { Deck, DeckGuideSection, DeckMatchup, DeckVisibility } from "../api/types";
import { CardDetailModal } from "../components/CardDetailModal";
import { DeckLegalityBadge, DeckSizeLabel } from "../components/DeckBadges";
import { DeckVisibilitySheet } from "../components/DeckVisibilitySheet";
import { StatusView } from "../components/StatusView";
import {
  BackIcon,
  GridIcon,
  ImageIcon,
  ListIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  ShareIcon,
  TrashIcon,
} from "../components/icons";
import { DeckCardActionsSheet } from "../components/deck-editor/DeckCardActionsSheet";
import { DeckCatalogSheet, type DeckCatalogAdd } from "../components/deck-editor/DeckCatalogSheet";
import { DeckCoverSheet } from "../components/deck-editor/DeckCoverSheet";
import { DeckEditorAnalysis } from "../components/deck-editor/DeckEditorAnalysis";
import { DeckEditorInfos } from "../components/deck-editor/DeckEditorInfos";
import { DeckEditorText } from "../components/deck-editor/DeckEditorText";
import {
  DeckEditorZones,
  type DeckEditorCardState,
  type DeckEditorView,
} from "../components/deck-editor/DeckEditorZones";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../store/auth";
import {
  changeCardQuantity,
  collectionCoverage,
  deckCardIds,
  deckNeeds,
  deckSize,
  moveCard,
  zoneCount,
  zoneEntries,
  type DeckCardInfo,
  type DeckCards,
} from "../lib/deck-contents";
import { deckCoverCandidates, resolveDeckCover } from "../lib/deck-cover";
import { zonesForDeck } from "../lib/deck-extra-legends";
import {
  AUTO_ZONE,
  routeCardToZone,
  zoneHoldingCard,
  type DeckTargetZone,
} from "../lib/deck-routing";
import { stringifyDeckText } from "../lib/deck-text";
import { getDeckZones, type DeckZone, type DeckZoneKey } from "../lib/deck-zones";

type EditorTab = "cards" | "text" | "analysis" | "infos";
const TABS: EditorTab[] = ["cards", "text", "analysis", "infos"];

/** Zones dont les cartes échappent au plafond d'exemplaires : elles ont leur propre règle. */
const COPY_LIMIT_EXEMPT: DeckZoneKey[] = ["runes", "legend", "battlefields"];

/** Plafond d'exemplaires d'un jeu qui ne le règle pas dans l'administration. */
const COPY_LIMITS: Record<string, number> = { riftbound: 3 };

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
 * L'édition d'un deck sur téléphone, alignée sur l'éditeur du site.
 *
 * Les trois colonnes du site deviennent quatre onglets : « Cartes » (toutes les
 * zones, en grille ou en liste), « Texte » (la liste à recopier ou à coller),
 * « Analyse » (statistiques, légalité, collection, version) et « Infos » (ce
 * que seul l'app édite ici : format, description, guide, confrontations,
 * notes). Le catalogue s'ouvre en feuille et reste ouvert pour enchaîner les
 * ajouts. La barre d'onglets de l'app est masquée : sa place revient à
 * « Ajouter des cartes » et « Enregistrer ».
 *
 * Tout vit en mémoire jusqu'à « Enregistrer », sauf la visibilité, enregistrée
 * aussitôt comme sur le site.
 *
 * **Concurrence** : l'écran renvoie `expectedVersion` — la version lue au
 * chargement, puis celle que le serveur rend à chaque écriture. Un
 * enregistrement parti d'un état devancé ne s'applique pas : le serveur rend un
 * `409` portant l'état frais, la saisie reste à l'écran, et la version fraîche
 * est adoptée pour qu'un second enregistrement impose la sienne — délibérément.
 */
export function DeckEditScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { deckId = "" } = useParams();

  const loaded = useApi(() => getDeck(deckId), [deckId]);

  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState("");
  const [notes, setNotes] = useState("");
  const [cards, setCards] = useState<DeckCards>({});
  const [guide, setGuide] = useState<DeckGuideSection[]>([]);
  const [matchups, setMatchups] = useState<DeckMatchup[]>([]);
  /** La carte désignée pour la couverture ; `null` = aucune (la légende prend le relais). */
  const [coverCardId, setCoverCardId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<DeckVisibility | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [tab, setTab] = useState<EditorTab>("cards");
  const [view, setView] = useState<DeckEditorView>("grid");
  const [target, setTarget] = useState<DeckTargetZone>(AUTO_ZONE);
  const [catalogFrom, setCatalogFrom] = useState<number | null>(null);
  const [actionsFor, setActionsFor] = useState<{ zone: DeckZoneKey; cardId: string } | null>(null);
  const [viewing, setViewing] = useState<DeckCardInfo | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  /**
   * La version serveur, telle qu'on l'a lue — puis telle que le serveur la
   * renvoie à chaque écriture, visibilité comprise.
   */
  const versionRef = useRef(1);

  // Le formulaire ne se remplit qu'une fois **par deck** : le recopier à chaque
  // rafraîchissement effacerait la saisie en cours, et `/decks/:deckId/edit`
  // est une seule route — React Router ne remonte pas l'écran quand seul le
  // paramètre change. D'où la mémoire de *quel* deck l'a rempli.
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
    setCoverCardId(deck.coverCardId ?? null);
    setVisibility(deck.visibility);
    setSavedAt(deck.updatedAt ? new Date(deck.updatedAt) : null);
    setDirty(false);
    versionRef.current = deck.version ?? 1;
    setHydratedFor(deck.id);
  }, [loaded.data, hydratedFor]);

  const hydrated = hydratedFor !== null && hydratedFor === loaded.data?.id;

  const game = useApi(
    () => (loaded.data?.gameId ? getGame(loaded.data.gameId) : Promise.resolve(null)),
    [loaded.data?.gameId],
  );
  const gameSlug = game.data?.slug ?? loaded.data?.gameId ?? "";
  const gameZones = useMemo(() => getDeckZones(game.data), [game.data]);
  // Les zones du jeu, ajustées au deck en cours : Neeko demande trois légendes de plus.
  const zones = useMemo(() => zonesForDeck(gameZones, cards), [gameZones, cards]);
  const copyLimit = game.data?.deckBuilder?.maxCopies ?? (game.data?.slug ? COPY_LIMITS[game.data.slug] : undefined);

  // --- Le catalogue connu : ce que contenait le deck, plus ce que la recherche
  //     et la liste collée ont fait passer. Une carte ajoutée s'affiche avec son
  //     illustration sans attendre un rechargement.
  const [known, setKnown] = useState<Map<string, DeckCardInfo>>(new Map());
  const initialIds = useMemo(() => deckCardIds(loaded.data?.cards), [loaded.data?.cards]);
  const initialCatalog = useApi(
    () =>
      loaded.data?.gameId && initialIds.length > 0
        ? getDeckCards(loaded.data.gameId, initialIds)
        : Promise.resolve<DeckCardInfo[]>([]),
    [loaded.data?.gameId, initialIds.join(",")],
  );

  // --- Exemplaires possédés, par nom : la collection se compte toutes
  //     impressions confondues, comme sur le site.
  const [ownedByName, setOwnedByName] = useState<Map<string, number>>(new Map());
  const [hasCollection, setHasCollection] = useState(false);
  const requestedNames = useRef(new Set<string>());

  const loadOwnership = useCallback(
    (infos: DeckCardInfo[]) => {
      if (!user || !gameSlug) return;
      const names = [...new Set(infos.map((card) => card.name))].filter(
        (cardName) => cardName && !requestedNames.current.has(cardName),
      );
      if (names.length === 0) return;
      for (const cardName of names) requestedNames.current.add(cardName);
      getOwnershipByName(gameSlug, names)
        .then((owned) => {
          setHasCollection(true);
          setOwnedByName((current) => new Map([...current, ...owned]));
        })
        .catch(() => {
          // Une prochaine recherche retentera ces noms ; sans réponse, l'écran
          // se passe simplement des pastilles.
          for (const cardName of names) requestedNames.current.delete(cardName);
        });
    },
    [user, gameSlug],
  );

  const learnCards = useCallback(
    (infos: DeckCardInfo[]) => {
      if (infos.length === 0) return;
      setKnown((current) => {
        const next = new Map(current);
        for (const card of infos) next.set(card.id, card);
        return next;
      });
      loadOwnership(infos);
    },
    [loadOwnership],
  );

  useEffect(() => {
    if (initialCatalog.data) learnCards(initialCatalog.data);
  }, [initialCatalog.data, learnCards]);

  const ownedByCardId = useMemo(() => {
    if (!hasCollection) return undefined;
    const byId = new Map<string, number>();
    for (const card of known.values()) {
      const owned = ownedByName.get(card.name);
      if (owned !== undefined) byId.set(card.id, owned);
    }
    return byId;
  }, [hasCollection, known, ownedByName]);

  // --- Garde de sortie : une modification non enregistrée ne part pas en
  //     silence avec un retour arrière du système.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const edit = useCallback((change: (current: DeckCards) => DeckCards) => {
    setCards(change);
    setDirty(true);
  }, []);

  const needs = useMemo(() => deckNeeds(cards, zones), [cards, zones]);

  /** Exemplaires de la carte qui comptent pour le plafond. */
  const limitedCopies = useCallback(
    (cardId: string) =>
      zones
        .filter((zone) => !COPY_LIMIT_EXEMPT.includes(zone.key))
        .reduce(
          (sum, zone) => sum + (zoneEntries(cards, zone.key).find((entry) => entry.cardId === cardId)?.quantity ?? 0),
          0,
        ),
    [cards, zones],
  );

  /** Pourquoi un exemplaire de plus ne peut pas entrer dans la zone ; `null` s'il le peut. */
  const refusal = useCallback(
    (zone: DeckZone, cardId: string): string | null => {
      if (zone.max !== undefined && zoneCount(cards, zone.key) >= zone.max) {
        return t("decks.editor.zoneFullNamed", { zone: t(`decks.zones.${zone.key}`), count: zone.max });
      }
      if (copyLimit !== undefined && !COPY_LIMIT_EXEMPT.includes(zone.key) && limitedCopies(cardId) >= copyLimit) {
        return t("decks.editor.copyLimit", { count: copyLimit });
      }
      return null;
    },
    [cards, copyLimit, limitedCopies, t],
  );

  const stateOf = useCallback(
    (zoneKey: DeckZoneKey, cardId: string): DeckEditorCardState => {
      const zone = zones.find((entry) => entry.key === zoneKey);
      return {
        owned: ownedByCardId?.get(cardId),
        needed: needs.get(cardId) ?? 0,
        canAdd: zone ? refusal(zone, cardId) === null : true,
      };
    },
    [needs, ownedByCardId, refusal, zones],
  );

  function changeQuantity(zone: DeckZoneKey, cardId: string, delta: number) {
    edit((current) => changeCardQuantity(current, zone, cardId, delta));
  }

  function addFromCatalog(card: DeckCardInfo, delta: number): DeckCatalogAdd | null {
    learnCards([card]);
    const key =
      target !== AUTO_ZONE
        ? target
        : delta > 0
          ? routeCardToZone(card, zones, cards)
          : zoneHoldingCard(card, zones, cards);
    if (!key) return null;

    if (delta > 0) {
      const zone = zones.find((entry) => entry.key === key);
      const refused = zone ? refusal(zone, card.id) : null;
      if (refused) return { refused };
    }

    const held = zoneEntries(cards, key).find((entry) => entry.cardId === card.id)?.quantity ?? 0;
    changeQuantity(key, card.id, delta);
    return { zone: key, count: Math.max(0, held + delta) };
  }

  function moveBetweenZones(from: DeckZoneKey, to: DeckZoneKey, cardId: string, quantity?: number) {
    const zone = zones.find((entry) => entry.key === to);
    const room = zone?.max === undefined ? Infinity : Math.max(0, zone.max - zoneCount(cards, to));
    if (room === 0) return;
    edit((current) => moveCard(current, from, to, cardId, quantity, room));
  }

  function openCatalog(zone: DeckTargetZone = target) {
    setTarget(zone);
    setCatalogFrom(deckSize(cards, zones));
  }

  function switchTab(next: EditorTab) {
    if (next === "text" && tab !== "text") {
      // La liste se réécrit depuis le deck en cours à chaque entrée dans
      // l'onglet : celle d'hier oublierait les cartes ajoutées depuis.
      setTextDraft(stringifyDeckText(cards, zones, (cardId) => known.get(cardId)?.name));
    }
    setTab(next);
  }

  async function changeVisibility(next: DeckVisibility) {
    if (next === visibility) return;
    const previous = visibility;
    setVisibility(next);
    setVisibilitySaving(true);
    setVisibilityError(null);
    try {
      const saved = await updateDeck(deckId, { visibility: next });
      versionRef.current = saved.version ?? versionRef.current;
    } catch (err: unknown) {
      setVisibility(previous);
      setVisibilityError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setVisibilitySaving(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await updateDeck(deckId, {
        name: name.trim() || loaded.data?.name || "",
        description,
        format: format.trim() || undefined,
        notes,
        cards,
        // Une section sans titre ne se relit pas : elle est écartée à
        // l'enregistrement plutôt que refusée par le serveur.
        guide: guide.filter((section) => section.title.trim()),
        matchups: matchups.filter((matchup) => matchup.name.trim()),
        // Une chaîne vide retire le choix : le serveur retombe sur la légende.
        coverCardId: coverCardId ?? "",
        expectedVersion: versionRef.current,
      });
      versionRef.current = saved.version ?? versionRef.current;
      setDirty(false);
      setSavedAt(new Date());
    } catch (err: unknown) {
      // Le deck a été enregistré ailleurs — l'autre appareil, ou le site.
      // Rien n'a été écrit : la saisie reste à l'écran, et son auteur décide.
      if (err instanceof ApiError && err.status === 409) {
        const fresh = readConflictVersion(err.body);
        if (fresh !== null) versionRef.current = fresh;
        setError(t("decks.edit.conflict"));
        return;
      }
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await deleteDeck(deckId);
      navigate("/decks", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setSaving(false);
    }
  }

  function leave() {
    if (dirty && !window.confirm(t("decks.editor.leaveUnsaved"))) return;
    navigate(-1);
  }

  const total = deckSize(cards, zones);
  const coverage = ownedByCardId ? collectionCoverage(cards, zones, ownedByCardId) : undefined;
  const cover = resolveDeckCover(
    {
      coverCardId: coverCardId ?? undefined,
      legendCardId: loaded.data?.legendCardId,
      coverImageUrl: loaded.data?.coverImageUrl,
      coverImage: loaded.data?.coverImage,
    },
    known,
  );
  const coverCandidates = deckCoverCandidates(cards, zones);
  const savedLabel = savedAt
    ? t("decks.editor.savedOn", {
        date: new Intl.DateTimeFormat(i18n.language, { dateStyle: "short", timeStyle: "short" }).format(savedAt),
      })
    : undefined;

  const actionZone = actionsFor ? zones.find((zone) => zone.key === actionsFor.zone) : undefined;
  const actionQuantity = actionsFor
    ? (zoneEntries(cards, actionsFor.zone).find((entry) => entry.cardId === actionsFor.cardId)?.quantity ?? 0)
    : 0;

  return (
    <div className="screen deck-editor">
      <header className="deck-editor__head">
        <button className="back-header__button" onClick={leave} aria-label={t("common.back")}>
          <BackIcon size={20} />
        </button>
        <div className="deck-editor__titles">
          {renaming ? (
            <input
              className="deck-editor__name-input"
              autoFocus
              value={name}
              maxLength={100}
              aria-label={t("decks.editor.nameLabel")}
              onChange={(e) => {
                setName(e.currentTarget.value);
                setDirty(true);
              }}
              onBlur={() => setRenaming(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") setRenaming(false);
              }}
            />
          ) : (
            <button
              className="deck-editor__name"
              onClick={() => setRenaming(true)}
              aria-label={t("decks.editor.rename", { name })}
              disabled={!hydrated}
            >
              <span>{hydrated ? name : t("decks.edit.title")}</span>
              {hydrated && <PencilIcon size={14} />}
            </button>
          )}
          {hydrated && (
            <p className="deck-editor__status">
              {[format.trim() || undefined].filter(Boolean).join("")}
              {format.trim() ? " · " : ""}
              {dirty ? <b>{t("decks.editor.unsaved")}</b> : savedLabel}
              {` · v${versionRef.current}`}
            </p>
          )}
        </div>
        {hydrated && (
          <>
            <button
              className="deck-editor__icon-btn"
              onClick={() => setCoverOpen(true)}
              aria-label={t("decks.cover.title")}
            >
              <ImageIcon size={17} />
            </button>
            <button
              className="deck-editor__icon-btn"
              onClick={() => setShareOpen(true)}
              aria-label={t("decks.editor.share")}
            >
              <ShareIcon size={17} />
            </button>
          </>
        )}
      </header>

      <StatusView
        loading={loaded.loading || game.loading}
        error={loaded.error ?? game.error}
        onRetry={() => {
          loaded.reload();
          game.reload();
        }}
      />

      {hydrated && (
        <>
          <div className="chip-row" style={{ flexWrap: "wrap", marginBottom: 0 }}>
            <DeckSizeLabel cards={cards} zones={zones} />
            <DeckLegalityBadge cards={cards} zones={zones} />
            {visibility && (
              <span className="chip">
                {visibility === "private" && <LockIcon size={11} />}
                {t(`decks.visibility.${visibility}.label`)}
              </span>
            )}
          </div>

          <div className="segmented" role="tablist">
            {TABS.map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className={`segmented__item${tab === key ? " segmented__item--active" : ""}`}
                onClick={() => switchTab(key)}
              >
                {t(`decks.editor.tabs.${key}`)}
              </button>
            ))}
          </div>

          {tab === "cards" && (
            <div className="deck-editor__body">
              <div className="deck-editor__toolbar">
                <div className="segmented" role="radiogroup" aria-label={t("decks.editor.density")}>
                  <button
                    role="radio"
                    aria-checked={view === "grid"}
                    className={`segmented__item${view === "grid" ? " segmented__item--active" : ""}`}
                    onClick={() => setView("grid")}
                  >
                    <GridIcon size={13} />
                    {t("decks.editor.grid")}
                  </button>
                  <button
                    role="radio"
                    aria-checked={view === "list"}
                    className={`segmented__item${view === "list" ? " segmented__item--active" : ""}`}
                    onClick={() => setView("list")}
                  >
                    <ListIcon size={13} />
                    {t("decks.editor.list")}
                  </button>
                </div>
                {coverage && (
                  <span className="muted" style={{ fontSize: 12 }}>
                    {t("decks.editor.ownedSummary", {
                      owned: coverage.owned,
                      total: coverage.owned + coverage.missing,
                    })}
                  </span>
                )}
              </div>
              <DeckEditorZones
                zones={zones}
                cards={cards}
                cardsById={known}
                view={view}
                stateOf={stateOf}
                onChange={changeQuantity}
                onActions={(zone, cardId) => setActionsFor({ zone, cardId })}
                onAddToZone={(zone) => openCatalog(zone)}
              />
            </div>
          )}

          {tab === "text" && (
            <DeckEditorText
              value={textDraft}
              onValueChange={setTextDraft}
              zones={zones}
              gameSlug={gameSlug}
              currentCards={cards}
              onApply={(applied, learned) => {
                learnCards(learned);
                edit(() => applied);
                setTab("cards");
              }}
            />
          )}

          {tab === "analysis" && (
            <div className="deck-editor__body">
              <DeckEditorAnalysis
                cards={cards}
                zones={zones}
                cardsById={known}
                ownedByCardId={ownedByCardId}
                copyLimit={copyLimit}
                version={versionRef.current}
                updatedAt={
                  savedAt ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "short" }).format(savedAt) : undefined
                }
              />
            </div>
          )}

          {tab === "infos" && (
            <DeckEditorInfos
              visibility={visibility}
              visibilitySaving={visibilitySaving}
              visibilityError={visibilityError}
              onVisibility={changeVisibility}
              format={format}
              onFormat={(value) => {
                setFormat(value);
                setDirty(true);
              }}
              description={description}
              onDescription={(value) => {
                setDescription(value);
                setDirty(true);
              }}
              guide={guide}
              onGuide={(update) => {
                setGuide(update);
                setDirty(true);
              }}
              matchups={matchups}
              onMatchups={(update) => {
                setMatchups(update);
                setDirty(true);
              }}
              notes={notes}
              onNotes={(value) => {
                setNotes(value);
                setDirty(true);
              }}
            />
          )}

          {error && <p className="form-error">{error}</p>}

          {tab !== "text" && (
            <div className="deck-editor__bar">
              {tab === "infos" ? (
                <button className="btn btn--danger" disabled={saving} onClick={remove}>
                  <TrashIcon size={16} />
                  {confirmDelete ? t("decks.editor.confirmDelete") : t("decks.editor.delete")}
                </button>
              ) : (
                <button className="btn btn--outline" onClick={() => openCatalog()}>
                  <PlusIcon size={16} />
                  {t("decks.editor.addCards")}
                </button>
              )}
              <button className="btn btn--grad" disabled={saving || !dirty} onClick={save}>
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          )}
        </>
      )}

      {catalogFrom !== null && hydrated && (
        <DeckCatalogSheet
          gameSlug={gameSlug}
          zones={zones}
          target={target}
          onTargetChange={setTarget}
          inDeck={(cardId) => needs.get(cardId) ?? 0}
          onAdd={addFromCatalog}
          onUndo={(zone, cardId) => changeQuantity(zone, cardId, -1)}
          ownedOf={(card) => (hasCollection ? ownedByName.get(card.name) : undefined)}
          onResults={learnCards}
          hasCollection={hasCollection}
          sessionAdded={total - catalogFrom}
          total={total}
          onClose={() => setCatalogFrom(null)}
        />
      )}

      {actionsFor && actionZone && (
        <DeckCardActionsSheet
          card={known.get(actionsFor.cardId)}
          zone={actionZone}
          zones={zones}
          cards={cards}
          quantity={actionQuantity}
          owned={ownedByCardId?.get(actionsFor.cardId)}
          needed={needs.get(actionsFor.cardId) ?? 0}
          canAdd={refusal(actionZone, actionsFor.cardId) === null}
          isCover={coverCardId === actionsFor.cardId}
          onChange={(delta) => {
            changeQuantity(actionsFor.zone, actionsFor.cardId, delta);
            if (actionQuantity + delta <= 0) setActionsFor(null);
          }}
          onMove={(to, quantity) => {
            moveBetweenZones(actionsFor.zone, to, actionsFor.cardId, quantity);
            setActionsFor(null);
          }}
          onCover={() => {
            setCoverCardId(actionsFor.cardId);
            setDirty(true);
            setActionsFor(null);
          }}
          onView={() => {
            const card = known.get(actionsFor.cardId);
            setActionsFor(null);
            if (card) setViewing(card);
          }}
          onClose={() => setActionsFor(null)}
        />
      )}

      {viewing && (
        <CardDetailModal
          gameSlug={gameSlug}
          cardId={viewing.id}
          fallbackName={viewing.name}
          fallbackImage={viewing.image}
          onClose={() => setViewing(null)}
        />
      )}

      {coverOpen && (
        <DeckCoverSheet
          cover={cover}
          candidates={coverCandidates}
          cardsById={known}
          coverCardId={coverCardId}
          onChoose={(cardId) => {
            setCoverCardId(cardId);
            setDirty(true);
          }}
          onClose={() => setCoverOpen(false)}
        />
      )}

      {shareOpen && loaded.data && (
        <DeckVisibilitySheet
          deck={{ ...loaded.data, name, visibility }}
          onSaved={(saved) => {
            setVisibility(saved.visibility);
            versionRef.current = saved.version ?? versionRef.current;
          }}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
