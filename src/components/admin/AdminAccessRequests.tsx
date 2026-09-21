import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { MoreHorizontal } from "lucide-react";
import { Button, Empty, ErrorState, Loading, Modal, Status } from "../ui";
import { api } from "../../api";
import { useApp } from "../../context";
import { useFormatters, useT } from "../../i18n";
import type { AccessRequest, AccessRequestStatus } from "../../../shared/types";
import { openingAccessFilter } from "./accessRequestFilter";

type ApiResult = {
  data?: AccessRequest[];
  error?: Error;
  loading: boolean;
  reload: () => void;
  setData: Dispatch<SetStateAction<AccessRequest[] | undefined>>;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

function RequestMenu({
  name,
  busy,
  actions,
}: {
  name: string;
  busy: boolean;
  actions: { key: string; label: string; danger?: boolean; run: () => void }[];
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = [
        ...(menuRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]',
        ) ?? []),
      ];
      if (!items.length) return;
      event.preventDefault();
      const index = items.findIndex((item) => item === document.activeElement);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next =
        items[index + direction] ??
        items[direction === 1 ? 0 : items.length - 1];
      next?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus();
  }, [open]);

  return (
    <div className={`admin-users-menu${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="admin-users-menu-trigger"
        aria-label={t("admin.users.actions_menu", { name })}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={busy}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          ref={menuRef}
          className="admin-users-menu-list"
          role="menu"
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              className={action.danger ? "is-danger" : undefined}
              onClick={() => {
                setOpen(false);
                action.run();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminAccessRequests({ result }: { result: ApiResult }) {
  const { config, notify } = useApp();
  const { t } = useT();
  const { displayDate } = useFormatters();
  const [filter, setFilter] = useState<"all" | AccessRequestStatus>("pending");
  const [busyId, setBusyId] = useState<string>();
  const [removeTarget, setRemoveTarget] = useState<AccessRequest>();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current || !result.data) return;
    opened.current = true;
    const next = openingAccessFilter(result.data);
    if (next !== "pending") setFilter(next);
  }, [result.data]);

  const all = result.data || [];
  const counts = {
    pending: all.filter((row) => row.status === "pending").length,
    approved: all.filter((row) => row.status === "approved").length,
    rejected: all.filter((row) => row.status === "rejected").length,
    all: all.length,
  };
  const rows = all.filter((row) => filter === "all" || row.status === filter);

  const setStatus = async (id: string, status: AccessRequestStatus) => {
    setBusyId(id);
    try {
      const updated = await api<AccessRequest>(`/admin/access-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      result.setData((prev) =>
        (prev || []).map((row) => (row.id === id ? updated : row)),
      );
      notify(
        status === "approved"
          ? t(
              config?.mode === "live"
                ? "admin.users.toasts.marked_approved"
                : "admin.users.toasts.marked_approved_demo",
            )
          : status === "rejected"
            ? t("admin.users.toasts.marked_rejected")
            : t("admin.users.toasts.marked_pending"),
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(undefined);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await api<{ success: true }>(`/admin/access-requests/${id}`, {
        method: "DELETE",
      });
      result.setData((prev) => (prev || []).filter((row) => row.id !== id));
      setRemoveTarget(undefined);
      notify(t("admin.users.toasts.removed"));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(undefined);
    }
  };

  if (result.loading) return <Loading label={t("admin.users.loading")} />;
  if (result.error)
    return <ErrorState error={result.error} retry={result.reload} />;

  const emptyElsewhere =
    filter === "pending" &&
    counts.pending === 0 &&
    counts.approved + counts.rejected > 0;

  return (
    <div className="admin-users">
      <p className="admin-users-note">
        {t(
          config?.mode === "live"
            ? "admin.users.caption"
            : "admin.users.caption_demo",
        )}
      </p>
      <div
        className="admin-users-tabs"
        role="group"
        aria-label={t("admin.users.filter_aria")}
      >
        {(
          [
            [
              "status",
              [
                ["pending", t("admin.users.filter_pending"), counts.pending],
                ["approved", t("admin.users.filter_approved"), counts.approved],
                ["rejected", t("admin.users.filter_rejected"), counts.rejected],
              ],
            ],
            ["all", [["all", t("admin.users.filter_all"), counts.all]]],
          ] as const
        ).map(([group, items]) => (
          <div
            key={group}
            className={
              group === "all"
                ? "admin-users-tab-track admin-users-tab-all"
                : "admin-users-tab-track"
            }
          >
            {items.map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                <span>{label}</span>
                <span className="admin-users-tab-count">{count}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty
          title={
            emptyElsewhere
              ? t("admin.users.empty_pending_title")
              : t("admin.users.empty_title")
          }
        >
          <p>
            {emptyElsewhere
              ? t("admin.users.empty_pending_body")
              : t("admin.users.empty_body")}
          </p>
          {emptyElsewhere && (
            <Button
              variant="secondary"
              data-size="sm"
              type="button"
              onClick={() => setFilter("all")}
            >
              {t("admin.users.show_all")}
            </Button>
          )}
        </Empty>
      ) : (
        <div className="admin-users-table">
          <div className="admin-users-header" role="row">
            <span>{t("admin.users.cols.user")}</span>
            <span>{t("admin.users.cols.received")}</span>
            <span>{t("admin.users.cols.company")}</span>
            <span>{t("admin.users.cols.status")}</span>
            <span className="admin-users-header-actions">
              {t("admin.users.cols.actions")}
            </span>
          </div>
          <ul className="admin-users-list">
            {rows.map((row) => (
              <li key={row.id} className="admin-users-row">
                <div className="admin-users-identity">
                  <div className="admin-users-avatar" aria-hidden="true">
                    {initials(row.name)}
                  </div>
                  <div className="admin-users-identity-text">
                    <strong>{row.name}</strong>
                    <span className="admin-users-email">{row.email}</span>
                  </div>
                </div>
                <p className="admin-users-date">
                  {displayDate(row.createdAt, true)}
                </p>
                <p className="admin-users-message">
                  {row.company || t("admin.users.company_missing")}
                </p>
                <div className="admin-users-status">
                  <Status status={row.status} />
                </div>
                <div className="admin-users-actions">
                  <RequestMenu
                    name={row.name}
                    busy={busyId === row.id}
                    actions={[
                      ...(row.status !== "approved"
                        ? [
                            {
                              key: "approve",
                              label: t(
                                config?.mode === "live"
                                  ? "admin.users.mark_approved"
                                  : "admin.users.mark_approved_demo",
                              ),
                              run: () => void setStatus(row.id, "approved"),
                            },
                          ]
                        : []),
                      ...(row.status !== "rejected"
                        ? [
                            {
                              key: "reject",
                              label: t("admin.users.mark_rejected"),
                              run: () => void setStatus(row.id, "rejected"),
                            },
                          ]
                        : []),
                      ...(row.status !== "pending"
                        ? [
                            {
                              key: "reset",
                              label: t("admin.users.mark_pending"),
                              run: () => void setStatus(row.id, "pending"),
                            },
                          ]
                        : []),
                      {
                        key: "remove",
                        label: t("admin.users.remove"),
                        danger: true,
                        run: () => setRemoveTarget(row),
                      },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {removeTarget && (
        <Modal
          title={t("admin.users.remove_title")}
          close={() => {
            if (busyId) return;
            setRemoveTarget(undefined);
          }}
        >
          <p>{t("admin.users.remove_body", { name: removeTarget.name })}</p>
          <div className="modal-actions">
            <Button
              variant="secondary"
              type="button"
              disabled={busyId === removeTarget.id}
              onClick={() => setRemoveTarget(undefined)}
            >
              {t("admin.users.remove_cancel")}
            </Button>
            <Button
              type="button"
              data-color="danger"
              disabled={busyId === removeTarget.id}
              onClick={() => void remove(removeTarget.id)}
            >
              {t("admin.users.remove_confirm")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
