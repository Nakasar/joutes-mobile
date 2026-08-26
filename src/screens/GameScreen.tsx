import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getGame } from "../api/games";
import { CachedImage } from "../components/CachedImage";
import {
  BackIcon,
  BookIcon,
  BoxIcon,
  CaretIcon,
  ChevronIcon,
  DeckCheckIcon,
  GridIcon,
  LayersIcon,
  QuizIcon,
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

/** Au-delà, la description se déplie plutôt que de tenir la moitié de l'écran. */
const ABOUT_CLAMP_LINES = 3;

/**
 * Page d'accueil d'un jeu : liens vers ses fonctionnalités, limités à
 * celles à la fois activées côté backend (`game.features`) et supportées par
 * l'application mobile (les tournois par exemple n'ont pas d'écran dédié par
 * jeu ici, uniquement une inscription globale par code).
 *
 * **Les cartes passent devant.** Sept liens de même poids ne disaient pas par
 * où commencer ; le catalogue est ce qu'on vient chercher sur un jeu de cartes,
 * il prend la largeur, et le reste passe en grille.
 *
 * La couleur du jeu descend en variable CSS (`--game`) : le bandeau, les
 * pastilles et les tuiles la reprennent de là. Sans couleur enregistrée,
 * `colorFor` en dérive une du slug, comme partout ailleurs.
 */
export function GameScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { gameSlug = "" } = useParams();
  const { data: game, loading, error, reload } = useApi(
    () => getGame(gameSlug),
    [gameSlug],
  );

  const [aboutOpen, setAboutOpen] = useState(false);

  const color = colorFor(gameSlug, game?.color);

  const features = useMemo<FeatureLink[]>(() => {
    // Le jeu n'est pas encore chargé : rien à proposer. Une fois chargé, les
    // quizz sont toujours listés — eux seuls n'ont pas de drapeau côté backend.
    if (!game) return [];
    const list: FeatureLink[] = [];
    if (game.features?.cards) {
      list.push({
        key: "cards",
        to: `/games/${gameSlug}/cards`,
        icon: <LayersIcon size={24} />,
        label: t("gameHub.cards"),
      });
    }
    if (game.features?.collection) {
      list.push({
        key: "collection",
        to: `/collection/${gameSlug}`,
        icon: <GridIcon size={21} />,
        label: t("gameHub.collection"),
      });
    }
    if (game.features?.rules) {
      list.push({
        key: "rules",
        to: `/games/${gameSlug}/rules`,
        icon: <BookIcon size={21} />,
        label: t("gameHub.rules"),
      });
    }
    if (game.features?.deckChecker) {
      list.push({
        key: "deckChecker",
        to: `/games/${gameSlug}/deck-checker`,
        icon: <DeckCheckIcon size={21} />,
        label: t("gameHub.deckChecker"),
      });
    }
    // Les jeux de figurines ne se collectionnent pas en cartes mais en
    // produits : boîtes, blisters, coffrets.
    if (game.features?.products) {
      list.push({
        key: "products",
        to: `/games/${gameSlug}/products`,
        icon: <BoxIcon size={21} />,
        label: t("gameHub.products"),
      });
    }
    if (game.features?.policies) {
      list.push({
        key: "policies",
        to: `/games/${gameSlug}/policies`,
        icon: <ScrollIcon size={21} />,
        label: t("gameHub.policies"),
      });
    }
    // Comme sur le web, chaque jeu a sa page de quizz, vide tant qu'aucun quizz
    // n'y est rattaché.
    list.push({
      key: "quizzes",
      to: `/games/${gameSlug}/quizzes`,
      icon: <QuizIcon size={21} />,
      label: t("gameHub.quizzes"),
    });
    return list;
  }, [game, gameSlug, t]);

  // Les cartes ouvrent le catalogue : c'est l'entrée principale quand elle
  // existe. Sinon la grille prend tout, plutôt que de promouvoir au hasard.
  const [main, rest] =
    features[0]?.key === "cards" ? [features[0], features.slice(1)] : [null, features];

  // La description est du texte libre : elle peut faire trois lignes comme
  // trente. Coupée, elle se déplie ; courte, le bouton ne s'affiche pas.
  const about = game?.description ?? "";
  const canExpand = about.length > 160 || about.includes("\n");

  return (
    <div className="screen" style={{ "--game": color } as CSSProperties}>
      <div className="game-hero">
        <div className="game-hero__wash" />
        <button
          className="glass-btn glass-btn--icon"
          onClick={() => navigate(-1)}
          aria-label={t("common.back")}
        >
          <BackIcon size={20} />
        </button>

        {game && (
          <div className="game-hero__id">
            {game.icon ? (
              <CachedImage
                src={game.icon}
                alt=""
                className="game-hero__icon"
                loading="lazy"
              />
            ) : (
              <span className="game-hero__icon" style={tintStyle(color)}>
                {initialOf(game.name)}
              </span>
            )}
            <div className="game-hero__body">
              <h1 className="game-hero__name">{game.name}</h1>
              {game.type && (
                <div className="game-hero__chips">
                  <span className="chip chip--game">
                    {t(`games.type.${game.type}`, game.type)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <StatusView loading={loading} error={error} onRetry={reload} />

      {game && about && (
        <section className="card" style={{ marginTop: 16 }}>
          <p
            className={`game-about${canExpand && !aboutOpen ? " game-about--clamped" : ""}`}
            style={{ WebkitLineClamp: ABOUT_CLAMP_LINES }}
          >
            {about}
          </p>
          {canExpand && (
            <button className="game-about__more" onClick={() => setAboutOpen((v) => !v)}>
              {aboutOpen ? t("gameHub.readLess") : t("gameHub.readMore")}
              <CaretIcon
                size={14}
                style={aboutOpen ? { transform: "rotate(180deg)" } : undefined}
              />
            </button>
          )}
        </section>
      )}

      {game && features.length > 0 && (
        <>
          <p className="section-label">{t("gameHub.explore")}</p>

          {main && (
            <Link to={main.to} className="feature-main">
              <span className="feature-main__icon">{main.icon}</span>
              <div className="feature-main__body">
                <p className="feature-main__label">{main.label}</p>
                <p className="feature-main__sub">{t("gameHub.cardsSub")}</p>
              </div>
              <span className="chevron">
                <ChevronIcon size={20} />
              </span>
            </Link>
          )}

          <div className="feature-grid">
            {rest.map((feature) => (
              <Link key={feature.key} to={feature.to} className="feature-tile">
                <span className="feature-tile__icon">{feature.icon}</span>
                <span className="feature-tile__label">{feature.label}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {game && features.length === 0 && (
        <p className="status muted">{t("gameHub.empty")}</p>
      )}
    </div>
  );
}
