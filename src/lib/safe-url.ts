/** N'autorise que http(s) : évite qu'un lien `javascript:` ou un schéma inattendu se retrouve dans un `href`. */
export function isSafeUrl(url: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}
