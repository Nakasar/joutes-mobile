import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getQuiz, recordQuizScore } from "../api/quizzes";
import { AnnotatedMarkdown } from "../components/AnnotatedMarkdown";
import { BackHeader } from "../components/BackHeader";
import { CardDetailModal } from "../components/CardDetailModal";
import { QuizQuestion } from "../components/QuizQuestion";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { LANGUAGE_LABELS, type Language } from "../i18n";
import { toCardIdByName } from "../lib/errata-markdown";
import { useAuth } from "../store/auth";
import {
  availableQuizLangs,
  isCorrect,
  isTranslationStale,
  localizeQuiz,
  questionsValidatedBy,
  toAnswerPayload,
  type QuizAnswerValue,
} from "../lib/quiz";

/** Score d'une section, tel qu'affiché à côté de son bouton de validation. */
type SectionScore = { correct: number; total: number };

/** Carte citée par le quizz, ouverte en panneau plutôt qu'en pleine page. */
type PreviewCard = { cardId: string; name: string };

/**
 * Écran de réponse à un quizz. La correction s'affiche sans attendre le réseau :
 * l'API renvoie les bonnes réponses avec le quizz. Le score d'une section
 * validée part en revanche au serveur quand le joueur est connecté — c'est lui
 * qui recorrige et enregistre. La création et la traduction d'un quizz restent
 * réservées au web.
 *
 * Les cartes citées s'ouvrent en panneau : y naviguer viderait les réponses en
 * cours de saisie et la correction déjà affichée, que rien ne rétablit au
 * retour.
 */
export function QuizScreen() {
  const { t, i18n } = useTranslation();
  const { gameSlug = "", quizId = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const { data: quiz, loading, error, reload } = useApi(() => getQuiz(quizId), [quizId]);

  const [lang, setLang] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuizAnswerValue>>({});
  const [results, setResults] = useState<Record<string, boolean>>({});
  /** Score de chaque section validée, indexé par l'identifiant de son bloc. */
  const [scores, setScores] = useState<Record<string, SectionScore>>({});
  const [preview, setPreview] = useState<PreviewCard | null>(null);

  const availableLangs = useMemo(
    () => (quiz ? availableQuizLangs(quiz) : []),
    [quiz],
  );

  // Le quizz s'ouvre dans la langue de l'app s'il y est traduit, sinon en VO ;
  // un choix manuel prend ensuite le pas.
  const interfaceLang = i18n.resolvedLanguage ?? i18n.language;
  const selectedLang =
    lang ??
    (availableLangs.includes(interfaceLang) ? interfaceLang : quiz?.originalLang ?? interfaceLang);

  const localized = useMemo(
    () => (quiz ? localizeQuiz(quiz, selectedLang) : null),
    [quiz, selectedLang],
  );

  // Résolu par l'API sur tout le quizz, traductions comprises : changer de
  // langue ne redemande rien, et l'index ne dépend donc pas de `selectedLang`.
  const cardIdByName = useMemo(
    () => toCardIdByName(quiz?.cardIdByName),
    [quiz?.cardIdByName],
  );

  const translation = quiz?.translations?.find((tr) => tr.lang === selectedLang);
  const stale = translation ? isTranslationStale(translation, quiz?.updatedAt) : false;

  const blocks = localized?.blocks ?? [];

  function validateBlock(blockIndex: number) {
    const questions = questionsValidatedBy(blocks, blockIndex);
    const block = blocks[blockIndex];

    // La correction est calculée hors des mises à jour d'état : compter dans un
    // `setState` la doublerait, React rejouant l'appel en mode strict.
    const corrected: Record<string, boolean> = {};
    let correct = 0;
    for (const question of questions) {
      const result = isCorrect(question, answers[question.id]);
      corrected[question.id] = result;
      if (result) correct += 1;
    }

    setResults((previous) => ({ ...previous, ...corrected }));
    setScores((previous) => ({
      ...previous,
      [block.id]: { correct, total: questions.length },
    }));

    if (isAuthenticated) {
      // L'enregistrement ne conditionne pas l'affichage : hors ligne, ou si le
      // serveur refuse, le joueur garde sa correction et son score à l'écran.
      recordQuizScore(quizId, {
        blockId: block.id,
        answers: toAnswerPayload(answers),
      }).catch((err) => {
        console.error("Score de quizz non enregistré:", err);
      });
    }
  }

  return (
    <div className="screen">
      <BackHeader title={localized?.title ?? t("quizzes.detailFallbackTitle")} />

      <StatusView loading={loading} error={error} onRetry={reload} />

      {localized && (
        <>
          {availableLangs.length > 1 && (
            <div className="chip-row">
              {availableLangs.map((available) => (
                <button
                  key={available}
                  className={`chip-filter${available === selectedLang ? " chip-filter--active" : ""}`}
                  onClick={() => setLang(available)}
                >
                  {LANGUAGE_LABELS[available as Language] ?? available}
                  {available === quiz?.originalLang && ` (${t("quizzes.originalLang")})`}
                </button>
              ))}
            </div>
          )}

          {stale && <p className="form-error">{t("quizzes.staleTranslation")}</p>}

          {blocks.map((block, index) =>
            block.type === "markdown" ? (
              <div key={block.id} className="quiz-block">
                <AnnotatedMarkdown
                  content={block.content}
                  cardIdByName={cardIdByName}
                  gameSlug={gameSlug}
                  onCardClick={(cardId, name) => setPreview({ cardId, name })}
                />
              </div>
            ) : (
              <div key={block.id} className="quiz-block">
                {block.questions.map((question) => (
                  <QuizQuestion
                    key={question.id}
                    question={question}
                    answer={answers[question.id]}
                    onAnswerChange={(value) =>
                      setAnswers((previous) => ({ ...previous, [question.id]: value }))
                    }
                    result={results[question.id]}
                    gameSlug={gameSlug}
                    cardIdByName={cardIdByName}
                    onCardClick={(cardId, name) => setPreview({ cardId, name })}
                  />
                ))}
                {block.showSubmitButton && (
                  <div className="quiz-submit">
                    <button
                      type="button"
                      className="btn btn--grad"
                      onClick={() => validateBlock(index)}
                    >
                      {t("quizzes.validate")}
                    </button>
                    {scores[block.id] && (
                      <p className="quiz-submit__score" role="status">
                        {/* L'accord porte sur le total : « 1 / 1 bonne
                            réponse », « 3 / 5 bonnes réponses ». */}
                        {t("quizzes.score", {
                          count: scores[block.id].total,
                          correct: scores[block.id].correct,
                          total: scores[block.id].total,
                        })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ),
          )}
        </>
      )}

      {preview && (
        <CardDetailModal
          gameSlug={gameSlug}
          cardId={preview.cardId}
          fallbackName={preview.name}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
