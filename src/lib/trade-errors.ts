import type { TradeError } from "../api/types";

/** Message utilisateur pour un code d'erreur d'échange (`TradeActionResult.error`). */
export function tradeErrorMessage(
  error: TradeError | "failed",
  t: (key: string) => string,
): string {
  switch (error) {
    case "not-found":
      return t("trades.errors.notFound");
    case "forbidden":
      return t("trades.errors.forbidden");
    case "closed":
      return t("trades.errors.closed");
    case "conflict":
      return t("trades.errors.changed");
    case "empty":
      return t("trades.errors.empty");
    case "side-taken":
      return t("trades.errors.taken");
    case "already-participant":
      return t("trades.errors.alreadyParticipant");
    case "self-trade":
      return t("trades.errors.self");
    case "insufficient-copies":
      return t("trades.errors.insufficientCopies");
    case "unknown-cards":
      return t("trades.errors.unknownCards");
    case "user-not-found":
      return t("trades.errors.userNotFound");
    default:
      return t("trades.errors.failed");
  }
}
