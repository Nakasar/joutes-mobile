import type {
  Quiz,
  QuizBlock,
  QuizQuestion,
  QuizTranslation,
  QuizTranslationEntry,
} from "../api/types";

/**
 * Lecture d'un quizz — portage de `lib/quizzes/translate.ts` côté web, limité à
 * ce dont l'app mobile a besoin : jouer un quizz, pas le traduire ni l'éditer.
 *
 * Le contenu d'un quizz est structuré (blocs, questions, propositions) : une
 * traduction ne recopie pas cette structure, elle range ses textes sous
 * l'identifiant du nœud qu'elle traduit. Le repli se fait donc champ par champ,
 * une traduction incomplète laissant le reste en version originale.
 */

/** Réponse donnée à une question, selon son type. */
export type QuizAnswerValue = string | string[] | number | undefined;

/** Texte traduit s'il existe et n'est pas vide, sinon l'original. */
function pick(
  entries: Record<string, QuizTranslationEntry>,
  id: string,
  field: keyof QuizTranslationEntry,
  original: string,
): string {
  return entries[id]?.[field]?.trim() || original;
}

function localizeBlock(
  block: QuizBlock,
  entries: Record<string, QuizTranslationEntry>,
): QuizBlock {
  if (block.type === "markdown") {
    return { ...block, content: pick(entries, block.id, "content", block.content) };
  }

  return {
    ...block,
    questions: block.questions.map((question) => ({
      ...question,
      prompt: pick(entries, question.id, "prompt", question.prompt),
      ...(question.options
        ? {
            options: question.options.map((option) => ({
              ...option,
              text: pick(entries, option.id, "text", option.text),
            })),
          }
        : {}),
      ...(question.correctText !== undefined
        ? { correctText: pick(entries, question.id, "correctText", question.correctText) }
        : {}),
      ...(question.correctFeedback !== undefined
        ? {
            correctFeedback: pick(
              entries,
              question.id,
              "correctFeedback",
              question.correctFeedback,
            ),
          }
        : {}),
      ...(question.incorrectFeedback !== undefined
        ? {
            incorrectFeedback: pick(
              entries,
              question.id,
              "incorrectFeedback",
              question.incorrectFeedback,
            ),
          }
        : {}),
    })),
  };
}

/** Langues dans lesquelles le quizz peut être lu : sa VO, puis ses traductions. */
export function availableQuizLangs(quiz: Quiz): string[] {
  return [...new Set([quiz.originalLang, ...(quiz.translations ?? []).map((tr) => tr.lang)])];
}

/**
 * Quizz tel qu'il se lit dans une langue. La langue d'origine — ou une langue
 * sans traduction — rend le quizz inchangé. Les identifiants ne changeant pas
 * d'une langue à l'autre, les réponses déjà données survivent au changement.
 */
export function localizeQuiz(quiz: Quiz, lang: string): Quiz {
  if (lang === quiz.originalLang) return quiz;

  const translation = quiz.translations?.find((tr) => tr.lang === lang);
  if (!translation) return quiz;

  const entries = translation.entries ?? {};
  return {
    ...quiz,
    title: translation.title?.trim() || quiz.title,
    blocks: quiz.blocks.map((block) => localizeBlock(block, entries)),
  };
}

/**
 * Une traduction est obsolète quand le contenu a changé après elle. Les
 * traductions ne touchant pas à `updatedAt`, la comparaison ne retient que les
 * modifications du quizz lui-même.
 */
export function isTranslationStale(
  translation: QuizTranslation,
  contentUpdatedAt?: string,
): boolean {
  if (!translation.updatedAt || !contentUpdatedAt) return false;
  return new Date(translation.updatedAt) < new Date(contentUpdatedAt);
}

/** Correction d'une réponse, selon le type de la question. */
export function isCorrect(question: QuizQuestion, answer: QuizAnswerValue): boolean {
  switch (question.type) {
    case "single": {
      const correct = question.correctOptionIds?.[0];
      return !!correct && answer === correct;
    }
    case "multiple": {
      const correctIds = question.correctOptionIds ?? [];
      const given = Array.isArray(answer) ? answer : [];
      return (
        correctIds.length > 0 &&
        correctIds.length === given.length &&
        correctIds.every((id) => given.includes(id))
      );
    }
    case "text": {
      const expected = (question.correctText ?? "").trim().toLowerCase();
      const given = typeof answer === "string" ? answer.trim().toLowerCase() : "";
      return !!expected && given === expected;
    }
    case "number": {
      if (question.correctNumber === undefined) return false;
      // La saisie d'un champ nombre est conservée telle quelle et convertie
      // ici : la convertir à chaque frappe rendrait les états intermédiaires
      // (« - », « 1. ») inéditables.
      const raw = typeof answer === "number" ? answer : (answer ?? "").toString().trim();
      if (raw === "") return false;
      return Number(raw) === question.correctNumber;
    }
  }
}

/**
 * Questions corrigées par le bouton de validation du bloc `blockIndex` : celles
 * depuis le bouton précédent, et non tout le quizz depuis le début — un quizz
 * en plusieurs sections ne recorrige donc pas les sections déjà validées.
 */
export function questionsValidatedBy(blocks: QuizBlock[], blockIndex: number): QuizQuestion[] {
  let startIndex = 0;
  for (let i = blockIndex - 1; i >= 0; i--) {
    const previous = blocks[i];
    if (previous.type === "form" && previous.showSubmitButton) {
      startIndex = i + 1;
      break;
    }
  }

  const questions: QuizQuestion[] = [];
  for (let i = startIndex; i <= blockIndex; i++) {
    const block = blocks[i];
    if (block.type === "form") questions.push(...block.questions);
  }
  return questions;
}
