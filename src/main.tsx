import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { markPlatform } from "./lib/platform";
import "./i18n";

// Avant le premier rendu : la marque décide de marges que le premier écran
// utilise déjà.
markPlatform();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
