import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { resolveTradeCards } from "../api/trades";
import type { TradeCard, TradeCardScope } from "../api/types";
import { TRADE_MAX_CARDS_PER_SIDE } from "../lib/trade-constants";
import {
  applyTradeText,
  parseTradeText,
  stringifyTradeCards,
  type TradeTextCard,
} from "../lib/trade-text";

/** Ce que la dernière application a laissé de côté. */
interface ApplyReport {
  unmatched: string[];
  dropped: number;
}

/**
 * L'offre d'un espace d'échange, écrite en texte — une carte par ligne.
 *
 * Se compose carte à carte par la recherche : c'est le bon geste pour trois
 * cartes, pas pour vingt. Et une liste ne se recopiait pas — ni vers un
 * message, ni depuis celui du partenaire. Cette vue-là fait les deux.
 *
 * Elle s'ouvre aussi en lecture seule, sur l'offre du partenaire ou sur un
 * échange clos : copier une liste ne demande pas le droit de la modifier.
 *
 * L'appariement des lignes à de vraies cartes se fait côté serveur
 * (`POST /trades/cards/resolve`) : l'application n'a ni la collection ni le
 * catalogue.
 */
export function TradeTextSheet({
  title,
  cards,
  editable,
  scope,
  requireCardId,
  onApply,
  onClose,
}: {
  title: string;
  cards: TradeTextCard[];
  editable: boolean;
  /** Où chercher les cartes nommées : sa propre collection, ou le catalogue. */
  scope: TradeCardScope;
  /** Vrai pour une contrepartie libre : la carte doit être connue du catalogue. */
  requireCardId: boolean;
  onApply?: (entries: { card: TradeCard; quantity: number }[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  // La liste est figée à l'ouverture : la feuille est remontée à chaque fois,
  // et une saisie en cours ne doit pas être effacée par le rafraîchissement de
  // l'offre du partenaire, qui tourne toutes les cinq secondes derrière.
  const [text, setText] = useState(() => stringifyTradeCards(cards));
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ApplyReport | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier indisponible : on sélectionne la liste pour que le geste
      // de copie du système prenne le relais, plutôt que de ne rien faire.
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }

  async function apply() {
    setError(null);

    const parsed = parseTradeText(text);
    // Le découpage précède la résolution parce que le serveur n'accepte pas
    // plus de `TRADE_MAX_CARDS_PER_SIDE` désignations : au-delà, il rejette la
    // requête entière plutôt que d'en apparier une partie. Envoyer la liste
    // complète ferait donc échouer un collage de cinquante et une lignes au
    // lieu d'en appliquer cinquante.
    //
    // Le revers est connu : deux lignes écrites différemment peuvent désigner
    // la même impression et ne se fondre qu'après appariement, si bien qu'une
    // liste tout juste trop longue peut voir une ligne écartée alors qu'elle
    // aurait tenu. Ce sont des cas rares, et les corriger demanderait au
    // serveur d'accepter plus de désignations qu'une face ne porte de cartes.
    const lines = parsed.lines.slice(0, TRADE_MAX_CARDS_PER_SIDE);
    const overflow = parsed.lines.length - lines.length;

    if (lines.length === 0) {
      // Un champ vidé vide l'offre : c'est une modification comme une autre,
      // celle qu'on ferait en retirant chaque carte. Un texte qu'on n'a pas su
      // lire, lui, n'est pas une liste vide — il est resté en travers, et
      // l'effacer emporterait à la fois l'offre et la saisie qui la corrigeait.
      if (text.trim() !== "") {
        setReport({ unmatched: parsed.ignored, dropped: 0 });
        setError(t("trades.text.failed"));
        return;
      }

      setReport(null);
      onApply?.([]);
      onClose();
      return;
    }

    setApplying(true);
    try {
      const matches = await resolveTradeCards(
        scope,
        lines.map(({ name, setCode, collectorNumber }) => ({
          name,
          setCode,
          collectorNumber,
        })),
      );

      const applied = applyTradeText(lines, (_line, index) => {
        const card = matches[index];
        if (!card) return undefined;
        // Une contrepartie libre demande des cartes au catalogue : une entrée
        // de collection qu'il ne connaît pas ne peut pas être demandée.
        if (requireCardId && !card.cardId) return undefined;
        return card;
      });

      setReport({
        unmatched: [...applied.unmatched, ...parsed.ignored],
        dropped: applied.dropped + overflow,
      });

      // Même raison qu'une liste illisible : une liste dont pas une ligne n'a
      // trouvé sa carte ne vaut pas une offre vide. Elle reste à corriger, avec
      // sous les yeux ce qui n'a pas été reconnu.
      if (applied.entries.length === 0) {
        setError(t("trades.text.noMatch"));
        return;
      }

      onApply?.(applied.entries);
      onClose();
    } catch {
      setError(t("trades.text.failed"));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{title}</h2>
          <p className="muted" style={{ marginBottom: 10 }}>
            {editable ? t("trades.text.hint") : t("trades.text.readOnlyHint")}
          </p>

          <textarea
            ref={textareaRef}
            className="trade-text__area"
            value={text}
            readOnly={!editable}
            spellCheck={false}
            rows={10}
            placeholder={t("trades.text.placeholder")}
            aria-label={title}
            onChange={(e) => setText(e.target.value)}
          />

          {report && (
            <div className="trade-text__report">
              {report.unmatched.length > 0 && (
                <>
                  <p className="trade-text__report-title">
                    {t("trades.text.unmatched", { count: report.unmatched.length })}
                  </p>
                  <ul className="trade-text__unmatched">
                    {report.unmatched.map((line, index) => (
                      <li key={`${line}-${index}`}>{line}</li>
                    ))}
                  </ul>
                </>
              )}
              {report.dropped > 0 && (
                <p className="trade-text__report-title">
                  {t("trades.text.dropped", {
                    count: report.dropped,
                    max: TRADE_MAX_CARDS_PER_SIDE,
                  })}
                </p>
              )}
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          {editable && (
            <button
              className="btn btn--grad btn--block"
              style={{ marginTop: 12 }}
              disabled={applying}
              onClick={apply}
            >
              {applying ? t("trades.text.applying") : t("trades.text.apply")}
            </button>
          )}
          <button
            className="btn btn--outline btn--block"
            style={{ marginTop: 10 }}
            onClick={copy}
          >
            {copied ? t("trades.text.copied") : t("trades.text.copy")}
          </button>
          <button
            className="btn btn--outline btn--block"
            style={{ marginTop: 10 }}
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
