/**
 * Marques de plateforme posées sur la racine du document, pour les réglages
 * que le CSS ne peut pas déduire seul.
 *
 * Une seule pour l'instant : **Android**. Son WebView dessine sous la barre
 * d'état sans la déclarer — `env(safe-area-inset-top)` y vaut zéro alors que
 * le contenu passe bel et bien dessous. iOS, lui, renseigne ses marges. La
 * feuille de style s'en sert pour poser un plancher sur `--safe-top` (voir
 * `:root.is-android` dans `styles.css`) — et, depuis qu'Android 15 dessine
 * aussi sous la barre de navigation, `watchSystemInsets` ci-dessous lui
 * apporte les vraies marges, lues au natif.
 *
 * Reconnaître la plateforme à l'agent utilisateur n'est joli nulle part ; ici
 * c'est le défaut d'une plateforme qu'on compense, et rien d'autre n'en dit
 * autant depuis le JavaScript.
 */

export function isAndroid(userAgent: string): boolean {
  return /android/i.test(userAgent);
}

export function markPlatform(
  root: Element = document.documentElement,
  userAgent: string = navigator.userAgent,
): void {
  if (isAndroid(userAgent)) root.classList.add("is-android");
}

/**
 * Les marges des barres système Android, lues au natif.
 *
 * Android 15 dessine le WebView sous la barre de navigation aussi — et pas
 * seulement sous la barre d'état — sans rien déclarer au CSS. La commande
 * `android_system_insets` (`src-tauri/src/lib.rs`) répond ce que le système
 * sait, en pixels CSS ; on le pose sur la racine, et la feuille de style en
 * fait un plancher pour `--safe-top` et `--safe-bottom` (`:root.is-android`).
 *
 * Rien n'est bloquant : le premier rendu part avec les planchers historiques,
 * et les variables arrivent quelques millisecondes plus tard. Une rotation ou
 * un changement de mode de navigation refait la lecture.
 */
export type SystemInsets = { top: number; bottom: number; left: number; right: number };

let coreModule: Promise<typeof import("@tauri-apps/api/core")> | null = null;

function loadCore() {
  if (!coreModule) coreModule = import("@tauri-apps/api/core");
  return coreModule;
}

export async function readSystemInsets(): Promise<SystemInsets | null> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return null;
  try {
    const { invoke } = await loadCore();
    return await invoke<SystemInsets>("android_system_insets");
  } catch {
    return null;
  }
}

export function applySystemInsets(
  insets: SystemInsets,
  root: HTMLElement = document.documentElement,
): void {
  const px = (value: number) => `${Math.max(0, Math.round(value))}px`;
  root.style.setProperty("--android-inset-top", px(insets.top));
  root.style.setProperty("--android-inset-bottom", px(insets.bottom));
  root.style.setProperty("--android-inset-left", px(insets.left));
  root.style.setProperty("--android-inset-right", px(insets.right));
}

/**
 * À appeler une fois au démarrage, après `markPlatform()` : ne fait rien hors
 * Android, et s'abonne aux changements de géométrie de la fenêtre.
 */
export function watchSystemInsets(
  root: HTMLElement = document.documentElement,
  userAgent: string = navigator.userAgent,
): void {
  if (!isAndroid(userAgent)) return;

  // Une rotation lâche plusieurs événements de suite : une lecture en cours
  // ne les jette pas, elle en retient un et relit une fois rendue — sinon les
  // marges appliquées seraient celles d'un état intermédiaire.
  let pending = false;
  let again = false;
  const refresh = () => {
    if (pending) {
      again = true;
      return;
    }
    pending = true;
    void readSystemInsets().then((insets) => {
      pending = false;
      if (insets) applySystemInsets(insets, root);
      if (again) {
        again = false;
        refresh();
      }
    });
  };

  refresh();
  window.addEventListener("resize", refresh);
  window.addEventListener("orientationchange", refresh);
}
