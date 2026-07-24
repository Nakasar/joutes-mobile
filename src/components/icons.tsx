import type { SVGProps } from "react";

/**
 * Jeu d'icônes vectorielles « Halo » (stroke, 24×24, currentColor),
 * remplaçant les emojis. Tracés issus du handoff Claude Design.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 24, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={rest.strokeWidth ?? 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </Icon>
  );
}

export function LayersIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
      <path d="M3 12.5 12 17l9-4.5" />
      <path d="M3 17 12 21.5 21 17" />
    </Icon>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </Icon>
  );
}

export function GridIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </Icon>
  );
}

export function UsersIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.6 20c0-3.5 2.9-5.6 6.4-5.6s6.4 2.1 6.4 5.6" />
      <path d="M17 4.2a3 3 0 0 1 0 5.8" />
      <path d="M19.5 20c0-2.6-1-4.4-3-5.2" />
    </Icon>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </Icon>
  );
}

export function SettingsIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </Icon>
  );
}

export function BackIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m15 5-7 7 7 7" />
    </Icon>
  );
}

export function ChevronIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m9 5 7 7-7 7" />
    </Icon>
  );
}

export function BookIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5" />
    </Icon>
  );
}

export function PinIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  );
}

export function HeartIcon({ filled, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Icon {...p} fill={filled ? "currentColor" : "none"}>
      <path d="M12 21s-7.5-4.6-10-9.1C.3 8.4 2 5 5.3 5c2 0 3.3 1.1 4.1 2.4L12 10l2.6-2.6C15.4 6.1 16.7 5 18.7 5 22 5 23.7 8.4 22 11.9 19.5 16.4 12 21 12 21Z" />
    </Icon>
  );
}

export function UserPlusIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3 20c0-3.5 2.7-5.6 6-5.6 1.2 0 2.3.3 3.2.8" />
      <path d="M17 8v6M14 11h6" />
    </Icon>
  );
}

export function ExternalLinkIcon(p: IconProps) {
  return (
    <Icon {...p} size={p.size ?? 13} className={`external-link-icon ${p.className ?? ""}`}>
      <path d="M7 17 17 7M9 7h8v8" />
    </Icon>
  );
}

export function AlertTriangleIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

export function DeckCheckIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M8 3.5h8" />
      <path d="m8.5 12.5 2.2 2.2 4.3-4.3" />
    </Icon>
  );
}

export function LockIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="5" y="10" width="14" height="10" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function MinusIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M5 12h14" />
    </Icon>
  );
}

export function TagIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M20.6 12.3 12.3 20.6a2 2 0 0 1-2.8 0l-6.1-6.1a2 2 0 0 1 0-2.8L11.7 3.4A2 2 0 0 1 13.1 2.8l6 .1a2 2 0 0 1 2 2l.1 6a2 2 0 0 1-.6 1.4Z" />
      <circle cx="15.5" cy="8.5" r="1.5" />
    </Icon>
  );
}

export function TrashIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 7h16" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
      <path d="M6 7l1 13.5A1.5 1.5 0 0 0 8.5 22h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
    </Icon>
  );
}

export function TrophyIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
      <path d="M8 5H5a3 3 0 0 0 3 5" />
      <path d="M16 5h3a3 3 0 0 1-3 5" />
      <path d="M12 13v3" />
      <path d="M9 20h6" />
      <path d="M10 16h4l.5 4h-5z" />
    </Icon>
  );
}

export function SwordsIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M7 17 19 5" />
      <path d="M5.5 15.5 8.5 18.5" />
      <path d="M7 17 5 19" />
      <circle cx="5" cy="19" r="1" />
      <path d="M17 17 5 5" />
      <path d="M18.5 15.5 15.5 18.5" />
      <path d="M17 17 19 19" />
      <circle cx="19" cy="19" r="1" />
    </Icon>
  );
}

export function ScanIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 9V6a2 2 0 0 1 2-2h3" />
      <path d="M20 9V6a2 2 0 0 0-2-2h-3" />
      <path d="M4 15v3a2 2 0 0 0 2 2h3" />
      <path d="M20 15v3a2 2 0 0 1-2 2h-3" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </Icon>
  );
}

export function StarIcon({ filled, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Icon {...p} fill={filled ? "currentColor" : "none"}>
      <path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.9l-5.6 3.2 1.4-6.3-4.8-4.3 6.4-.6Z" />
    </Icon>
  );
}

export function ScrollIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M7 3h11a2 2 0 0 1 2 2v13.5a2.5 2.5 0 0 1-2.5 2.5H8" />
      <path d="M7 3a2.5 2.5 0 0 0-2.5 2.5v13A2.5 2.5 0 0 0 7 21" />
      <path d="M7 3v18" />
      <path d="M10 8h7M10 12h7" />
    </Icon>
  );
}
