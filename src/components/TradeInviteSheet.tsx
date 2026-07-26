import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { config } from "../config";
import { setTradePartner } from "../api/trades";
import type { Trade } from "../api/types";
import { tradeErrorMessage } from "../lib/trade-errors";

/**
 * Invitation du partenaire d'échange : QR code + code à recopier (l'autre
 * joueur ouvre l'échange avec son compte), ou désignation directe par tag
 * `pseudo#1234`, nom d'utilisateur ou adresse e-mail.
 */
export function TradeInviteSheet({
  tradeId,
  code,
  onClose,
  onTradeChange,
}: {
  tradeId: string;
  code: string;
  onClose: () => void;
  onTradeChange: (trade: Trade) => void;
}) {
  const { t } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinUrl = `${config.webUrl}/trade/join/${code}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(joinUrl, { width: 280, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        // Le code/lien restent affichés même si le rendu du QR échoue.
      });
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier indisponible : le code reste affiché pour recopie manuelle.
    }
  }

  function invite() {
    const value = identifier.trim();
    if (!value) return;
    setInviting(true);
    setError(null);
    setTradePartner(tradeId, value)
      .then((result) => {
        setInviting(false);
        if (!result.ok) {
          setError(tradeErrorMessage(result.error, t));
          return;
        }
        onTradeChange(result.trade);
        onClose();
      })
      .catch(() => {
        setInviting(false);
        setError(t("common.error"));
      });
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
          <h2 className="form-sheet__title">{t("trades.invite.title")}</h2>
          <p className="screen-subtitle">{t("trades.invite.description")}</p>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={t("trades.invite.qrAlt")}
                style={{ width: 220, height: 220, borderRadius: 12, border: "4px solid var(--border)" }}
              />
            ) : (
              <div
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: 12,
                  border: "1px dashed var(--border)",
                }}
              />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <code className="chip" style={{ fontSize: 18, letterSpacing: 2, fontWeight: 700 }}>
                {code}
              </code>
              <button className="btn btn--outline" onClick={() => void copyLink()}>
                {copied ? t("trades.invite.copied") : t("trades.invite.copyLink")}
              </button>
            </div>
            <p className="muted" style={{ textAlign: "center", fontSize: 12 }}>
              {t("trades.invite.codeHint")}
            </p>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 16 }}>
            <p className="field__label">{t("trades.invite.directTitle")}</p>
            <label className="field">
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.currentTarget.value)}
                placeholder={t("trades.invite.identifierPlaceholder")}
                maxLength={200}
              />
            </label>
            <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
              {t("trades.invite.identifierHint")}
            </p>
            {error && <p className="form-error">{error}</p>}
            <button
              className="btn btn--grad btn--block"
              disabled={inviting || identifier.trim().length === 0}
              onClick={invite}
            >
              {inviting ? t("common.saving") : t("trades.invite.submit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
