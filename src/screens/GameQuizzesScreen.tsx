import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getGame } from "../api/games";
import { listGameQuizzes } from "../api/quizzes";
import { BackHeader } from "../components/BackHeader";
import { ChevronIcon, QuizIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";

const PAGE_SIZE = 50;

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Quizz d'un jeu. Seule la lecture est portée sur mobile : la création et la
 * traduction restent sur le web.
 */
export function GameQuizzesScreen() {
  const { t } = useTranslation();
  const { gameSlug = "" } = useParams();
  const game = useApi(() => getGame(gameSlug), [gameSlug]);
  const { data, loading, error, reload } = useApi(
    () => listGameQuizzes(gameSlug, { limit: PAGE_SIZE }),
    [gameSlug],
  );

  const quizzes = data?.quizzes ?? [];

  return (
    <div className="screen">
      <BackHeader title={t("quizzes.title")} />
      {game.data?.name && <p className="screen-subtitle">{game.data.name}</p>}

      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={data && quizzes.length === 0 ? t("quizzes.empty") : undefined}
      />

      {quizzes.map((quiz) => (
        <Link
          key={quiz.id}
          to={`/games/${gameSlug}/quizzes/${quiz.id}`}
          className="list-row list-row--link"
        >
          <span className="list-row__icon" style={{ background: "var(--chip)" }}>
            <QuizIcon size={18} />
          </span>
          <div className="list-row__body">
            <p className="list-row__title">{quiz.title}</p>
            <p className="list-row__sub">
              {[quiz.author?.displayName, formatDate(quiz.createdAt)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span className="chevron">
            <ChevronIcon size={18} />
          </span>
        </Link>
      ))}
    </div>
  );
}
