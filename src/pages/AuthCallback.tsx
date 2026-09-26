import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loading, ErrorState } from "../components/ui";
import { AccessRequestFromLogin } from "../components/RequireAuth";
import { useApp } from "../context";
import { ApiError, post } from "../api";
import { useT } from "../i18n";
import { postLoginPath } from "../postLoginPath";

/** Digilist auth callback — receives sessionToken after Digilist redirect. */
export function AuthCallback() {
  const { config, refresh } = useApp();
  const { t } = useT();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [error, setError] = useState<Error>();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const token = params.get("sessionToken");
      const oauthError = params.get("error");
      const returnPath =
        params.get("returnPath") || params.get("redirect") || "/";
      if (oauthError) {
        setError(new Error(t("auth.sign_in_failed")));
        return;
      }
      if (!token) {
        setError(new Error(t("auth.session_missing")));
        return;
      }
      try {
        await post("/auth/session", { token });
        if (cancelled) return;
        const next = await refresh();
        if (config?.access === "members" && next && !next.isMember) {
          nav("/login", { replace: true });
          return;
        }
        nav(postLoginPath(returnPath, next), { replace: true });
      } catch (e) {
        if (!cancelled) setError(e as Error);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [params, refresh, nav, t, config?.access]);

  if (error instanceof ApiError && error.code === "members_only_access") {
    return (
      <div className="login-layout">
        <div className="login-left">
          <div className="login-main">
            <AccessRequestFromLogin
              onDismiss={() => nav("/login", { replace: true })}
            />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="login-layout">
        <div className="login-left">
          <div className="login-main">
            <ErrorState error={error} />
            <a className="ds-button" data-variant="secondary" href="/login">
              {t("auth.back_to_login")}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-layout">
      <div className="login-left">
        <div className="login-main">
          <Loading label={t("auth.completing_login")} />
        </div>
      </div>
    </div>
  );
}
