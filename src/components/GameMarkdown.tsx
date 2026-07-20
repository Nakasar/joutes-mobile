import { Link, useNavigate } from "react-router-dom";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { KeywordBadge } from "./KeywordBadge";

/**
 * Rendu du contenu de jeu (erratas, news, texte de carte…) avec badges de
 * mots-clés et liens de cartes. Portage de `components/GameMarkdown.tsx` côté
 * web, adapté au mobile : les mots-clés et noms de cartes deviennent des liens
 * de navigation (tap) au lieu de popovers au survol.
 *
 * Le texte doit avoir été prétraité par `annotateErrataMarkdown` /
 * `annotateCardText`, qui encodent mots-clés et cartes en pseudo-liens
 * `keyword://<id>[/arrow]` et `card://<id>`.
 */
export function GameMarkdown({
  markdown,
  gameSlug,
  ruleLang = "fr",
}: {
  markdown: string;
  gameSlug: string;
  ruleLang?: "en" | "fr";
}) {
  const navigate = useNavigate();

  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // Le nettoyeur d'URL par défaut de react-markdown n'autorise qu'une
        // liste fixe de protocoles « sûrs » et efface silencieusement les
        // autres — dont nos pseudo-liens keyword:// et card:// : on les laisse
        // passer explicitement.
        urlTransform={(url) =>
          url.startsWith("keyword://") || url.startsWith("card://")
            ? url
            : defaultUrlTransform(url)
        }
        components={{
          img: ({ src, alt }) => {
            if (typeof src === "string" && src.includes("/riot-glyphs/")) {
              return <img src={src} alt={alt ?? ""} className="rb-glyph" />;
            }
            return (
              <img src={src} alt={alt ?? ""} className="markdown__image" />
            );
          },
          a: ({ href, children }) => {
            if (href?.startsWith("keyword://")) {
              const [id, shape] = href.slice("keyword://".length).split("/");
              return (
                <KeywordBadge
                  id={id}
                  shape={shape === "arrow" ? "arrow" : undefined}
                  onClick={() =>
                    navigate(
                      `/games/${gameSlug}/rules?doc=CR&lang=${ruleLang}&rule=${id}`,
                    )
                  }
                >
                  {children}
                </KeywordBadge>
              );
            }

            if (href?.startsWith("card://")) {
              const id = href.slice("card://".length);
              // `Link` rend un vrai <a href> (focusable clavier, sémantique)
              // tout en gérant la navigation côté routeur.
              return (
                <Link className="card-link" to={`/games/${gameSlug}/cards/${id}`}>
                  {children}
                </Link>
              );
            }

            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
