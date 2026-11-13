import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listBoosters, type Booster } from "../api/boosters";
import { getGame } from "../api/games";
import { BackHeader } from "../components/BackHeader";
import { CardImage } from "../components/CardImage";
import { CreateBoosterSheet } from "../components/CreateBoosterSheet";
import { CheckIcon, ChevronIcon, PlusIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useBoosterTypeLabel } from "../hooks/useBoosterTypeLabel";
import { currentLocale } from "../i18n";
import { formatMoney } from "../lib/prices";
import { useAuth } from "../store/auth";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(currentLocale(), { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Les boosters ouverts sur un jeu, du plus récent au plus ancien, comme
 * `/collection/{jeu}/boosters` sur le site. Un booster s'ouvre pour y scanner
 * ses cartes.
 */
export function BoostersScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { gameSlug = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const game = useApi(() => getGame(gameSlug), [gameSlug]);
  const boosters = useApi(
    () => (isAuthenticated ? listBoosters(gameSlug, { page }) : Promise.resolve(null)),
    [gameSlug, page, isAuthenticated],
  );
  const typeLabel = useBoosterTypeLabel(game.data);

  if (!isAuthenticated) {
    return (
      <div className="screen">
        <BackHeader title={t("boosters.title")} />
        <div className="card gate">
          <h2 className="gate__title">{t("common.loginRequiredTitle")}</h2>
          <p className="gate__text">{t("boosters.gateText")}</p>
          <Link to="/login" className="btn btn--grad btn--block">
            {t("common.signIn")}
          </Link>
        </div>
      </div>
    );
  }

  const data = boosters.data;

  return (
    <div className="screen">
      <BackHeader
        title={t("boosters.title")}
        action={
          game.data && (
            <button
              type="button"
              className="icon-button icon-button--primary"
              onClick={() => setCreating(true)}
              aria-label={t("boosters.create")}
            >
              <PlusIcon size={20} />
            </button>
          )
        }
      />
      {game.data && <p className="screen-subtitle">{t("boosters.subtitle", { game: game.data.name })}</p>}

      <StatusView
        loading={boosters.loading}
        error={boosters.error}
        onRetry={boosters.reload}
        empty={data && data.total === 0 ? t("boosters.emptyDescription") : undefined}
      />

      {data && data.total === 0 && game.data && (
        <button type="button" className="btn btn--grad btn--block" onClick={() => setCreating(true)}>
          <PlusIcon size={16} />
          {t("boosters.create")}
        </button>
      )}

      {data && data.total > 0 && (
        <p className="section-label">{t("boosters.boosterCount", { count: data.total })}</p>
      )}

      {data?.boosters.map((booster: Booster) => {
        const cover = booster.cards.find((card) => card.image)?.image;
        return (
          <Link
            key={booster.id}
            to={`/collection/${gameSlug}/boosters/${booster.id}`}
            className="list-row list-row--link booster-row"
          >
            <span className="booster-row__cover">
              {cover ? <CardImage src={cover} alt="" loading="lazy" /> : <span>{booster.setCode}</span>}
            </span>
            <div className="list-row__body">
              <p className="list-row__title">
                {booster.setCode} · {booster.lang.toUpperCase()} · {typeLabel(booster.type)}
              </p>
              <p className="list-row__sub">
                {[
                  t("boosters.cardCount", { count: booster.cards.length }),
                  booster.estimatedValue ? formatMoney(booster.estimatedValue) : null,
                  formatDate(booster.createdAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {booster.addedToCollection && (
              <span className="chip chip--accent" title={t("boosters.inCollection")}>
                <CheckIcon size={14} />
              </span>
            )}
            <span className="chevron">
              <ChevronIcon size={18} />
            </span>
          </Link>
        );
      })}

      {data && data.totalPages > 1 && (
        <div className="pager">
          <button type="button" className="btn btn--outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t("boosters.previousPage")}
          </button>
          <span className="muted">{t("boosters.pageOf", { page, totalPages: data.totalPages })}</span>
          <button
            type="button"
            className="btn btn--outline"
            disabled={page >= data.totalPages}
            onClick={() => setPage(page + 1)}
          >
            {t("boosters.nextPage")}
          </button>
        </div>
      )}

      {creating && game.data && (
        <CreateBoosterSheet
          game={game.data}
          onClose={() => setCreating(false)}
          onCreated={(id) => navigate(`/collection/${gameSlug}/boosters/${id}`)}
        />
      )}
    </div>
  );
}
