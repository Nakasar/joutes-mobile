import type { ReactNode } from "react";

export interface TabItem<K extends string = string> {
  key: K;
  label: ReactNode;
}

/**
 * La navigation interne d'un écran : Registre / Classement, les onglets d'un
 * profil, Mes jeux / Tous les jeux.
 *
 * À distinguer du `segmented`, qui reste le choix d'une **option** — une
 * visibilité, un mode d'affichage. Un onglet, lui, change ce qu'on regarde,
 * et se dessine donc en souligné plutôt qu'en pastilles épaisses : c'est la
 * convention, et cela rend douze pixels de hauteur à des écrans où les
 * commandes repoussaient déjà le contenu sous la ligne de flottaison.
 *
 * La barre défile quand les onglets ne tiennent pas côte à côte — cinq onglets
 * de profil sur un téléphone étroit.
 */
export function Tabs<K extends string>({
  items,
  current,
  onSelect,
  className,
}: {
  items: TabItem<K>[];
  current: K;
  onSelect: (key: K) => void;
  className?: string;
}) {
  return (
    <div className={`tabs${className ? ` ${className}` : ""}`} role="tablist">
      {items.map((item) => (
        <button
          key={item.key}
          role="tab"
          aria-selected={current === item.key}
          className={`tabs__item${current === item.key ? " tabs__item--active" : ""}`}
          onClick={() => onSelect(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
