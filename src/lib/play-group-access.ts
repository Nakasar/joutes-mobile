/**
 * Qui peut quoi dans un groupe de jeu — portage de `lib/play-groups/access.ts`
 * de joutes-app, pur et testé là-bas. Toute modification doit être reportée
 * dans les deux dépôts : c'est le serveur qui tranche, et une lecture
 * différente ici afficherait un bouton que l'API refuserait.
 *
 * `readRollFilter` n'est pas porté : c'est un filtre Mongo, et le mobile ne
 * requête pas la base.
 *
 * **Un écart assumé** : `readMemberRole` rend `null` sur un rôle inconnu, là où
 * l'original le rend tel quel. Côté serveur le rôle vient d'un document typé et
 * ne peut être que l'un des trois ; ici il vient d'une réponse HTTP, où rien ne
 * le garantit. Un rôle qu'on ne reconnaît pas ne doit surtout pas ouvrir de
 * droits, et `canManagePlayGroup(null)` est faux.
 */

export type PlayGroupMemberRole = "owner" | "admin" | "member";

export type PlayGroupVisibility = "public" | "private";

/** Le rôle du visiteur dans le groupe, ou `null` s'il n'en est pas membre. */
export function readMemberRole(
  group: { members?: { userId?: string; role?: string }[] },
  userId: string | null | undefined,
): PlayGroupMemberRole | null {
  if (!userId) {
    return null;
  }

  const role = group.members?.find((member) => member.userId === userId)?.role;

  return role === "owner" || role === "admin" || role === "member" ? role : null;
}

/**
 * Publier une annonce, confirmer un sondage, retirer un direct, gérer les
 * membres et la personnalisation : tout cela est réservé au fondateur et aux
 * admins. Un membre lit, répond aux sessions et alimente les listes.
 */
export function canManagePlayGroup(role: PlayGroupMemberRole | null): boolean {
  return role === "owner" || role === "admin";
}

/**
 * La visibilité du groupe, champ absent compris.
 *
 * Tous les groupes antérieurs à ce réglage n'ont pas le champ : les lire comme
 * publics est le seul choix qui ne change rien pour eux.
 */
export function readPlayGroupVisibility(group: {
  visibility?: string;
}): PlayGroupVisibility {
  return group.visibility === "private" ? "private" : "public";
}
