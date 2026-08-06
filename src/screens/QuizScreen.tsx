import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getQuiz } from "../api/quizzes";
import { BackHeader } from "../components/BackHeader";
import { GameMarkdown } from "../components/GameMarkdown";
import { QuizQuestion } from "../components/QuizQuestion";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { LANGUAGE_LABELS, type Language } from "../i18n";
import {
  availableQuizLangs,
  isCorrect,
  isTranslationStale,
  localizeQuiz,
  questionsValidatedBy,
  type QuizAnswerValue,
} from "../lib/quiz";

/**
 * Écran de réponse à un quizz. La correction est entièrement locale : l'API
 * renvoie les bonnes réponses avec le quizz et rien n'est enregistré, comme sur
 * le web. La création et la traduction d'un quizz restent réservées au web.
 */
export function QuizScreen() {
  const { t, i18n } = useTranslation();
  const { gameSlug = "", quizId = "" } = useParams();
  const { data: quiz, loading, error, reload } = useApi(() => getQuiz(quizId), [quizId]);

  const [lang, setLang] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuizAnswerValue>>({});
  const [results, setResults] = useState<Record<string, boolean>>({});

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

  const translation = quiz?.translations?.find((tr) => tr.lang === selectedLang);
  const stale = translation ? isTranslationStale(translation, quiz?.updatedAt) : false;

  const blocks = localized?.blocks ?? [];

  function validateBlock(blockIndex: number) {
    setResults((previous) => {
      const next = { ...previous };
      for (const question of questionsValidatedBy(blocks, blockIndex)) {
        next[question.id] = isCorrect(question, answers[question.id]);
      }
      return next;
    });
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
                <GameMarkdown markdown={block.content} gameSlug={gameSlug} />
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
                  />
                ))}
                {block.showSubmitButton && (
                  <button
                    type="button"
                    className="btn btn--grad btn--block"
                    onClick={() => validateBlock(index)}
                  >
                    {t("quizzes.validate")}
                  </button>
                )}
              </div>
            ),
          )}
        </>
      )}
    </div>
  );
}
