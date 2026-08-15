import type { News } from "../api/types";

/**
 * Lire une actualité dans la langue de l'application.
 *
 * Le repli est **champ par champ** : une traduction commencée montre ce qui est
 * traduit et laisse le reste en version originale, plutôt que de tout renvoyer
 * en VO. C'est la règle des quizz et du site, et elle vaut ici pour la même
 * raison — un résumé pas encore écrit ne doit pas emporter le corps avec lui.
 *
 * L'application ne fait que lire : les traductions se saisissent sur le site.
 */

export type LocalizedNews = {
  title: string;
  summary?: string;
  content?: string;
  /** La langue effectivement affichée, pour l'attribut `lang` du texte. */
  lang: string;
};

/** Un texte traduit mais blanc n'est pas une traduction : la VO reprend la main. */
function pick(translated: string | undefined, original: string | undefined): string | undefined {
  return translated?.trim() ? translated : original;
}

export function localizeNews(news: News, lang: string): LocalizedNews {
  const original = news.originalLang ?? "fr";
  const translation = lang === original ? undefined : news.translations?.find((tr) => tr.lang === lang);

  const hasAnyText = !!(
    translation?.title?.trim() ||
    translation?.summary?.trim() ||
    translation?.content?.trim()
  );

  if (!translation || !hasAnyText) {
    return { title: news.title, summary: news.summary, content: news.content, lang: original };
  }

  return {
    title: pick(translation.title, news.title) ?? news.title,
    summary: pick(translation.summary, news.summary),
    content: pick(translation.content, news.content),
    lang,
  };
}
