import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "./ui";
import { BrandMark } from "./BrandMark";
import { useApp } from "../context";
import { post } from "../api";
import { useI18nLocale, useT } from "../i18n";
export function Shell() {
  const { config, user, refresh, notify } = useApp();
  const { t } = useT();
  const { label, nativeLabel, cycleLocale } = useI18nLocale();
  const location = useLocation();
  const admin = location.pathname.startsWith("/admin");
  const login =
    location.pathname === "/login" || location.pathname === "/auth/callback";
  const building = config?.buildingName || t("common.app_name");
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
      "/": t("rooms.document_title_find"),
      "/ny-booking": t("booking.document_title_new"),
      "/admin": t("admin.document.overview"),
      "/admin/innsikt": t("admin.document.insights"),
      "/admin/calendar": t("admin.document.calendar"),
      "/admin/bookings": t("admin.document.bookings"),
      "/admin/rooms": t("admin.document.rooms"),
      "/admin/users": t("admin.document.users"),
      "/admin/messages": t("admin.document.messages"),
      "/admin/settings": t("admin.document.settings"),
      "/mine-bookinger": t("dashboard.document_title"),
      "/meldinger": t("messages.document_title"),
      "/login": t("auth.document_title"),
    };
    const fallback = location.pathname.startsWith("/ny-booking")
      ? t("booking.document_title_new")
      : location.pathname.startsWith("/bestill/")
        ? t("booking.document_title_new")
        : location.pathname.startsWith("/booking/")
          ? t("booking.document_title_detail")
          : location.pathname.startsWith("/admin")
            ? t("admin.document.administration")
            : t("common.booking");
    document.title = `${headings[location.pathname] || fallback} · ${building}`;
  }, [location.pathname, building, t]);
  useEffect(() => {
    document
      .querySelector<HTMLElement>("#main-content")
      ?.focus({ preventScroll: true });
  }, [location.pathname]);
  const logout = async () => {
    try {
      await post("/auth/logout");
      await refresh();
      notify(t("auth.logged_out"));
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const dashboardPath =
    location.pathname.startsWith("/mine-bookinger") ||
    location.pathname.startsWith("/meldinger") ||
    location.pathname.startsWith("/booking/");
  const customer = Boolean(user && !user.isAdmin && !login && !admin);
  const customerNav = customer && dashboardPath;
  const dashboardClass = () => (dashboardPath ? "active" : undefined);
  const customerLinks = [
    {
      to: "/mine-bookinger",
      icon: CalendarDays,
      label: t("dashboard.nav"),
    },
    {
      to: "/meldinger",
      icon: MessageCircle,
      label: t("messages.nav"),
    },
  ];
  const footer = (
    <footer className="app-footer">
      <span>
        {building} <span aria-hidden>·</span>{" "}
        {t("common.powered_by_digilist_footer")}
      </span>
      <span>{config?.address || t("common.default_timezone_note")}</span>
      {config?.contactEmail && (
        <a href={`mailto:${config.contactEmail}`}>{t("common.contact_us")}</a>
      )}
    </footer>
  );
  return (
    <div
      className={
        login
          ? "app-shell auth-shell"
          : customerNav
            ? "app-shell customer-shell"
            : "app-shell"
      }
    >
      <a href="#main-content" className="skip-link">
        {t("a11y.skip_to_content")}
      </a>
      {!login && (
        <header className="app-header">
          <NavLink to="/" className="brand" aria-label={t("a11y.brand_home")}>
            <BrandMark />
          </NavLink>
          {user && (
            <nav aria-label={t("a11y.main_nav")} className="desktop-nav">
              {user.isAdmin ? (
                <>
                  <NavLink to="/" end>
                    {t("common.find_rooms")}
                  </NavLink>
                  <NavLink to="/admin">{t("common.administration")}</NavLink>
                </>
              ) : (
                <>
                  <NavLink
                    to="/mine-bookinger"
                    className={dashboardClass}
                    aria-current={dashboardPath ? "page" : undefined}
                  >
                    {t("dashboard.area")}
                  </NavLink>
                  <NavLink to="/" end>
                    {t("common.find_rooms")}
                  </NavLink>
                </>
              )}
            </nav>
          )}
          <div className="header-actions">
            <Button
              variant="tertiary"
              className="language-switch"
              data-testid="language-switcher"
              aria-label={t("a11y.language_switch", { label: nativeLabel })}
              onClick={cycleLocale}
            >
              {label}
            </Button>
            <Button
              variant="tertiary"
              icon
              aria-label={
                dark ? t("a11y.use_light_theme") : t("a11y.use_dark_theme")
              }
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
            {user ? (
              <>
                <NavLink
                  to={user.isAdmin ? "/admin" : "/mine-bookinger"}
                  className="user-name user-name-link"
                >
                  {user.name}
                </NavLink>
                <Button
                  variant="tertiary"
                  icon
                  aria-label={t("a11y.log_out")}
                  onClick={logout}
                >
                  <LogOut size={20} />
                </Button>
              </>
            ) : config?.access === "members" ? null : (
              <NavLink
                className="ds-button"
                data-variant="secondary"
                data-size="sm"
                to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
              >
                {t("auth.log_in")}
              </NavLink>
            )}
          </div>
        </header>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className={
          admin || customerNav
            ? "admin-main"
            : login
              ? "page-main auth-main"
              : "page-main"
        }
      >
        {login && (
          <div className="login-shell-actions">
            <Button
              variant="tertiary"
              className="language-switch"
              data-testid="language-switcher"
              aria-label={t("a11y.language_switch", { label: nativeLabel })}
              onClick={cycleLocale}
            >
              {label}
            </Button>
            <Button
              variant="tertiary"
              icon
              aria-label={
                dark ? t("a11y.use_light_theme") : t("a11y.use_dark_theme")
              }
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
          </div>
        )}
        {customerNav ? (
          <div className="admin-layout">
            <aside className="admin-sidebar customer-sidebar">
              <nav aria-label={t("a11y.dashboard_nav")}>
                {customerLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink key={link.to} to={link.to}>
                      <Icon size={19} />
                      {link.label}
                    </NavLink>
                  );
                })}
              </nav>
            </aside>
            <div className="customer-pane">
              <div className="page-main">
                <Outlet />
              </div>
              {footer}
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      {!admin && !login && !customerNav && footer}
      {user && !login && (
        <nav className="mobile-nav" aria-label={t("a11y.mobile_nav")}>
          {user.isAdmin ? (
            <>
              <NavLink to="/" end>
                <Building2 size={21} />
                {t("common.find_rooms")}
              </NavLink>
              <NavLink to="/admin">
                <LayoutDashboard size={21} />
                {t("common.administration")}
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to="/mine-bookinger"
                className={dashboardClass}
                aria-current={dashboardPath ? "page" : undefined}
              >
                <LayoutDashboard size={21} />
                {t("dashboard.area")}
              </NavLink>
              <NavLink to="/" end>
                <Building2 size={21} />
                {t("common.find_rooms")}
              </NavLink>
            </>
          )}
        </nav>
      )}
    </div>
  );
}
