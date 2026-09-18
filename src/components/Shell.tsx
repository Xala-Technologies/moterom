import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Building2,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  LayoutDashboard,
  Languages,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Settings,
  Sun,
  UsersRound,
  X,
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
  const [menuOpen, setMenuOpen] = useState(false);
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
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const menu = document.getElementById("app-header-menu");
    const button = document.getElementById("header-menu-button");
    const items = () =>
      [
        ...(menu?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ) ?? []),
      ].filter((el) => el.getClientRects().length > 0);
    items()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        button?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menu?.contains(target) || button?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);
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
  const adminSections: {
    to: string;
    end?: boolean;
    label: string;
    icon: typeof LayoutDashboard;
  }[] = [
    {
      to: "/admin",
      end: true,
      label: t("admin.nav.overview"),
      icon: LayoutDashboard,
    },
    {
      to: "/admin/innsikt",
      label: t("admin.nav.insights"),
      icon: ChartColumn,
    },
    {
      to: "/admin/calendar",
      label: t("admin.nav.calendar"),
      icon: CalendarDays,
    },
    {
      to: "/admin/bookings",
      label: t("admin.nav.bookings"),
      icon: ClipboardList,
    },
    {
      to: "/admin/messages",
      label: t("admin.nav.messages"),
      icon: MessageCircle,
    },
    { to: "/admin/rooms", label: t("admin.nav.rooms"), icon: Building2 },
    { to: "/admin/users", label: t("admin.nav.users"), icon: UsersRound },
    {
      to: "/admin/settings",
      label: t("admin.nav.settings"),
      icon: Settings,
    },
  ];
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
          <Button
            id="header-menu-button"
            variant="tertiary"
            icon
            className="header-menu-button"
            aria-expanded={menuOpen}
            aria-controls="app-header-menu"
            aria-label={menuOpen ? t("a11y.close_menu") : t("a11y.open_menu")}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
          <div
            id="app-header-menu"
            className="header-menu"
            data-open={menuOpen ? "true" : undefined}
          >
            {user && (
              <nav aria-label={t("a11y.main_nav")} className="desktop-nav">
                {user.isAdmin ? (
                  <>
                    <NavLink to="/" end>
                      <Building2 aria-hidden size={19} />
                      {t("common.find_rooms")}
                    </NavLink>
                    <NavLink className="header-admin-entry" to="/admin">
                      {t("common.administration")}
                    </NavLink>
                    <div
                      className="header-admin-links"
                      role="group"
                      aria-labelledby="header-admin-label"
                    >
                      <p className="header-menu-label" id="header-admin-label">
                        {t("common.administration")}
                      </p>
                      {adminSections.map((item) => {
                        const Icon = item.icon;
                        return (
                          <NavLink key={item.to} to={item.to} end={item.end}>
                            <Icon aria-hidden size={19} />
                            {item.label}
                          </NavLink>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <NavLink
                      to="/mine-bookinger"
                      className={dashboardClass}
                      aria-current={dashboardPath ? "page" : undefined}
                    >
                      <LayoutDashboard aria-hidden size={19} />
                      {t("dashboard.area")}
                    </NavLink>
                    <NavLink to="/" end>
                      <Building2 aria-hidden size={19} />
                      {t("common.find_rooms")}
                    </NavLink>
                  </>
                )}
              </nav>
            )}
            <div className="header-actions">
              <Button
                variant="tertiary"
                className="language-switch header-tool"
                data-testid="language-switcher"
                aria-label={t("a11y.language_switch", { label: nativeLabel })}
                onClick={cycleLocale}
              >
                <Languages aria-hidden className="menu-only-icon" size={19} />
                <span className="language-switch-code">{label}</span>
                <span className="header-action-text">{nativeLabel}</span>
              </Button>
              <Button
                variant="tertiary"
                className="header-icon-button header-tool"
                aria-label={
                  dark ? t("a11y.use_light_theme") : t("a11y.use_dark_theme")
                }
                onClick={() => setDark(!dark)}
              >
                {dark ? <Sun size={20} /> : <Moon size={20} />}
                <span className="header-action-text">
                  {dark ? t("a11y.use_light_theme") : t("a11y.use_dark_theme")}
                </span>
              </Button>
              {user ? (
                <>
                  <NavLink
                    to={user.isAdmin ? "/admin" : "/mine-bookinger"}
                    className="user-name user-name-link"
                    title={user.name}
                  >
                    {user.name}
                  </NavLink>
                  <Button
                    variant="tertiary"
                    className="header-icon-button"
                    aria-label={t("a11y.log_out")}
                    onClick={logout}
                  >
                    <LogOut size={20} />
                    <span className="header-action-text">
                      {t("a11y.log_out")}
                    </span>
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
