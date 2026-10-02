import { useEffect, useId, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { api, useApi } from "../../api";
import { useApp } from "../../context";
import { useT } from "../../i18n";
import {
  Button,
  ErrorState,
  Label,
  Loading,
  Modal,
  Select,
  Status,
} from "../ui";
import { PORTAL_ROLES, type PortalRole } from "../../../shared/adminAccess";
import type { TenantMember } from "../../../shared/types";

const PAGE_SIZE = 6;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

function roleLabelKey(role: PortalRole): string {
  if (role === "full") return "admin.members.role_portal_admin";
  if (role === "operations") return "admin.members.role_operations";
  return "admin.members.role_member";
}

/** Digilist directory with explicit Møterom portal grants and roles. */
export function AdminMembers() {
  const { notify, user } = useApp();
  const { t } = useT();
  const result = useApi<TenantMember[]>("/admin/members");
  const [page, setPage] = useState(0);
  const [revokeTarget, setRevokeTarget] = useState<TenantMember>();
  const [busyId, setBusyId] = useState<string>();
  const roleFieldId = useId();

  const members = result.data || [];
  const paginate = members.length > PAGE_SIZE;
  const pageCount = paginate ? Math.ceil(members.length / PAGE_SIZE) : 1;
  const listKey = members.map((member) => member.userId).join(",");

  useEffect(() => {
    setPage(0);
  }, [listKey]);

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const safePage = Math.min(page, pageCount - 1);
  const start = paginate ? safePage * PAGE_SIZE : 0;
  const end = paginate ? start + PAGE_SIZE : members.length;
  const visible = members.slice(start, end);
  const from = members.length === 0 ? 0 : start + 1;
  const to = Math.min(end, members.length);

  const grant = async (member: TenantMember) => {
    setBusyId(member.userId);
    try {
      await api<{ success: true; portalGranted: true }>(
        `/admin/members/${encodeURIComponent(member.userId)}/portal-access`,
        { method: "POST" },
      );
      result.setData((prev) =>
        (prev || []).map((row) =>
          row.userId === member.userId ? { ...row, portalGranted: true } : row,
        ),
      );
      notify(t("admin.members.granted", { email: member.email }));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(undefined);
    }
  };

  const revoke = async (member: TenantMember) => {
    setBusyId(member.userId);
    try {
      await api<{ success: true }>(
        `/admin/members/${encodeURIComponent(member.userId)}`,
        { method: "DELETE" },
      );
      result.setData((prev) =>
        (prev || []).filter((row) => row.userId !== member.userId),
      );
      setRevokeTarget(undefined);
      notify(t("admin.members.revoked", { email: member.email }));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(undefined);
    }
  };

  const setPortalRole = async (member: TenantMember, role: PortalRole) => {
    if ((member.portalRole ?? "member") === role) return;
    setBusyId(member.userId);
    try {
      const updated = await api<TenantMember>("/admin/members/portal-role", {
        method: "PATCH",
        body: JSON.stringify({ email: member.email, role }),
      });
      result.setData((prev) =>
        (prev || []).map((row) =>
          row.userId === member.userId
            ? {
                ...row,
                portalRole: updated.portalRole ?? role,
                portalGranted: updated.portalGranted ?? row.portalGranted,
              }
            : row,
        ),
      );
      notify(t("admin.members.role_saved"));
    } catch (e) {
      notify((e as Error).message);
      result.reload();
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <section className="settings-card" aria-labelledby="building-members-title">
      <header className="settings-card-header">
        <div className="settings-card-heading">
          <h2 id="building-members-title">{t("admin.members.title")}</h2>
        </div>
        <Button
          variant="secondary"
          data-size="sm"
          type="button"
          onClick={result.reload}
          disabled={result.loading}
          aria-label={t("admin.members.refresh")}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {t("admin.members.refresh_short")}
        </Button>
      </header>
      <div className="settings-card-body stack">
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <ErrorState error={result.error} retry={result.reload} />
        ) : result.data?.length ? (
          <div className="admin-users-table admin-members-table">
            <div className="admin-users-header admin-members-header" role="row">
              <span>{t("admin.users.cols.user")}</span>
              <span>{t("admin.members.role")}</span>
              <span>{t("admin.members.portal_access")}</span>
              <span className="visually-hidden">
                {t("admin.members.actions")}
              </span>
            </div>
            <ul className="admin-users-list">
              {visible.map((member) => {
                const isSelf = member.userId === user?.id;
                const granted = Boolean(member.portalGranted);
                const portalRole = member.portalRole ?? "member";
                const lockRole = isSelf && portalRole === "full";
                const selectId = `${roleFieldId}-${member.userId}`;
                return (
                  <li
                    key={member.userId}
                    className="admin-users-row admin-members-row"
                  >
                    <div className="admin-users-identity">
                      <div className="admin-users-avatar" aria-hidden="true">
                        {initials(member.name)}
                      </div>
                      <div className="admin-users-identity-text">
                        <strong>{member.name}</strong>
                        <span className="admin-users-email">
                          {member.email}
                        </span>
                      </div>
                    </div>
                    <div className="admin-members-role">
                      <Label htmlFor={selectId} className="visually-hidden">
                        {t("admin.members.role_for", { name: member.name })}
                      </Label>
                      <Select
                        id={selectId}
                        data-size="sm"
                        value={portalRole}
                        disabled={busyId === member.userId || lockRole}
                        title={
                          lockRole
                            ? t("admin.members.cannot_demote_self")
                            : undefined
                        }
                        onChange={(event) => {
                          const next = event.target.value;
                          if (
                            next === "member" ||
                            next === "operations" ||
                            next === "full"
                          )
                            void setPortalRole(member, next);
                        }}
                      >
                        {PORTAL_ROLES.map((role) => (
                          <Select.Option
                            key={role}
                            value={role}
                            disabled={isSelf && role !== "full"}
                          >
                            {t(roleLabelKey(role))}
                          </Select.Option>
                        ))}
                      </Select>
                    </div>
                    <div
                      className="admin-users-status"
                      title={t(
                        granted
                          ? "admin.members.portal_granted"
                          : "admin.members.portal_digilist_only",
                      )}
                    >
                      <Status status={granted ? "active" : "invited"} />
                      <span className="visually-hidden">
                        {t(
                          granted
                            ? "admin.members.portal_granted"
                            : "admin.members.portal_digilist_only",
                        )}
                      </span>
                    </div>
                    <div className="admin-members-actions">
                      {!granted ? (
                        <Button
                          type="button"
                          variant="secondary"
                          data-size="sm"
                          disabled={
                            busyId === member.userId ||
                            member.status !== "active"
                          }
                          title={
                            member.status !== "active"
                              ? t("admin.members.grant_needs_active")
                              : undefined
                          }
                          onClick={() => void grant(member)}
                        >
                          {t("admin.members.grant")}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        data-size="sm"
                        data-color="danger"
                        disabled={busyId === member.userId || isSelf}
                        title={
                          isSelf
                            ? t("admin.members.cannot_revoke_self")
                            : undefined
                        }
                        onClick={() => setRevokeTarget(member)}
                      >
                        {t("admin.members.revoke")}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {paginate ? (
              <nav
                className="admin-users-pagination"
                aria-label={t("admin.members.pagination_aria")}
              >
                <p className="admin-users-pagination-status" aria-live="polite">
                  {t("admin.members.page_status", {
                    from,
                    to,
                    total: members.length,
                  })}
                </p>
                <div className="admin-users-pagination-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    data-size="sm"
                    disabled={safePage <= 0}
                    aria-label={t("admin.members.previous")}
                    onClick={() =>
                      setPage((current) => Math.max(0, current - 1))
                    }
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                    {t("admin.members.previous")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    data-size="sm"
                    disabled={safePage >= pageCount - 1}
                    aria-label={t("admin.members.next")}
                    onClick={() =>
                      setPage((current) => Math.min(pageCount - 1, current + 1))
                    }
                  >
                    {t("admin.members.next")}
                    <ChevronRight size={16} aria-hidden="true" />
                  </Button>
                </div>
              </nav>
            ) : null}
          </div>
        ) : (
          <p>{t("admin.members.empty")}</p>
        )}
      </div>
      {revokeTarget ? (
        <Modal
          title={t("admin.members.revoke_title")}
          close={() => {
            if (!busyId) setRevokeTarget(undefined);
          }}
        >
          <p>
            {t("admin.members.revoke_body", {
              name: revokeTarget.name,
              email: revokeTarget.email,
            })}
          </p>
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={Boolean(busyId)}
              onClick={() => setRevokeTarget(undefined)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              data-color="danger"
              disabled={Boolean(busyId)}
              onClick={() => void revoke(revokeTarget)}
            >
              {t("admin.members.revoke_confirm")}
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
