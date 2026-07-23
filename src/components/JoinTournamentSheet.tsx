import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "../api/http";
import { syncTournamentKeys } from "../api/tournaments";
import { ScanIcon } from "./icons";
import { parseInviteInput } from "../lib/tournament-invite";
import { scanQrCode } from "../lib/qr-scan";
import { storeSyncKey } from "../lib/tournament-sync-storage";

export function JoinTournamentSheet({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: (tournamentId: string) => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function join(raw: string) {
    const key = parseInviteInput(raw);
    if (!key) {
      setError(t("tournaments.joinInvalidCode"));
      return;
    }
    setSaving(true);
    setError(null);
    syncTournamentKeys([key])
      .then((entries) => {
        const entry = entries[0];
        if (!entry) {
          setError(t("tournaments.joinInvalidCode"));
          return;
        }
        storeSyncKey(entry.tournament.id, key);
        onClose();
        onJoined(entry.tournament.id);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => setSaving(false));
  }

  function scan() {
    setError(null);
    scanQrCode()
      .then((content) => {
        if (!content) {
          setError(t("tournaments.scanUnavailable"));
          return;
        }
        join(content);
      })
      .catch(() => setError(t("tournaments.scanUnavailable")));
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
          <h2 className="form-sheet__title">{t("tournaments.joinTitle")}</h2>
          <div className="join-options">
            <label className="field">
              <span className="field__label">{t("tournaments.joinCodeLabel")}</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.currentTarget.value)}
                placeholder={t("tournaments.joinCodePlaceholder")}
                autoFocus
              />
            </label>
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
  );
}
