import { useTranslation } from "react-i18next";
import type { QuizQuestion as QuizQuestionType } from "../api/types";
import type { QuizAnswerValue } from "../lib/quiz";
import { GameMarkdown } from "./GameMarkdown";
import { CheckIcon, CrossIcon } from "./icons";

/**
 * Une question de quizz et sa correction. `result` vaut `undefined` tant que le
 * bloc n'a pas été validé.
 */
export function QuizQuestion({
  question,
  answer,
  onAnswerChange,
  result,
  gameSlug,
}: {
  question: QuizQuestionType;
  answer: QuizAnswerValue;
  onAnswerChange: (value: QuizAnswerValue) => void;
  result?: boolean;
  gameSlug: string;
}) {
  const { t } = useTranslation();
  const choice = question.type === "single" || question.type === "multiple";

  return (
    <div className="quiz-question">
      <div className="quiz-question__prompt">
        <GameMarkdown markdown={question.prompt} gameSlug={gameSlug} />
      </div>

      {choice && (
        <div className="quiz-question__options">
          {(question.options ?? []).map((option) => {
            const checked =
              question.type === "single"
                ? answer === option.id
                : Array.isArray(answer) && answer.includes(option.id);

            return (
              <label
                key={option.id}
                className={`quiz-option${checked ? " quiz-option--checked" : ""}`}
              >
                <input
                  type={question.type === "single" ? "radio" : "checkbox"}
                  name={question.id}
                  checked={checked}
                  onChange={() => {
                    if (question.type === "single") {
                      onAnswerChange(option.id);
                      return;
                    }
                    const current = Array.isArray(answer) ? answer : [];
                    onAnswerChange(
                      current.includes(option.id)
                        ? current.filter((id) => id !== option.id)
                        : [...current, option.id],
                    );
                  }}
                />
                <span className="quiz-option__text">
                  <GameMarkdown markdown={option.text} gameSlug={gameSlug} />
                </span>
              </label>
            );
          })}
        </div>
      )}

      {question.type === "text" && (
        <input
          type="text"
          className="quiz-question__input"
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => onAnswerChange(e.currentTarget.value)}
          placeholder={t("quizzes.answerPlaceholder")}
          maxLength={300}
        />
      )}

      {question.type === "number" && (
        <input
          type="number"
          inputMode="numeric"
          className="quiz-question__input"
          value={typeof answer === "number" ? answer : ""}
          onChange={(e) =>
            onAnswerChange(
              e.currentTarget.value === "" ? undefined : Number(e.currentTarget.value),
            )
          }
          placeholder={t("quizzes.answerPlaceholder")}
        />
      )}

      {result !== undefined && (
        <div
          className={`quiz-feedback quiz-feedback--${result ? "correct" : "incorrect"}`}
          role="status"
        >
          {result ? <CheckIcon size={16} /> : <CrossIcon size={16} />}
          <div className="quiz-feedback__text">
            <GameMarkdown
              markdown={
                (result ? question.correctFeedback : question.incorrectFeedback) ||
                t(result ? "quizzes.correct" : "quizzes.incorrect")
              }
              gameSlug={gameSlug}
            />
          </div>
        </div>
      )}
    </div>
  );
}
