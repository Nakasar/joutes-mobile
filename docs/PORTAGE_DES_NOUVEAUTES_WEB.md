# Porter les nouveautés Joutes sur l'application mobile

> Analyse d'écart et plan de portage, écrits le 25 août 2026 depuis l'état des deux
> dépôts à cette date (`joutes-mobile` v0.32.0, `joutes-app` à `876e496`).
>
> **Convention de chemins** : un chemin en `src/…` ou `scripts/…` désigne ce dépôt ;
> un chemin en `lib/…`, `app/…` ou `openapi.yaml` désigne **joutes-app**.

## Contexte

La plateforme web (`joutes-app`) a livré entre le 18 et le 25 août 2026 une série de
fonctionnalités majeures ; l'application mobile (`joutes-mobile`, Tauri 2 + React 19,
v0.32.0, dernier commit le 21 août) n'en porte aucune. L'écart n'est pas seulement
un retard : depuis qu'un second fournisseur de prix (CardNexus) cote à côté de
Cardmarket, le mobile affiche un **lien faux** sur les cartes qu'il relève.

Périmètre arbitré : decks, vitrine de profil, groupes de jeu enrichis, lieux, plus
deux rattrapages courts (prix multi-fournisseurs, échange au format texte).

**La contrainte structurante est l'API.** Trois des quatre gros chantiers n'existent
côté serveur que comme *server actions* Next.js, inaccessibles à un client tiers ;
il n'y a même pas de `GET /api/lairs/{lairId}`. Là où l'API existe (decks), la spec
`openapi.yaml` — le contrat que le mobile suit — a divergé du code. Ouvrir et
remettre à jour l'API fait donc partie du travail, dans les deux dépôts.

Bonne nouvelle : le travail serveur est presque toujours **une route mince posée sur
une fonction déjà écrite et testée** (`lib/db/user-followers.ts`,
`lib/db/user-contents.ts`, `lib/db/play-group-sessions.ts`,
`lib/db/play-groups-explore.ts`, `getLairById`, `searchLairs` qui accepte déjà
`nearLocation` — c'est la *route* qui ne lit pas le paramètre). La logique de
présentation est elle aussi isolée et testée : `lib/lairs/{sections, opening-hours,
theme, urls}.ts`, `lib/users/showcase.ts`, `lib/play-groups/{access, explore}.ts`,
`lib/decks/*`, `lib/trade/text.ts`.

## Décisions prises

- **Édition de deck sur mobile** : liste collée (appariée par le serveur) + réglage
  carte à carte au −/+, une zone à la fois. L'éditeur web à trois colonnes n'est pas
  transposé.
- **Navigation** : aucun onglet ajouté. Les decks entrent par `CollectionScreen`, la
  communauté par `SocialScreen`. La TabBar reste à cinq entrées.
- **Écritures ouvertes au mobile** : gestion des membres d'un groupe (l'API existe
  déjà) et publication d'une vidéo / d'un replay (titre + URL). Restent web-only :
  le réglage de sa propre vitrine et l'écriture d'articles markdown.

## Les lots

Chaque lot est une PR par dépôt concerné, suivie d'un commit `Passe en 0.3x.0` côté
mobile. L'ordre suit le rapport valeur/effort et les dépendances.

| # | Lot | Version | API à ouvrir |
|---|---|---|---|
| 0 | Filet i18n + client HTTP | — | aucune |
| 1 | Prix multi-fournisseurs | 0.33.0 | aucune |
| 2 | Échange au format texte | 0.34.0 | documentation seule |
| 3 | Decks — lecture et librairie | 0.35.0 | documentation + 3 chemins |
| 4 | Decks — édition mobile | 0.36.0 | aucune |
| 5 | Profil-vitrine, suivi, succès | 0.37.0 | 3 routes |
| 6 | Publications et registre | 0.38.0 | 3 routes |
| 7 | Lieux — vitrine | 0.39.0 | 4 routes |
| 8 | Groupes — l'Établi | 0.40.0 | 8 routes + 1 correctif |
| 9 | Groupes — vitrine et exploration | 0.41.0 | 4 routes |

**Pourquoi cet ordre.** Les deux rattrapages passent d'abord : ils corrigent un bug
visible et coûtent peu. Puis les decks, seul gros chantier dont l'API est déjà
écrite. Le profil ensuite, parce que sa vitrine cite les decks. Les publications
suivent le profil dont elles sont un onglet, et fournissent au lot 9 le type
`UserContent`. Les lieux avant les groupes : indépendants, moins coûteux, et une
session de groupe affiche un lieu.

---

### Lot 0 — Deux verrous à lever d'abord

Deux points bloquent la suite et ne coûtent presque rien.

- **`src/api/client.ts`** : `QueryParams` est `Record<string, string|number|boolean|undefined>`
  et la boucle fait `searchParams.set`. Les paramètres **répétés** sont donc
  impossibles — or le lot 3 en a besoin (`domain`, `visibility`). Élargir le type à
  `string[]` et faire `append` pour les tableaux.
- **Parité i18n** : les quatre locales portent 745 clés chacune, en parité parfaite,
  et **aucun script ne le vérifie** dans joutes-mobile. Ce plan en ajoute environ
  400. Porter `scripts/check-message-parity.mjs` de joutes-app en
  `scripts/check-i18n-parity.mjs` et l'appeler depuis `npm run build`.

Ajouter aussi `cacheDelete(key)` à côté de `cacheSet` dans `src/lib/response-cache.ts` :
les lots 5, 7 et 9 doivent invalider une fiche après un « suivre ».

---

### Lot 1 — Prix multi-fournisseurs (0.33.0)

Une carte cotée par CardNexus doit dire « CardNexus » et renvoyer chez CardNexus.

**joutes-app** — rien. `getMarketPrices` (`lib/db/card-prices.ts`) sert déjà
`source`, l'export hors ligne le fait suivre, et `openapi.yaml` le documente
(schéma `MarketPrice`, l. 4250, `required: [amount, currency, source, updatedAt]`).
Le serveur applique déjà la préférence du lecteur par requête
(`lib/prices/viewer.ts`) : **le mobile en bénéficie passivement**, seul le réglage
reste web.

**joutes-mobile**
- `src/api/types.ts` — `CardMarketPrice` gagne `source: CardPriceSource`
  (`"cardnexus" | "cardmarket"`).
- `src/lib/prices.ts` — porter `PRICE_SOURCE_LABELS` et `marketProductUrl` de
  `lib/prices/sources.ts`, plus `cardnexusProductUrl` et sa table de jeux de
  `lib/prices/cardnexus.ts`. Mettre à jour l'en-tête de synchronisation déjà présent.
- `src/components/CardPriceDetails.tsx` — nommer la place de marché, construire le
  lien par `marketProductUrl(price.source, gameSlug, price.productId)`.
- `src/components/CardPriceTag.tsx`, `src/lib/offline-adapters.ts` — suivre le type.
- i18n : namespace `prices` (5 clés) revu — `prices.openOnSource` interpole `{{source}}`.
  Les noms de marques ne se traduisent pas (règle de `lib/prices/sources.ts`).

**Écarté** : la fiche « tous les fournisseurs » (l'API ne sert qu'un prix par carte),
et le réglage de la préférence (server action `account/price-actions.ts`).

---

### Lot 2 — Échange au format texte (0.34.0)

Basculer chaque offre entre vue cartes et vue texte, collable depuis une conversation.

**joutes-app** — aucune route. Documenter `POST /trades/cards/resolve` dans
`openapi.yaml` (absent : `grep "/trades/cards"` ne rend rien) — corps de
`tradeCardResolveSchema` (`lib/schemas/trade.schema.ts`), réponse `{ matches }` de
même longueur et même ordre que `cards`, `null` pour l'irrésolu. En profiter pour
écrire dans la description du tag que **toutes** les routes `trades/*` n'acceptent
que le cookie de session (elles n'appellent jamais `authenticateApiRequest`).

**joutes-mobile**
- `src/lib/trade-text.ts` — portage de `lib/trade/text.ts` (194 l., pur), avec
  `TRADE_MAX_CARDS_PER_SIDE` et `normalizeCardName` (qui vient de `lib/decks/text.ts`,
  à déposer dans `src/lib/deck-text.ts` — le reste du module arrive au lot 4).
- `src/api/trades.ts` — `resolveTradeCards(scope, cards)`, **sans cache**.
- `src/components/TradeTextSheet.tsx` — feuille sur le modèle de
  `TradeCardPickerSheet.tsx` : zone de texte monospace, rapport d'appariement
  (appariées / fondues / non reconnues), bouton Appliquer.
- `src/screens/TradeDetailScreen.tsx` — bascule cartes/texte par face, copie possible
  même sur l'offre du partenaire et sur un échange clos.
- i18n : ~10 clés dans le namespace `trades` existant.

**Garde à porter telle quelle** (commit `b76266e` côté web) : si la lecture d'un
texte non vide ne rend aucune entrée, on affiche l'erreur et **on n'écrit rien** —
une liste illisible ne vide pas l'offre.

---

### Lot 3 — Decks : lecture, librairie, favoris (0.35.0)

Retrouver ses decks, parcourir la librairie publique avec ses facettes, lire une
fiche complète, copier un deck chez soi.

**joutes-app** — pas de code applicatif, mais `openapi.yaml` ment sur trois points :
- schéma `Deck` (l. 4515) : ajouter `cards` (nouveau schéma `DeckCards`, clés =
  zones), `guide`, `matchups`, `format`, `legendCardId`, `legendName`, `domains`,
  `favoritesCount`, `views`, `version` ; `visibility` devient
  `[private, unlisted, public]` ; documenter que `notes` n'est jamais servi à un tiers ;
- `GET /decks` : `visibility` est **répétable** (le code fait `getAll`), `scope`
  accepte `public`, et `format` / `legendCardId` / `domain[]` sont de vrais filtres ;
  documenter le 400 « non répertorié non listable » hors `scope=mine` ;
- documenter `POST /decks/{deckId}/copy`, `GET /decks/legends?gameId=`,
  `GET|POST /games/{gameId}/deck-cards`.
Vérité : `app/api/decks/route.ts`, `lib/schemas/deck.schema.ts`, `lib/types/Deck.ts`.

Vérifier au passage si `Game` porte déjà `formats` ; sinon ajouter
`GET /api/decks/formats?gameId=` sur le modèle exact de `/decks/legends`
(agrégation `$group` à côté de `getDeckLegendFacets`).

**joutes-mobile**
- Modules portés dans `src/lib/` avec en-tête de synchronisation : `deck-zones.ts`
  (de `lib/decks/zones.ts` — les zones sont déclarées par le jeu, pas par le deck),
  `deck-contents.ts` (de `lib/decks/contents.ts` : `deckSize`, `deckLegality`,
  `costCurve`, `typeSplit`…). Rien de ce qui se calcule n'est stocké, des deux côtés.
- `src/api/decks.ts` — `listMyDecks`, `searchDeckLibrary`, `getDeck`, `getDeckCards`,
  `toggleDeckFavorite`, `copyDeck`, `listDeckLegends`. Cache : `withCache` sur la
  fiche et les cartes (une fiche consultée en boutique sans réseau reste utile),
  **aucun** sur les listes paginées et les écritures. Pas d'`offlineFirst` : les decks
  ne sont pas dans le document d'export d'un jeu.
- Écrans : `DecksScreen` (onglets Tous / En cours / Publiés / Favoris),
  `DeckLibraryScreen` (facettes jeu / format / légende / domaines, tris),
  `DeckDetailScreen` (en-tête, onglets Description / Guide / Cartes, favori, copie).
  `DeckLibraryScreen` suit le pattern imposé : `PAGE_SIZE` en tête de module, état
  local, recherche débouncée 300 ms, `setPage(1)` sur changement de critère,
  `requestId = useRef(0)`, accumulation, bouton `load-more`.
- Routes : `/decks`, `/decks/library`, `/decks/:deckId`. Entrées depuis
  `CollectionScreen` (« Mes decks ») et `GameScreen` (« Librairie »).
- i18n : **nouveau namespace `decks`** (~60 clés × 4 locales), à ne pas confondre
  avec `deck` (26 clés), qui est celui du vérificateur.
- CSS : section commentée en fin de `styles.css` (`.deck-card`, `.deck-hero`,
  `.deck-zone`, `.deck-curve`, `.deck-facet-chip`…), `flex-wrap` sur toute rangée de
  `chip`/`btn`.

**Écarté / dégradé**
- Fiche auteur et fiche visiteur fusionnées en un seul écran (l'édition arrive au lot 4).
- `collectionCoverage` porté mais **non branché** : il faudrait lire la collection
  pour un deck tiers, ce que l'API n'expose pas.
- Code d'export Riftbound écarté (dépendance npm pour un bouton) — remplacé par
  « Copier la liste au format texte ».
- Les libellés de zones viennent de l'i18n (`t('decks.zones.' + zone.key)`), pas du
  `label` français en dur du module porté : à écrire dans l'en-tête de synchronisation.

---

### Lot 4 — Decks : édition sur mobile (0.36.0)

Créer un deck, y coller une liste, corriger les quantités, écrire son guide, régler
sa visibilité.

**joutes-app** — rien ; vérifier seulement que la seconde branche du `oneOf` du
PATCH bimodal liste bien les nouveaux champs.

**joutes-mobile**
- `src/lib/deck-text.ts` complété (`ZONE_ALIASES`, `parseDeckText`,
  `stringifyDeckText`, `applyDeckText`) ; `deck-contents.ts` gagne
  `changeCardQuantity` / `setCardQuantity`.
- `src/api/decks.ts` — `createDeck`, `updateDeck`, `deleteDeck`,
  `resolveDeckCardsByName`.
- Composants : `CreateDeckSheet`, `DeckTextSheet` (même grammaire que
  `TradeTextSheet` du lot 2), `DeckGuideEditor`, `DeckMatchupsEditor`,
  `DeckVisibilitySheet`.
- `src/screens/DeckEditScreen.tsx` — une zone à la fois, cartes en lignes avec
  −/quantité/+, bouton « Coller une liste ». Route `/decks/:deckId/edit`.
- L'ajout d'une carte absente réutilise `GameCardsScreen` en mode « choisir une carte ».
- i18n : ~35 clés de plus dans `decks`.

**Écarté** : le catalogue permanent à l'écran et le glisser-déposer ; `DeckAnalysis`
réduit à la courbe de coûts et au compteur de légalité par zone.

**À signaler dans la PR** : l'API n'a **pas** de contrôle de version optimiste sur
les decks (`version` est incrémenté mais jamais vérifié). Éditer depuis deux
appareils écrase en silence. Ajouter un `expectedVersion` au PATCH est hors
périmètre mais mérite une décision.

---

### Lot 5 — Profil-vitrine, suivi, succès (0.37.0)

Le profil devient une vitrine : blocs dans l'ordre choisi, decks publics, succès
complets, bouton « Suivre ».

**joutes-app** — 3 routes, sous le tag `Users` :
- **Étendre `GET /users/{userTagOrId}`** (additif, aucun champ existant ne change) :
  `showcase` (`readUserShowcaseSections`, `lib/users/showcase.ts`), `followersCount`,
  `isFollowing`, `badges` (`lib/db/user-badges.ts`), `live`. Ce sont exactement les
  lectures de `app/[locale]/(app)/users/[userTagOrId]/profile-data.ts` : déplacer les
  lectures partagées dans `lib/users/profile.ts` et faire pointer la page et la route
  dessus, pour qu'une évolution de la vitrine ne divise pas les deux.
- **`PUT|DELETE /users/{userTagOrId}/follow`** → `{ following, followersCount }`.
  `toggleUserFollower` est une bascule : ajouter `followUser` / `unfollowUser`
  idempotents dans `lib/db/user-followers.ts` et réécrire la bascule par-dessus, pour
  que la server action existante reste inchangée. Une bascule en REST est une
  invitation au double-clic.
- **`GET /users/{userTagOrId}/achievements`** — route séparée parce que l'onglet
  montre aussi les succès **non décrochés** : le catalogue entier ne doit pas se payer
  à chaque ouverture d'un profil. Via `getAchievementsForUser` et
  `unlockedMostRecentFirst`.

**joutes-mobile**
- `src/lib/user-showcase.ts` — portage de `lib/users/showcase.ts` et
  `lib/users/profile-tabs.ts` (`visibleProfileTabs`, `sectionsForTab`), purs et testés.
- `src/api/users.ts` — `followUser`, `unfollowUser` (sans cache, avec `cacheDelete`
  du profil), `getUserAchievements` (`withCache`).
- Composants : `FollowButton` (bascule optimiste, réutilisé aux lots 7 et 9),
  `AchievementRow`, `ProfileSectionCard`.
- `src/screens/UserProfileScreen.tsx` (235 l.) — refonte : en-tête (bannière, avatar,
  badges, abonnés, Suivre, direct), barre d'onglets calculée par `visibleProfileTabs`
  (un onglet vide n'est pas rendu), blocs dans l'ordre de `readUserShowcaseSections`.
- i18n : namespace `profile` étendu (~45 clés).

**Écarté** : le réglage de sa propre vitrine (lien « Régler ma vitrine sur
joutes.app »), le bloc « échange » (`readProfileTradeMatches` n'a pas d'API), la
demande d'ami (server action).

---

### Lot 6 — Publications et registre communautaire (0.38.0)

Lire les publications d'un joueur, parcourir le registre à quatre filtres.

**joutes-app** — 3 routes :
- `GET /users/{userTagOrId}/contents` — `listPublicContentsByAuthor`.
- `GET /users` — le registre. Paramètres repris **mot pour mot** de
  `readRegistryFilters` (`lib/users/registry-search.ts`) pour qu'un lien web et un
  appel mobile donnent la même page : `q`, `game`, `city`, `sells`, `live`, `sort`,
  `count`. **Extraction** : déplacer `readRegistry` et ses lectures de
  `app/[locale]/(app)/users/registry-data.ts` vers `lib/users/registry.ts`, la page
  devenant une façade — `await connection()` et le `cache` de React n'ont rien à faire
  dans un handler d'API.
- `POST /play-groups/{id}/contents` et `POST /users/me/contents` limités au genre
  vidéo / replay (titre + URL), pour l'écriture arbitrée. L'article markdown reste web.
- Documenter que `count` est un **compteur cumulé**, pas un numéro de page.

**joutes-mobile**
- `src/lib/user-registry.ts` — portage de `parseRegistrySearch`, `REGISTRY_SORTS`,
  `readRegistrySort`.
- Écrans : `CommunityScreen` (`/community`, recherche débouncée, quatre filtres,
  trois tris, bande « en direct »), `UserContentScreen` (article en markdown par
  `AnnotatedMarkdown` ; une vidéo ouvre son URL en `<a target="_blank" rel="noopener noreferrer">`),
  plus une feuille « Publier une vidéo » (titre + URL).
- Entrée depuis `SocialScreen`. i18n : **nouveau namespace `community`** (~40 clés).

**Dégradé** : « proches de moi » repose sur `me.location.city`, que le mobile ne peut
ni lire ni régler — le filtre `city` reste, alimenté par `GET /api/geo/places?q=`
(public), la section « joueurs de votre commune » n'apparaît pas.

---

### Lot 7 — Lieux : la vitrine (0.39.0)

Ouvrir la fiche d'un lieu : actualité épinglée, événement à la une, horaires du jour,
agenda, jeux joués ici, itinéraire, suivi.

**joutes-app** — 4 routes, tag `Lairs` (aujourd'hui réduit à une seule opération) :
- **`GET /lairs/{lairId}` — la route qui manque.** Reprendre exactement la porte de
  confidentialité de `requireVisibleLair`
  (`app/[locale]/(app)/lairs/[lairId]/lair-data.ts`) : un lieu privé n'est servi qu'à
  ceux qui le suivent ou à son équipe, sinon **404 et jamais 403** — un 403
  confirmerait son existence. Rendre le `Lair` de `toLair` (`proGrant` en est déjà
  exclu, c'est délibéré), plus `isPro` (booléen seul, jamais le motif),
  `followersCount`, `isFollowing`.
- `GET /lairs/{lairId}/events?year=&gameId=` — via `getEventsByLairId`. Vérifier
  d'abord si `GET /events?lairId=` suffit : ce serait moins de surface.
- `PUT|DELETE /lairs/{lairId}/follow` — `addLairToUser` / `removeLairFromUser`
  existent déjà en base et sont déjà appelées directement par le handler MCP ; rien à
  extraire.
- **Étendre `GET /lairs`** : passer la session en `userId` et lire `lat`/`lng`/`radius`
  → `nearLocation`. `searchLairs` les supporte déjà, l'index géospatial existe. Trois
  lignes dans la route, zéro en base — le correctif le plus rentable du plan. À
  documenter : un utilisateur connecté verra désormais les lieux privés qu'il suit.

**joutes-mobile**
- Modules portés : `lair-hours.ts` (de `lib/lairs/opening-hours.ts` — gère les
  horaires coupés et le 0/7 du dimanche ; **la version web utilise `luxon`, absent du
  mobile** : porter en `Intl.DateTimeFormat` + arithmétique de minutes, et l'écrire
  dans l'en-tête), `lair-sections.ts`, `lair-theme.ts` (accent → variable CSS
  `--lair-accent`), `lair-urls.ts` (à croiser avec `isSafeUrl` déjà en place).
- `src/api/lairs.ts` (sort de `social.ts`), composants `LairHours`, `LairNewsCard`,
  écrans `LairsScreen` (`/lairs`) et `LairDetailScreen` (`/lairs/:lairId`, quatre
  onglets). Entrées depuis `EventsScreen` et `SocialScreen`.
- i18n : **nouveau namespace `lairs`** (~55 clés).

**Écarté / dégradé** : pas de carte embarquée (bouton « Itinéraire » ouvrant
`maps.apple.com` / `google.com/maps` selon la plateforme, via un `<a>` — pas via
`tauri-plugin-opener`, déclaré mais inutilisé) ; le direct devient une carte cliquable
qui ouvre l'application native ; la gestion du lieu reste web ; la marque blanche est
appliquée à l'accent et au logo, pas aux surfaces (`tintSurfaces` abîme le mode sombre).

---

### Lot 8 — Groupes de jeu : l'Établi (0.40.0)

Proposer des créneaux, voter, confirmer, répondre présent, lire les annonces, gérer
les membres.

**joutes-app** — 8 routes plus un correctif. Toute la logique existe
(`lib/db/play-group-sessions.ts`, 370 l.) ; chaque route reprend le corps de la
server action homonyme de `play-groups/[playGroupId]/actions.ts` : garde d'accès par
`readMemberRole` + `canManagePlayGroup` (`lib/play-groups/access.ts`, purs et testés),
puis appel de la fonction de base, `revalidatePath` remplacé par une réponse JSON.

```
GET|POST   /play-groups/{id}/sessions                     membre
GET|PATCH|DELETE /play-groups/{id}/sessions/{sessionId}   membre / canManage
POST       /play-groups/{id}/sessions/{sessionId}/vote    membre   (bascule un créneau)
POST       /play-groups/{id}/sessions/{sessionId}/confirm canManage
PUT        /play-groups/{id}/sessions/{sessionId}/rsvp    membre   { yes|maybe|no }
GET|POST   /play-groups/{id}/announcements                membre / canManage
PATCH|DELETE /play-groups/{id}/announcements/{aId}        canManage
```

**Correctif bloquant** : `GET /play-groups/{playGroupId}` est réservé aux membres
(`getPlayGroupByIdAndUser`) alors que la vitrine est publique depuis la refonte.
Passer à `getPlayGroupById` + `readMemberRole`, et servir une **forme allégée** à un
non-membre (nom, description, thème, visibilité, nombre de membres) — jamais la liste
des membres ni les listes partagées. Sans ce correctif le lot 9 ne peut pas exister.

Étendre aussi le schéma `PlayGroup` d'`openapi.yaml`, qui ignore `visibility` et
`options`, et documenter quel rôle peut quoi.

**joutes-mobile**
- `src/api/play-groups.ts` (les fonctions de groupe quittent `social.ts`, qui garde
  les amis), `src/lib/play-group-access.ts` (portage de `lib/play-groups/access.ts`).
- Composants : `SessionCard`, `SessionPollCard`, `RsvpButtons` (optimistes),
  `CreateSessionSheet` (date fixe ou sondage à 2-6 créneaux), `MemberActions`.
- Écrans : `PlayGroupDetailScreen` refondu (barre de vues Établi / Sessions /
  Annonces / Listes / Membres, prochaine session en tête), `PlayGroupSessionsScreen`,
  `PlayGroupAnnouncementsScreen`.
- **Aucun cache** sur les sessions et les annonces, et le commentaire doit le dire :
  une réponse RSVP servie depuis IndexedDB ferait croire à un vote enregistré.
- i18n : extension du namespace `social` (26 → ~110 clés) plutôt qu'un nouveau — le
  mobile range déjà les groupes sous `social.*`.

**Inclus par arbitrage** : la gestion des membres (inviter, promouvoir, exclure),
l'API `/play-groups/{id}/members/{memberId}` et les invitations existant déjà.

**Écarté** : la création d'un événement public depuis une session (formulaire complet).

---

### Lot 9 — Groupes : vitrine, contenus, exploration (0.41.0)

Découvrir des groupes ouverts, lire leur vitrine et leurs publications, les suivre.

**joutes-app** — 4 routes :
- `GET /play-groups/{id}/showcase` — public : groupe allégé, thème, liens, rythme,
  annonces de portée `public`, contenus, directs frais (`isFreshLive`), compteurs,
  `isFollowing`, et les publications publiques des membres via
  `listPublicContentsByAuthors(memberIds)` — la fonction existe exactement pour ça. La
  vitrine d'un groupe privé est servie, avec `indexable: false`.
- `POST|PATCH|DELETE /play-groups/{id}/contents[/{contentId}]` — `canManagePlayGroup`.
- `PUT|DELETE /play-groups/{id}/follow` — mêmes verbes idempotents qu'au lot 5.
- `GET /play-groups/explore?q=&order=&lat=&lng=&count=` — `readExploreRoll` est déjà
  dans `lib/db/`, la route ne fait que lire les paramètres.

**joutes-mobile**
- Modules portés : `play-group-explore.ts` (de `lib/play-groups/explore.ts` :
  `EXPLORE_ORDERS`, `isFreshLive`, `matchesExploreQuery`, `readInitials` ; le tri est
  fait par le serveur mais on porte quand même pour garder les fichiers alignés),
  `play-group-theme.ts`.
- Écrans : `PlayGroupsExploreScreen` (`/social/groups/explore`),
  `PlayGroupShowcaseScreen` (`/social/groups/:groupId/showcase`) ; `UserContentScreen`
  du lot 6 est réutilisé tel quel pour les contenus de groupe.
- i18n : extension de `social` (~45 clés).

**Dégradé** : le tri « proches » n'est proposé que si une ville a été saisie (résolue
par `GET /api/geo/places`) — pas de plugin de géolocalisation ajouté pour un tri, et
il faut le dire dans l'interface plutôt que de masquer l'option. Le blason animé du
rôle d'armes est remplacé par les initiales sur fond d'accent. Les réglages du groupe
restent web.

---

## Vérification

**joutes-app** — `npx tsc --noEmit`, `npm test` (les modules purs portés sont déjà
couverts : `lib/decks/contents.test.ts`, `lib/trade/text.test.ts`,
`lib/lairs/opening-hours.test.ts`, `lib/users/showcase.test.ts`,
`lib/play-groups/{access,explore}.test.ts` — ils doivent rester verts, on n'y touche
pas), `node scripts/check-flex-rows.mjs`, `npm run build`. Après chaque extraction de
server action, vérifier que la page web rend exactement la même chose. Relire la spec
via `GET /api/docs`.

**joutes-mobile** — `npm run build` (`tsc && vite build`) : c'est tout ce que la CI
exécute, mais `tsconfig.json` est strict (`noUnusedLocals`, `noUnusedParameters`),
donc une variable oubliée casse la CI. Plus `npm run check-i18n` (lot 0). Puis
`npm run tauri dev` sur desktop, et un passage Android pour les marges
(`--safe-top` / `--safe-bottom`, jamais `env(safe-area-inset-*)`).

**À la main, contre la production** — par lot :
1. une carte cotée par chaque fournisseur, et une carte d'un jeu absent de la table
   CardNexus (aucun lien mort) ;
2. un texte avec quantité `3x`, une puce `-`, un nom inexistant, un doublon ;
3. un deck public, un non répertorié par son lien, un privé d'un autre (403 propre),
   deux domaines cumulés (valide le `append` du lot 0), une copie qui arrive privée ;
5. un profil public riche, un profil privé (lisible, sans les blocs), le sien (pas de
   bouton Suivre), un profil à un seul onglet (pas de barre) ;
7. un lieu Pro personnalisé, un lieu nu (aucun onglet vide), un lieu à horaires
   coupés le bon jour, un lieu privé suivi puis non suivi, un lieu privé jamais suivi
   (404) ;
8. à deux comptes : sondage à trois créneaux, votes des deux côtés, confirmation
   (les votants restent comptés), présent puis absent, annonce `group` qui **ne sort
   pas** sur la vitrine.

Trois écarts connus entre la spec et la production, à revalider à chaque lot :
`GET /games` renvoie `_id` et non `id` ; le cookie s'appelle
`__Secure-better-auth.session_token` ; les écritures exigent l'en-tête
`Origin: https://www.joutes.app`.

## Points laissés ouverts

- **Concurrence sur les decks** : ajouter un `expectedVersion` au
  `PATCH /decks/{deckId}` ? Sans lui, deux appareils s'écrasent en silence (lot 4).
- **`GET /lairs` et `GET /play-groups/{id}`** changent de comportement pour les
  clients existants (lots 7 et 8). C'est nécessaire et aligné sur le web, mais cela
  se documente explicitement dans `openapi.yaml`.
- **Réglage de la préférence de fournisseur de prix** depuis le mobile : écarté au
  lot 1, à rouvrir si le réglage web se révèle introuvable.
