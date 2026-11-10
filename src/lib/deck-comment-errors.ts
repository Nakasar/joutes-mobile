import { ApiError } from "../api/client";

/**
 * Message lisible pour une erreur de la route des commentaires d'un deck.
 * Le serveur répond par un code (`{ error: "FORBIDDEN" }`, voir
 * `commentErrorStatus` côté web) : sans cette table, l'écran l'afficherait tel
 * quel. Une erreur réseau garde son propre message, déjà traduit.
 */
export function deckCommentErrorMessage(err: unknown, t: (key: string) => string): string {
  if (!(err instanceof ApiError)) return t("common.error");
  if (err.status === 0) return err.message;
  switch (err.message) {
    case "UNAUTHENTICATED":
      return t("decks.comments.errors.unauthenticated");
    case "FORBIDDEN":
      return t("decks.comments.errors.forbidden");
    case "NOT_FOUND":
      return t("decks.comments.errors.notFound");
    case "EMPTY":
      return t("decks.comments.errors.empty");
    case "TOO_LONG":
      return t("decks.comments.errors.tooLong");
    case "TOO_MANY_CARDS":
      return t("decks.comments.errors.tooManyCards");
    case "CARD_NOT_IN_DECK":
      return t("decks.comments.errors.cardNotInDeck");
    case "REPLY_WITH_CARDS":
      return t("decks.comments.errors.replyWithCards");
    default:
      return t("common.error");
  }
}
