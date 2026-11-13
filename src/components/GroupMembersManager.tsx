import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  invitePlayGroupMember,
  removePlayGroupMember,
  setPlayGroupMemberRole,
} from "../api/play-groups";
import { ApiError } from "../api/client";
import type { PlayGroupMember } from "../api/types";

/**
 * Inviter un joueur par son tag (`pseudo#1234`) ou son e-mail. Le serveur
 * envoie l'invitation ; le joueur l'accepte depuis son onglet Groupes.
 */
export function InviteMemberForm({ playGroupId }: { playGroupId: string }) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    const identifier = value.trim();
    if (!identifier) return;
    setSaving(true);
    setMessage(null);
    try {
      await invitePlayGroupMember(playGroupId, identifier);
      setValue("");
      setMessage({ ok: true, text: t("groupManage.invite.sent", { who: identifier }) });
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.status : 0;
      const text =
        status === 404
          ? t("groupManage.invite.notFound")
          : status === 409
            ? t("groupManage.invite.conflict")
            : err instanceof Error
              ? err.message
              : t("common.error");
      setMessage({ ok: false, text });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <p className="section-label" style={{ marginTop: 0 }}>
        {t("groupManage.invite.title")}
      </p>
      <form
        className="group-invite"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          type="text"
          value={value}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder={t("groupManage.invite.placeholder")}
          aria-label={t("groupManage.invite.title")}
          onChange={(e) => setValue(e.currentTarget.value)}
        />
        <button className="btn btn--grad" disabled={saving || !value.trim()}>
          {saving ? t("common.saving") : t("groupManage.invite.submit")}
        </button>
      </form>
      {message && (
        <p className={message.ok ? "form-success" : "form-error"} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}

/**
 * Les gestes sur un membre : le fondateur promeut ou rétrograde, le fondateur
 * et les admins retirent (un admin ne touche ni au fondateur ni à un autre
 * admin, comme sur le site). Le retrait se confirme d'un second geste.
 */
export function MemberActions({
  playGroupId,
  member,
  myRole,
  myUserId,
  onChanged,
}: {
  playGroupId: string;
  member: PlayGroupMember;
  myRole: "owner" | "admin" | "member" | null;
  myUserId?: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = member.userId;
  const role = member.role ?? "member";
  if (!userId || userId === myUserId || role === "owner") return null;
  const canPromote = myRole === "owner";
  const canRemove = myRole === "owner" || (myRole === "admin" && role === "member");
  if (!canPromote && !canRemove) return null;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setConfirming(false);
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="member-actions">
      {confirming ? (
        <>
          <button
            type="button"
            className="btn btn--danger"
            disabled={busy}
            onClick={() => void run(() => removePlayGroupMember(playGroupId, userId))}
          >
            {t("groupManage.members.confirmRemove")}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)}>
            {t("common.cancel")}
          </button>
        </>
      ) : (
        <>
          {canPromote && (
            <button
              type="button"
              className="btn btn--outline"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  setPlayGroupMemberRole(playGroupId, userId, role === "admin" ? "member" : "admin"),
                )
              }
            >
              {role === "admin" ? t("groupManage.members.demote") : t("groupManage.members.promote")}
            </button>
          )}
          {canRemove && (
            <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setConfirming(true)}>
              {t("groupManage.members.remove")}
            </button>
          )}
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
