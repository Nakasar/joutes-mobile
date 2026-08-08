import { isValidElement, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { KeywordBadge } from "./KeywordBadge";

/** Texte brut d'un contenu de lien, pour nommer la carte avant que l'API réponde. */
function nodeText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return nodeText(node.props.children);
  }
  return "";
}

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
  onCardClick,
}: {
  markdown: string;
  gameSlug: string;
  ruleLang?: "en" | "fr";
  /**
   * Prend la main sur les mentions de cartes au lieu de naviguer vers leur
   * fiche — pour les afficher en panneau quand quitter l'écran couperait le
   * fil de ce qu'on est en train de faire (un quizz en cours).
   */
  onCardClick?: (cardId: string, name: string) => void;
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

              if (onCardClick) {
                return (
                  <button
                    type="button"
                    className="card-link"
                    onClick={(e) => {
                      // Une mention peut être rendue dans un <label> (une
                      // proposition de quizz) : sans ça, ouvrir la carte
                      // cocherait la réponse au passage.
                      e.preventDefault();
                      e.stopPropagation();
                      onCardClick(id, nodeText(children));
                    }}
                  >
                    {children}
                  </button>
                );
              }

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
