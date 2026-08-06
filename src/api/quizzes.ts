import { api } from "./client";
import { endpoints } from "./endpoints";
import type { PaginatedQuizzes, Quiz } from "./types";

/** Quizz rattachés à un jeu, du plus récent au plus ancien. */
export function listGameQuizzes(
  gameIdOrSlug: string,
  params: { page?: number; limit?: number } = {},
): Promise<PaginatedQuizzes> {
  return api.get<PaginatedQuizzes>(endpoints.games.quizzes(gameIdOrSlug), {
    ...params,
  });
}

/** Quizz complet, avec ses blocs, ses bonnes réponses et ses traductions. */
export function getQuiz(quizId: string): Promise<Quiz> {
  return api.get<Quiz>(endpoints.quizzes.detail(quizId));
}
