import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getGame, listGames } from "../api/games";
import { PLAY_GAMES } from "../api/play";
import { CachedImage } from "../components/CachedImage";
import { ChevronIcon, SwordsIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { readSwuSave } from "./swu/useSwuSoloGame";
import { readSoloSave } from "./useSoloGame";

/**
 * Le volet « Table » de l'onglet Jouer : les jeux que le moteur de Joutes sait
 * jouer (Riftbound, Star Wars: Unlimited), quand le jeu a activé « Jouer ».
 * Chacun ouvre sa page : contre l'IA, en ligne, ou sur un serveur.
 */
export function PlayHubPane() {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useApi(async () => {
    const catalog = await listGames();
    const candidates = catalog.filter((game) => (PLAY_GAMES as readonly string[]).includes(game.slug));
    // La liste des jeux ne porte pas les fonctionnalités : la fiche de chacun, si.
    const details = await Promise.all(candidates.map((game) => getGame(game.slug).catch(() => null)));
    return details.filter((game) => game?.features?.play === true).map((game) => game!);
  }, []);

  // Une partie contre l'IA gardée sur le téléphone : elle se signale sur sa ligne.
  const saved = useMemo(() => ({ riftbound: readSoloSave() !== null, swu: readSwuSave() !== null }), []);

  return (
    <>
      <p className="muted play-small" style={{ marginBottom: 12 }}>
        {t("play.tableIntro")}
      </p>
      <div className="play-games">
        {(data ?? []).map((game) => (
          <Link key={game.slug} to={`/play/${game.slug}`} className="play-game">
            {game.icon ? <CachedImage src={game.icon} alt="" /> : <SwordsIcon size={28} />}
            <span className="play-game__body">
              <span className="play-game__name">{game.name}</span>
              <span className="muted play-small">
                {saved[game.slug as "riftbound" | "swu"] ? t("play.tableResume") : t("play.tableSub")}
              </span>
            </span>
            <span className="chevron">
              <ChevronIcon size={18} />
            </span>
          </Link>
        ))}
      </div>
      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={!loading && !error && (data ?? []).length === 0 ? t("play.tableEmpty") : undefined}
      />
    </>
  );
}
