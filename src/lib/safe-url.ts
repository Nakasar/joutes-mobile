/** N'autorise que http(s) : évite qu'un lien `javascript:` ou un schéma inattendu se retrouve dans un `href`. */
export function isSafeUrl(url: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * La valeur est-elle une adresse http(s) écrite comme telle ?
 *
 * Sert à trancher « URL ou texte ? » sur un champ qui accepte les deux : la
 * source d'un errata, celle d'une politique, et l'icône d'un succès — que
 * l'API sert en emoji (`🎲`) et non en image. Un test de présence ne suffit
 * pas : `<img src="🎲">` est une URL relative valide pour le navigateur, qui
 * la demande, échoue, et affiche son icône d'image cassée.
 *
 * Distinct d'`isSafeUrl` : celui-ci demande « puis-je poser ça dans un href
 * sans risque ? », celui-là « est-ce que c'est une adresse, au fond ? ».
 */
export function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}
