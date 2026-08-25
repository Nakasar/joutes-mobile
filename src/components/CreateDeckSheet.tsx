import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createDeck } from "../api/decks";
import { listGames } from "../api/games";
import type { DeckVisibility } from "../api/types";
import { DECK_VISIBILITIES } from "../api/types";
import { useApi } from "../hooks/useApi";
import { StatusView } from "./StatusView";

/**
 * Créer un deck : le strict nécessaire pour qu'il existe — un nom et un jeu.
 *
 * Tout le reste (contenu, guide, confrontations) s'ajoute ensuite sur sa fiche.
 * Demander ici une liste de cartes ferait de la création un formulaire, alors
 * que c'est un geste : on nomme le deck, puis on le construit.
 *
 * La visibilité par défaut est « privé », comme côté serveur : publier est une
 * décision, pas un état initial.
 */
export function CreateDeckSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const games = useApi(() => listGames(), []);

  const [name, setName] = useState("");
  const [gameId, setGameId] = useState("");
  const [visibility, setVisibility] = useState<DeckVisibility>("private");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || !gameId) return;

    setSaving(true);
    setError(null);
    try {
      const deck = await createDeck({ name: trimmed, gameId, visibility });
      // On ouvre le deck qu'on vient de créer : c'est là qu'on va le
      // construire. Recharger la liste qu'on quitte ne servirait personne — elle
      // se relit d'elle-même au retour.
      onClose();
      navigate(`/decks/${deck.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setSaving(false);
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("decks.create.title")}</h2>

          <StatusView loading={games.loading} error={games.error} onRetry={games.reload} />

          <label className="field">
            <span className="field__label">{t("decks.create.name")}</span>
            <input
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder={t("decks.create.namePlaceholder")}
            />
          </label>

          <label className="field">
            <span className="field__label">{t("decks.create.game")}</span>
            <select value={gameId} onChange={(e) => setGameId(e.currentTarget.value)}>
              <option value="">{t("decks.create.gamePlaceholder")}</option>
              {(games.data ?? []).map((game) => (
                <option key={game._id} value={game._id}>
                  {game.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">{t("decks.create.visibility")}</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.currentTarget.value as DeckVisibility)}
            >
              {DECK_VISIBILITIES.map((value) => (
                <option key={value} value={value}>
                  {t(`decks.visibility.${value}.label`)}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">{t(`decks.visibility.${visibility}.hint`)}</p>

          {error && <p className="form-error">{error}</p>}

          <button
            className="btn btn--grad btn--block"
            style={{ marginTop: 10 }}
            disabled={saving || name.trim().length === 0 || !gameId}
            onClick={submit}
          >
            {saving ? t("common.saving") : t("decks.create.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
