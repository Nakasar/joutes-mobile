import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "../api/http";
import { joinTrade } from "../api/trades";
import { ScanIcon } from "./icons";
import { parseTradeInviteInput } from "../lib/trade-invite";
import { scanQrCode } from "../lib/qr-scan";
import { tradeErrorMessage } from "../lib/trade-errors";

/** Rejoint un échange par code, lien ou QR — toujours en session (pas d'invité). */
export function JoinTradeSheet({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: (tradeId: string) => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function join(raw: string) {
    const parsedCode = parseTradeInviteInput(raw);
    if (!parsedCode) {
      setError(t("trades.joinInvalidCode"));
      return;
    }
    setSaving(true);
    setError(null);
    joinTrade(parsedCode)
      .then((result) => {
        setSaving(false);
        if (!result.ok) {
          setError(tradeErrorMessage(result.error, t));
          return;
        }
        onClose();
        onJoined(result.trade.id);
      })
      .catch(() => {
        setSaving(false);
        setError(t("common.error"));
      });
  }

  function scan() {
    setError(null);
    scanQrCode()
      .then((content) => {
        if (!content) {
          setError(t("trades.scanUnavailable"));
          return;
        }
        const parsedCode = parseTradeInviteInput(content);
        if (parsedCode) setCode(parsedCode);
        join(content);
      })
      .catch(() => setError(t("trades.scanUnavailable")));
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
          <h2 className="form-sheet__title">{t("trades.joinTitle")}</h2>
          <div className="join-options">
            <label className="field">
              <span className="field__label">{t("trades.joinCodeLabel")}</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.currentTarget.value)}
                placeholder={t("trades.joinCodePlaceholder")}
                autoFocus
                maxLength={120}
              />
            </label>
            <button
              className="btn btn--grad btn--block"
              onClick={() => join(code)}
              disabled={saving || code.trim().length === 0}
            >
              {saving ? t("common.saving") : t("trades.joinSubmit")}
            </button>

            {isTauri() && (
              <>
                <div className="join-divider">{t("trades.joinOr")}</div>
                <button
                  type="button"
                  className="btn btn--outline btn--block"
                  onClick={scan}
                  disabled={saving}
                >
                  <ScanIcon size={18} />
                  {t("trades.scanAction")}
                </button>
              </>
            )}
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
