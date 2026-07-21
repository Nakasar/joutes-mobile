import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import de from "./locales/de.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import it from "./locales/it.json";

export const SUPPORTED_LANGUAGES = ["fr", "en", "de", "it"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Libellés affichés dans le sélecteur de langue (chacun dans sa propre langue). */
export const LANGUAGE_LABELS: Record<Language, string> = {
  fr: "Français",
  en: "English",
  de: "Deutsch",
  it: "Italiano",
};

/** Clé de persistance du choix manuel de langue (localStorage). */
export const LANGUAGE_STORAGE_KEY = "joutes.lang";

void i18n
  // Détecte la langue : choix mémorisé (localStorage) sinon langue de l'appareil.
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      de: { translation: de },
      it: { translation: it },
    },
    fallbackLng: "fr",
    supportedLngs: [...SUPPORTED_LANGUAGES],
    // Rabat les variantes régionales (fr-CA → fr, de-AT → de).
    load: "languageOnly",
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });

// Tient l'attribut <html lang> à jour pour l'accessibilité et la césure.
function syncDocumentLang(lng: string) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
}
syncDocumentLang(i18n.resolvedLanguage ?? "fr");
i18n.on("languageChanged", syncDocumentLang);

/** Balise BCP-47 de la langue active, pour `toLocale*` (dates, nombres). */
export function currentLocale(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? "fr";
}

export default i18n;
