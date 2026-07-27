/**
 * Nom d'un joueur suivi de son discriminateur (`Léa Fabre #4821`).
 *
 * Le discriminateur est lisible, pas décoratif : c'est lui qui départage deux
 * joueurs de même pseudo quand on cherche son adversaire dans la salle.
 */
export function playerTag(displayName: string, discriminator?: string): string {
  return discriminator ? `${displayName} #${discriminator}` : displayName;
}
