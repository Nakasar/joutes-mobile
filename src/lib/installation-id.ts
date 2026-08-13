const STORAGE_KEY = "joutes.installation-id";

/**
 * Identifiant de cette installation de l'application.
 *
 * Le jeton de notification, lui, tourne : le système en redonne un nouveau
 * après une réinstallation ou la restauration d'une sauvegarde. Sans un repère
 * stable, chaque rotation ajouterait un appareil de plus dans la liste du
 * compte, et l'utilisateur y verrait cinq téléphones là où il n'en a qu'un.
 *
 * `localStorage`, comme la langue (`joutes.lang`) et les clés de tournoi
 * invité : l'application n'embarque pas de plugin de stockage, et cet
 * identifiant n'a aucune valeur en soi — le perdre ne coûte qu'une ligne
 * dupliquée, que le serveur remplacera au prochain enregistrement du même
 * jeton.
 */
export function installationId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const created = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, created);
  return created;
}
