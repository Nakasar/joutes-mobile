import { useMemo } from "react";
import { annotateErrataMarkdown } from "../lib/errata-markdown";
import { GameMarkdown } from "./GameMarkdown";

/**
 * Contenu de jeu écrit en markdown annoté — mentions `[Nom de carte]`, mots-clés
 * entre crochets, balises d'icônes `:rb_xxx:` — rendu avec ses badges, ses
 * glyphes et ses liens de cartes.
 *
 * `GameMarkdown` attend du texte déjà réécrit en pseudo-liens ; ce composant se
 * charge de l'étape qui manque, comme `AnnotatedMarkdown` côté web. Le passage
 * par `useMemo` n'est pas cosmétique : l'annotation reconstruit une expression
 * régulière sur tous les mots-clés du jeu, et un quizz en enchaîne une par
 * énoncé, par proposition et par correction.
 */
export function AnnotatedMarkdown({
  content,
  cardIdByName,
  gameSlug,
  ruleLang,
  onCardClick,
}: {
  content: string;
  /** Noms de cartes en minuscules → identifiants, tels que résolus par l'API. */
  cardIdByName: Map<string, string>;
  gameSlug: string;
  ruleLang?: "en" | "fr";
  /** Voir `GameMarkdown` : ouvre la carte sur place au lieu d'y naviguer. */
  onCardClick?: (cardId: string, name: string) => void;
}) {
  const markdown = useMemo(
    () => annotateErrataMarkdown(content, cardIdByName),
    [content, cardIdByName],
  );

  return (
    <GameMarkdown
      markdown={markdown}
      gameSlug={gameSlug}
      ruleLang={ruleLang}
      onCardClick={onCardClick}
    />
  );
}
