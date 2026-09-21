import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, post } from "./api";
import { Button, Modal } from "./components/ui";
import type { Announcement, Config, User } from "../shared/types";
import { useT } from "./i18n";

interface AppContext {
  config?: Config;
  user?: User;
  loading: boolean;
  error?: string;
  refresh: () => Promise<User | undefined>;
  notify: (message: string) => void;
}
const Context = createContext<AppContext | null>(null);

function AnnouncementPopup({ user }: { user: User }) {
  const { t } = useT();
  const [announcement, setAnnouncement] = useState<Announcement | null>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user.isAdmin) {
      setAnnouncement(null);
      return;
    }
    let cancelled = false;
    api<Announcement | null>("/announcements/active")
      .then((value) => {
        if (!cancelled) setAnnouncement(value);
      })
      .catch(() => {
        if (!cancelled) setAnnouncement(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id, user.isAdmin]);

  if (!announcement) return null;

  const dismiss = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await post(`/announcements/${announcement.id}/dismiss`, {});
      setAnnouncement(null);
    } catch {
      setBusy(false);
    }
  };

  return (
    <Modal title={announcement.title} close={() => void dismiss()}>
      <p className="preserve-lines">{announcement.body}</p>
      <div className="modal-actions">
        <Button type="button" disabled={busy} onClick={() => void dismiss()}>
          {busy ? t("common.sending") : t("messages.announcement_dismiss")}
        </Button>
      </div>
    </Modal>
  );
}

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
      const next = s.user ?? undefined;
      setUser(next);
      return next;
    } catch (e) {
      setError((e as Error).message);
      return undefined;
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
      {user && !loading ? <AnnouncementPopup user={user} /> : null}
      <div
        className={`toast ${notice ? "visible" : ""}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
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
