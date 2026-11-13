import type { PlayGame } from "../api/play";

/**
 * Le mode hôte : une partie sur le serveur de parties de quelqu'un d'autre.
 * Sur le site, l'invitation porte l'adresse du serveur et le ticket dans le
 * fragment (`#server=…&ticket=…`) ; dans l'app, le fragment sert déjà au
 * routeur, donc l'écran les reçoit en paramètres (`?server=…&ticket=…`).
 */
export function remotePath(game: PlayGame, server: string, ticket: string): string {
  return `/play/${game}/remote?server=${encodeURIComponent(server)}&ticket=${encodeURIComponent(ticket)}`;
}

/** L'adresse WebSocket d'une partie hébergée, à partir de l'adresse du serveur et d'un ticket. */
export function remoteSocketUrl(server: string, ticket: string): string | null {
  try {
    const body = JSON.parse(atob(ticket.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"))) as { game?: unknown };
    if (typeof body.game !== "string") return null;
    const base = new URL(server);
    if (base.protocol !== "http:" && base.protocol !== "https:") return null;
    base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    const path = base.pathname.replace(/\/+$/, "");
    return `${base.origin}${path}/games/${encodeURIComponent(body.game)}/ws?ticket=${encodeURIComponent(ticket)}`;
  } catch {
    return null;
  }
}
