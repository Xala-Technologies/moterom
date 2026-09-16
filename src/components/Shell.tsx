import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "./ui";
import { useApp } from "../context";
import { post } from "../api";
export function Shell() {
  const { config, user, refresh, notify } = useApp();
  const location = useLocation();
  const admin = location.pathname.startsWith("/admin");
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("moterom-theme") === "dark";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.dataset.colorScheme = dark ? "dark" : "light";
    try {
      localStorage.setItem("moterom-theme", dark ? "dark" : "light");
    } catch {
      /* preferences are optional */
    }
  }, [dark]);
  useEffect(() => {
    const headings: Record<string, string> = {
      "/": "Finn rom",
      "/mine-bookinger": "Mine bookinger",
      "/admin": "Oversikt",
      "/admin/calendar": "Romkalender",
      "/admin/bookings": "Bookinger",
      "/admin/rooms": "Rom",
      "/admin/settings": "Innstillinger",
      "/login": "Logg inn",
    };
    const fallback = location.pathname.startsWith("/rom/")
      ? "Rom"
      : location.pathname.startsWith("/bestill/")
        ? "Bekreft booking"
        : location.pathname.startsWith("/booking/")
          ? "Booking"
          : location.pathname.startsWith("/admin")
            ? "Administrasjon"
            : "Booking";
    document.title = `${headings[location.pathname] || fallback} · ${config?.buildingName || "Møterom"}`;
    document.querySelector<HTMLElement>("#main-content")?.focus();
  }, [location.pathname, config?.buildingName]);
  const logout = async () => {
    try {
      await post("/auth/logout");
      await refresh();
      notify("Du er logget ut.");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Hopp til innhold
      </a>
      <header className="app-header">
        <NavLink to="/" className="brand" aria-label="Møterom – forsiden">
          <img src="/digilist-logo.svg" alt="" />
          <span>
            {config?.buildingName || "Møterom"}
            <small>drevet av Digilist</small>
          </span>
        </NavLink>
        <nav aria-label="Hovedmeny" className="desktop-nav">
          <NavLink to="/" end>
            Finn rom
          </NavLink>
          <NavLink to="/mine-bookinger">Mine bookinger</NavLink>
          {user?.isAdmin && <NavLink to="/admin">Administrasjon</NavLink>}
        </nav>
        <div className="header-actions">
          <Button
            variant="tertiary"
            icon
            aria-label={dark ? "Bruk lyst tema" : "Bruk mørkt tema"}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </Button>
          {user ? (
            <>
              <span className="user-name">{user.name}</span>
              <Button
                variant="tertiary"
                icon
                aria-label="Logg ut"
                onClick={logout}
              >
                <LogOut size={20} />
              </Button>
            </>
          ) : (
            <NavLink
              className="ds-button"
              data-variant="secondary"
              data-size="sm"
              to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
            >
              Logg inn
            </NavLink>
          )}
        </div>
      </header>
      {config?.mode === "demo" && (
        <div className="demo-banner">
          <span className="demo-dot" />
          <span>
            Demoversjon · Fiktive bookinger. Ingen e-post eller betaling.
          </span>
          <NavLink to="/login">Bytt demorolle</NavLink>
        </div>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className={admin ? "admin-main" : "page-main"}
      >
        <Outlet />
      </main>
      {!admin && (
        <footer className="app-footer">
          <span>
            {config?.buildingName || "Møterom"} <span aria-hidden>·</span>{" "}
            Drevet av Digilist
          </span>
          <span>{config?.address || "Alle tidspunkt vises i norsk tid"}</span>
          {config?.contactEmail && (
            <a href={`mailto:${config.contactEmail}`}>Kontakt oss</a>
          )}
        </footer>
      )}
      <nav className="mobile-nav" aria-label="Mobilmeny">
        <NavLink to="/" end>
          <Building2 size={21} />
          Finn rom
        </NavLink>
        <NavLink to="/mine-bookinger">
          <CalendarDays size={21} />
          Mine bookinger
        </NavLink>
        {user?.isAdmin && (
          <NavLink to="/admin">
            <LayoutDashboard size={21} />
            Administrasjon
          </NavLink>
        )}
      </nav>
    </div>
  );
}
