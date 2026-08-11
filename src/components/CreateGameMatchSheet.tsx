import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { createGameMatch } from "../api/game-matches";
import { listGames } from "../api/games";
import { listFriends } from "../api/social";
import type { GameSummary, PublicUser } from "../api/types";
import { useApi } from "../hooks/useApi";
import { userLabel } from "../lib/user-tag";
import { useAuth } from "../store/auth";
import { PlusIcon, TrashIcon } from "./icons";

/** Participant sans compte, tel que le formulaire le tient avant l'envoi. */
type Guest = { id: string; name: string };

/**
 * Identifiant d'invité, à la forme attendue par l'API (`guest_…`).
 *
 * Il est fabriqué ici plutôt que par le serveur parce que le vainqueur se
 * désigne avant l'enregistrement : sans identifiant, un invité ne serait
 * cochable qu'une fois la partie créée.
 */
function newGuestId(): string {
  const suffix = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `guest_${suffix}`;
}

/** Valeur d'un `datetime-local`, qui attend l'heure locale sans fuseau. */
function nowForInput(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * Enregistrement d'une partie jouée hors tournoi.
 *
 * Les adversaires se prennent parmi les amis — c'est la seule liste de comptes
 * que le mobile a sous la main — ou se saisissent comme invités, pour tous ceux
 * qui n'ont pas de compte ou ne sont pas encore amis.
 */
export function CreateGameMatchSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (matchId: string) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const games = useApi(() => listGames(), []);
  const friends = useApi(() => listFriends(), []);

  const [gameId, setGameId] = useState("");
  const [playedAt, setPlayedAt] = useState(nowForInput);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestName, setGuestName] = useState("");
  const [winnerIds, setWinnerIds] = useState<string[]>([]);
  const [scenario, setScenario] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedGames = useMemo(
    () => [...(games.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [games.data],
  );

  const friendById = useMemo(
    () => new Map((friends.data ?? []).map((friend) => [friend.id, friend])),
    [friends.data],
  );

  function friendName(friend: PublicUser): string {
    return userLabel(friend, friend.id);
  }

  // Tout le monde à la table, dans l'ordre où l'API les recevra : le compte
  // qui saisit, les amis cochés, puis les invités.
  const participants = [
    ...(user ? [{ id: user.id, name: t("gameMatches.you") }] : []),
    ...friendIds.map((id) => {
      const friend = friendById.get(id);
      return { id, name: friend ? friendName(friend) : id };
    }),
    ...guests.map((guest) => ({ id: guest.id, name: guest.name })),
  ];

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
  }

  function toggleFriend(id: string) {
    const wasSelected = friendIds.includes(id);
    setFriendIds(toggle(friendIds, id));
    // Un joueur retiré de la table ne peut pas en rester vainqueur.
    if (wasSelected) {
      setWinnerIds((winners) => winners.filter((winner) => winner !== id));
    }
  }

  function addGuest() {
    const name = guestName.trim();
    if (!name) return;
    setGuests((current) => [...current, { id: newGuestId(), name }]);
    setGuestName("");
  }

  function removeGuest(id: string) {
    setGuests((current) => current.filter((guest) => guest.id !== id));
    setWinnerIds((current) => current.filter((winner) => winner !== id));
  }

  function submit() {
    if (!gameId || saving) return;
    setSaving(true);
    setError(null);

    const trimmedScenario = scenario.trim();
    const trimmedNotes = notes.trim();
    const battleReport =
      trimmedScenario || trimmedNotes
        ? {
            ...(trimmedScenario ? { scenario: trimmedScenario } : {}),
            ...(trimmedNotes ? { notes: trimmedNotes } : {}),
          }
        : undefined;

    createGameMatch({
      gameId,
      // Saisi en heure locale : il faut le rendre absolu avant de l'envoyer.
      playedAt: new Date(playedAt).toISOString(),
      ...(friendIds.length > 0 ? { playerIds: friendIds } : {}),
      ...(guests.length > 0 ? { guests } : {}),
      ...(winnerIds.length > 0 ? { winnerIds } : {}),
      ...(battleReport ? { battleReport } : {}),
    })
      .then((match) => {
        onClose();
        onCreated(match.id);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => setSaving(false));
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("gameMatches.createTitle")}</h2>

          <label className="field">
            <span className="field__label">{t("gameMatches.gameLabel")}</span>
            <select value={gameId} onChange={(e) => setGameId(e.currentTarget.value)}>
              <option value="">{t("gameMatches.gamePlaceholder")}</option>
              {sortedGames.map((game: GameSummary) => (
                <option key={game._id} value={game._id}>
                  {game.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">{t("gameMatches.dateLabel")}</span>
            <input
              type="datetime-local"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.currentTarget.value)}
            />
          </label>

          {(friends.data ?? []).length > 0 && (
            <div className="field">
              <span className="field__label">{t("gameMatches.friendsLabel")}</span>
              <div className="chip-set">
                {(friends.data ?? []).map((friend) => (
                  <button
                    key={friend.id}
                    type="button"
                    className={`chip-filter${friendIds.includes(friend.id) ? " chip-filter--active" : ""}`}
                    onClick={() => toggleFriend(friend.id)}
                  >
                    {friendName(friend)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <span className="field__label">{t("gameMatches.guestsLabel")}</span>
            {guests.map((guest) => (
              <div key={guest.id} className="chip-set">
                <span className="chip">{guest.name}</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("gameMatches.removeGuest", { name: guest.name })}
                  onClick={() => removeGuest(guest.id)}
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            ))}
            <div className="chip-set">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.currentTarget.value)}
                placeholder={t("gameMatches.guestPlaceholder")}
                maxLength={60}
                style={{ flex: 1, minWidth: 0 }}
              />
              <button
                type="button"
                className="btn btn--outline"
                onClick={addGuest}
                disabled={guestName.trim().length === 0}
              >
                <PlusIcon size={16} />
                {t("gameMatches.addGuest")}
              </button>
            </div>
          </div>

          <div className="field">
            <span className="field__label">{t("gameMatches.winnersLabel")}</span>
            <div className="chip-set">
              {participants.map((participant) => (
                <button
                  key={participant.id}
                  type="button"
                  className={`chip-filter${winnerIds.includes(participant.id) ? " chip-filter--active" : ""}`}
                  onClick={() => setWinnerIds((current) => toggle(current, participant.id))}
                >
                  {participant.name}
                </button>
              ))}
            </div>
          </div>

          {/* Facultatif, et c'est volontaire : une partie peut se noter en deux
              touches. Renseigner l'un ou l'autre en fait un rapport de bataille. */}
          <label className="field">
            <span className="field__label">{t("gameMatches.scenarioLabel")}</span>
            <input
              type="text"
              value={scenario}
              onChange={(e) => setScenario(e.currentTarget.value)}
              placeholder={t("gameMatches.scenarioPlaceholder")}
              maxLength={200}
            />
          </label>

          <label className="field">
            <span className="field__label">{t("gameMatches.notesLabel")}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              placeholder={t("gameMatches.notesPlaceholder")}
              rows={4}
              maxLength={10000}
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button
            className="btn btn--grad btn--block"
            onClick={submit}
            disabled={saving || gameId.length === 0}
          >
            {saving ? t("common.saving") : t("gameMatches.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
