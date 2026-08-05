import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "../api/http";
import { joinTournament } from "../api/tournaments";
import { ScanIcon } from "./icons";
import { QrScannerOverlay } from "./QrScannerOverlay";
import { useQrScanner } from "../hooks/useQrScanner";
import { parseInviteInput } from "../lib/tournament-invite";
import { storeSyncKey } from "../lib/tournament-sync-storage";
import { useAuth } from "../store/auth";

export function JoinTournamentSheet({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: (tournamentId: string) => void;
}) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const scanner = useQrScanner();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function join(raw: string) {
    const parsedCode = parseInviteInput(raw);
    if (!parsedCode) {
      setError(t("tournaments.joinInvalidCode"));
      return;
    }
    const trimmedName = displayName.trim();
    if (!isAuthenticated && trimmedName.length === 0) {
      setError(t("tournaments.joinNameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    joinTournament({ code: parsedCode, displayName: isAuthenticated ? undefined : trimmedName })
      .then((result) => {
        if (result.player.syncKey) {
          storeSyncKey(result.tournamentId, result.player.syncKey);
        }
        setSaving(false);
        onClose();
        onJoined(result.tournamentId);
      })
      .catch((err: unknown) => {
        setSaving(false);
        setError(err instanceof Error ? err.message : t("common.error"));
      });
  }

  function scan() {
    setError(null);
    scanner
      .start()
      .then((result) => {
        // Scan quitté par l'utilisateur : on revient simplement à la saisie
        // manuelle du code, sans message d'erreur.
        if (result.status === "cancelled") return;
        if (result.status === "unavailable") {
          setError(t("tournaments.scanUnavailable"));
          return;
        }
        const parsedCode = parseInviteInput(result.content);
        if (parsedCode) setCode(parsedCode);
        join(result.content);
      })
      .catch(() => setError(t("tournaments.scanUnavailable")));
  }

  return (
    <>
      {scanner.scanning && (
        <QrScannerOverlay
          title={t("tournaments.scanAction")}
          onCancel={scanner.cancel}
        />
      )}
      <div className="sheet-overlay" onClick={onClose}>
        <div
          className="sheet"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sheet__handle" />
          <div className="sheet__body form-sheet">
            <h2 className="form-sheet__title">{t("tournaments.joinTitle")}</h2>
            <div className="join-options">
              <label className="field">
                <span className="field__label">
                  {t("tournaments.joinCodeLabel")}
                </span>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.currentTarget.value)}
                  placeholder={t("tournaments.joinCodePlaceholder")}
                  autoFocus
                  maxLength={120}
                />
              </label>
              {!isAuthenticated && (
                <label className="field">
                  <span className="field__label">
                    {t("tournaments.joinNameLabel")}
                  </span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.currentTarget.value)}
                    placeholder={t("tournaments.joinNamePlaceholder")}
                    maxLength={100}
                  />
                </label>
              )}
              <button
                className="btn btn--grad btn--block"
                onClick={() => join(code)}
                disabled={saving || code.trim().length === 0}
              >
                {saving ? t("common.saving") : t("tournaments.joinSubmit")}
              </button>

              {isTauri() && (
                <>
                  <div className="join-divider">{t("tournaments.joinOr")}</div>
                  <button
                    type="button"
                    className="btn btn--outline btn--block"
                    onClick={scan}
                    disabled={saving}
                  >
                    <ScanIcon size={18} />
                    {t("tournaments.scanAction")}
                  </button>
                </>
              )}
            </div>
            {error && <p className="form-error">{error}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
