import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { markPlatform, watchSystemInsets } from "./lib/platform";
import "./i18n";

// Avant le premier rendu : la marque décide de marges que le premier écran
// utilise déjà.
markPlatform();
// Les marges réelles des barres système Android arrivent juste après, sans
// retenir le premier rendu.
watchSystemInsets();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
