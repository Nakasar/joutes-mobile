import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CollectionValue } from "../api/types";
import { formatMoney } from "../lib/prices";
import { currentLocale } from "../i18n";
import { RefreshIcon } from "./icons";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Valeur estimée d'une collection — celle d'un jeu, ou de tout le compte — et
 * le bouton qui la recalcule.
 *
 * Le chiffre est un relevé daté, pas un cours : il ne bouge qu'au recalcul, et
 * c'est ce qui le rend comparable d'un mois à l'autre. L'écran doit donc dire
 * de quand il date et sur combien d'exemplaires il repose — une valeur portée
 * par deux cents cartes sur mille ne se lit pas comme le prix de la collection.
 *
 * Sans `onRecompute`, le bloc est en lecture seule.
 */
export function CollectionValueCard({
  value,
  copies,
  onRecompute,
}: {
  value?: CollectionValue;
  /** Exemplaires possédés aujourd'hui : ce qui dit si le calcul a vieilli. */
  copies: number;
  onRecompute?: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [computing, setComputing] = useState(false);
  const [failed, setFailed] = useState(false);

  const recompute = async () => {
    if (!onRecompute) return;

    setComputing(true);
    setFailed(false);
    try {
      await onRecompute();
    } catch {
      // Le réseau peut manquer, et la valeur affichée reste celle d'avant :
      // le dire vaut mieux qu'un bouton qui semble n'avoir rien fait.
      setFailed(true);
    } finally {
      setComputing(false);
    }
  };

  // La collection a bougé depuis le calcul : le chiffre parle d'un autre
  // contenu. Mieux vaut l'annoncer que le laisser passer pour celui du jour.
  const outdated = value !== undefined && value.copies !== copies;

  return (
    <section className="collection-value">
      <div className="collection-value__head">
        <div className="collection-value__body">
          <p className="collection-value__label">{t("collectionValue.title")}</p>
          {value ? (
            <p className="collection-value__sub">
              {t("collectionValue.breakdown", {
                count: value.pricedCopies,
                priced: value.pricedCopies,
                copies: value.copies,
              })}
              {" · "}
              {t("collectionValue.computedAt", { date: formatDate(value.computedAt) })}
              {outdated && (
                <span className="collection-value__warn">
                  {" · "}
                  {t("collectionValue.outdated")}
                </span>
              )}
            </p>
          ) : (
            <p className="collection-value__sub">{t("collectionValue.never")}</p>
          )}
        </div>
        {value && (
          <span className="collection-value__amount">{formatMoney(value)}</span>
        )}
      </div>

      {onRecompute && (
        <button
          type="button"
          className="btn btn--outline btn--block"
          onClick={recompute}
          disabled={computing}
        >
          <RefreshIcon size={16} />
          {computing ? t("collectionValue.computing") : t("collectionValue.recompute")}
        </button>
      )}

      {failed && <p className="collection-value__error">{t("collectionValue.error")}</p>}
    </section>
  );
}
