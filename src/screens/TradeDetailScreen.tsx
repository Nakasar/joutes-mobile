import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  cancelTrade,
  getTrade,
  removeTradePartner,
  revokeTradeValidation,
  setTradeOffer,
  validateTrade,
} from "../api/trades";
import type {
  Trade,
  CardOrientation,
  TradeCard,
  TradeCardSnapshot,
  TradeCatalogCardInput,
  TradeOwnedCardInput,
} from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { MinusIcon, PlusIcon, TextListIcon, UserPlusIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { TradeCardPickerSheet } from "../components/TradeCardPickerSheet";
import { TradeInviteSheet } from "../components/TradeInviteSheet";
import { TradeTextSheet } from "../components/TradeTextSheet";
import { tradeErrorMessage } from "../lib/trade-errors";
import { TRADE_MAX_QUANTITY } from "../lib/trade-constants";
import { useAuth } from "../store/auth";
import { CardImage } from "../components/CardImage";

const POLL_INTERVAL_MS = 5000;
const SAVE_DEBOUNCE_MS = 400;

type OfferTarget = "mine" | "counterparty";
const TARGETS: OfferTarget[] = ["mine", "counterparty"];

interface DraftCard {
  key: string;
  cardId?: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  image: string;
  /** Sens d'impression de la carte, relu du catalogue par l'API. */
  orientation?: CardOrientation;
  gameName?: string;
  quantity: number;
  maxQuantity: number;
}

function userLabel(user: { displayName?: string; discriminator?: string; username?: string }): string {
  return user.displayName && user.discriminator
    ? `${user.displayName}#${user.discriminator}`
    : user.displayName || user.username || "";
}

function cardKeyOf(card: { name: string; setCode: string; collectorNumber: string }): string {
  return `${card.name}|${card.setCode}|${card.collectorNumber}`;
}

function toDraftCards(
  cards: TradeCardSnapshot[],
  hints: Map<string, number>,
  capToOwned: boolean,
): DraftCard[] {
  return cards.map((card) => {
    const key = cardKeyOf(card);
    return {
      key,
      cardId: card.cardId,
      name: card.name,
      setCode: card.setCode,
      collectorNumber: card.collectorNumber,
      image: card.image,
      orientation: card.orientation,
      gameName: card.gameName,
      quantity: card.quantity,
      maxQuantity: capToOwned ? (hints.get(key) ?? TRADE_MAX_QUANTITY) : TRADE_MAX_QUANTITY,
    };
  });
}

function sidesFor(trade: Trade, userId: string) {
  const mine = trade.sides.find((side) => side.user?.id === userId) ?? trade.sides[0];
  const other = trade.sides.find((side) => side.id !== mine.id) ?? trade.sides[1];
  return { mine, other };
}

function copiesOf(cards: { quantity: number }[]): number {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}

function OfferPanel({
  title,
  subtitle,
  cards,
  emptyLabel,
  editable,
  badge,
  onAdd,
  onOpenText,
  onQuantityChange,
  onRemove,
}: {
  title: string;
  subtitle: string;
  cards: DraftCard[];
  emptyLabel: string;
  editable: boolean;
  badge?: string;
  onAdd?: () => void;
  onOpenText?: () => void;
  onQuantityChange?: (key: string, quantity: number) => void;
  onRemove?: (key: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="screen-head" style={{ marginBottom: 10 }}>
        <div className="screen-head__titles">
          <h2 className="section-label" style={{ marginBottom: 2 }}>
            {title}
          </h2>
          <p className="muted" style={{ fontSize: 12 }}>
            {subtitle}
          </p>
        </div>
        {/* La rangée aligne le badge de validation et le bouton de la vue
            texte : elle passe à la ligne plutôt que d'élargir la page. */}
        <div className="offer-panel__actions">
          {badge && <span className="chip chip--grad">{badge}</span>}
          {/* Ouvert même en lecture : copier l'offre du partenaire, ou celle
              d'un échange clos, ne demande pas le droit de la modifier. */}
          <button
            className="icon-button"
            onClick={onOpenText}
            aria-label={t("trades.text.open")}
            title={t("trades.text.open")}
          >
            <TextListIcon size={18} />
          </button>
        </div>
      </div>

      {cards.length === 0 ? (
        <p className="status muted">{emptyLabel}</p>
      ) : (
        cards.map((card) => (
          <div key={card.key} className="list-row">
            {card.image ? (
              <CardImage
                src={card.image}
                orientation={card.orientation}
                alt=""
                loading="lazy"
                className="list-row__thumb"
              />
            ) : (
              <span className="list-row__thumb" />
            )}
            <div className="list-row__body">
              <p className="list-row__title">{card.name}</p>
              <p className="list-row__sub">
                {card.setCode} {card.collectorNumber}
                {card.gameName ? ` · ${card.gameName}` : ""}
              </p>
            </div>
            {editable ? (
              <div className="list-row__actions">
                <div className="stepper">
                  <button
                    className="stepper__btn"
                    onClick={() => onQuantityChange?.(card.key, card.quantity - 1)}
                    disabled={card.quantity <= 1}
                    aria-label={t("trades.panel.decrease")}
                  >
                    <MinusIcon size={14} />
                  </button>
                  <span className="stepper__value">{card.quantity}</span>
                  <button
                    className="stepper__btn"
                    onClick={() => onQuantityChange?.(card.key, card.quantity + 1)}
                    disabled={card.quantity >= card.maxQuantity}
                    aria-label={t("trades.panel.increase")}
                  >
                    <PlusIcon size={14} />
                  </button>
                </div>
                <button
                  className="remove-btn"
                  onClick={() => onRemove?.(card.key)}
                  aria-label={t("common.remove")}
                >
                  ×
                </button>
              </div>
            ) : (
              <span className="stepper__value">×{card.quantity}</span>
            )}
          </div>
        ))
      )}

      {editable && (
        <button className="btn btn--outline btn--block" style={{ marginTop: 10 }} onClick={onAdd}>
          <PlusIcon size={16} />
          {t("trades.panel.add")}
        </button>
      )}
    </div>
  );
}

export function TradeDetailScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { tradeId = "" } = useParams();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<OfferTarget, DraftCard[]>>({ mine: [], counterparty: [] });
  const [saving, setSaving] = useState<Record<OfferTarget, boolean>>({ mine: false, counterparty: false });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<OfferTarget | null>(null);
  const [textTarget, setTextTarget] = useState<OfferTarget | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const ownedHints = useRef<Map<string, number>>(new Map());
  const revisionRef = useRef(0);
  const draftsRef = useRef(drafts);
  const dirtyRef = useRef<Record<OfferTarget, boolean>>({ mine: false, counterparty: false });
  const inFlightRef = useRef<Record<OfferTarget, boolean>>({ mine: false, counterparty: false });
  const timersRef = useRef<Partial<Record<OfferTarget, ReturnType<typeof setTimeout>>>>({});

  const applyServerTrade = useCallback(
    (next: Trade) => {
      setTrade(next);
      revisionRef.current = next.revision;
      const { mine: nextMine, other: nextOther } = sidesFor(next, userId);
      setDrafts((current) => {
        const updated: Record<OfferTarget, DraftCard[]> = {
          mine:
            dirtyRef.current.mine || inFlightRef.current.mine
              ? current.mine
              : toDraftCards(nextMine.cards, ownedHints.current, true),
          counterparty:
            dirtyRef.current.counterparty || inFlightRef.current.counterparty
              ? current.counterparty
              : toDraftCards(nextOther.cards, ownedHints.current, false),
        };
        draftsRef.current = updated;
        return updated;
      });
    },
    [userId],
  );

  // Chargement initial. Dépend aussi de `applyServerTrade` (donc de `userId`) :
  // si la session finit de se résoudre pendant que la requête est en vol, on
  // veut relire la réponse avec le bon `userId`, sous peine d'assigner la
  // mauvaise face à « mon offre ».
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getTrade(tradeId)
      .then((loaded) => {
        if (cancelled) return;
        applyServerTrade(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tradeId, applyServerTrade, t]);

  // Les envois différés en attente ne doivent pas survivre au démontage de
  // l'écran (navigation rapide après une modification d'offre).
  useEffect(() => {
    return () => {
      for (const target of TARGETS) clearTimeout(timersRef.current[target]);
    };
  }, []);

  const flush = useCallback(
    async (target: OfferTarget) => {
      if (inFlightRef.current[target]) return;
      dirtyRef.current[target] = false;
      inFlightRef.current[target] = true;
      setSaving((current) => ({ ...current, [target]: true }));

      const draft = draftsRef.current[target];
      const input =
        target === "mine"
          ? {
              target: "mine" as const,
              cards: draft.map(
                (card): TradeOwnedCardInput => ({
                  name: card.name,
                  setCode: card.setCode,
                  collectorNumber: card.collectorNumber,
                  quantity: card.quantity,
                }),
              ),
            }
          : {
              target: "counterparty" as const,
              cards: draft
                .filter((card) => card.cardId)
                .map((card): TradeCatalogCardInput => ({ cardId: card.cardId as string, quantity: card.quantity })),
            };

      const result = await setTradeOffer(tradeId, input);
      inFlightRef.current[target] = false;

      if (!result.ok) {
        setActionError(tradeErrorMessage(result.error, t));
        if (result.trade) applyServerTrade(result.trade);
      } else {
        applyServerTrade(result.trade);
      }

      setSaving((current) => ({ ...current, [target]: false }));
      if (dirtyRef.current[target]) void flush(target);
    },
    [tradeId, applyServerTrade, t],
  );

  const scheduleSave = useCallback(
    (target: OfferTarget) => {
      dirtyRef.current[target] = true;
      clearTimeout(timersRef.current[target]);
      timersRef.current[target] = setTimeout(() => void flush(target), SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  const updateDraft = useCallback(
    (target: OfferTarget, next: DraftCard[]) => {
      setDrafts((current) => {
        const updated = { ...current, [target]: next };
        draftsRef.current = updated;
        return updated;
      });
      scheduleSave(target);
    },
    [scheduleSave],
  );

  const addCard = useCallback(
    (target: OfferTarget, card: TradeCard) => {
      if (target === "mine") ownedHints.current.set(card.key, card.owned);
      const max = target === "mine" ? Math.max(1, card.owned) : TRADE_MAX_QUANTITY;
      const draft = draftsRef.current[target];
      const existing = draft.find((item) => item.key === card.key);
      const next = existing
        ? draft.map((item) =>
            item.key === card.key
              ? { ...item, quantity: Math.min(max, item.quantity + 1), maxQuantity: max }
              : item,
          )
        : [
            ...draft,
            {
              key: card.key,
              cardId: card.cardId,
              name: card.name,
              setCode: card.setCode,
              collectorNumber: card.collectorNumber,
              image: card.image,
              orientation: card.orientation,
              gameName: card.gameName,
              quantity: 1,
              maxQuantity: max,
            },
          ];
      updateDraft(target, next);
    },
    [updateDraft],
  );

  /**
   * Remplace le contenu d'une face par ce qu'une liste collée désigne.
   *
   * Le texte fait foi : ce qu'il n'énumère pas sort de l'offre. C'est ce qu'on
   * attend d'une liste qu'on recopie — sinon elle s'ajouterait à l'ancienne, et
   * il faudrait vider la face à la main avant chaque collage. Les quantités
   * sont ramenées à ce que l'on possède, comme le fait déjà l'ajout par la
   * recherche.
   */
  const replaceDraftFromText = useCallback(
    (target: OfferTarget, entries: { card: TradeCard; quantity: number }[]) => {
      const next = entries.map(({ card, quantity }): DraftCard => {
        if (target === "mine") ownedHints.current.set(card.key, card.owned);
        const max = target === "mine" ? Math.max(1, card.owned) : TRADE_MAX_QUANTITY;
        return {
          key: card.key,
          cardId: card.cardId,
          name: card.name,
          setCode: card.setCode,
          collectorNumber: card.collectorNumber,
          image: card.image,
          orientation: card.orientation,
          gameName: card.gameName,
          quantity: Math.max(1, Math.min(max, quantity)),
          maxQuantity: max,
        };
      });
      updateDraft(target, next);
    },
    [updateDraft],
  );

  const changeQuantity = useCallback(
    (target: OfferTarget, key: string, quantity: number) => {
      updateDraft(
        target,
        draftsRef.current[target].map((card) =>
          card.key === key ? { ...card, quantity: Math.max(1, Math.min(card.maxQuantity, quantity)) } : card,
        ),
      );
    },
    [updateDraft],
  );

  const removeCard = useCallback(
    (target: OfferTarget, key: string) => {
      updateDraft(target, draftsRef.current[target].filter((card) => card.key !== key));
    },
    [updateDraft],
  );

  const isOpen = trade?.status === "open";
  const { mine: mySide, other: otherSide } = trade
    ? sidesFor(trade, userId)
    : { mine: undefined, other: undefined };
  const partner = otherSide?.user ?? null;
  const isCreator = trade?.createdBy === userId;

  // Rafraîchissement de l'offre du partenaire et des validations.
  useEffect(() => {
    if (!isOpen || !partner || !tradeId) return;
    const interval = setInterval(() => {
      const busyWriting =
        dirtyRef.current.mine || dirtyRef.current.counterparty || inFlightRef.current.mine || inFlightRef.current.counterparty;
      if (busyWriting) return;
      getTrade(tradeId).then(applyServerTrade).catch(() => {
        // Rafraîchissement best-effort : la prochaine passe réessaiera.
      });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isOpen, partner, tradeId, applyServerTrade]);

  async function flushPending() {
    for (const target of TARGETS) clearTimeout(timersRef.current[target]);
    for (let attempt = 0; attempt < 40; attempt++) {
      const writing = TARGETS.filter((target) => inFlightRef.current[target]);
      const pending = TARGETS.filter((target) => dirtyRef.current[target]);
      if (writing.length === 0 && pending.length === 0) return;
      if (writing.length === 0) {
        await Promise.all(pending.map((target) => flush(target)));
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // Un partenaire qui rejoint (surtout via un QR scanné immédiatement) doit
  // trouver l'échange à jour : on s'assure qu'aucune offre n'est encore en
  // attente d'enregistrement avant d'afficher le code/QR d'invitation.
  async function openInvite() {
    setBusy(true);
    await flushPending();
    setBusy(false);
    setInviteOpen(true);
  }

  async function validate() {
    setBusy(true);
    setActionError(null);
    await flushPending();
    const result = await validateTrade(tradeId, revisionRef.current);
    setBusy(false);
    if (!result.ok) {
      const names = (result.details ?? []).map((d) => d.name).filter(Boolean).join(", ");
      setActionError(tradeErrorMessage(result.error, t) + (names ? ` (${names})` : ""));
      if (result.trade) applyServerTrade(result.trade);
      return;
    }
    applyServerTrade(result.trade);
  }

  async function revokeValidation() {
    setBusy(true);
    setActionError(null);
    const result = await revokeTradeValidation(tradeId);
    setBusy(false);
    if (!result.ok) {
      setActionError(tradeErrorMessage(result.error, t));
      return;
    }
    applyServerTrade(result.trade);
  }

  async function cancel() {
    setBusy(true);
    setActionError(null);
    const result = await cancelTrade(tradeId);
    setBusy(false);
    if (!result.ok) {
      setActionError(tradeErrorMessage(result.error, t));
      return;
    }
    applyServerTrade(result.trade);
  }

  async function removePartner() {
    setBusy(true);
    setActionError(null);
    const result = await removeTradePartner(tradeId);
    setBusy(false);
    if (!result.ok) {
      setActionError(tradeErrorMessage(result.error, t));
      return;
    }
    applyServerTrade(result.trade);
  }

  const myValidated = !!mySide?.validatedAt;
  const partnerValidated = !!otherSide?.validatedAt;
  const canValidate = isOpen && !busy && (drafts.mine.length > 0 || drafts.counterparty.length > 0);

  return (
    <div className="screen">
      <BackHeader title={t("trades.detailTitle")} />
      <StatusView loading={loading} error={loadError} />

      {trade && (
        <>
          <p className="screen-subtitle" style={{ marginBottom: 14 }}>
            {partner ? t("trades.withPartner", { name: userLabel(partner) }) : t("trades.noPartner")}
          </p>

          {trade.status === "completed" && (
            <p className="status" style={{ color: "var(--primary)", marginBottom: 14 }}>
              {t("trades.status.completedBanner")}
            </p>
          )}
          {trade.status === "cancelled" && (
            <p className="status muted" style={{ marginBottom: 14 }}>
              {t("trades.status.cancelledBanner")}
            </p>
          )}

          <OfferPanel
            title={t("trades.offer.title")}
            subtitle={t("trades.offer.subtitle")}
            cards={drafts.mine}
            emptyLabel={t("trades.panel.emptyOffer")}
            editable={isOpen}
            badge={myValidated ? t("trades.validation.mine") : undefined}
            onAdd={() => setPickerTarget("mine")}
            onOpenText={() => setTextTarget("mine")}
            onQuantityChange={(key, quantity) => changeQuantity("mine", key, quantity)}
            onRemove={(key) => removeCard("mine", key)}
          />

          <OfferPanel
            title={
              partner
                ? t("trades.request.titleWithPartner", { name: userLabel(partner) })
                : t("trades.request.title")
            }
            subtitle={partner ? t("trades.request.subtitlePartner") : t("trades.request.subtitle")}
            cards={drafts.counterparty}
            emptyLabel={partner ? t("trades.panel.emptyPartner") : t("trades.panel.emptyRequest")}
            editable={isOpen && !partner}
            badge={partnerValidated ? t("trades.validation.partner") : undefined}
            onAdd={() => setPickerTarget("counterparty")}
            onOpenText={() => setTextTarget("counterparty")}
            onQuantityChange={(key, quantity) => changeQuantity("counterparty", key, quantity)}
            onRemove={(key) => removeCard("counterparty", key)}
          />

          {saving.mine || saving.counterparty ? <p className="muted status">{t("common.saving")}</p> : null}

          {isOpen && (
            <p className="muted" style={{ marginBottom: 14 }}>
              {t("trades.summary", { offered: copiesOf(drafts.mine), received: copiesOf(drafts.counterparty) })}
            </p>
          )}

          {actionError && <p className="form-error">{actionError}</p>}

          {isOpen && !partner && (
            <button
              className="btn btn--outline btn--block"
              style={{ marginBottom: 10 }}
              disabled={busy}
              onClick={openInvite}
            >
              <UserPlusIcon size={16} />
              {t("trades.invite.button")}
            </button>
          )}

          {isOpen && partner && (
            <button
              className="btn btn--outline btn--block"
              style={{ marginBottom: 10 }}
              disabled={busy}
              onClick={removePartner}
            >
              {isCreator ? t("trades.partner.remove") : t("trades.partner.leave")}
            </button>
          )}

          {isOpen && (
            <>
              {myValidated ? (
                <button
                  className="btn btn--outline btn--block"
                  style={{ marginBottom: 10 }}
                  disabled={busy}
                  onClick={revokeValidation}
                >
                  {t("trades.validation.revoke")}
                </button>
              ) : (
                <button
                  className="btn btn--grad btn--block"
                  style={{ marginBottom: 10 }}
                  disabled={!canValidate}
                  onClick={validate}
                >
                  {partner ? t("trades.validation.validate") : t("trades.tradeAction")}
                </button>
              )}
              <button className="btn btn--danger btn--block" disabled={busy} onClick={cancel}>
                {t("trades.cancel.button")}
              </button>
            </>
          )}
        </>
      )}

      {pickerTarget && (
        <TradeCardPickerSheet
          defaultScope={pickerTarget === "mine" ? "collection" : "catalog"}
          requireOwned={pickerTarget === "mine"}
          requireCardId={pickerTarget === "counterparty"}
          selectedQuantities={new Map(drafts[pickerTarget].map((c) => [c.key, c.quantity]))}
          onAdd={(card) => addCard(pickerTarget, card)}
          onClose={() => setPickerTarget(null)}
        />
      )}

      {textTarget && (
        <TradeTextSheet
          title={
            textTarget === "mine" ? t("trades.offer.title") : t("trades.request.title")
          }
          cards={drafts[textTarget]}
          // Une face que l'on ne peut pas modifier reste lisible et copiable :
          // c'est le cas de l'offre du partenaire et de tout échange clos.
          editable={isOpen && (textTarget === "mine" || !partner)}
          scope={textTarget === "mine" ? "collection" : "catalog"}
          requireCardId={textTarget === "counterparty"}
          onApply={(entries) => replaceDraftFromText(textTarget, entries)}
          onClose={() => setTextTarget(null)}
        />
      )}

      {inviteOpen && trade && (
        <TradeInviteSheet
          tradeId={trade.id}
          code={trade.code}
          onClose={() => setInviteOpen(false)}
          onTradeChange={applyServerTrade}
        />
      )}
    </div>
  );
}
