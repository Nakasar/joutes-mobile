import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { ApiError } from "../api/client";
import { isTauri } from "../api/http";
import { addFriendByCode, getMyFriendCode, sendFriendRequest } from "../api/social";
import { config } from "../config";
import { useQrScanner } from "../hooks/useQrScanner";
import { friendCodeUrl, parseFriendCodeInput } from "../lib/friend-code";
import { ScanIcon } from "./icons";
import { QrScannerOverlay } from "./QrScannerOverlay";

type Outcome = { kind: "added"; name: string } | { kind: "requested" };

/**
 * Ajouter un ami, comme sur la page Amis du site :
 * - montrer son propre code ami en QR, que l'autre scanne ;
 * - scanner ou saisir le code d'un autre : l'amitié est immédiate ;
 * - ou envoyer une demande à un tag `pseudo#1234`, que l'autre acceptera.
 */
export function AddFriendSheet({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { t } = useTranslation();
  const scanner = useQrScanner();
  const [myCode, setMyCode] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyFriendCode()
      .then((code) => {
        if (cancelled) return;
        setMyCode(code);
        return QRCode.toDataURL(friendCodeUrl(config.webUrl, code), {
          width: 280,
          margin: 2,
          color: { dark: "#000000", light: "#FFFFFF" },
        }).then((url) => {
          if (!cancelled) setQrDataUrl(url);
        });
      })
      .catch(() => {
        // Sans code, l'ajout par tag ou par le code d'un autre reste possible.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Le code HTTP ne suffit pas : `POST /friends` rend 409 pour « déjà amis »
   * comme pour « demande en attente », et 400 pour soi-même comme pour une
   * saisie invalide. Le message du serveur (en français) les départage.
   */
  function errorMessage(err: unknown, byCode: boolean): string {
    if (err instanceof ApiError) {
      const message = String((err.body as { error?: unknown } | undefined)?.error ?? err.message);
      if (err.status === 404) return t(byCode ? "social.add.codeNotFound" : "social.add.userNotFound");
      if (err.status === 409) {
        return t(/déjà amis/i.test(message) ? "social.add.alreadyFriends" : "social.add.alreadyPending");
      }
      if (err.status === 400) {
        if (/vous-même/i.test(message)) return t("social.add.self");
        if (byCode) return t("social.add.invalidCode");
      }
    }
    return t("social.add.error");
  }

  function submit(raw: string) {
    const input = raw.trim();
    if (!input || saving) return;
    const code = parseFriendCodeInput(input);
    setSaving(true);
    setError(null);
    setOutcome(null);
    const byTag = () => sendFriendRequest(input).then((): Outcome => ({ kind: "requested" }));
    const request: Promise<Outcome> = code
      ? addFriendByCode(code)
          .then((r): Outcome => ({ kind: "added", name: r.friend.displayName || r.friend.username || code }))
          .catch((err: unknown) => {
            // Un pseudo de huit lettres en majuscules ressemble à un code :
            // code inconnu, on tente la demande par pseudo.
            if (err instanceof ApiError && err.status === 404 && code === input) return byTag();
            throw err;
          })
      : byTag();
    request
      .then((result) => {
        setOutcome(result);
        setValue("");
        onAdded();
      })
      .catch((err: unknown) => setError(errorMessage(err, !!code)))
      .finally(() => setSaving(false));
  }

  function scan() {
    setError(null);
    scanner
      .start()
      .then((result) => {
        if (result.status === "cancelled") return;
        if (result.status === "unavailable") {
          setError(t("social.add.scanUnavailable"));
          return;
        }
        if (!parseFriendCodeInput(result.content)) {
          setError(t("social.add.invalidQr"));
          return;
        }
        submit(result.content);
      })
      .catch(() => setError(t("social.add.scanUnavailable")));
  }

  async function copyCode() {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(friendCodeUrl(config.webUrl, myCode));
    } catch {
      // Le code reste affiché pour être recopié.
    }
  }

  return (
    <>
      {scanner.scanning && <QrScannerOverlay title={t("social.add.scan")} onCancel={scanner.cancel} />}
      <div className="sheet-overlay" onClick={onClose}>
        <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="sheet__handle" />
          <div className="sheet__body form-sheet">
            <h2 className="form-sheet__title">{t("social.add.title")}</h2>

            <section className="friend-code" aria-labelledby="my-friend-code">
              <p id="my-friend-code" className="section-label">
                {t("social.add.myCode")}
              </p>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={t("social.add.qrAlt")} className="friend-code__qr" />
              ) : (
                <div className="friend-code__qr friend-code__qr--empty" aria-hidden />
              )}
              {myCode && (
                <button type="button" className="chip friend-code__value" onClick={() => void copyCode()}>
                  {myCode}
                </button>
              )}
              <p className="muted friend-code__hint">{t("social.add.myCodeHint")}</p>
            </section>

            <div className="join-options">
              <label className="field">
                <span className="field__label">{t("social.add.inputLabel")}</span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.currentTarget.value)}
                  placeholder={t("social.add.inputPlaceholder")}
                  autoCapitalize="none"
                  autoCorrect="off"
                  maxLength={120}
                />
              </label>
              <button
                type="button"
                className="btn btn--grad btn--block"
                onClick={() => submit(value)}
                disabled={saving || value.trim().length === 0}
              >
                {saving ? t("common.saving") : t("social.add.submit")}
              </button>
              {isTauri() && (
                <>
                  <div className="join-divider">{t("trades.joinOr")}</div>
                  <button type="button" className="btn btn--outline btn--block" onClick={scan} disabled={saving}>
                    <ScanIcon size={18} />
                    {t("social.add.scan")}
                  </button>
                </>
              )}
            </div>
            {error && <p className="form-error">{error}</p>}
            {outcome && (
              <p className="form-success" role="status">
                {outcome.kind === "added"
                  ? t("social.add.added", { name: outcome.name })
                  : t("social.add.requested")}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
