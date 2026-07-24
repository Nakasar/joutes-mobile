import { useMemo, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getGame } from "../api/games";
import { BackHeader } from "../components/BackHeader";
import { CachedImage } from "../components/CachedImage";
import {
  BookIcon,
  ChevronIcon,
  DeckCheckIcon,
  GridIcon,
  LayersIcon,
  ScrollIcon,
} from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";

interface FeatureLink {
  key: string;
  to: string;
  icon: ReactNode;
  label: string;
}

/**
 * Page d'accueil d'un jeu : liens vers ses fonctionnalités, limités à
 * celles à la fois activées côté backend (`game.features`) et supportées par
 * l'application mobile (les tournois par exemple n'ont pas d'écran dédié par
 * jeu ici, uniquement une inscription globale par code).
 */
export function GameScreen() {
  const { t } = useTranslation();
  const { gameSlug = "" } = useParams();
  const { data: game, loading, error, reload } = useApi(
    () => getGame(gameSlug),
    [gameSlug],
  );

  const color = colorFor(gameSlug, game?.color);

  const features = useMemo<FeatureLink[]>(() => {
    if (!game?.features) return [];
    const list: FeatureLink[] = [];
    if (game.features.cards) {
      list.push({
        key: "cards",
        to: `/games/${gameSlug}/cards`,
        icon: <LayersIcon size={20} />,
        label: t("gameHub.cards"),
      });
    }
    if (game.features.rules) {
      list.push({
        key: "rules",
        to: `/games/${gameSlug}/rules`,
        icon: <BookIcon size={20} />,
        label: t("gameHub.rules"),
      });
    }
    if (game.features.deckChecker) {
      list.push({
        key: "deckChecker",
        to: `/games/${gameSlug}/deck-checker`,
        icon: <DeckCheckIcon size={20} />,
        label: t("gameHub.deckChecker"),
      });
    }
    if (game.features.collection) {
      list.push({
        key: "collection",
        to: `/collection/${gameSlug}`,
        icon: <GridIcon size={20} />,
        label: t("gameHub.collection"),
      });
    }
    if (game.features.policies) {
      list.push({
        key: "policies",
        to: `/games/${gameSlug}/policies`,
        icon: <ScrollIcon size={20} />,
        label: t("gameHub.policies"),
      });
    }
    return list;
  }, [game, gameSlug, t]);

  return (
    <div className="screen">
      <BackHeader title={game?.name ?? t("gameHub.fallbackTitle")} />

      {game && (
        <div className="game-row" style={{ marginBottom: 14 }}>
          <span className="game-row__bar" style={{ background: color }} />
          {game.icon ? (
            <CachedImage
              src={game.icon}
              alt=""
              className="avatar avatar--game"
              loading="lazy"
            />
          ) : (
            <span className="avatar avatar--game" style={tintStyle(color)}>
              {initialOf(game.name)}
            </span>
          )}
          <div className="game-row__body">
            <h2 className="game-row__name">{game.name}</h2>
            {game.description && (
              <p className="game-row__desc">{game.description}</p>
            )}
          </div>
        </div>
      )}

      <StatusView loading={loading} error={error} onRetry={reload} />

      {game &&
        features.map((feature) => (
          <Link key={feature.key} to={feature.to} className="list-row list-row--link">
            <span className="list-row__icon" style={{ background: "var(--chip)" }}>
              {feature.icon}
            </span>
            <div className="list-row__body">
              <p className="list-row__title">{feature.label}</p>
            </div>
            <span className="chevron">
              <ChevronIcon size={18} />
            </span>
          </Link>
        ))}

      {game && features.length === 0 && (
        <p className="status muted">{t("gameHub.empty")}</p>
      )}
    </div>
  );
}
