import { useState, type Dispatch, type SetStateAction } from "react";
import { ArrowUpRight } from "lucide-react";
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

export function AdminAccessRequests({ result }: { result: ApiResult }) {
  const { config, notify } = useApp();
  const { t } = useT();
  const { displayDate } = useFormatters();
  const [filter, setFilter] = useState<"all" | AccessRequestStatus>("pending");
  const [busyId, setBusyId] = useState<string>();

  const rows = (result.data || []).filter(
    (row) => filter === "all" || row.status === filter,
  );

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
          ? t("admin.users.toasts.marked_approved")
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

  return (
    <div className="admin-users stack">
      <p className="muted">{t("admin.users.caption")}</p>
      <div className="admin-users-toolbar">
        <div
          className="view-switch"
          role="group"
          aria-label={t("admin.users.filter_aria")}
        >
          {(
            [
              ["pending", t("admin.users.filter_pending")],
              ["approved", t("admin.users.filter_approved")],
              ["rejected", t("admin.users.filter_rejected")],
              ["all", t("admin.users.filter_all")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <a
          href={config?.dashboardUrl}
          className="ds-button"
          data-variant="secondary"
          data-size="sm"
          target="_blank"
          rel="noreferrer"
        >
          {t("common.open_digilist")}
          <ArrowUpRight size={16} />
          <span className="sr-only"> {t("common.opens_new_tab")}</span>
        </a>
      </div>

      {rows.length === 0 ? (
        <Empty title={t("admin.users.empty_title")}>
          <p>{t("admin.users.empty_body")}</p>
        </Empty>
      ) : (
        <ul className="admin-users-list">
          {rows.map((row) => (
            <li key={row.id} className="admin-users-row">
              <div className="admin-users-row-main">
                <div>
                  <strong>{row.name}</strong>
                  <p className="muted">{row.email}</p>
                </div>
                <Status status={row.status} />
              </div>
              <p className="admin-users-message">{row.message}</p>
              <p className="caption">
                {t("admin.users.requested_at", {
                  date: displayDate(row.createdAt, true),
                })}
              </p>
              <div className="admin-users-actions">
                <a
                  href={config?.dashboardUrl}
                  className="ds-button"
                  data-variant="secondary"
                  data-size="sm"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("common.open_digilist")}
                  <ArrowUpRight size={15} />
                  <span className="sr-only"> {t("common.opens_new_tab")}</span>
                </a>
                {row.status !== "approved" && (
                  <Button
                    data-size="sm"
                    disabled={busyId === row.id}
                    onClick={() => void setStatus(row.id, "approved")}
                  >
                    {t("admin.users.mark_approved")}
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
      )}
    </div>
  );
}
