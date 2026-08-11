/**
 * Marques de plateforme posées sur la racine du document, pour les réglages
 * que le CSS ne peut pas déduire seul.
 *
 * Une seule pour l'instant : **Android**. Son WebView dessine sous la barre
 * d'état sans la déclarer — `env(safe-area-inset-top)` y vaut zéro alors que
 * le contenu passe bel et bien dessous. iOS, lui, renseigne ses marges. La
 * feuille de style s'en sert pour poser un plancher sur `--safe-top`, et
 * seulement là (voir `:root.is-android` dans `styles.css`).
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
