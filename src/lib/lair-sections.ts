/**
 * Les sections de la vitrine d'un lieu — portage de `lib/lairs/sections.ts` de
 * joutes-app, pur et testé là-bas. Toute modification doit être reportée dans
 * les deux dépôts : c'est le serveur qui enregistre l'ordre, et deux lectures
 * différentes montreraient deux vitrines pour le même lieu.
 */

/**
 * Les sections, dans leur ordre par défaut.
 *
 * L'ordre stocké est une liste de clés : un lieu qui n'a rien réordonné n'a
 * rien en base, et suit celui-ci.
 */
export const LAIR_SECTION_KEYS = ["news", "featured", "calendar", "media", "about"] as const;

export type LairSectionKey = (typeof LAIR_SECTION_KEYS)[number];

export type LairSection = {
  key: LairSectionKey;
  enabled: boolean;
  /** Le calendrier est toujours affiché : c'est ce qu'on vient chercher ici. */
  locked?: boolean;
};

/** Ce qui est stocké : une liste partielle, dans l'ordre voulu par le lieu. */
export type LairSectionState = {
  key: LairSectionKey;
  enabled: boolean;
};

/** Les sections qu'un lieu ne peut pas éteindre. */
const LOCKED: LairSectionKey[] = ["calendar"];

export type LairSectionsSource = {
  options?: { sections?: LairSectionState[] };
};

/**
 * Les sections du lieu, complétées et remises en ordre.
 *
 * Ce que cette lecture garantit : **toutes** les clés connues sont présentes,
 * exactement une fois, les inconnues écartées. Une section absente de ce qui
 * est stocké — parce qu'elle a été ajoutée après la dernière sauvegarde du
 * lieu — revient activée, à sa place par défaut, plutôt que de disparaître
 * silencieusement de la page.
 */
export function readLairSections(lair: LairSectionsSource): LairSection[] {
  const stored = lair.options?.sections ?? [];
  const known = new Map<LairSectionKey, boolean>();

  for (const section of stored) {
    if (LAIR_SECTION_KEYS.includes(section.key) && !known.has(section.key)) {
      known.set(section.key, section.enabled);
    }
  }

  const ordered: LairSectionKey[] = [...known.keys()];

  for (const key of LAIR_SECTION_KEYS) {
    if (known.has(key)) {
      continue;
    }

    // La section se pose **après** le dernier de ses prédécesseurs déjà placés,
    // et non avant son premier successeur : un lieu qui a délibérément mis
    // « À propos » en tête verrait sinon trois sections qu'il n'a jamais
    // ordonnées se glisser au-dessus. Sans prédécesseur placé, elle prend la
    // tête ; sans repère du tout, la fin.
    const predecessors = LAIR_SECTION_KEYS.slice(0, LAIR_SECTION_KEYS.indexOf(key));
    const anchor = predecessors.filter((previous) => ordered.includes(previous)).pop();

    ordered.splice(anchor ? ordered.indexOf(anchor) + 1 : 0, 0, key);
  }

  return ordered.map((key) => ({
    key,
    enabled: LOCKED.includes(key) ? true : (known.get(key) ?? true),
    locked: LOCKED.includes(key) || undefined,
  }));
}

/** Une section est-elle affichée sur la vitrine ? */
export function isSectionEnabled(sections: LairSection[], key: LairSectionKey): boolean {
  return sections.find((section) => section.key === key)?.enabled ?? true;
}
