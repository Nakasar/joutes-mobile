import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getGame } from "../api/games";
import { listPolicies } from "../api/policies";
import type { Policy } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { ChevronIcon, ScrollIcon, SearchIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";

const PAGE_SIZE = 15;

/** Résumé texte de la politique, débarrassé des marqueurs markdown les plus courants. */
function policySnippet(policy: Policy): string {
  return policy.content
    .replace(/[#*`_>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

/**
 * Liste paginée des politiques (règles d'organisation, clarifications) d'un
 * jeu, avec recherche plein texte. La pagination de l'API repose sur des
 * en-têtes de réponse ; côté client on charge par pages successives (« Charger
 * plus »), comme pour la galerie de cartes.
 */
export function PoliciesListScreen() {
  const { t } = useTranslation();
  const { gameSlug = "" } = useParams();
  const game = useApi(() => getGame(gameSlug), [gameSlug]);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Débounce de la saisie de recherche.
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Toute modification de la recherche repart de la page 1.
  useEffect(() => {
    setPage(1);
  }, [searchQuery, gameSlug]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    listPolicies(gameSlug, {
      searchQuery: searchQuery || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((results) => {
        if (id !== requestId.current) return;
        setPolicies((previous) => (page === 1 ? results : [...previous, ...results]));
        setHasMore(results.length === PAGE_SIZE);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("policies.error"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [gameSlug, searchQuery, page, t]);

  return (
    <div className="screen">
      <BackHeader title={t("policies.title")} />
      {game.data?.name && <p className="screen-subtitle">{game.data.name}</p>}

      <div className="search-field" style={{ marginBottom: 14 }}>
        <SearchIcon size={18} className="search-field__icon" />
        <input
          type="search"
          placeholder={t("policies.searchPlaceholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.currentTarget.value)}
        />
      </div>

      {policies.map((policy) => (
        <Link
          key={policy.id}
          to={`/games/${gameSlug}/policies/${policy.id}`}
          className="list-row list-row--link"
        >
          <span className="list-row__icon" style={{ background: "var(--chip)" }}>
            <ScrollIcon size={18} />
          </span>
          <div className="list-row__body">
            <p className="list-row__title">
              {policy.title}
              {policy.deprecatedAt && (
                <span className="chip chip--danger" style={{ marginLeft: 6 }}>
                  {t("errata.deprecated")}
                </span>
              )}
            </p>
            <p className="list-row__sub">{policySnippet(policy)}</p>
          </div>
          <span className="chevron">
            <ChevronIcon size={18} />
          </span>
        </Link>
      ))}

      <StatusView
        loading={loading}
        error={error}
        onRetry={() => setPage(1)}
        empty={
          !loading && !error && policies.length === 0
            ? t("policies.empty")
            : undefined
        }
      />

      {!loading && !error && hasMore && (
        <button
          className="btn btn--grad load-more"
          onClick={() => setPage((p) => p + 1)}
        >
          {t("policies.loadMore")}
        </button>
      )}
    </div>
  );
}
