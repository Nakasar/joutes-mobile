import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { VoteTally, VoteType } from "../api/types";
import { ThumbDownIcon, ThumbUpIcon } from "./icons";

/**
 * Applique localement le basculement du vote, pour afficher le nouveau
 * décompte sans attendre la réponse : revoter à l'identique retire le vote,
 * voter dans l'autre sens le déplace.
 */
function applyVote(tally: VoteTally, vote: VoteType): VoteTally {
  const counts = {
    positive: tally.positive ?? 0,
    negative: tally.negative ?? 0,
  };
  if (tally.userVote) counts[tally.userVote] -= 1;
  const userVote = tally.userVote === vote ? undefined : vote;
  if (userVote) counts[userVote] += 1;
  return { ...counts, userVote };
}

/**
 * Votes 👍 / 👎 sur un contenu communautaire (errata, policy). Le décompte est
 * mis à jour de façon optimiste puis remplacé par celui du serveur, qui fait
 * foi — deux appareils peuvent voter en parallèle.
 */
export function VoteButtons({
  votes,
  canVote,
  submitVote,
}: {
  votes?: VoteTally;
  /** Hors session : les boutons restent lisibles mais inactifs. */
  canVote: boolean;
  submitVote: (vote: VoteType) => Promise<VoteTally>;
}) {
  const { t } = useTranslation();
  const [tally, setTally] = useState<VoteTally>(votes ?? {});
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  // Le parent peut recharger le contenu (retour d'écran, création d'un errata) :
  // le décompte du serveur reprend alors la main sur l'état local.
  useEffect(() => setTally(votes ?? {}), [votes]);

  function vote(next: VoteType) {
    if (!canVote || pending) return;
    const previous = tally;
    setTally(applyVote(tally, next));
    setPending(true);
    setFailed(false);
    submitVote(next)
      .then(setTally)
      .catch(() => {
        setTally(previous);
        setFailed(true);
      })
      .finally(() => setPending(false));
  }

  return (
    <div className="vote-buttons">
      <button
        type="button"
        className={`vote-button${tally.userVote === "positive" ? " vote-button--on" : ""}`}
        onClick={() => vote("positive")}
        disabled={!canVote || pending}
        aria-pressed={tally.userVote === "positive"}
        aria-label={t("votes.upAction")}
      >
        <ThumbUpIcon size={16} filled={tally.userVote === "positive"} />
        {tally.positive ?? 0}
      </button>
      <button
        type="button"
        className={`vote-button${tally.userVote === "negative" ? " vote-button--on vote-button--down" : ""}`}
        onClick={() => vote("negative")}
        disabled={!canVote || pending}
        aria-pressed={tally.userVote === "negative"}
        aria-label={t("votes.downAction")}
      >
        <ThumbDownIcon size={16} filled={tally.userVote === "negative"} />
        {tally.negative ?? 0}
      </button>
      {failed && <span className="vote-buttons__error">{t("votes.error")}</span>}
      {!canVote && <span className="vote-buttons__hint">{t("votes.signInHint")}</span>}
    </div>
  );
}
