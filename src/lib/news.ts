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

/**
 * Un texte de l'actualité, et la langue dans laquelle il est **réellement**
 * écrit.
 *
 * Le repli étant champ par champ, les trois ne sont pas forcément dans la même
 * langue : un titre traduit peut voisiner un résumé resté en VO. Poser une
 * étiquette unique sur les trois mentirait à la synthèse vocale, qui lirait du
 * français avec une prononciation anglaise, et à la coupure de mots.
 */
export type LocalizedText<T extends string | undefined = string> = { text: T; lang: string };

export type LocalizedNews = {
  title: LocalizedText;
  summary: LocalizedText<string | undefined>;
  content: LocalizedText<string | undefined>;
};

/** Un texte traduit mais blanc n'est pas une traduction : la VO reprend la main. */
function pick(
  translated: string | undefined,
  original: string | undefined,
  translatedLang: string,
  originalLang: string,
): LocalizedText<string | undefined> {
  return translated?.trim()
    ? { text: translated, lang: translatedLang }
    : { text: original, lang: originalLang };
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
    return {
      title: { text: news.title, lang: original },
      summary: { text: news.summary, lang: original },
      content: { text: news.content, lang: original },
    };
  }

  const title = pick(translation.title, news.title, lang, original);

  return {
    title: { text: title.text ?? news.title, lang: title.lang },
    summary: pick(translation.summary, news.summary, lang, original),
    content: pick(translation.content, news.content, lang, original),
  };
}
