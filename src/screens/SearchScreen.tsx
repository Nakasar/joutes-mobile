import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listGames } from "../api/games";
import { EMPTY, searchAll } from "../api/search";
import type { SearchResponse, SearchResult } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { CachedImage } from "../components/CachedImage";
import {
  BookIcon,
  CalendarIcon,
  ChevronIcon,
  ClockIcon,
  CrossIcon,
  LayersIcon,
  PinIcon,
  SearchIcon,
} from "../components/icons";
import { useApi } from "../hooks/useApi";
import {
  forgetRecentSearches,
  readRecentSearches,
  rememberSearch,
  routeFor,
} from "../lib/search-routes";

/** Le temps qu'on laisse à une frappe avant de la poser à l'API. */
const DEBOUNCE_MS = 250;
const MIN_LENGTH = 2;

const GROUPS: { key: keyof SearchResponse; Icon: typeof LayersIcon }[] = [
  { key: "games", Icon: LayersIcon },
  { key: "cards", Icon: SearchIcon },
  { key: "lairs", Icon: PinIcon },
  { key: "events", Icon: CalendarIcon },
  { key: "rules", Icon: BookIcon },
];

function ResultRow({ result, onOpen }: { result: SearchResult; onOpen: () => void }) {
  const to = routeFor(result);
  const body = (
    <>
      {result.image ? (
        <CachedImage src={result.image} alt="" className="list-row__thumb" />
      ) : null}
      <div className="list-row__body">
        <p className="list-row__title">{result.label}</p>
        {result.sublabel && <p className="list-row__sub">{result.sublabel}</p>}
      </div>
      {to && <ChevronIcon size={18} className="muted" />}
    </>
  );
  if (!to) return <div className="list-row">{body}</div>;
  return (
    <Link to={to} className="list-row list-row--link" onClick={onOpen}>
      {body}
    </Link>
  );
}

/**
 * La recherche globale : une question, cinq listes courtes.
 *
 * L'écran ouvre clavier sorti, et parle dès deux caractères. Une réponse qui
 * arrive après une frappe plus récente est jetée : `requestId` la reconnaît.
 * Sans question, il propose ce qu'on a déjà cherché, et les jeux du catalogue
 * — la palette du site fait pareil avec ses liens rapides.
 */
export function SearchScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>(() => readRecentSearches());

  const games = useApi(() => listGames());

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    if (query.length < MIN_LENGTH) {
      setResults(EMPTY);
      setLoading(false);
      setError(null);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    searchAll(query).then(
      (response) => {
        if (id !== requestId.current) return;
        setResults(response);
        setLoading(false);
      },
      (err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("common.error"));
        setLoading(false);
      },
    );
  }, [query, t]);

  const total = GROUPS.reduce((sum, group) => sum + results[group.key].length, 0);
  const asking = query.length >= MIN_LENGTH;

  const open = () => setRecent(rememberSearch(query));

  return (
    <div className="screen">
      <BackHeader title={t("search.title")} />

      <div className="search-field" style={{ marginBottom: 16 }}>
        <SearchIcon size={18} className="search-field__icon" />
        <input
          ref={inputRef}
          type="search"
          value={input}
          placeholder={t("search.placeholder")}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setQuery(input.trim());
          }}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </div>

      {!asking && (
        <>
          {recent.length > 0 && (
            <>
              <div className="search-head">
                <p className="section-label">{t("search.recent")}</p>
                <button className="link-button" onClick={() => { forgetRecentSearches(); setRecent([]); }}>
                  <CrossIcon size={14} /> {t("search.clearRecent")}
                </button>
              </div>
              <div className="chip-set">
                {recent.map((item) => (
                  <button key={item} className="chip-filter" onClick={() => setInput(item)}>
                    <ClockIcon size={13} /> {item}
                  </button>
                ))}
              </div>
            </>
          )}
          {games.data && games.data.length > 0 && (
            <>
              <p className="section-label">{t("search.quickLinks")}</p>
              <div className="chip-set">
                {games.data.map((game) => (
                  <button
                    key={game._id}
                    className="chip-filter"
                    onClick={() => navigate(`/games/${game.slug ?? game._id}`)}
                  >
                    {game.name}
                  </button>
                ))}
              </div>
            </>
          )}
          {input.length > 0 && input.trim().length < MIN_LENGTH && (
            <p className="muted" style={{ marginTop: 12 }}>{t("search.minChars")}</p>
          )}
        </>
      )}

      {asking && loading && total === 0 && <p className="status muted">{t("common.loading")}</p>}
      {asking && error && <p className="form-error">{error}</p>}
      {asking && !loading && !error && total === 0 && (
        <p className="status muted">{t("search.empty", { query })}</p>
      )}

      {asking &&
        GROUPS.map(({ key, Icon }) =>
          results[key].length === 0 ? null : (
            <section key={key} className="search-group">
              <p className="section-label">
                <Icon size={12} /> {t(`search.groups.${key}`)}
              </p>
              {results[key].map((result) => (
                <ResultRow key={`${result.kind}:${result.id}`} result={result} onOpen={open} />
              ))}
            </section>
          ),
        )}
    </div>
  );
}
