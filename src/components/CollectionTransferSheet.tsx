import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { exportCollection, importCollection, previewImport } from "../api/collection";
import type { ImportPreview, ImportResult } from "../api/types";
import { collectionFormats, detectCollectionFormat } from "../lib/collection-search";
import { saveTextFile } from "../lib/save-file";
import { DownloadIcon, UploadIcon } from "./icons";

const SKIP = "";

type ExportScope = "all" | "search" | "doubles";

/**
 * Import et export de la collection d'un jeu, en CSV (Joutes, Piltover
 * Archive pour Riftbound). L'import se fait en deux temps comme sur le site :
 * le fichier est d'abord vérifié — lignes reconnues, à préciser, introuvables —
 * puis ajouté à la collection ou mis à sa place.
 */
export function CollectionTransferSheet({
  gameSlug,
  search,
  onClose,
  onImported,
}: {
  gameSlug: string;
  /** La recherche en cours, que l'export peut reprendre. */
  search: string;
  onClose: () => void;
  onImported: (result: ImportResult) => void;
}) {
  const { t } = useTranslation();
  const formats = collectionFormats(gameSlug);
  const [tab, setTab] = useState<"import" | "export">("import");

  // ---- Import ----
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [importFormat, setImportFormat] = useState(formats[0].id);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [mode, setMode] = useState<"add" | "replace">("add");

  // ---- Export ----
  const [exportFormat, setExportFormat] = useState(formats[0].id);
  const [exportScope, setExportScope] = useState<ExportScope>("all");
  const hasSearch = search.trim().length > 0;
  // La recherche a pu être vidée après le choix : on n'exporte pas tout sous
  // l'étiquette « recherche ».
  const scope: ExportScope = exportScope === "search" && !hasSearch ? "all" : exportScope;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fail = (err: unknown) => setError(err instanceof Error ? err.message : t("transfer.error"));

  const pickFile = async (file: File | undefined) => {
    setPreview(null);
    setChoices({});
    setError(null);
    if (!file) {
      setFileName(null);
      setCsv(null);
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setCsv(text);
    setImportFormat(detectCollectionFormat(text, gameSlug));
  };

  const check = async () => {
    if (!csv) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await previewImport(gameSlug, { format: importFormat, csv }));
      setChoices({});
      setMode("add");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const ambiguous = preview?.issues.filter((issue) => issue.candidates?.length) ?? [];
  const missing = preview?.issues.filter((issue) => !issue.candidates?.length) ?? [];
  const chosenCopies = ambiguous.reduce(
    (total, issue) => total + (choices[issue.line] ? (issue.quantity ?? 0) : 0),
    0,
  );
  const totalCopies = (preview?.copies ?? 0) + chosenCopies;

  const runImport = async () => {
    if (!csv || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const resolutions = Object.fromEntries(
        Object.entries(choices).filter(([, cardId]) => cardId !== SKIP),
      );
      onImported(await importCollection(gameSlug, { format: importFormat, csv, resolutions, mode }));
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  };

  const runExport = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const content = await exportCollection(gameSlug, {
        format: exportFormat,
        scope,
        search,
      });
      const suffix = exportFormat === "piltover-archive" ? "piltover-archive" : "joutes";
      const name = `${gameSlug}-collection-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
      if (await saveTextFile(name, content, "text/csv;charset=utf-8")) {
        setNotice(t("transfer.export.saved", { name }));
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const option = (active: boolean, onPick: () => void, title: string, text: string | null, name: string) => (
    <label className={`option-card${active ? " option-card--active" : ""}`}>
      <input type="radio" name={name} checked={active} onChange={onPick} />
      <span>
        <span className="option-card__title">{title}</span>
        {text && <span className="option-card__text">{text}</span>}
      </span>
    </label>
  );

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <div className="segmented">
            <button
              className={`segmented__item${tab === "import" ? " segmented__item--active" : ""}`}
              onClick={() => {
                setTab("import");
                setError(null);
              }}
            >
              {t("transfer.importTab")}
            </button>
            <button
              className={`segmented__item${tab === "export" ? " segmented__item--active" : ""}`}
              onClick={() => {
                setTab("export");
                setError(null);
              }}
            >
              {t("transfer.exportTab")}
            </button>
          </div>

          {tab === "import" ? (
            <>
              <h2 className="form-sheet__title">{t("transfer.import.title")}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {preview ? t("transfer.import.checkedHint") : t("transfer.import.hint")}
              </p>

              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv,text/plain"
                hidden
                onChange={(e) => void pickFile(e.currentTarget.files?.[0])}
              />
              <button className="btn btn--outline btn--block" onClick={() => fileInput.current?.click()}>
                <UploadIcon size={16} />
                {fileName ?? t("transfer.import.chooseFile")}
              </button>

              {csv && (
                <label className="field">
                  <span className="field__label">{t("transfer.format")}</span>
                  <select
                    value={importFormat}
                    onChange={(e) => {
                      setImportFormat(e.currentTarget.value);
                      setPreview(null);
                    }}
                  >
                    {formats.map((format) => (
                      <option key={format.id} value={format.id}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {csv && !preview && (
                <button className="btn btn--grad btn--block" onClick={check} disabled={busy}>
                  {busy ? t("transfer.import.checking") : t("transfer.import.check")}
                </button>
              )}

              {preview && (
                <>
                  <div className="preview-tiles">
                    <div className="preview-tile preview-tile--ok">
                      <span className="preview-tile__value">{preview.rows}</span>
                      <span className="preview-tile__label">
                        {t("transfer.import.recognized", { count: preview.copies })}
                      </span>
                    </div>
                    <div className="preview-tile preview-tile--warn">
                      <span className="preview-tile__value">{ambiguous.length}</span>
                      <span className="preview-tile__label">{t("transfer.import.ambiguous")}</span>
                    </div>
                    <div className="preview-tile preview-tile--bad">
                      <span className="preview-tile__value">{missing.length}</span>
                      <span className="preview-tile__label">{t("transfer.import.missing")}</span>
                    </div>
                  </div>

                  {preview.issues.length > 0 && (
                    <div>
                      {preview.issues.map((issue) => (
                        <div key={issue.line} className="import-issue">
                          <span className="import-issue__title">
                            {t("transfer.import.line", { line: issue.line })}
                            {issue.label ? ` · ${issue.label}` : ""}
                          </span>
                          <span className="import-issue__text">{issue.message}</span>
                          {issue.candidates?.length ? (
                            <select
                              value={choices[issue.line] ?? SKIP}
                              onChange={(e) => {
                                const value = e.currentTarget.value;
                                setChoices((current) => ({ ...current, [issue.line]: value }));
                              }}
                            >
                              <option value={SKIP}>{t("transfer.import.skip")}</option>
                              {issue.candidates.map((card) => (
                                <option key={card.id} value={card.id}>
                                  {`${card.setCode} ${card.collectorNumber} · ${card.name}${card.rarity ? ` (${card.rarity})` : ""}`}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="import-issue__text">{t("transfer.import.ignored")}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="field">
                    <span className="field__label">
                      {t("transfer.import.modeLabel", { count: preview.currentCopies })}
                    </span>
                    <div className="option-list">
                      {option(
                        mode === "add",
                        () => setMode("add"),
                        t("transfer.import.modeAdd"),
                        t("transfer.import.modeAddText"),
                        "import-mode",
                      )}
                      {option(
                        mode === "replace",
                        () => setMode("replace"),
                        t("transfer.import.modeReplace"),
                        t("transfer.import.modeReplaceText"),
                        "import-mode",
                      )}
                    </div>
                  </div>

                  <button
                    className={`btn btn--block ${mode === "replace" ? "btn--danger" : "btn--grad"}`}
                    onClick={runImport}
                    disabled={busy || totalCopies === 0}
                  >
                    <UploadIcon size={16} />
                    {busy
                      ? t("common.saving")
                      : mode === "replace"
                        ? t("transfer.import.submitReplace", { count: totalCopies })
                        : t("transfer.import.submit", { count: totalCopies })}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <h2 className="form-sheet__title">{t("transfer.export.title")}</h2>
              <label className="field">
                <span className="field__label">{t("transfer.format")}</span>
                <select value={exportFormat} onChange={(e) => setExportFormat(e.currentTarget.value)}>
                  {formats.map((format) => (
                    <option key={format.id} value={format.id}>
                      {format.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span className="field__label">{t("transfer.export.scopeLabel")}</span>
                <div className="option-list">
                  {option(scope === "all", () => setExportScope("all"), t("transfer.export.all"), null, "export-scope")}
                  {hasSearch &&
                    option(
                      scope === "search",
                      () => setExportScope("search"),
                      t("transfer.export.search"),
                      search,
                      "export-scope",
                    )}
                  {option(
                    scope === "doubles",
                    () => setExportScope("doubles"),
                    t("transfer.export.doubles"),
                    t("transfer.export.doublesText", { count: 3 }),
                    "export-scope",
                  )}
                </div>
              </div>
              {exportFormat === "piltover-archive" && (
                <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                  {t("transfer.export.piltoverLoss")}
                </p>
              )}
              {notice && <p className="muted" style={{ margin: 0 }}>{notice}</p>}
              <button className="btn btn--grad btn--block" onClick={runExport} disabled={busy}>
                <DownloadIcon size={16} />
                {busy ? t("transfer.export.exporting") : t("transfer.export.submit")}
              </button>
            </>
          )}

          {error && <p className="form-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
