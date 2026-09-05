import { isAppBlobImageUrl } from "./blob-image-url";

/**
 * Copie de `lib/quizzes/cover.ts` de joutes-app — toute modification doit
 * être reportée dans les deux dépôts.
 *
 * Deux choix explicites et un vide : une image déposée, une carte du jeu
 * désignée, ou rien — un quizz n'a pas de carte qui le désigne d'office.
 */
export type QuizCoverSource = "upload" | "card" | "none";

export type QuizCoverFields = {
  coverImageUrl?: string;
  coverCardId?: string;
  coverImage?: string;
};

export type QuizCover = {
  source: QuizCoverSource;
  image?: string;
  cardId?: string;
};

export function resolveQuizCover(quiz: QuizCoverFields, cardImage?: string): QuizCover {
  if (quiz.coverImageUrl) {
    return { source: "upload", image: quiz.coverImageUrl };
  }

  if (quiz.coverCardId) {
    return { source: "card", cardId: quiz.coverCardId, image: cardImage ?? quiz.coverImage };
  }

  return { source: "none", image: undefined };
}

export function quizCoverPosition(source: QuizCoverSource): "top" | "center" {
  return source === "upload" ? "center" : "top";
}

export function isQuizCoverImageUrl(value: string): boolean {
  return isAppBlobImageUrl(value);
}
