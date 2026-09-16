import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Building2, LayoutDashboard, LogOut, Moon, Sun } from "lucide-react";
import { Button } from "./ui";
import { useApp } from "../context";
import { post } from "../api";
import { useI18nLocale, useT } from "../i18n";
export function Shell() {
  const { config, user, refresh, notify } = useApp();
  const { t } = useT();
  const { label, nativeLabel, cycleLocale } = useI18nLocale();
  const location = useLocation();
  const admin = location.pathname.startsWith("/admin");
  const login = location.pathname === "/login";
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
      "/admin/settings": t("admin.document.settings"),
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
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        {t("a11y.skip_to_content")}
      </a>
      <header className="app-header">
        <NavLink to="/" className="brand" aria-label={t("a11y.brand_home")}>
          <img src="/digilist-logo.svg" alt="" />
          <span>
            {building}
            <small>{t("common.powered_by_digilist")}</small>
          </span>
        </NavLink>
        {user?.isAdmin && (
          <nav aria-label={t("a11y.main_nav")} className="desktop-nav">
            <NavLink to="/" end>
              {t("common.find_rooms")}
            </NavLink>
            <NavLink to="/admin">{t("common.administration")}</NavLink>
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
              <span className="user-name">{user.name}</span>
              <Button
                variant="tertiary"
                icon
                aria-label={t("a11y.log_out")}
                onClick={logout}
              >
                <LogOut size={20} />
              </Button>
            </>
          ) : (
            !login && (
              <NavLink
                className="ds-button"
                data-variant="secondary"
                data-size="sm"
                to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
              >
                {t("auth.log_in")}
              </NavLink>
            )
          )}
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className={
          admin ? "admin-main" : login ? "page-main auth-main" : "page-main"
        }
      >
        <Outlet />
      </main>
      {!admin && !login && (
        <footer className="app-footer">
          <span>
            {building} <span aria-hidden>·</span>{" "}
            {t("common.powered_by_digilist_footer")}
          </span>
          <span>{config?.address || t("common.default_timezone_note")}</span>
          {config?.contactEmail && (
            <a href={`mailto:${config.contactEmail}`}>
              {t("common.contact_us")}
            </a>
          )}
        </footer>
      )}
      {user?.isAdmin && (
        <nav className="mobile-nav" aria-label={t("a11y.mobile_nav")}>
          <NavLink to="/" end>
            <Building2 size={21} />
            {t("common.find_rooms")}
          </NavLink>
          <NavLink to="/admin">
            <LayoutDashboard size={21} />
            {t("common.administration")}
          </NavLink>
        </nav>
      )}
    </div>
  );
}
