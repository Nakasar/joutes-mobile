# Joutes Mobile

Application mobile (et desktop) pour [Joutes](https://joutes.app) — plateforme compagnon pour les communautés de jeux de cartes à collectionner (collection, decks, actualités, quiz, scanner de cartes, événements, boutiques, ligues, amis, groupes de jeu, wishlists, listes de vente). Construite avec **Tauri 2** et **React** (TypeScript + Vite), elle consomme l'[API Joutes](https://api.joutes.app/api/docs) (OpenAPI 2.0.0).

## Fonctionnalités actuelles

- **Actualités** : fil des news (bannières, jeux liés, likes)
- **Jeux** : catalogue des jeux (Magic, Star Wars Unlimited, Riftbound…)
- **Événements** : calendrier mensuel des tournois/événements avec navigation par mois
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
  config.ts       Configuration (URL de l'API…)
src-tauri/        Projet Rust Tauri (plugins http + cookies, opener)
```

Points clés :

- **Appels API sans CORS** : dans l'app, les requêtes passent par le plugin HTTP de Tauri (couche native), avec une permission limitée à `joutes.app` et `*.joutes.app` (voir `src-tauri/capabilities/default.json`).
- **Authentification Better Auth** : connexion par OTP e-mail (`/auth/email-otp/send-verification-otp` puis `/auth/sign-in/email-otp`). Le cookie de session `better-auth.session_token` est géré et **persisté nativement** par le plugin HTTP (feature `cookies` de reqwest) — le JS n'y touche jamais. Au démarrage, `GET /auth/get-session` restaure l'état connecté.
- **Contenus publics sans compte** : news, jeux, événements, decks et lairs sont accessibles anonymement ; la collection et les fonctionnalités sociales demandent une session.
- **URL de l'API surchargeable** : `VITE_JOUTES_API_URL` (défaut : `https://api.joutes.app/api`).

Particularité de l'API constatée : `GET /games` renvoie les identifiants dans `_id` (la spec indique `id`) ; le détail d'un jeu est accessible par id **ou** par slug.

## Prérequis

- [Node.js](https://nodejs.org) ≥ 20 et npm
- [Rust](https://rustup.rs) (stable)
- Selon la cible : [prérequis Tauri](https://tauri.app/start/prerequisites/) pour Linux/macOS/Windows, Android Studio + NDK pour Android, Xcode pour iOS

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
