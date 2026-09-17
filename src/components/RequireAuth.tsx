import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useApp } from "../context";
import { post } from "../api";
import { Button, Loading } from "./ui";
import { AccessRequestForm } from "./AccessRequestForm";
import { useT } from "../i18n";

/** Shared panel: signed in (or Digilist auth refused) but not a building member. */
export function AccessPending({
  onLogout,
}: {
  onLogout?: () => void;
} = {}) {
  const { refresh, notify } = useApp();
  const { t } = useT();
  const [showForm, setShowForm] = useState(false);
  const logout = async () => {
    try {
      await post("/auth/logout");
      await refresh();
      notify(t("auth.logged_out"));
      onLogout?.();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <div className="container access-pending">
      {showForm ? (
        <AccessRequestForm showCancel onCancel={() => setShowForm(false)} />
      ) : (
        <>
          <h1>{t("auth.access_pending_title")}</h1>
          <p>{t("auth.access_pending_body")}</p>
          <p className="muted">{t("auth.access_pending_admin_hint")}</p>
          <div className="access-pending-actions">
            <Button type="button" onClick={() => setShowForm(true)}>
              {t("auth.request_access")}
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => void logout()}
            >
              {t("a11y.log_out")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Login-first gate: requires a session; members mode also requires isMember. */
export function RequireAuth() {
  const { user, config, loading } = useApp();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) {
    const returnTo = location.pathname + location.search;
    return (
      <Navigate
        replace
        to={`/login?returnTo=${encodeURIComponent(returnTo || "/")}`}
      />
    );
  }
  if (config?.access === "members" && !user.isMember) {
    return <AccessPending />;
  }
  return <Outlet />;
}

/** Shown on login when the user is signed in but not yet approved for the building. */
export function AccessRequestFromLogin({
  onDismiss,
}: {
  onDismiss?: () => void;
}) {
  const { t } = useT();
  const [showForm, setShowForm] = useState(false);
  if (showForm) {
    return <AccessRequestForm showCancel onCancel={() => setShowForm(false)} />;
  }
  return (
    <div className="access-pending login-access-pending" role="status">
      <h2>{t("auth.access_pending_title")}</h2>
      <p>{t("auth.members_only_login_body")}</p>
      <p className="muted">{t("auth.access_pending_admin_hint")}</p>
      <div className="access-pending-actions">
        <Button type="button" onClick={() => setShowForm(true)}>
          {t("auth.request_access")}
        </Button>
        <Button variant="secondary" type="button" onClick={onDismiss}>
          {t("auth.back_to_login")}
        </Button>
      </div>
    </div>
  );
}
