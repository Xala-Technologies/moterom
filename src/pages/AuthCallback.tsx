import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loading, ErrorState } from "../components/ui";
import { useApp } from "../context";
import { post } from "../api";
import { useT } from "../i18n";

/** Digilist OAuth callback — receives sessionToken from Digilist auth redirect. */
export function AuthCallback() {
  const { refresh } = useApp();
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
      const safeReturn =
        returnPath.startsWith("/") &&
        !returnPath.startsWith("//") &&
        !returnPath.includes("\\")
          ? returnPath
          : "/";
      if (oauthError) {
        setError(new Error(t("auth.bankid_error")));
        return;
      }
      if (!token) {
        setError(new Error(t("auth.session_missing")));
        return;
      }
      try {
        await post("/auth/session", { token });
        if (cancelled) return;
        await refresh();
        nav(safeReturn, { replace: true });
      } catch (e) {
        if (!cancelled) setError(e as Error);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [params, refresh, nav, t]);

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
