import { NavLink } from "react-router-dom";
import type { ReactElement, SVGProps } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarIcon,
  GridIcon,
  HomeIcon,
  LayersIcon,
  UsersIcon,
} from "./icons";

type TabIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => ReactElement;

const tabs: { to: string; labelKey: string; Icon: TabIcon }[] = [
  { to: "/", labelKey: "tabs.home", Icon: HomeIcon },
  { to: "/games", labelKey: "tabs.games", Icon: LayersIcon },
  { to: "/events", labelKey: "tabs.events", Icon: CalendarIcon },
  { to: "/collection", labelKey: "tabs.collection", Icon: GridIcon },
  { to: "/social", labelKey: "tabs.social", Icon: UsersIcon },
];

export function TabBar() {
  const { t } = useTranslation();
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
              <span className="tab-bar__label">{t(tab.labelKey)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
