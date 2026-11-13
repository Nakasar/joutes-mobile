/* Copie de `lib/scanner-frame.ts` de joutes-app : toute modification se reporte dans les deux dépôts. */

/**
 * Découpe des images de la caméra pour les scanners de cartes : celui des
 * outils de jeu et celui de l'édition d'un booster cadrent la carte de la même
 * façon, et lisent les mêmes bandes.
 */

// Fraction of the captured frame kept, centered — matches the on-screen guide
// box so the card crop only sees the card, not whatever background surrounds it.
export const CROP_RATIO = 0.82;
// The name is printed in a horizontal band near the top on virtually every
// trading card layout. OCR-ing (and matching against) only that band —
// instead of the whole card — is what keeps rules text, flavor text, and
// artwork noise from ever being fuzzy-matched against the card-name index.
export const NAME_BAND_TOP_MARGIN_RATIO = 0.03;
export const NAME_BAND_HEIGHT_RATIO = 0.2;
export const NAME_BAND_SIDE_MARGIN_RATIO = 0.06;
// Simple contrast boost applied after grayscale conversion; text edges on
// busy card art come through much cleaner for Tesseract with this than raw color.
const CONTRAST = 1.5;

type Box = { x: number; y: number; width: number; height: number };

/** Proportions d'une carte au format standard (63 × 88 mm). */
export const CARD_ASPECT = 63 / 88;

/**
 * Options de cadrage. Sans `cardAspect`, la carte occupe tout le cadre centré ;
 * avec, elle y est inscrite à ses proportions, ce qui garde la bande du nom en
 * haut de la carte même sur une webcam en paysage.
 */
export type FrameOptions = { cardAspect?: number };

/** Zone de la carte, en fractions de l'image (gauche, haut, largeur, hauteur). */
export function cardGuide(videoWidth: number, videoHeight: number, options: FrameOptions = {}) {
  let width = CROP_RATIO;
  let height = CROP_RATIO;
  if (options.cardAspect && videoWidth && videoHeight) {
    const boxAspect = (videoWidth * CROP_RATIO) / (videoHeight * CROP_RATIO);
    if (boxAspect > options.cardAspect) width = (CROP_RATIO * videoHeight * options.cardAspect) / videoWidth;
    else height = (CROP_RATIO * videoWidth) / options.cardAspect / videoHeight;
  }
  return { left: (1 - width) / 2, top: (1 - height) / 2, width, height };
}

/** Zone de la carte dans l'image, sous le cadre de visée. */
function cardBox(video: HTMLVideoElement, options: FrameOptions = {}): Box | null {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) return null;
  const guide = cardGuide(videoWidth, videoHeight, options);
  return {
    x: Math.round(videoWidth * guide.left),
    y: Math.round(videoHeight * guide.top),
    width: Math.round(videoWidth * guide.width),
    height: Math.round(videoHeight * guide.height),
  };
}

/** Recopie une zone de l'image en niveaux de gris contrastés, ce que Tesseract lit le mieux. */
function drawHighContrast(video: HTMLVideoElement, canvas: HTMLCanvasElement, box: Box, scale = 1): boolean {
  const width = Math.round(box.width * scale);
  const height = Math.round(box.height * scale);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  ctx.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const adjusted = Math.min(255, Math.max(0, (gray - 128) * CONTRAST + 128));
    data[i] = adjusted;
    data[i + 1] = adjusted;
    data[i + 2] = adjusted;
  }
  ctx.putImageData(imageData, 0, 0);
  return true;
}

/** Bande du nom, en haut de la carte. */
export function drawNameBand(video: HTMLVideoElement, canvas: HTMLCanvasElement, options?: FrameOptions): boolean {
  const card = cardBox(video, options);
  if (!card) return false;
  return drawHighContrast(video, canvas, {
    x: card.x + Math.round(card.width * NAME_BAND_SIDE_MARGIN_RATIO),
    y: card.y + Math.round(card.height * NAME_BAND_TOP_MARGIN_RATIO),
    width: Math.round(card.width * (1 - 2 * NAME_BAND_SIDE_MARGIN_RATIO)),
    height: Math.round(card.height * NAME_BAND_HEIGHT_RATIO),
  });
}

/**
 * Toute la carte, réduite à `maxWidth` : selon le jeu, le nom n'est pas en
 * haut (au milieu chez Riftbound), et le numéro de collection est en bas. Une
 * seule lecture de la carte entière donne les deux.
 */
export function drawCard(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  options?: FrameOptions & { maxWidth?: number },
): boolean {
  const card = cardBox(video, options);
  if (!card) return false;
  const scale = options?.maxWidth ? Math.min(1, options.maxWidth / card.width) : 1;
  return drawHighContrast(video, canvas, card, scale);
}

// Captures the full-color card crop (not the grayscale, name-band-only
// crop used for OCR) — the AI model benefits from seeing the whole card,
// not just its name.
export function captureCardImageDataUrl(video: HTMLVideoElement, options?: FrameOptions): string | null {
  const card = cardBox(video, options);
  if (!card) return null;

  const canvas = document.createElement("canvas");
  canvas.width = card.width;
  canvas.height = card.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, card.x, card.y, card.width, card.height, 0, 0, card.width, card.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}
