import { useTranslation } from "react-i18next";
import type { GameLive } from "../api/types";
import { currentLocale } from "../i18n";
import { formatRelative } from "../lib/game-links";
import { externalUrl } from "../lib/lair-urls";
import { ExternalLinkIcon } from "./icons";

/**
 * Le direct de l'éditeur, en tête de la fiche du jeu.
 *
 * Disparaît quand rien ne tourne — pas d'état vide, pas de silhouette : le
 * cas courant est qu'il n'y ait aucun direct, et lui réserver sa place
 * laisserait un trou sur toutes les fiches. Pas de lecteur intégré non plus :
 * le direct s'ouvre dans l'application YouTube, qui le lit mieux qu'une vue
 * web dans une vue web.
 */
export function GameLiveCard({ live, gameName }: { live: GameLive | null; gameName: string }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const url = live ? externalUrl(live.url) : null;
  if (!live || !url) return null;

  const thumbnail = externalUrl(live.thumbnail);

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="game-live">
      {thumbnail && (
        <span className="game-live__media">
          <img src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
        </span>
      )}
      <span className="game-live__body">
        <span className="game-live__badge">
          <span className="live-dot" />
          {t("gameHub.live.badge")}
        </span>
        <span className="game-live__title">{live.title ?? gameName}</span>
        <span className="game-live__meta">
          {live.channelTitle ?? gameName}
          {live.startedAt && ` · ${t("gameHub.live.since", { when: formatRelative(live.startedAt, locale) })}`}
        </span>
        <span className="game-live__cta">
          <ExternalLinkIcon size={13} />
          {t("gameHub.live.watch")}
        </span>
      </span>
    </a>
  );
}
