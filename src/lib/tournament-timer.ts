import type { TournamentTimer } from "../api/types";

/** `12:03` (mm:ss), ou `1:02:03` (h:mm:ss) au-delà d'une heure. Négatif une fois expiré. */
export function formatDuration(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "";
  const abs = Math.abs(Math.round(totalSeconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${sign}${h}:${mm}:${ss}` : `${sign}${mm}:${ss}`;
}

/**
 * Temps restant en secondes, corrigé du décalage d'horloge client/serveur
 * (`serverOffsetMs`, calculé à partir de `serverNow` sur chaque réponse de
 * `/live`). `null` si le minuteur n'est pas défini ou n'a jamais démarré.
 */
export function timerRemainingSeconds(
  timer: TournamentTimer | null | undefined,
  serverOffsetMs: number,
): number | null {
  if (!timer) return null;
  if (timer.running && timer.endsAt) {
    const endsAtMs = new Date(timer.endsAt).getTime();
    return (endsAtMs - (Date.now() + serverOffsetMs)) / 1000;
  }
  if (!timer.running && timer.remainingSeconds !== undefined) {
    return timer.remainingSeconds;
  }
  return null;
}

export function timerIsPaused(timer: TournamentTimer | null | undefined): boolean {
  return !!timer && !timer.running && timer.remainingSeconds !== undefined;
}
