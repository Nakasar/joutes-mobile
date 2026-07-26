import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createTrade, listTrades } from "../api/trades";
import type { Trade } from "../api/types";
import { ArrowLeftRightIcon, ChevronIcon, LockIcon, PlusIcon } from "../components/icons";
import { JoinTradeSheet } from "../components/JoinTradeSheet";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../store/auth";

function userLabel(user: { displayName?: string; discriminator?: string; username?: string }): string {
  return user.displayName && user.discriminator
    ? `${user.displayName}#${user.discriminator}`
    : user.displayName || user.username || "";
}

function copiesOf(cards: { quantity: number }[]): number {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}

function TradeRow({ trade }: { trade: Trade }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const mine = trade.sides.find((side) => side.user?.id === user?.id) ?? trade.sides[0];
  const other = trade.sides.find((side) => side.id !== mine.id) ?? trade.sides[1];
  const partner = other.user;

  let statusChip = <span className="chip">{t("trades.status.open")}</span>;
  if (trade.status === "completed") {
    statusChip = <span className="chip chip--accent">{t("trades.status.completed")}</span>;
  } else if (trade.status === "cancelled") {
    statusChip = <span className="chip">{t("trades.status.cancelled")}</span>;
  } else if (mine.validatedAt) {
    statusChip = <span className="chip chip--grad">{t("trades.status.validated")}</span>;
  }

  return (
    <Link to={`/trades/${trade.id}`} className="list-row list-row--link">
      <span className="list-row__icon" style={{ background: "var(--chip)" }}>
        <ArrowLeftRightIcon size={20} style={{ color: "var(--primary)" }} />
      </span>
      <div className="list-row__body">
        <p className="list-row__title">{partner ? userLabel(partner) : t("trades.noPartner")}</p>
        <p className="list-row__sub">
          {t("trades.summary", { offered: copiesOf(mine.cards), received: copiesOf(other.cards) })}
        </p>
      </div>
      <div className="list-row__actions">
        {statusChip}
        <span className="chevron">
          <ChevronIcon size={18} />
        </span>
      </div>
    </Link>
  );
}

function TradesContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(() => listTrades());
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  function create() {
    setCreating(true);
    createTrade()
      .then((trade) => navigate(`/trades/${trade.id}`))
      .catch(() => setCreating(false));
  }

  return (
    <>
      <button
        className="btn btn--grad btn--block"
        style={{ marginBottom: 10 }}
        onClick={create}
        disabled={creating}
      >
        <PlusIcon size={18} />
        {creating ? t("common.saving") : t("trades.createAction")}
      </button>
      <button
        className="btn btn--outline btn--block"
        style={{ marginBottom: 16 }}
        onClick={() => setJoining(true)}
      >
        {t("trades.joinAction")}
      </button>

      <StatusView loading={loading} error={error} onRetry={reload} />

      {data && (
        <>
          <p className="section-label">{t("trades.openTitle")}</p>
          {data.open.length === 0 ? (
            <p className="status muted">{t("trades.noOpen")}</p>
          ) : (
            data.open.map((trade) => <TradeRow key={trade.id} trade={trade} />)
          )}

          <p className="section-label" style={{ marginTop: 16 }}>
            {t("trades.historyTitle")}
          </p>
          {data.past.length === 0 ? (
            <p className="status muted">{t("trades.noHistory")}</p>
          ) : (
            data.past.map((trade) => <TradeRow key={trade.id} trade={trade} />)
          )}
        </>
      )}

      {joining && (
        <JoinTradeSheet
          onClose={() => setJoining(false)}
          onJoined={(tradeId) => navigate(`/trades/${tradeId}`)}
        />
      )}
    </>
  );
}

export function TradesScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">{t("trades.title")}</h1>
          <p className="screen-subtitle">{t("trades.subtitle")}</p>
        </div>
      </div>
      {isAuthenticated ? (
        <TradesContent />
      ) : (
        <div className="card gate">
          <div className="gate__icon">
            <LockIcon size={30} />
          </div>
          <h2 className="gate__title">{t("common.loginRequiredTitle")}</h2>
          <p className="gate__text">{t("trades.gateText")}</p>
          <Link to="/login" className="btn btn--grad btn--block">
            {t("common.signIn")}
          </Link>
        </div>
      )}
    </div>
  );
}
