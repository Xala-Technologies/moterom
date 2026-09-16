import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { Config, User } from "../shared/types";
interface AppContext {
  config?: Config;
  user?: User;
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
}
const Context = createContext<AppContext | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config>();
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState("");
  const refresh = async () => {
    setError(undefined);
    try {
      const [c, s] = await Promise.all([
        api<Config>("/config"),
        api<{ user: User | null }>("/session"),
      ]);
      setConfig(c);
      setUser(s.user ?? undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);
  return (
    <Context.Provider
      value={{ config, user, loading, error, refresh, notify: setNotice }}
    >
      {children}
      <div
        className={`toast ${notice ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice}
      </div>
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider missing");
  return value;
}
