import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isSafeUrl } from "../lib/safe-url";

/**
 * Prose écrite par un joueur : description d'un deck, section d'un guide.
 *
 * Distinct de `GameMarkdown`, qui rend du contenu de jeu **prétraité** — texte
 * de carte, errata — où les mots-clés et les noms de cartes ont été encodés en
 * pseudo-liens. Ici rien n'a été annoté : ce qui est écrit est ce qui s'affiche,
 * et un `card://` tapé à la main ne doit surtout pas devenir un lien.
 *
 * Les liens sortants s'ouvrent dans le navigateur du système, et seuls
 * `http(s)` passent : un `javascript:` collé dans une description ne doit pas
 * se retrouver dans un `href`.
 */
export function UserMarkdown({ children }: { children: string }) {
  return (
    <div className="user-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (isSafeUrl(url) ? url : "")}
        components={{
          a: ({ href, children: content }) =>
            href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {content}
              </a>
            ) : (
              <>{content}</>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
