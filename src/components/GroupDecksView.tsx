import { useState } from "react";
import { useTranslation } from "react-i18next";
import { listGroupDecks, removeGroupDeck } from "../api/play-group-game";
import type { PlayGroupDeck } from "../api/types";
import { useApi } from "../hooks/useApi";
import { AddGroupDecksSheet } from "./AddGroupDecksSheet";
import { DeckRow } from "./DeckRow";
import { PlusIcon, TrashIcon } from "./icons";
import { StatusView } from "./StatusView";

/**
 * La bibliothèque de decks du groupe : les decks que les membres y ont
 * partagés, épinglés d'abord. Un deck s'ouvre sur sa fiche, avec le fil du
 * groupe (`?groupe=`), et un deck privé partagé ici reste lisible des membres.
 *
 * Le filtre par membre suffit au pouce : le site garde ceux par légende,
 * domaine et carte jouée.
 */
export function GroupDecksView({
  groupId,
  userId,
  members,
}: {
  groupId: string;
  userId: string | null;
  members: { userId: string; name: string }[];
}) {
  const { t } = useTranslation();
  const [member, setMember] = useState<string | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // La bibliothèque entière, filtrée ici : les pastilles des auteurs et les
  // decks déjà partagés se lisent sur toute la liste, pas sur le filtre en
  // cours — sinon choisir un membre ferait disparaître les autres pastilles.
  const decks = useApi(() => listGroupDecks(groupId), [groupId]);
  const all = decks.data ?? [];
  const shown = member === undefined ? all : all.filter((link) => link.ownerId === member);
  const nameOf = (id: string) => members.find((entry) => entry.userId === id)?.name ?? "";
  const owners = members.filter((entry) => all.some((link) => link.ownerId === entry.userId));

  async function remove(link: PlayGroupDeck) {
    setRemoving(link.deckId);
    setError(null);
    try {
      await removeGroupDeck(groupId, link.deckId);
      decks.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <>
      <button className="btn btn--grad btn--block" style={{ marginBottom: 14 }} onClick={() => setAdding(true)}>
        <PlusIcon size={16} />
        {t("social.groupDecks.add")}
      </button>

      {(owners.length > 1 || member !== undefined) && (
        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button
            className={`chip-filter${member === undefined ? " chip-filter--active" : ""}`}
            onClick={() => setMember(undefined)}
          >
            {t("social.groupDecks.allMembers")}
          </button>
          {owners.map((owner) => (
            <button
              key={owner.userId}
              className={`chip-filter${member === owner.userId ? " chip-filter--active" : ""}`}
              onClick={() => setMember(owner.userId)}
            >
              {owner.userId === userId ? t("social.groupGame.you") : owner.name}
            </button>
          ))}
        </div>
      )}

      <StatusView
        loading={decks.loading}
        error={decks.error}
        onRetry={decks.reload}
        empty={decks.data && shown.length === 0 ? t("social.groupDecks.empty") : undefined}
      />
      {error && <p className="form-error">{error}</p>}

      {shown.map((link) => {
        const owner = link.ownerId === userId ? t("social.groupGame.you") : nameOf(link.ownerId);
        const note = [
          t("social.groupDecks.by", { name: owner }),
          link.pinnedAt
            ? link.pinNote
              ? t("social.groupDecks.pinnedNote", { note: link.pinNote })
              : t("social.groupDecks.pinned")
            : undefined,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <div key={link.deckId} className="group-deck">
            <DeckRow
              deck={{ ...link.deck, id: link.deckId }}
              to={`/decks/${link.deckId}?groupe=${encodeURIComponent(groupId)}&tab=comments`}
              note={note}
            />
            {link.canRemove && (
              <button
                className="group-deck__remove"
                aria-label={t("social.groupDecks.remove")}
                disabled={removing === link.deckId}
                onClick={() => remove(link)}
              >
                <TrashIcon size={15} />
              </button>
            )}
          </div>
        );
      })}

      {adding && (
        <AddGroupDecksSheet
          groupId={groupId}
          alreadyIn={new Set(all.map((link) => link.deckId))}
          onClose={() => setAdding(false)}
          onAdded={(done) => {
            if (done) setAdding(false);
            decks.reload();
          }}
        />
      )}
    </>
  );
}
