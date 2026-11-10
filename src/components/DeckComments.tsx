import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  deleteDeckComment,
  getDeckComments,
  postDeckComment,
  resolveDeckComment,
} from "../api/play-group-game";
import type { DeckComment, DeckCommentsResponse } from "../api/types";
import { currentLocale } from "../i18n";
import type { DeckCardInfo } from "../lib/deck-contents";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { DeckCommentCardsSheet } from "./DeckCommentCardsSheet";
import { CheckIcon, TrashIcon } from "./icons";
import { StatusView } from "./StatusView";
import { deckCommentErrorMessage } from "../lib/deck-comment-errors";

const MAX_BODY = 2000;

/**
 * Le fil de commentaires d'un deck dans un espace : celui d'un groupe (tout
 * membre lit et écrit) ou l'espace personnel de l'auteur.
 *
 * Un commentaire peut viser des cartes du deck ; une carte retirée depuis
 * reste nommée, barrée. Les réponses tiennent sur un niveau, les commentaires
 * résolus se replient. Ouvrir le fil le marque lu.
 */
export function DeckComments({
  deckId,
  space,
  spaceLabel,
  cardIds,
  cardsById,
}: {
  deckId: string;
  space: string;
  spaceLabel: string;
  cardIds: string[];
  cardsById: Map<string, DeckCardInfo>;
}) {
  const { t } = useTranslation();
  const [thread, setThread] = useState<DeckCommentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [body, setBody] = useState("");
  const [linked, setLinked] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Le premier chargement marque le fil lu ; les suivants (après une
    // écriture) n'en ont pas besoin, poster le marque déjà.
    getDeckComments(deckId, space, tick === 0)
      .then((data) => {
        if (!cancelled) setThread(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(deckCommentErrorMessage(err, t));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deckId, space, tick, t]);

  const reload = () => setTick((value) => value + 1);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      reload();
      return true;
    } catch (err: unknown) {
      setActionError(deckCommentErrorMessage(err, t));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const ok = await run(() => postDeckComment(deckId, { space, body: body.trim(), cardIds: linked }));
    if (ok) {
      setBody("");
      setLinked([]);
    }
  }

  async function reply(parentId: string) {
    const ok = await run(() => postDeckComment(deckId, { space, body: replyBody.trim(), parentId }));
    if (ok) {
      setReplyBody("");
      setReplyTo(null);
    }
  }

  const comments = thread?.comments ?? [];
  const open = comments.filter((comment) => !comment.resolvedAt);
  const resolved = comments.filter((comment) => comment.resolvedAt);

  const item = (comment: DeckComment, isReply = false) => (
    <CommentItem
      key={comment.id}
      comment={comment}
      thread={thread as DeckCommentsResponse}
      isReply={isReply}
      busy={busy}
      onReply={isReply ? undefined : () => setReplyTo(replyTo === comment.id ? null : comment.id)}
      onResolve={() => run(() => resolveDeckComment(deckId, comment.id, !comment.resolvedAt))}
      onDelete={() => run(() => deleteDeckComment(deckId, comment.id))}
    >
      {comment.replies?.map((child) => item(child, true))}
      {replyTo === comment.id && (
        <div className="comment-compose comment-compose--reply">
          <textarea
            rows={2}
            maxLength={MAX_BODY}
            value={replyBody}
            placeholder={t("decks.comments.replyPlaceholder")}
            onChange={(event) => setReplyBody(event.currentTarget.value)}
          />
          <button className="btn btn--grad" disabled={busy || !replyBody.trim()} onClick={() => reply(comment.id)}>
            {t("decks.comments.send")}
          </button>
        </div>
      )}
    </CommentItem>
  );

  return (
    <>
      <p className="muted" style={{ marginBottom: 10 }}>
        {t("decks.comments.space", { space: spaceLabel })}
      </p>

      <div className="card comment-compose">
        <textarea
          rows={3}
          maxLength={MAX_BODY}
          value={body}
          placeholder={t("decks.comments.placeholder")}
          onChange={(event) => setBody(event.currentTarget.value)}
        />
        {linked.length > 0 && (
          <div className="chip-set">
            {linked.map((id) => (
              <span key={id} className="chip chip--accent">
                {cardsById.get(id)?.name ?? id}
              </span>
            ))}
          </div>
        )}
        <div className="comment-compose__actions">
          <button className="btn btn--outline" disabled={cardIds.length === 0} onClick={() => setPicking(true)}>
            {linked.length > 0
              ? t("decks.comments.cardsLinked", { count: linked.length })
              : t("decks.comments.linkCards")}
          </button>
          <button className="btn btn--grad" disabled={busy || !body.trim()} onClick={send}>
            {t("decks.comments.send")}
          </button>
        </div>
      </div>

      {actionError && <p className="form-error">{actionError}</p>}
      <StatusView
        loading={loading && !thread}
        error={error}
        onRetry={reload}
        empty={thread && comments.length === 0 ? t("decks.comments.empty") : undefined}
      />

      {open.map((comment) => item(comment))}

      {resolved.length > 0 && (
        <>
          <button className="btn btn--outline btn--block" onClick={() => setShowResolved((value) => !value)}>
            {showResolved
              ? t("decks.comments.hideResolved")
              : t("decks.comments.showResolved", { count: resolved.length })}
          </button>
          {showResolved && resolved.map((comment) => item(comment))}
        </>
      )}

      {picking && (
        <DeckCommentCardsSheet
          cardIds={cardIds}
          cardsById={cardsById}
          initial={linked}
          onDone={(ids) => {
            setLinked(ids);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

function CommentItem({
  comment,
  thread,
  isReply,
  busy,
  onReply,
  onResolve,
  onDelete,
  children,
}: {
  comment: DeckComment;
  thread: DeckCommentsResponse;
  isReply: boolean;
  busy: boolean;
  onReply?: () => void;
  onResolve: () => void;
  onDelete: () => void;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const author = thread.authors[comment.authorId];
  const name = author?.name ?? t("social.friendDefault");
  const unread = Boolean(thread.lastReadAt && comment.createdAt > thread.lastReadAt);
  const when = new Date(comment.createdAt).toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const older = comment.deckVersion < thread.deckVersion;

  return (
    <div className={`${isReply ? "comment comment--reply" : "card comment"}${comment.resolvedAt ? " comment--resolved" : ""}`}>
      <div className="comment__head">
        {author?.avatar ? (
          <img src={author.avatar} alt="" className="avatar avatar--xs" loading="lazy" />
        ) : (
          <span className="avatar avatar--xs" style={tintStyle(colorFor(comment.authorId))}>
            {initialOf(name)}
          </span>
        )}
        <span className="comment__author">{name}</span>
        <span className="muted comment__when">{when}</span>
        {unread && <span className="chip chip--accent">{t("decks.comments.new")}</span>}
        {older && !isReply && <span className="chip">v{comment.deckVersion}</span>}
      </div>

      {comment.deleted ? (
        <p className="muted">{t("decks.comments.deleted")}</p>
      ) : (
        <p className="comment__body">{comment.body}</p>
      )}

      {comment.cards.length > 0 && (
        <div className="chip-set">
          {comment.cards.map((card) => (
            <span key={card.id} className={`chip${card.removed ? " comment__card--removed" : ""}`}>
              {card.name}
            </span>
          ))}
        </div>
      )}

      {comment.resolvedAt && (
        <p className="muted comment__resolved">
          <CheckIcon size={13} />
          {comment.resolvedVersion
            ? t("decks.comments.resolvedIn", { version: comment.resolvedVersion })
            : t("decks.comments.resolved")}
        </p>
      )}

      {!comment.deleted && (
        <div className="comment__actions">
          {onReply && (
            <button className="link-btn" onClick={onReply}>
              {t("decks.comments.reply")}
            </button>
          )}
          {!isReply && comment.permissions.canResolve && (
            <button className="link-btn" disabled={busy} onClick={onResolve}>
              {comment.resolvedAt ? t("decks.comments.reopen") : t("decks.comments.resolve")}
            </button>
          )}
          {comment.permissions.canDelete && (
            <button className="link-btn link-btn--danger" disabled={busy} onClick={onDelete} aria-label={t("decks.comments.delete")}>
              <TrashIcon size={13} />
            </button>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
