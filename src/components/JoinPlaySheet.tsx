import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "../api/http";
import { joinGameMatch } from "../api/game-matches";
import { joinTournament } from "../api/tournaments";
import { ScanIcon } from "./icons";
import { QrScannerOverlay } from "./QrScannerOverlay";
import { useQrScanner } from "../hooks/useQrScanner";
import { parsePlayInvite } from "../lib/play-invite";
import { storeSyncKey } from "../lib/tournament-sync-storage";
import { useAuth } from "../store/auth";

/**
 * Rejoindre ce qu'on va jouer : un tournoi ou une partie, sans avoir à dire
 * lequel.
 *
 * Le code le dit lui-même — 9 caractères pour un tournoi, 24 hexadécimaux pour
 * une partie —, et devant un QR code personne ne sait ce qu'il contient avant
 * de l'avoir lu. Demander « tournoi ou partie ? » d'abord, ce serait faire
 * poser une question dont la réponse est dans le code.
 *
 * Le nom d'affichage ne concerne que les tournois : une partie se rattache à un
 * compte, il n'y a pas d'invité à nommer. Le champ n'apparaît donc que
 * lorsqu'il peut servir — déconnecté — et n'est exigé qu'une fois le code
 * reconnu comme celui d'un tournoi.
 */
export function JoinPlaySheet({
  onClose,
  onJoinedTournament,
  onJoinedMatch,
}: {
  onClose: () => void;
  onJoinedTournament: (tournamentId: string) => void;
  onJoinedMatch: (matchId: string) => void;
}) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const scanner = useQrScanner();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function join(raw: string) {
    const invite = parsePlayInvite(raw);
    if (!invite) {
      setError(t("play.joinInvalidCode"));
      return;
    }

    if (invite.kind === "match") {
      // Une partie ne se rejoint qu'avec un compte : l'API répondrait 401, et
      // le dire ici évite un aller-retour pour l'apprendre.
      if (!isAuthenticated) {
        setError(t("play.joinMatchLoginRequired"));
        return;
      }
      setSaving(true);
      setError(null);
      joinGameMatch(invite.matchId)
        .then((result) => {
          setSaving(false);
          onClose();
          onJoinedMatch(result.match.id);
        })
        .catch((err: unknown) => {
          setSaving(false);
          setError(err instanceof Error ? err.message : t("common.error"));
        });
      return;
    }

    const trimmedName = displayName.trim();
    if (!isAuthenticated && trimmedName.length === 0) {
      setError(t("tournaments.joinNameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    joinTournament({
      code: invite.code,
      displayName: isAuthenticated ? undefined : trimmedName,
    })
      .then((result) => {
        if (result.player.syncKey) {
          storeSyncKey(result.tournamentId, result.player.syncKey);
        }
        setSaving(false);
        onClose();
        onJoinedTournament(result.tournamentId);
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
        const invite = parsePlayInvite(result.content);
        // Le champ montre ce qui a été lu : en cas d'échec, l'utilisateur voit
        // sur quoi porter la correction plutôt qu'un formulaire vide.
        if (invite?.kind === "tournament") setCode(invite.code);
        join(result.content);
      })
      .catch(() => setError(t("tournaments.scanUnavailable")));
  }

  return (
    <>
      {scanner.scanning && (
        <QrScannerOverlay title={t("play.scanAction")} onCancel={scanner.cancel} />
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
            <h2 className="form-sheet__title">{t("play.joinTitle")}</h2>
            <p className="muted form-sheet__note">{t("play.joinHint")}</p>
            <div className="join-options">
              <label className="field">
                <span className="field__label">{t("play.joinCodeLabel")}</span>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.currentTarget.value)}
                  placeholder={t("play.joinCodePlaceholder")}
                  autoFocus
                  maxLength={200}
                />
              </label>
              {!isAuthenticated && (
                <label className="field">
                  <span className="field__label">{t("tournaments.joinNameLabel")}</span>
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
                {saving ? t("common.saving") : t("play.joinSubmit")}
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
                    {t("play.scanAction")}
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
