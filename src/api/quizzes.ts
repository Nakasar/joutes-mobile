import { api } from "./client";
import { endpoints } from "./endpoints";
import type { PaginatedQuizzes, Quiz, QuizAnswerPayload, QuizScore } from "./types";

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

/**
 * Enregistre le score d'une section sur le profil du joueur connecté.
 *
 * Ce sont les réponses qui partent, non le score : l'écran corrige en local
 * pour répondre sans attendre le réseau, mais c'est le serveur qui note ce
 * qu'il enregistre. Il rend son propre compte, qui fait foi.
 */
export function recordQuizScore(
  quizId: string,
  payload: QuizAnswerPayload,
): Promise<QuizScore> {
  return api.post<QuizScore>(endpoints.quizzes.scores(quizId), payload);
}
