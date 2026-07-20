import { Link } from "react-router-dom";
import { listNews } from "../api/news";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function HomeScreen() {
  const { data, loading, error, reload } = useApi(() => listNews({ limit: 20 }));

  return (
    <div className="screen">
      <header className="screen__header">
        <h1>Actualités</h1>
      </header>
      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={data?.news.length === 0 ? "Aucune actualité." : undefined}
      />
      {data?.news.map((item) => (
        <Link
          key={item.id}
          to={`/news/${item.id}`}
          className="card news-card news-card--link"
        >
          {item.banner && (
            <img
              src={item.banner}
              alt=""
              className="news-card__banner"
              loading="lazy"
            />
          )}
          <div className="news-card__body">
            <h2>{item.title}</h2>
            {item.summary && <p>{item.summary}</p>}
            <p className="news-card__meta muted">
              {item.games?.map((game) => game.name).join(" · ")}
              {item.games?.length ? " — " : ""}
              {formatDate(item.createdAt)}
              {typeof item.likesCount === "number" &&
                item.likesCount > 0 &&
                ` · ❤️ ${item.likesCount}`}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
