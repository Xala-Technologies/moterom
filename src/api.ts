import { useCallback, useEffect, useRef, useState } from "react";
import { i18n } from "./i18n";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

const AUTH_LOSS_CODES = new Set(["login_required", "session_expired"]);

export function isAuthLossError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    Boolean(error.code && AUTH_LOSS_CODES.has(error.code))
  );
}

type AuthLossHandler = () => void;

let authLossHandler: AuthLossHandler | undefined;
let authLossNotified = false;

/** AppProvider registers once; parallel 401s only invoke the handler once. */
export function setAuthLossHandler(handler: AuthLossHandler | undefined) {
  authLossHandler = handler;
  authLossNotified = false;
}

/** Test helper — allow a fresh auth-loss cycle after a redirect was simulated. */
export function resetAuthLossGuard() {
  authLossNotified = false;
}

function notifyAuthLoss() {
  if (authLossNotified) return;
  authLossNotified = true;
  authLossHandler?.();
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: "same-origin",
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": i18n.language,
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(i18n.t("errors.network_unreachable"), 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new ApiError(
      body.message || i18n.t("errors.request_failed"),
      res.status,
      body.code,
    );
    if (isAuthLossError(error)) notifyAuthLoss();
    throw error;
  }
  return body as T;
}
export const post = <T>(
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) =>
  api<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    headers,
  });
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(Boolean(path));
  const [revision, setRevision] = useState(0);
  const current = useRef(path);
  const previousPath = useRef<string | null | undefined>(undefined);
  current.current = path;
  useEffect(() => {
    if (!path) {
      previousPath.current = path;
      setData(undefined);
      setLoading(false);
      setError(undefined);
      return;
    }
    const pathChanged = previousPath.current !== path;
    previousPath.current = path;
    const abort = new AbortController();
    // Soft reload (same path): keep showing the last response so send/reply
    // does not unmount the open thread and jump the layout.
    if (pathChanged) {
      setData(undefined);
      setLoading(true);
    }
    setError(undefined);
    api<T>(path, { signal: abort.signal })
      .then((value) => {
        if (!abort.signal.aborted && current.current === path) setData(value);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [path, revision]);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  return { data, error, loading, reload, setData };
}
