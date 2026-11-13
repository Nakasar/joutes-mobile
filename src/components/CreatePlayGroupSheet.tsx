import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createPlayGroup } from "../api/play-groups";

/**
 * Fonder un groupe de jeu : un nom, une description facultative. Le reste
 * (images, visibilité, invitations) se règle ensuite depuis l'Établi.
 */
export function CreatePlayGroupSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const group = await createPlayGroup({
        name: trimmed,
        description: description.trim() || undefined,
      });
      onClose();
      navigate(`/social/groups/${group.id}?view=members`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setSaving(false);
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("groupManage.create.title")}</h2>
          <p className="muted">{t("groupManage.create.hint")}</p>

          <label className="field">
            <span className="field__label">{t("groupManage.fields.name")}</span>
            <input value={name} maxLength={80} onChange={(e) => setName(e.currentTarget.value)} />
          </label>
          <label className="field">
            <span className="field__label">{t("groupManage.fields.description")}</span>
            <textarea
              value={description}
              maxLength={500}
              rows={3}
              onChange={(e) => setDescription(e.currentTarget.value)}
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button
            className="btn btn--grad btn--block"
            style={{ marginTop: 10 }}
            disabled={saving || name.trim().length === 0}
            onClick={submit}
          >
            {saving ? t("common.saving") : t("groupManage.create.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
