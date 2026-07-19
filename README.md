# Joutes Mobile

Application mobile (et desktop) pour [Joutes](https://joutes.app), construite avec **Tauri 2** et **React** (TypeScript + Vite). Elle consomme l'[API Joutes](https://api.joutes.app/api/docs).

## Architecture

```
src/
  api/            Couche d'accès à l'API Joutes
    client.ts     Client HTTP (base URL, Bearer token, erreurs)
    http.ts       Transport : plugin HTTP Tauri (natif, sans CORS) ou fetch navigateur
    endpoints.ts  Chemins des endpoints, centralisés
    types.ts      Types des données de l'API
    auth.ts       Service d'authentification
  store/
    auth.tsx      Contexte React : session, restauration du token, login/logout
  screens/        Écrans (Login, Accueil, Réglages)
  components/     Composants partagés (barre d'onglets…)
  storage.ts      Persistance clé/valeur (plugin Store Tauri / localStorage)
  config.ts       Configuration (URL de l'API…)
src-tauri/        Projet Rust Tauri (plugins http, store, opener)
```

Points clés :

- **Appels API sans CORS** : dans l'app, les requêtes passent par le plugin HTTP de Tauri (couche native), avec une permission limitée à `https://*.joutes.app` (voir `src-tauri/capabilities/default.json`).
- **Session persistante** : le token est stocké via le plugin Store de Tauri et restauré au démarrage.
- **URL de l'API surchargeable** : définir `VITE_JOUTES_API_URL` pour pointer vers un autre environnement.

> ⚠️ **À faire — aligner sur la spec réelle** : la documentation `https://api.joutes.app/api/docs` n'était pas accessible depuis l'environnement qui a généré ce squelette. Les chemins dans `src/api/endpoints.ts` et les types dans `src/api/types.ts` sont des valeurs par défaut à vérifier avant la mise en service.

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

Le frontend seul peut aussi être lancé dans un navigateur avec `npm run dev` (les appels API utilisent alors `fetch` et sont soumis au CORS).

## Build

```bash
npm run tauri build            # desktop
npm run tauri android build    # APK / AAB
npm run tauri ios build        # IPA
```
