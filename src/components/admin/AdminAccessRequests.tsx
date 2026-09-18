import { useState, type Dispatch, type SetStateAction } from "react";
import { Button, Empty, ErrorState, Loading, Status } from "../ui";
import { api } from "../../api";
import { useApp } from "../../context";
import { useFormatters, useT } from "../../i18n";
import type { AccessRequest, AccessRequestStatus } from "../../../shared/types";

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

export function AdminAccessRequests({ result }: { result: ApiResult }) {
  const { config, notify } = useApp();
  const { t } = useT();
  const { displayDate } = useFormatters();
  const [filter, setFilter] = useState<"all" | AccessRequestStatus>("pending");
  const [busyId, setBusyId] = useState<string>();

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

  if (result.loading) return <Loading label={t("admin.users.loading")} />;
  if (result.error)
    return <ErrorState error={result.error} retry={result.reload} />;

  const emptyElsewhere =
    filter === "pending" &&
    counts.pending === 0 &&
    counts.approved + counts.rejected > 0;

  return (
    <div className="admin-users stack">
      <p className="muted">
        {t(
          config?.mode === "live"
            ? "admin.users.caption"
            : "admin.users.caption_demo",
        )}
      </p>
      <div className="admin-users-toolbar">
        <div
          className="view-switch"
          role="group"
          aria-label={t("admin.users.filter_aria")}
        >
          {(
            [
              ["pending", t("admin.users.filter_pending"), counts.pending],
              ["approved", t("admin.users.filter_approved"), counts.approved],
              ["rejected", t("admin.users.filter_rejected"), counts.rejected],
              ["all", t("admin.users.filter_all"), counts.all],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {t("admin.users.filter_with_count", { label, count })}
            </button>
          ))}
        </div>
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
            <span>{t("admin.users.cols.message")}</span>
            <span>{t("admin.users.cols.received")}</span>
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
                <p className="admin-users-message">{row.message}</p>
                <p className="admin-users-date">
                  {displayDate(row.createdAt, true)}
                </p>
                <div className="admin-users-status">
                  <Status status={row.status} />
                </div>
                <div className="admin-users-actions">
                  {row.status !== "approved" && (
                    <Button
                      data-size="sm"
                      disabled={busyId === row.id}
                      onClick={() => void setStatus(row.id, "approved")}
                    >
                      {t(
                        config?.mode === "live"
                          ? "admin.users.mark_approved"
                          : "admin.users.mark_approved_demo",
                      )}
                    </Button>
                  )}
                  {row.status !== "rejected" && (
                    <Button
                      variant="secondary"
                      data-size="sm"
                      disabled={busyId === row.id}
                      onClick={() => void setStatus(row.id, "rejected")}
                    >
                      {t("admin.users.mark_rejected")}
                    </Button>
                  )}
                  {row.status !== "pending" && (
                    <Button
                      variant="tertiary"
                      data-size="sm"
                      disabled={busyId === row.id}
                      onClick={() => void setStatus(row.id, "pending")}
                    >
                      {t("admin.users.mark_pending")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
