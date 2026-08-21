import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCard } from "../api/cards";
import { AddToWishlistSheet } from "../components/AddToWishlistSheet";
import { BackHeader } from "../components/BackHeader";
import { CardImage } from "../components/CardImage";
import { CardPriceDetails } from "../components/CardPriceDetails";
import { ErrataCard } from "../components/ErrataCard";
import { GameMarkdown } from "../components/GameMarkdown";
import { HeartIcon, PlusIcon, TagIcon } from "../components/icons";
import { ListForSaleSheet } from "../components/ListForSaleSheet";
import { StatusView } from "../components/StatusView";
import { SubmitErrataSheet } from "../components/SubmitErrataSheet";
import { useApi } from "../hooks/useApi";
import { annotateCardText } from "../lib/card-text-markdown";
import { toCardIdByName } from "../lib/errata-markdown";
import { useAuth } from "../store/auth";

export function CardDetailScreen() {
  const { t } = useTranslation();
  const { gameSlug = "", cardId = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const { data, loading, error, reload } = useApi(
    () => getCard(gameSlug, cardId),
    [gameSlug, cardId],
  );
  const [addingToWishlist, setAddingToWishlist] = useState(false);
  const [listingForSale, setListingForSale] = useState(false);
  const [submittingErrata, setSubmittingErrata] = useState(false);

  const cardIdByName = useMemo(() => toCardIdByName(data?.cardIdByName), [data?.cardIdByName]);
  const cardTextMarkdown = useMemo(
    () => (data?.text ? annotateCardText(data.text) : null),
    [data?.text],
  );

  const erratas = data?.erratas ?? [];
  const printings = data?.printings ?? [];

  return (
    <div className="screen">
      <BackHeader title={data?.name ?? t("card.fallbackTitle")} />
      <StatusView loading={loading} error={error} onRetry={reload} />
      {data && (
        <>
          {data.image && (
            <div className="card-hero">
              {/* Une carte toujours foil porte le voile irisé sur son illustration. */}
              <div
                className={`card-hero__frame${data.foil ? " foil-shine" : ""}`}
              >
                <CardImage
                  src={data.image}
                  orientation={data.orientation}
                  alt={data.name}
                  className="card-hero__image"
                />
              </div>
            </div>
          )}
          <h2 className="card-title">{data.name}</h2>
          {data.subtitle && <p className="card-subtitle">{data.subtitle}</p>}
          <p className="card-badges">
            {data.foil && (
              <span className="chip chip--accent">{t("printings.foil")}</span>
            )}
            {data.type && <span className="chip">{data.type}</span>}
            {typeof data.cost === "number" && (
              <span className="chip">{t("card.cost", { cost: data.cost })}</span>
            )}
            {data.setCode && (
              <span className="chip">
                {data.setCode}
                {data.collectorNumber ? ` ${data.collectorNumber}` : ""}
              </span>
            )}
            {data.banned && (
              <span className="chip chip--danger">{t("card.banned")}</span>
            )}
          </p>
          <CardPriceDetails price={data.marketPrice} gameSlug={gameSlug} />
          {cardTextMarkdown && (
            <div className="card-text-block">
              <GameMarkdown markdown={cardTextMarkdown} gameSlug={gameSlug} />
            </div>
          )}
          {printings.length > 0 && (
            <section>
              <h2 className="section-title">{t("printings.sectionTitle")}</h2>
              <div className="printings-grid">
                {printings.map((printing) => (
                  <div key={printing.id} className="printing-tile">
                    <span
                      className={`printing-tile__frame${printing.foil ? " foil-shine" : ""}`}
                    >
                      <CardImage
                        src={printing.image || data.image}
                        orientation={data.orientation}
                        alt={`${data.name} — ${printing.name}`}
                        loading="lazy"
                        className="printing-tile__image"
                      />
                    </span>
                    <span className="printing-tile__name">{printing.name}</span>
                    <span className="printing-tile__note">
                      {[
                        printing.foil ? t("printings.foil") : null,
                        printing.image ? null : t("printings.baseImage"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {isAuthenticated && (
            <div className="action-row">
              <button
                className="btn btn--outline"
                onClick={() => setAddingToWishlist(true)}
              >
                <HeartIcon size={16} />
                {t("wishlists.addToAction")}
              </button>
              <button
                className="btn btn--outline"
                onClick={() => setListingForSale(true)}
              >
                <TagIcon size={16} />
                {t("sellLists.listForSaleAction")}
              </button>
            </div>
          )}
          <section>
            <h2 className="section-title">
              {t("card.errataSection")}
              {erratas.length > 0 && (
                <span className="section-title__count muted">
                  ({erratas.length})
                </span>
              )}
            </h2>
            {erratas.length === 0 ? (
              <p className="muted">{t("card.noErrataDetail")}</p>
            ) : (
              erratas.map((errata) => (
                <ErrataCard
                  key={errata.id}
                  errata={errata}
                  gameSlug={gameSlug}
                  cardIdByName={cardIdByName}
                />
              ))
            )}
            {isAuthenticated && (
              <button
                className="btn btn--outline btn--block"
                onClick={() => setSubmittingErrata(true)}
              >
                <PlusIcon size={16} />
                {t("errata.submitAction")}
              </button>
            )}
          </section>
        </>
      )}
      {addingToWishlist && data && (
        <AddToWishlistSheet
          card={data}
          gameSlug={gameSlug}
          onClose={() => setAddingToWishlist(false)}
        />
      )}
      {listingForSale && data && (
        <ListForSaleSheet
          card={data}
          gameSlug={gameSlug}
          onClose={() => setListingForSale(false)}
        />
      )}
      {submittingErrata && data && (
        <SubmitErrataSheet
          card={data}
          gameSlug={gameSlug}
          onClose={() => setSubmittingErrata(false)}
          onCreated={reload}
        />
      )}
    </div>
  );
}
