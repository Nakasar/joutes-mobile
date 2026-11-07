import { isTauri } from "../api/http";

/**
 * Enregistre un fichier texte là où la personne le choisit.
 *
 * Dans l'app, la webview ne télécharge pas un lien `blob:` : on demande un
 * emplacement au système (`plugin-dialog`), puis on y écrit (`plugin-fs`,
 * qui sait écrire dans l'URI de contenu qu'Android renvoie). Dans un
 * navigateur (développement), un lien de téléchargement suffit.
 *
 * Renvoie `false` si la personne a renoncé.
 */
export async function saveTextFile(fileName: string, content: string, mimeType: string): Promise<boolean> {
  if (isTauri()) {
    const [{ save }, { writeTextFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const extension = fileName.split(".").pop() ?? "csv";
    const path = await save({
      defaultPath: fileName,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    });
    if (!path) return false;
    await writeTextFile(path, content);
    return true;
  }

  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
