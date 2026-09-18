import { useApi } from "../../api";
import { useT } from "../../i18n";
import { Button, ErrorState, Loading, Status } from "../ui";
import { isBuildingAdminRole } from "../../../shared/members";
import type { TenantMember } from "../../../shared/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

/** Read the same tenant membership records used by Digilist authorization. */
export function AdminMembers() {
  const { t } = useT();
  const result = useApi<TenantMember[]>("/admin/members");
  return (
    <section className="settings-card" aria-labelledby="building-members-title">
      <header className="settings-card-header">
        <h2 id="building-members-title">{t("admin.members.title")}</h2>
        <p>{t("admin.members.caption")}</p>
      </header>
      <div className="settings-card-body stack">
        <Button
          variant="secondary"
          data-size="sm"
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
              <span>{t("admin.users.cols.status")}</span>
            </div>
            <ul className="admin-users-list">
              {result.data.map((member) => (
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
                      <span className="admin-users-email">{member.email}</span>
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
                    <Status status={member.status} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>{t("admin.members.empty")}</p>
        )}
      </div>
    </section>
  );
}
