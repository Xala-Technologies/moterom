import { useApi } from "../../api";
import { useT } from "../../i18n";
import { Button, ErrorState, Loading } from "../ui";
import type { TenantMember } from "../../../shared/types";

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
          <div
            className="insights-table-wrap"
            role="region"
            aria-label={t("admin.members.title")}
            tabIndex={0}
          >
            <table className="insights-table">
              <thead>
                <tr>
                  <th scope="col">{t("common.name")}</th>
                  <th scope="col">{t("common.email")}</th>
                  <th scope="col">{t("admin.members.role")}</th>
                  <th scope="col">{t("admin.users.cols.status")}</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((member) => (
                  <tr key={member.userId}>
                    <th scope="row">{member.name}</th>
                    <td>{member.email}</td>
                    <td>{member.role}</td>
                    <td>{t(`admin.members.${member.status}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>{t("admin.members.empty")}</p>
        )}
      </div>
    </section>
  );
}
