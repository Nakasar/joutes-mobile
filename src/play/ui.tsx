import "./play.css";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "./icons";

/**
 * Une feuille qui monte du bas de l'écran, comme partout dans l'app
 * (`.sheet-overlay` / `.sheet`). Sur la table, elle porte l'aperçu d'une carte,
 * le journal, les réglages, la défausse. Elle s'ouvre hors de la table (le
 * plateau en relief est transformé, ce qui piégerait un `position: fixed`) ;
 * `theme="table"` lui garde les couleurs sombres de la table.
 */
export function Sheet({
  title,
  onClose,
  children,
  className,
  theme = "table",
}: {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  theme?: "table" | "app";
}) {
  return createPortal(
    <div
      className={`sheet-overlay pt-sheet-overlay${theme === "table" ? " pt-theme" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
      // Un portail laisse remonter les évènements dans l'arbre React : la main
      // ne doit pas prendre un appui long fait dans la feuille pour un glisser.
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <div
        className={`sheet pt-sheet${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet__handle" />
        <button type="button" className="sheet__close" onClick={onClose} aria-label="×">
          <CloseIcon size={16} />
        </button>
        <div className="sheet__body">
          {title && <h2 className="form-sheet__title pt-sheet__title">{title}</h2>}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * La mise en page de la table : téléphone à la verticale, téléphone à
 * l'horizontale, ou tablette (à partir de 1024 px de large et de 700 px de
 * haut). Une tablette à la verticale reprend celle du téléphone, en plus grand.
 */
export type TableLayout = "portrait" | "landscape" | "tablet";

function layoutNow(): TableLayout {
  if (typeof window === "undefined") return "portrait";
  const { innerWidth: width, innerHeight: height } = window;
  if (width >= 1024 && height >= 700) return "tablet";
  if (width > height) return "landscape";
  return "portrait";
}

export function useTableLayout(): TableLayout {
  const [layout, setLayout] = useState<TableLayout>(layoutNow);
  useEffect(() => {
    const sync = () => setLayout(layoutNow());
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);
  return layout;
}

const PANEL_STORAGE_KEY = "joutes.play.panel";

function readPinned(): boolean {
  try {
    return window.localStorage.getItem(PANEL_STORAGE_KEY) === "open";
  } catch {
    return false;
  }
}

function writePinned(pinned: boolean): void {
  try {
    window.localStorage.setItem(PANEL_STORAGE_KEY, pinned ? "open" : "auto");
  } catch {
    // Stockage refusé : le réglage vaut pour cette table.
  }
}

/**
 * Le panneau latéral (paysage et tablette) : replié en une bande étroite, il
 * se déplie seul quand une décision attend, puis se replie quand la main passe.
 * L'ouvrir soi-même le garde ouvert (et ce choix est gardé avec les réglages de
 * la table) ; le replier soi-même pendant une décision ne vaut que pour elle.
 *
 * `decision` : une clé qui change à chaque nouvelle décision, ou `null` quand
 * rien n'est attendu de ce joueur.
 */
export function useSidePanel(decision: string | null): {
  open: boolean;
  pinned: boolean;
  toggle: () => void;
} {
  const [pinned, setPinned] = useState(readPinned);
  // La décision pour laquelle le joueur a replié le panneau à la main.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const open = pinned || (decision !== null && dismissed !== decision);
  const toggle = () => {
    if (open) {
      if (pinned) {
        setPinned(false);
        writePinned(false);
      }
      if (decision !== null) setDismissed(decision);
    } else {
      setPinned(true);
      writePinned(true);
      setDismissed(null);
    }
  };
  return { open, pinned, toggle };
}

/** Une case à cocher avec son intitulé et sa précision, comme dans les réglages de l'app. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`pt-toggle${disabled ? " pt-toggle--off" : ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className="pt-toggle__label">{label}</span>
        {hint && <span className="pt-toggle__hint">{hint}</span>}
      </span>
    </label>
  );
}

/** Un petit message qui s'efface tout seul (« Lien copié », une erreur). */
export function useToast(): { toast: (message: string, tone?: "ok" | "error") => void; node: ReactNode } {
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error"; at: number } | null>(null);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), message.tone === "error" ? 5000 : 2200);
    return () => window.clearTimeout(timer);
  }, [message]);
  return {
    toast: (text, tone = "ok") => setMessage({ text, tone, at: Date.now() }),
    node: message ? (
      <div key={message.at} role="status" className={`pt-toast pt-toast--${message.tone}`}>
        {message.text}
      </div>
    ) : null,
  };
}

/** Copier un texte, ou le partager quand le téléphone sait le faire. */
export async function shareLink(url: string, title: string): Promise<"shared" | "copied" | "failed"> {
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
  if (typeof nav.share === "function") {
    try {
      await nav.share({ url, title });
      return "shared";
    } catch {
      // Partage annulé ou refusé : on retombe sur la copie.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
