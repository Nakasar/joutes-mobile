import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { searchDecks, type SearchDecksParams } from "../api/decks";
import type { Deck } from "../api/types";
import { CreateDeckSheet } from "../components/CreateDeckSheet";
import { DeckRow } from "../components/DeckRow";
import { LockIcon, PlusIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useAuth } from "../store/auth";
import { useSearchParamState } from "../hooks/useSearchParamState";

const PAGE_SIZE = 20;

/**
 * Les quatre lectures qu'un joueur fait de ses propres decks.
 *
 * « En cours » réunit le privé et le non répertorié : ce sont les deux états
 * d'un deck qu'on n'a pas publié, et les séparer ferait deux onglets à moitié
 * vides. « Favoris » sort du périmètre personnel — on met en favori les decks
 * des autres —, d'où son `scope: all`.
 */
const TABS = ["all", "drafts", "published", "favorites"] as const;
type Tab = (typeof TABS)[number];

function paramsFor(tab: Tab): SearchDecksParams {
  switch (tab) {
    case "drafts":
      return { scope: "mine", visibility: ["private", "unlisted"] };
    case "published":
      return { scope: "mine", visibility: ["public"] };
    case "favorites":
      return { scope: "all", favoritesOnly: true };
    case "all":
      return { scope: "mine" };
  }
}

function DecksContent() {
  const { t } = useTranslation();
  const [tab, setTab] = useSearchParamState<Tab>("tab", TABS, "all");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    searchDecks({ ...paramsFor(tab), page, limit: PAGE_SIZE, sortBy: "updatedAt" })
      .then((data) => {
        if (id !== requestId.current) return;
        setDecks((previous) => (page === 1 ? data.decks : [...previous, ...data.decks]));
        setTotalPages(data.totalPages || 1);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [tab, page, reloadTick, t]);

  const reload = () => {
    setPage(1);
    setReloadTick((tick) => tick + 1);
  };

  return (
    <>
      <button
        className="btn btn--grad btn--block"
        style={{ marginBottom: 14 }}
        onClick={() => setCreating(true)}
      >
        <PlusIcon size={18} />
        {t("decks.createAction")}
      </button>

      <div className="segmented" style={{ marginBottom: 14 }}>
        {TABS.map((key) => (
          <button
            key={key}
            className={`segmented__item${tab === key ? " segmented__item--active" : ""}`}
            onClick={() => setTab(key)}
          >
            {t(`decks.tabs.${key}`)}
          </button>
        ))}
      </div>

      <p className="screen-subtitle" style={{ marginBottom: 14 }}>
        <Link to="/decks/library">{t("decks.library.link")}</Link>
      </p>

      {decks.map((deck) => (
        <DeckRow key={deck.id} deck={deck} showAuthor={tab === "favorites"} />
      ))}

      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={!loading && !error && decks.length === 0 ? t(`decks.empty.${tab}`) : undefined}
      />

      {!loading && !error && page < totalPages && (
        <button className="btn btn--grad load-more" onClick={() => setPage((p) => p + 1)}>
          {t("decks.loadMore")}
        </button>
      )}

      {creating && (
        <CreateDeckSheet onClose={() => setCreating(false)} />
      )}
    </>
  );
}

export function DecksScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">{t("decks.title")}</h1>
          <p className="screen-subtitle">{t("decks.subtitle")}</p>
        </div>
      </div>

      {isAuthenticated ? (
        <DecksContent />
      ) : (
        <div className="card gate">
          <div className="gate__icon">
            <LockIcon size={30} />
          </div>
          <h2 className="gate__title">{t("common.loginRequiredTitle")}</h2>
          <p className="gate__text">{t("decks.gateText")}</p>
          <Link to="/login" className="btn btn--grad btn--block">
            {t("common.signIn")}
          </Link>
          <Link to="/decks/library" className="btn btn--outline btn--block" style={{ marginTop: 10 }}>
            {t("decks.library.link")}
          </Link>
        </div>
      )}
    </div>
  );
}
