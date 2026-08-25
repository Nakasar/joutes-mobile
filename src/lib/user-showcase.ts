/**
 * La vitrine d'un profil : ses blocs et ses onglets — copie de
 * `lib/users/showcase.ts` et `lib/users/profile-tabs.ts` de joutes-app, tous
 * deux purs et testés là-bas. Toute modification doit être reportée dans les
 * deux dépôts : c'est le serveur qui enregistre l'ordre, et deux lectures
 * différentes montreraient deux vitrines pour le même compte.
 *
 * L'API sert déjà les blocs ordonnés dans `showcase.sections` ; ce module les
 * relit tout de même, pour deux raisons. Une réponse mémorisée peut dater d'une
 * version où un bloc n'existait pas encore, et c'est ici que les onglets se
 * calculent — la règle « un onglet dont le bloc n'a rien à montrer n'existe
 * pas » ne se vérifie qu'avec ce que l'écran a réellement chargé.
 */

export const USER_SHOWCASE_SECTION_KEYS = [
  "live",
  "about",
  "decks",
  "publications",
  "achievements",
  "follows",
  "trade",
] as const;

export type UserShowcaseSectionKey = (typeof USER_SHOWCASE_SECTION_KEYS)[number];

/** Ce qui est stocké : une liste partielle, dans l'ordre voulu par le compte. */
export type UserShowcaseSectionState = {
  key: UserShowcaseSectionKey;
  enabled: boolean;
};

/** Ce qui est lu : la liste complète, chaque clé une fois. */
export type UserShowcaseSection = {
  key: UserShowcaseSectionKey;
  enabled: boolean;
  /**
   * Souhaits et ventes sont toujours affichés : leur visibilité se règle liste
   * par liste, sur chaque liste. Un second interrupteur ici mentirait sur qui
   * décide.
   */
  locked?: boolean;
};

const LOCKED: UserShowcaseSectionKey[] = ["trade"];

export type UserShowcaseSectionsSource = {
  showcase?: { sections?: UserShowcaseSectionState[] };
};

/**
 * Les blocs de la vitrine, complétés et remis en ordre.
 *
 * Ce que cette lecture garantit : **toutes** les clés connues sont présentes,
 * exactement une fois, les inconnues écartées. Un bloc absent de ce qui est
 * stocké — parce qu'il a été ajouté après le dernier enregistrement du compte —
 * revient activé, à sa place par défaut, plutôt que de disparaître en silence.
 */
export function readUserShowcaseSections(
  user: UserShowcaseSectionsSource,
): UserShowcaseSection[] {
  const stored = user.showcase?.sections ?? [];
  const known = new Map<UserShowcaseSectionKey, boolean>();

  for (const section of stored) {
    if (USER_SHOWCASE_SECTION_KEYS.includes(section.key) && !known.has(section.key)) {
      known.set(section.key, section.enabled);
    }
  }

  const ordered: UserShowcaseSectionKey[] = [...known.keys()];

  for (const key of USER_SHOWCASE_SECTION_KEYS) {
    if (known.has(key)) {
      continue;
    }

    // Le bloc se pose **après** le dernier de ses prédécesseurs déjà placés, et
    // non avant son premier successeur : quelqu'un qui a délibérément mis « À
    // propos » en tête verrait sinon des blocs qu'il n'a jamais ordonnés se
    // glisser au-dessus. Sans prédécesseur placé, il prend la tête ; sans
    // repère du tout, la fin.
    const predecessors = USER_SHOWCASE_SECTION_KEYS.slice(
      0,
      USER_SHOWCASE_SECTION_KEYS.indexOf(key),
    );
    const anchor = predecessors.filter((previous) => ordered.includes(previous)).pop();

    ordered.splice(anchor ? ordered.indexOf(anchor) + 1 : 0, 0, key);
  }

  return ordered.map((key) => ({
    key,
    enabled: LOCKED.includes(key) ? true : (known.get(key) ?? true),
    locked: LOCKED.includes(key) || undefined,
  }));
}

/** Les onglets, dans l'ordre de la barre. */
export const USER_PROFILE_TABS = [
  "showcase",
  "decks",
  "publications",
  "achievements",
  "trade",
] as const;

export type UserProfileTab = (typeof USER_PROFILE_TABS)[number];

/**
 * Le bloc qu'isole chaque onglet. « Vitrine » n'en isole aucun : elle les
 * empile tous.
 */
const TAB_SECTION: Record<Exclude<UserProfileTab, "showcase">, UserShowcaseSectionKey> = {
  decks: "decks",
  publications: "publications",
  achievements: "achievements",
  trade: "trade",
};

/** Ce que chaque bloc a réellement à montrer. */
export type ProfileSectionContent = Partial<Record<UserShowcaseSectionKey, boolean>>;

/**
 * Les onglets à rendre.
 *
 * `showcase` ouvre toujours la liste dès qu'un onglet la suit : seule, elle
 * n'empilerait rien qu'on ne voie déjà, et une barre à un seul onglet est du
 * décor. Un profil privé n'a pas de barre du tout — l'appelant ne demande alors
 * pas cette liste.
 */
export function visibleProfileTabs(
  sections: UserShowcaseSection[],
  content: ProfileSectionContent,
): UserProfileTab[] {
  const enabled = new Set(
    sections.filter((section) => section.enabled).map((section) => section.key),
  );

  const tabs = USER_PROFILE_TABS.filter((tab) => {
    if (tab === "showcase") {
      return true;
    }

    const key = TAB_SECTION[tab];
    return enabled.has(key) && content[key] === true;
  });

  return tabs.length > 1 ? tabs : [];
}

/**
 * L'onglet retenu, ramené à ceux qui existent.
 *
 * Un onglet dont le bloc vient d'être éteint retombe sur « Vitrine » plutôt que
 * sur une page vide — le cas se produit quand la fiche se recharge en arrière-
 * plan pendant qu'on la lit.
 */
export function readUserProfileTab(
  value: string | undefined,
  visible: UserProfileTab[],
): UserProfileTab {
  return visible.includes(value as UserProfileTab) ? (value as UserProfileTab) : "showcase";
}

/** Les blocs à empiler pour cet onglet, dans l'ordre réglé par le compte. */
export function sectionsForTab(
  sections: UserShowcaseSection[],
  tab: UserProfileTab,
): UserShowcaseSectionKey[] {
  const enabled = sections.filter((section) => section.enabled).map((section) => section.key);

  if (tab === "showcase") {
    return enabled;
  }

  const key = TAB_SECTION[tab];
  return enabled.includes(key) ? [key] : [];
}
