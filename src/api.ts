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
  if (!res.ok)
    throw new ApiError(
      body.message || i18n.t("errors.request_failed"),
      res.status,
      body.code,
    );
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
  current.current = path;
  useEffect(() => {
    if (!path) {
      setData(undefined);
      setLoading(false);
      setError(undefined);
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setError(undefined);
    setData(undefined);
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
