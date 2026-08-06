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
- **Collection** : vue d'ensemble de la collection par jeu avec taux de complétion (connexion requise)
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
    games.ts, news.ts, events.ts, collection.ts   Services par ressource
  store/
    auth.tsx      Contexte React : session, restauration au démarrage
  hooks/
    useApi.ts     Hook de chargement de données (loading / error / reload)
  screens/        Écrans (Accueil, Jeux, Événements, Collection, Réglages, Login)
  components/     Composants partagés (TabBar, StatusView)
  lib/            Logique pure et stockage local (dont `tournament-presets.ts`
                  et `printings.ts`, copies de joutes-app — table de presets et
                  résolution des variantes d'impression : toute modification
                  doit être reportée dans les deux dépôts)
  config.ts       Configuration (URL de l'API…)
src-tauri/        Projet Rust Tauri (plugins http + cookies, opener)
```

Points clés :

- **Appels API sans CORS** : dans l'app, les requêtes passent par le plugin HTTP de Tauri (couche native), avec une permission limitée à `joutes.app` et `*.joutes.app` (voir `src-tauri/capabilities/default.json`).
- **Authentification Better Auth** : connexion par OTP e-mail (`/auth/email-otp/send-verification-otp` puis `/auth/sign-in/email-otp`). Le cookie de session `better-auth.session_token` est géré et **persisté nativement** par le plugin HTTP (feature `cookies` de reqwest) — le JS n'y touche jamais. Au démarrage, `GET /auth/get-session` restaure l'état connecté.
- **Contenus publics sans compte** : news, jeux, événements, decks et lairs sont accessibles anonymement ; la collection et les fonctionnalités sociales demandent une session.
- **URL de l'API surchargeable** : `VITE_JOUTES_API_URL` (défaut : `https://api.joutes.app/api`).

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
| iOS | `IOS_CERTIFICATE` | certificat de distribution `.p12` en base64 |
| iOS | `IOS_CERTIFICATE_PASSWORD` | mot de passe du `.p12` |
| iOS | `IOS_MOBILE_PROVISION` | profil `.mobileprovision` en base64 |
| iOS | `APPLE_DEVELOPMENT_TEAM` | identifiant d'équipe Apple (ex. `ABCDE12345`) |

L'IPA App Store nécessite un profil de provisionnement de distribution correspondant à l'identifiant `app.joutes.mobile`.
