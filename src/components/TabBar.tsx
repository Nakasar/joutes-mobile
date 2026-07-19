import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/", label: "Accueil", icon: "🏠" },
  { to: "/settings", label: "Réglages", icon: "⚙️" },
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
          <span className="tab-bar__icon" aria-hidden>
            {tab.icon}
          </span>
          <span className="tab-bar__label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
