# Joutes Mobile

Application mobile (et desktop) pour [Joutes](https://joutes.app) — plateforme compagnon pour les communautés de jeux de cartes à collectionner (collection, decks, actualités, quiz, scanner de cartes, événements, boutiques, ligues, amis, groupes de jeu, wishlists, listes de vente). Construite avec **Tauri 2** et **React** (TypeScript + Vite), elle consomme l'[API Joutes](https://api.joutes.app/api/docs) (OpenAPI 2.0.0).

## Fonctionnalités actuelles

- **Actualités** : fil des news (bannières, jeux liés, likes)
- **Jeux** : catalogue des jeux (Magic, Star Wars Unlimited, Riftbound…)
- **Galerie de cartes** : exploration du catalogue de cartes d'un jeu — recherche plein texte (Meilisearch), filtres par set et par type, pagination
- **Détail d'une carte** : image, coût/type/set, et ses **erratas, clarifications et rulings** (markdown rendu, traduction française affichée quand elle existe, votes, obsolescence)
- **Contributions communautaires** : proposer un errata / une clarification / un ruling depuis la fiche d'une carte (ouvert à tout compte connecté), publier une politique pour un jeu (comptes portant `policies:update`), et voter 👍/👎 sur les erratas comme sur les politiques — revoter à l'identique retire le vote
- **Quizz** : liste des quizz d'un jeu et réponse aux questions (choix unique/multiple, texte, nombre) avec correction et retours par section, dans la langue de l'app quand le quizz y est traduit. La création et la traduction d'un quizz restent sur le web.
- **Foil et variantes d'impression** : une carte qui n'existe qu'en foil porte un voile irisé animé sur son illustration (galerie, fiche, collection, listes) et un badge « Foil » ; ses **variantes d'impression** (promo pack, pre-release, judge…) sont listées sur sa fiche et proposées au choix partout où un exemplaire est enregistré (collection, liste de souhaits), une variante imprimée en foil imposant le foil sur l'exemplaire
- **Événements** : calendrier mensuel des tournois/événements avec navigation par mois
- **Tournois — portail joueur** : rejoindre par code ou QR (avec ou sans compte), en-tête permanent (ronde, minuteur, annonce de l'organisation), numéro de table, prolongation accordée par l'arbitrage, saisie du résultat en deux touches (raccourcis dérivés du best-of, saisie détaillée en repli), confirmation ou contestation, classement en direct ou figé ronde par ronde (OMW%), déroulé de la journée, parcours personnel et informations pratiques
- **Tournois — ligues et jeux de figurines** : sur une phase au rythme asynchrone, l'échéance de l'intervalle remplace le minuteur et la date de jeu remplace le numéro de table ; scénario de la ronde affiché avec ses consignes de composition ; statistiques secondaires du jeu (cartes de lutte, blessures, points de victoire…) saisies partie par partie et reprises en colonnes de départage au classement
- **Tournois — puzzles** : sur une phase de type puzzle, l'en-tête montre un chronomètre parti de 0 au lieu du minuteur, l'onglet du match cède la place au puzzle à résoudre et au bouton « j'ai terminé » (quand le self-report est activé), et le classement se lit au temps, le plus rapide en tête
- **Tournois — formulaire d'inscription** : réponses au formulaire demandé par l'organisation (texte, nombre, choix, carte du jeu recherchée dans le catalogue, liste de deck analysée par le serveur), avec date limite, réponses tardives signalées et consultation en lecture seule une fois la saisie close
- **Parties hors tournoi** : dans l'onglet « Jouer », enregistrer une partie (jeu, date, amis à la table, invités sans compte, vainqueurs, scénario et notes) et consulter ses parties passées — listes d'armée du rapport de bataille comprises.
- **Table de jeu et instants** : la fiche d'une partie en rapport de bataille montre la table vue de dessus — décor, jetons à la couleur de chaque joueur, graduation tous les 10 cm — et la suite de ses **instants** (« début de partie », « fin du tour 2 »). Le créateur les édite : basculer d'un instant à l'autre, en ouvrir un nouveau (qui reprend l'état courant, une partie évolue, elle ne se redéploie pas), le renommer, y noter ce qui s'est passé — la charge décisive, l'objectif pris — le supprimer, poser une figurine tirée d'une liste d'armée, la traîner au doigt, la retirer. Les notes d'un instant s'affichent sous la table pour qui lit le rapport : les positions montrent où étaient les figurines, elles ne disent pas pourquoi. Tout est en centimètres : la `viewBox` **est** la table. Le décor, lui, se pose sur le web — il appartient à la table, pas à l'instant, et se met en place une fois pour toutes.
- **Rejoindre par QR code ou par code** : un seul bouton de l'onglet « Jouer » ouvre un tournoi comme une partie. Le code le dit lui-même — neuf caractères pour un tournoi, vingt-quatre hexadécimaux pour une partie — et devant un QR code personne ne sait ce qu'il contient avant de l'avoir lu : la question n'est donc jamais posée d'avance.
- **Retrouver un tournoi ou une partie** : recherche par nom sur les tournois, filtres par jeu et par fenêtre de dates partagés entre les deux volets, pagination des deux listes. Les tournois en cours passent en tête, les terminés sont derrière une puce plutôt que dans la liste — ce qu'on ouvre l'application pour retrouver, c'est le tournoi de la journée.
- **Collection** : vue d'ensemble de la collection par jeu avec taux de complétion (connexion requise)
- **Produits — jeux de figurines** : les jeux qui ne se jouent pas avec des cartes (Star Wars: Shatterpoint…) exposent un catalogue de **produits** — boîtes, blisters, coffrets, dont certains en contiennent d'autres. Le catalogue se parcourt sans compte (recherche, gamme, type) ; connecté, chaque tuile porte la possession et la complétude de son contenu comptée en références (« 5/8 »), avec l'anneau ambre du « tu as déjà tout dedans » sur une boîte qu'on ne possède pas. La fiche d'un produit gère ses exemplaires : ajout d'une boîte avec son contenu (décochable, une boîte d'occasion arrive rarement complète) ou d'une figurine seule, état de peinture, sous blister, descellement, détachement d'une figurine de sa boîte, retrait annoncé quand il emporte du contenu. L'écran de collection liste ces jeux à part : ils n'ont ni cartes ni set maître, et la gamme de figurines y sert de jauge.
- **Connexion** : par code OTP e-mail (Better Auth), session persistante

## Architecture

```
src/
  api/            Couche d'accès à l'API Joutes
    client.ts     Client HTTP (base URL, erreurs, cookie de session)
    http.ts       Transport : plugin HTTP Tauri (natif, sans CORS) ou fetch navigateur
    endpoints.ts  Chemins des endpoints
    types.ts      Types alignés sur la spec OpenAPI 2.0.0
    auth.ts       Connexion OTP / session / déconnexion (Better Auth)
    games.ts, news.ts, events.ts, collection.ts, products.ts   Services par ressource
  store/
    auth.tsx      Contexte React : session, restauration au démarrage
  hooks/
    useApi.ts     Hook de chargement de données (loading / error / reload)
  screens/        Écrans (Accueil, Jeux, Événements, Collection, Réglages, Login)
  components/     Composants partagés (TabBar, StatusView)
  lib/            Logique pure et stockage local (dont `tournament-presets.ts`,
                  `printings.ts`, `products.ts` et `battle-map.ts`, copies de
                  joutes-app — table de presets, résolution des variantes
                  d'impression, tables des types de produits et des états de
                  peinture, géométrie et bornes de la table de jeu : toute
                  modification doit être reportée dans les deux dépôts, le
                  serveur normalisant avec le même code à l'enregistrement)
  config.ts       Configuration (URL de l'API…)
src-tauri/        Projet Rust Tauri (plugins http + cookies, opener)
```

Points clés :

- **Appels API sans CORS** : dans l'app, les requêtes passent par le plugin HTTP de Tauri (couche native), avec une permission limitée à `joutes.app` et `*.joutes.app` (voir `src-tauri/capabilities/default.json`).
- **Authentification Better Auth** : connexion par OTP e-mail (`/auth/email-otp/send-verification-otp` puis `/auth/sign-in/email-otp`). Le cookie de session `better-auth.session_token` est géré et **persisté nativement** par le plugin HTTP (feature `cookies` de reqwest) — le JS n'y touche jamais. Au démarrage, `GET /auth/get-session` restaure l'état connecté.
- **Contenus publics sans compte** : news, jeux, événements, decks et lairs sont accessibles anonymement ; la collection et les fonctionnalités sociales demandent une session.
- **Réseau lent traité comme une coupure** (`lib/network-status.ts`) : passé 3 secondes sans réponse, l'app sert son contenu local s'il en a un et affiche le bandeau « hors connexion », **sans annuler la requête**. Quand celle-ci aboutit — ou qu'une requête redevient rapide, ou que l'appareil se reconnecte — la « génération » réseau change et `useApi` recharge en arrière-plan, sans état de chargement, pour remplacer l'affichage par les données fraîches. Tant que le réseau reste mauvais, le contenu local est servi d'emblée plutôt que d'imposer 3 secondes d'attente à chaque écran, et un seul rafraîchissement est déclenché par épisode dégradé (sinon chaque réponse tardive en relancerait une autre, indéfiniment).
- **URL de l'API surchargeable** : `VITE_JOUTES_API_URL` (défaut : `https://api.joutes.app/api`).
- **Marges de sécurité** (`--safe-top`, `--safe-bottom` dans `styles.css`) : à utiliser plutôt que `env(safe-area-inset-*)` en direct. iOS renseigne ses marges (encoche, barre gestuelle) ; **Android dessine sous la barre d'état sans la déclarer** — `env()` y vaut zéro. Un plancher de 24 px est donc posé pour Android seulement, la racine étant marquée `is-android` par `markPlatform()` (`src/lib/platform.ts`), appelé au démarrage depuis `src/main.tsx` avant le premier rendu.

Particularités de l'API constatées (testées contre la production le 2026-07-19, connexion OTP réelle incluse) :

- `GET /games` renvoie les identifiants dans `_id` (la spec indique `id`) ; le détail d'un jeu est accessible par id **ou** par slug.
- Le cookie de session s'appelle `__Secure-better-auth.session_token` (préfixe `__Secure-`, la spec mentionne `better-auth.session_token`).
- Les écritures authentifiées (ex. `POST /auth/sign-out`) exigent un en-tête `Origin` de confiance, sinon 403 `INVALID_ORIGIN`. `https://www.joutes.app` est accepté ; `https://joutes.app`, `https://api.joutes.app` et `tauri://localhost` sont rejetés. Le client l'envoie donc explicitement dans l'app (voir `src/api/client.ts`).

## Prérequis

- [Node.js](https://nodejs.org) ≥ 20 et npm
- [Rust](https://rustup.rs) (stable)
- Selon la cible : [prérequis Tauri](https://tauri.app/start/prerequisites/) pour Linux/macOS/Windows, Android Studio + NDK pour Android, Xcode pour iOS

Planchers des systèmes visés, déclarés dans `src-tauri/tauri.conf.json` :

| Plateforme | Minimum | Réglage |
| --- | --- | --- |
| iOS / iPadOS | 16.0 | `bundle.iOS.minimumSystemVersion` |
| Android | API 24 (7.0) | `bundle.android.minSdkVersion` (défaut Tauri) |

Le projet Xcode n'est pas versionné : il est régénéré par `tauri ios init` à
partir de cette configuration, et c'est donc elle qui fait foi.

## Développement

```bash
npm install

# Desktop (fenêtre au format mobile)
npm run tauri dev

# Android (nécessite Android Studio / SDK / NDK)
npm run tauri android init   # une seule fois, génère src-tauri/gen/android
npm run tauri android dev

# iOS (nécessite Xcode, sur macOS)
npm run tauri ios init       # une seule fois, génère src-tauri/gen/apple
npm run tauri ios dev
```

Le frontend seul peut aussi être lancé dans un navigateur avec `npm run dev` (les appels API utilisent alors `fetch` avec `credentials: "include"` et sont soumis au CORS du serveur).

## Build

```bash
npm run tauri build            # desktop
npm run tauri android build    # APK / AAB
npm run tauri ios build        # IPA
```

## CI/CD (GitHub Actions)

- **`ci.yml`** — sur chaque push/PR : typecheck TypeScript + build du frontend.
- **`mobile-build.yml`** — sur tag `v*` ou déclenchement manuel :
  - **Android** (Ubuntu) : `tauri android init` puis build **APK + AAB** (arm64). Non signés par défaut ; signés si les secrets sont présents.
  - **iOS / iPadOS** (macOS) : `tauri ios init` puis build **IPA** signé (export `app-store-connect`) si les secrets Apple sont présents ; sinon build non signé (`CODE_SIGNING_ALLOWED=NO`) pour valider la compilation, empaqueté en `.ipa` d'artefact.
  - Sur un tag, les artefacts signés sont attachés à la release GitHub.

Secrets à configurer dans le dépôt pour la signature :

| Plateforme | Secret | Contenu |
|---|---|---|
| Android | `ANDROID_KEYSTORE` | keystore `.jks` encodé en base64 |
| Android | `ANDROID_KEYSTORE_PASSWORD` | mot de passe du keystore |
| Android | `ANDROID_KEY_ALIAS` | alias de la clé |
| Android | `ANDROID_KEY_PASSWORD` | mot de passe de la clé |
| iOS | `ASC_KEY_ID` | Key ID de la clé App Store Connect |
| iOS | `ASC_ISSUER_ID` | Issuer ID de la clé App Store Connect |
| iOS | `ASC_API_KEY` | fichier `.p8` de la clé App Store Connect, en base64 |
| iOS | `APPLE_DEVELOPMENT_TEAM` | identifiant d'équipe Apple (ex. `ABCDE12345`) |
| Android | `GOOGLE_SERVICES_JSON` | `google-services.json` du projet Firebase, en base64 |

L'IPA App Store nécessite un profil de provisionnement de distribution correspondant à l'identifiant `app.joutes.mobile` ; avec la clé App Store Connect, `xcodebuild` le résout ou le crée lui-même (`-allowProvisioningUpdates`).

## Notifications push

L'application enregistre son jeton auprès de l'API dès que la session est
établie, et le retire à la déconnexion — **avant** de fermer la session, sans
quoi la requête part sans cookie et le téléphone continue de recevoir les
notifications du compte quitté.

Le projet natif n'étant pas versionné (`src-tauri/gen/` est recréé à chaque
construction), la configuration Firebase et l'entitlement APNs sont rejoués
après l'`init` par `scripts/setup-android-push.sh` et `scripts/setup-ios-push.sh`,
sur le modèle de l'étape qui réapplique l'icône.

Deux choses ne peuvent pas être automatisées et se font une fois pour toutes :
la capacité **Push Notifications** sur l'App ID `app.joutes.mobile` dans le
portail Apple Developer, et la clé APNs `.p8` — **distincte** de la clé App
Store Connect ci-dessus, ce sont deux `.p8` de nature différente. Le reste est
documenté dans `docs/PUSH_NOTIFICATIONS.md` du dépôt `joutes-app`.
