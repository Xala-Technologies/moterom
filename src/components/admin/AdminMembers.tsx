import { useState } from "react";
import { api, useApi } from "../../api";
import { useApp } from "../../context";
import { useT } from "../../i18n";
import { Button, ErrorState, Loading, Modal, Status } from "../ui";
import { isBuildingAdminRole } from "../../../shared/members";
import type { TenantMember } from "../../../shared/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

/** Digilist directory with explicit Møterom portal grants. */
export function AdminMembers() {
  const { notify, user } = useApp();
  const { t } = useT();
  const result = useApi<TenantMember[]>("/admin/members");
  const [revokeTarget, setRevokeTarget] = useState<TenantMember>();
  const [busyId, setBusyId] = useState<string>();

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

  return (
    <section className="settings-card" aria-labelledby="building-members-title">
      <header className="settings-card-header">
        <div className="settings-card-heading">
          <h2 id="building-members-title">{t("admin.members.title")}</h2>
          <p>{t("admin.members.caption")}</p>
        </div>
      </header>
      <div className="settings-card-body stack">
        <Button
          variant="secondary"
          data-size="sm"
          type="button"
          onClick={result.reload}
          disabled={result.loading}
        >
          {t("admin.members.refresh")}
        </Button>
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
              {result.data.map((member) => {
                const isSelf = member.userId === user?.id;
                const granted = Boolean(member.portalGranted);
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
                    <p className="admin-members-role">
                      {t(
                        isBuildingAdminRole(member.role)
                          ? "admin.members.role_administrator"
                          : "admin.members.role_member",
                      )}
                    </p>
                    <div className="admin-users-status">
                      <Status status={granted ? "active" : "invited"} />
                      <span className="admin-members-access-label">
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
