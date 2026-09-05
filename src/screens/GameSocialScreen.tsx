import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getGame, listGameSocialPosts } from "../api/games";
import { BackHeader } from "../components/BackHeader";
import { SocialPostCard } from "../components/SocialPostCard";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";

/** Ce qu'un jeu garde de publications : la rétention est la page. */
const ALL_POSTS = 100;

/** « Sur les réseaux », la page entière : tout ce que le jeu garde. */
export function GameSocialScreen() {
  const { t } = useTranslation();
  const { gameSlug = "" } = useParams();
  const game = useApi(() => getGame(gameSlug), [gameSlug]);
  const posts = useApi(() => listGameSocialPosts(gameSlug, ALL_POSTS), [gameSlug]);

  return (
    <div className="screen">
      <BackHeader title={t("gameHub.social.title")} />
      {game.data?.name && <p className="screen-subtitle">{game.data.name}</p>}
      <StatusView
        loading={posts.loading}
        error={posts.error}
        onRetry={posts.reload}
        empty={posts.data && posts.data.length === 0 ? t("gameHub.social.empty") : undefined}
      />
      <div className="social-grid">
        {(posts.data ?? []).map((post) => (
          <SocialPostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
