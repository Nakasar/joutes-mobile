import type { TableCard } from "../engine/cards";
import { abilityKey, type Coverage, type PayChoice } from "../engine/payment";
import type { EngineObj, EnginePayment } from "../engine/types";
import { DOMAIN_HEX } from "../engine/told-text";
import { CostChips, RUNE_MARK } from "./HandPlay";
import { usePlayT } from "./t";

type PaymentPanelProps = {
  payment: EnginePayment;
  cover: Coverage;
  choice: PayChoice;
  custom: boolean;
  objOf: (id: number) => EngineObj | undefined;
  cardOf: (obj: EngineObj | undefined) => TableCard | undefined;
  onCustom: (custom: boolean) => void;
  onToggleAbility: (key: string) => void;
  onPay: () => void;
  onCancel: (() => void) | null;
};

/**
 * Le paiement, comme sur le site (`components/play/PaymentPanel.tsx`) : le
 * coût, ce que le moteur propose, et en « Personnaliser » les runes, Seals et
 * Or choisis soi-même (en touchant les runes sur la table), avec des jauges
 * qui passent au vert quand le coût est couvert.
 */
export function PaymentPanel({
  payment,
  cover,
  choice,
  custom,
  objOf,
  cardOf,
  onCustom,
  onToggleAbility,
  onPay,
  onCancel,
}: PaymentPanelProps) {
  const t = usePlayT("Play.payment");
  const domainLabel = usePlayT("Play.domain");
  const gaugeLabel = (key: string) =>
    key === "energy" ? t("energy") : key === "any" ? t("anyPower") : key === "card" ? t("cardPower") : domainLabel(key);
  const gaugeColor = (key: string) => (key === "energy" ? "var(--primary)" : (DOMAIN_HEX[key] ?? "#eab308"));

  const runeLines = Object.entries(choice.runes)
    .filter(([, use]) => use !== "none")
    .map(([id, use]) => {
      const obj = objOf(Number(id));
      const domain = cardOf(obj)?.domains[0]?.toLowerCase() ?? "";
      return { id: Number(id), use, domain, exhausted: obj?.exhausted === true };
    });
  const used = payment.abilities.filter((ability) => choice.abilities.includes(abilityKey(ability)));

  return (
    <div data-pay-panel className="pt-pay">
      <div className="pt-pay__total">
        <span>{t("total")}</span>
        <CostChips cost={payment.cost} domains={payment.domains} />
      </div>

      <div className="pt-pay__gauges">
        {[cover.energy, ...cover.power].map((gauge) => (
          <div key={gauge.key} className="pt-pay__gauge">
            <span className="pt-pay__gauge-label">
              {gauge.key !== "energy" && <span className="pt-dot" style={{ background: gaugeColor(gauge.key) }} />}
              {gaugeLabel(gauge.key)}
            </span>
            <span className="pt-pay__bar">
              <span
                style={{
                  width: `${gauge.need ? Math.min(100, (gauge.have / gauge.need) * 100) : 100}%`,
                  background: gaugeColor(gauge.key),
                }}
              />
            </span>
            <b className={gauge.have >= gauge.need ? "pt-ok" : "pt-warn"}>
              {gauge.have} / {gauge.need}
            </b>
          </div>
        ))}
      </div>

      <div className="pt-pay__lines">
        <h3>{custom ? t("yours") : t("proposed")}</h3>
        {runeLines.length === 0 && used.length === 0 ? (
          <p className="pt-muted">{t("nothing")}</p>
        ) : (
          <ul>
            {runeLines.map((line) => (
              <li key={line.id}>
                <span className="pt-dot" style={{ background: DOMAIN_HEX[line.domain] ?? "#94a3b8" }} />
                <span className="pt-grow">
                  {t("rune", { domain: line.domain ? domainLabel(line.domain) : "" })}
                  {line.exhausted && <span className="pt-muted"> · {t("alreadyExhausted")}</span>}
                </span>
                <span className={`pt-mark${line.use === "recycle" ? " pt-mark--recycle" : ""}`}>
                  {RUNE_MARK[line.use as keyof typeof RUNE_MARK]}
                </span>
                <span className="pt-muted">
                  {line.use === "exhaust"
                    ? t("givesEnergy")
                    : line.use === "recycle"
                      ? t("givesPower", { domain: line.domain ? domainLabel(line.domain) : "" })
                      : t("givesBoth", { domain: line.domain ? domainLabel(line.domain) : "" })}
                </span>
              </li>
            ))}
            {used.map((ability) => (
              <li key={abilityKey(ability)}>
                <span className="pt-dot" style={{ background: "#facc15" }} />
                <span className="pt-grow">{cardOf(objOf(ability.source))?.name ?? t("source")}</span>
                <span className="pt-muted">{t("adds")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {custom && (
        <>
          <p className="pt-muted pt-small">{t("customHint")}</p>
          {payment.abilities.length > 0 && (
            <div className="pt-row-wrap">
              {payment.abilities.map((ability) => {
                const key = abilityKey(ability);
                const on = choice.abilities.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`pt-btn pt-btn--sm${on ? " pt-btn--primary" : ""}`}
                    aria-pressed={on}
                    onClick={() => onToggleAbility(key)}
                  >
                    {cardOf(objOf(ability.source))?.name ?? t("source")}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {(cover.extraEnergy > 0 || cover.extraPower > 0) && (
        <p className="pt-warn pt-small">{t("extra", { energy: cover.extraEnergy, power: cover.extraPower })}</p>
      )}

      <div className="pt-row-wrap">
        <button type="button" className="pt-btn pt-btn--grad" onClick={onPay} disabled={custom && !cover.ok}>
          {t("pay")}
        </button>
        <button type="button" className="pt-btn" onClick={() => onCustom(!custom)}>
          {custom ? t("useProposed") : t("customize")}
        </button>
        {onCancel && (
          <button type="button" className="pt-btn pt-btn--ghost" onClick={onCancel}>
            {t("cancel")}
          </button>
        )}
      </div>
    </div>
  );
}
