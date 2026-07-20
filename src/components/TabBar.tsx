import { NavLink } from "react-router-dom";
import type { ReactElement, SVGProps } from "react";
import {
  CalendarIcon,
  GridIcon,
  HomeIcon,
  LayersIcon,
  UsersIcon,
} from "./icons";

type TabIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => ReactElement;

const tabs: { to: string; label: string; Icon: TabIcon }[] = [
  { to: "/", label: "Accueil", Icon: HomeIcon },
  { to: "/games", label: "Jeux", Icon: LayersIcon },
  { to: "/events", label: "Événements", Icon: CalendarIcon },
  { to: "/collection", label: "Collection", Icon: GridIcon },
  { to: "/social", label: "Social", Icon: UsersIcon },
];

export function TabBar() {
  return (
    <nav className="tab-bar">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === "/"}
          className={({ isActive }) =>
            `tab-bar__item${isActive ? " tab-bar__item--active" : ""}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="tab-bar__icon-wrap">
                <tab.Icon size={22} strokeWidth={isActive ? 2.4 : 1.9} />
              </span>
              <span className="tab-bar__label">{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
