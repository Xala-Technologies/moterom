import { useState } from "react";
import { api, useApi } from "../../api";
import { useApp } from "../../context";
import { useT } from "../../i18n";
import { Button, ErrorState, Loading, Status } from "../ui";
import { AdminMembers } from "./AdminMembers";
import { AdminAccessRequests } from "./AdminAccessRequests";
import type {
  MembershipRequest,
  Organization,
  OrganizationMembership,
  OrganizationRelation,
  AccessRequest,
} from "../../../shared/types";

type Tab = "people" | "organizations" | "requests" | "roles";

type OrgAdminPayload = {
  organizations: Organization[];
  relations: OrganizationRelation[];
  memberships: OrganizationMembership[];
  requests: MembershipRequest[];
};

function registryLabel(
  org: Organization,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (
    org.registrySource === "demo_fixture" &&
    org.registryStatus === "verified"
  )
    return t("admin.orgs.registry_demo");
  if (org.registryStatus === "verified") return t("admin.orgs.registry_brreg");
  if (org.registryStatus === "not_registered")
    return t("admin.orgs.registry_not_registered");
  if (org.registryStatus === "verification_failed")
    return t("admin.orgs.registry_failed");
  return t("admin.orgs.registry_unchecked");
}

function registryBadgeLabel(
  org: Organization,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (org.registryStatus === "verified")
    return t("admin.orgs.registry_badge_verified");
  if (org.registryStatus === "not_registered")
    return t("admin.orgs.registry_badge_not_registered");
  if (org.registryStatus === "verification_failed")
    return t("admin.orgs.registry_badge_failed");
  return t("admin.orgs.registry_badge_unchecked");
}

function sourceLabel(
  source: Organization["registrySource"],
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (source === "brreg") return t("admin.orgs.source_brreg");
  if (source === "demo_fixture") return t("admin.orgs.source_demo_fixture");
  if (source === "manual_fhh") return t("admin.orgs.source_manual_fhh");
  return t("admin.orgs.source_none");
}

export function AdminUsersHub({
  accessResult,
  onMembersChanged,
}: {
  accessResult: ReturnType<typeof useApi<AccessRequest[]>>;
  onMembersChanged: () => void;
}) {
  const { notify, config } = useApp();
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("organizations");
  const demoOrgs = config?.mode === "demo";
  const orgs = useApi<OrgAdminPayload>(
    demoOrgs ? "/admin/organizations" : null,
  );
  const [busyId, setBusyId] = useState<string>();

  const pendingOrgRequests =
    orgs.data?.requests.filter((r) => r.status === "pending").length || 0;
  const pendingAccess =
    accessResult.data?.filter((r) => r.status === "pending").length || 0;

  const setRequestStatus = async (
    id: string,
    status: "approved" | "rejected" | "revoked",
  ) => {
    setBusyId(id);
    try {
      await api(`/admin/membership-requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      orgs.reload();
      notify(
        status === "approved"
          ? t("admin.orgs.request_approved")
          : status === "rejected"
            ? t("admin.orgs.request_rejected")
            : t("admin.orgs.request_revoked"),
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(undefined);
    }
  };

  const setMembershipStatus = async (
    id: string,
    status: "approved" | "revoked",
  ) => {
    setBusyId(id);
    try {
      await api(`/admin/memberships/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      orgs.reload();
      notify(
        status === "approved"
          ? t("admin.orgs.membership_approved")
          : t("admin.orgs.membership_revoked"),
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(undefined);
    }
  };

  const setManualIdeal = async (id: string, eligible: boolean) => {
    setBusyId(id);
    try {
      await api(`/admin/organizations/${encodeURIComponent(id)}/manual-ideal`, {
        method: "POST",
        body: JSON.stringify({ eligible }),
      });
      orgs.reload();
      notify(t("admin.orgs.manual_ideal_saved"));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(undefined);
    }
  };

  const recheck = async (id: string) => {
    setBusyId(id);
    try {
      await api(`/admin/organizations/${encodeURIComponent(id)}/recheck`, {
        method: "POST",
      });
      orgs.reload();
      notify(t("admin.orgs.rechecked"));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(undefined);
    }
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "people", label: t("admin.orgs.tab_people") },
    {
      id: "organizations",
      label: t("admin.orgs.tab_organizations"),
      count: orgs.data?.organizations.length,
    },
    {
      id: "requests",
      label: t("admin.orgs.tab_requests"),
      count: pendingOrgRequests + pendingAccess,
    },
    { id: "roles", label: t("admin.orgs.tab_roles") },
  ];

  return (
    <div className="stack admin-users-hub">
      <div className="page-heading">
        <div>
          <h2>{t("admin.orgs.hub_title")}</h2>
          <p>{t("admin.orgs.hub_intro")}</p>
        </div>
      </div>
      {demoOrgs && orgs.data ? (
        <div className="admin-users-summary" aria-live="polite">
          <div>
            <span className="caption">{t("admin.orgs.stat_people")}</span>
            <strong>{orgs.data.memberships.length}</strong>
          </div>
          <div>
            <span className="caption">{t("admin.orgs.stat_orgs")}</span>
            <strong>{orgs.data.organizations.length}</strong>
          </div>
          <div>
            <span className="caption">{t("admin.orgs.stat_pending")}</span>
            <strong>{pendingOrgRequests + pendingAccess}</strong>
          </div>
        </div>
      ) : null}
      <div className="admin-users-tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span className="admin-users-tab-count">{item.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "people" && (
        <div className="stack">
          {demoOrgs ? (
            orgs.loading ? (
              <Loading label={t("admin.orgs.loading")} />
            ) : orgs.error ? (
              <ErrorState error={orgs.error} retry={orgs.reload} />
            ) : (
              <div className="card stack">
                <h3>{t("admin.orgs.representatives_title")}</h3>
                <p className="caption">
                  {t("admin.orgs.representatives_intro")}
                </p>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("admin.orgs.col_person")}</th>
                        <th>{t("admin.orgs.col_organization")}</th>
                        <th>{t("admin.orgs.col_status")}</th>
                        <th>{t("admin.orgs.col_actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(orgs.data?.memberships || []).map((m) => {
                        const org = orgs.data?.organizations.find(
                          (o) => o.id === m.organizationId,
                        );
                        return (
                          <tr key={m.id}>
                            <td>
                              <div>{m.name}</div>
                              <div className="caption">{m.email}</div>
                            </td>
                            <td>{org?.name || m.organizationId}</td>
                            <td>
                              <Status status={m.status} />
                            </td>
                            <td className="row-actions">
                              {m.status !== "approved" ? (
                                <Button
                                  data-size="sm"
                                  disabled={busyId === m.id}
                                  onClick={() =>
                                    void setMembershipStatus(m.id, "approved")
                                  }
                                >
                                  {t("admin.orgs.approve")}
                                </Button>
                              ) : (
                                <Button
                                  variant="secondary"
                                  data-size="sm"
                                  disabled={busyId === m.id}
                                  onClick={() =>
                                    void setMembershipStatus(m.id, "revoked")
                                  }
                                >
                                  {t("admin.orgs.revoke")}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : null}
          <AdminMembers />
        </div>
      )}

      {tab === "organizations" &&
        (demoOrgs ? (
          orgs.loading ? (
            <Loading label={t("admin.orgs.loading")} />
          ) : orgs.error ? (
            <ErrorState error={orgs.error} retry={orgs.reload} />
          ) : (
            <div className="stack">
              {(orgs.data?.organizations || []).map((org) => {
                const childRelations = (orgs.data?.relations || []).filter(
                  (r) =>
                    r.parentOrganizationId === org.id &&
                    r.status === "approved",
                );
                const directMembers = (orgs.data?.memberships || []).filter(
                  (m) => m.organizationId === org.id,
                );
                return (
                  <div key={org.id} className="card stack admin-org-card">
                    <div className="admin-org-card-head">
                      <div>
                        <h3>{org.name}</h3>
                        <p className="caption">
                          {org.isInternalTenant
                            ? t("admin.orgs.badge_internal")
                            : t("admin.orgs.badge_external")}
                          {" · "}
                          {t("admin.orgs.org_number", {
                            number: org.organizationNumber,
                          })}
                        </p>
                      </div>
                      <span
                        className={`admin-org-registry-badge admin-org-registry-badge--${org.registryStatus}`}
                      >
                        {registryBadgeLabel(org, t)}
                      </span>
                    </div>
                    {org.registryStatus === "verified" ? (
                      <p className="admin-org-registry-banner" role="status">
                        {org.registrySource === "demo_fixture"
                          ? t("admin.orgs.registry_banner_demo")
                          : t("admin.orgs.registry_banner_verified")}
                      </p>
                    ) : null}
                    <dl className="admin-org-meta">
                      <div>
                        <dt>{t("admin.orgs.meta_registry")}</dt>
                        <dd>{registryLabel(org, t)}</dd>
                      </div>
                      <div>
                        <dt>{t("admin.orgs.meta_source")}</dt>
                        <dd>{sourceLabel(org.registrySource, t)}</dd>
                      </div>
                      <div>
                        <dt>{t("admin.orgs.meta_checked")}</dt>
                        <dd>
                          {org.registryCheckedAt
                            ? new Date(org.registryCheckedAt).toLocaleString()
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("admin.orgs.meta_manual_ideal")}</dt>
                        <dd>
                          {org.manualIdealEligible
                            ? t("common.status.approved")
                            : t("admin.orgs.manual_ideal_no")}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("admin.orgs.meta_representatives")}</dt>
                        <dd>
                          {
                            directMembers.filter((m) => m.status === "approved")
                              .length
                          }{" "}
                          / {directMembers.length}
                        </dd>
                      </div>
                      {org.isInternalTenant ? (
                        <div>
                          <dt>{t("admin.orgs.meta_member_orgs")}</dt>
                          <dd>{childRelations.length}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <div className="row-actions">
                      <Button
                        variant="secondary"
                        data-size="sm"
                        disabled={busyId === org.id}
                        onClick={() => void recheck(org.id)}
                      >
                        {t("admin.orgs.recheck")}
                      </Button>
                      <Button
                        variant="secondary"
                        data-size="sm"
                        disabled={busyId === org.id}
                        onClick={() =>
                          void setManualIdeal(org.id, !org.manualIdealEligible)
                        }
                      >
                        {org.manualIdealEligible
                          ? t("admin.orgs.clear_manual_ideal")
                          : t("admin.orgs.grant_manual_ideal")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <p className="caption">{t("admin.orgs.live_unavailable")}</p>
        ))}

      {tab === "requests" && (
        <div className="stack">
          {demoOrgs ? (
            orgs.loading ? (
              <Loading label={t("admin.orgs.loading")} />
            ) : orgs.error ? (
              <ErrorState error={orgs.error} retry={orgs.reload} />
            ) : (
              <div className="card stack">
                <h3>{t("admin.orgs.membership_requests_title")}</h3>
                {(orgs.data?.requests || []).length === 0 ? (
                  <p className="caption">
                    {t("admin.orgs.no_membership_requests")}
                  </p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{t("admin.orgs.col_person")}</th>
                          <th>{t("admin.orgs.col_organization")}</th>
                          <th>{t("admin.orgs.col_status")}</th>
                          <th>{t("admin.orgs.col_actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(orgs.data?.requests || []).map((r) => {
                          const org = orgs.data?.organizations.find(
                            (o) => o.id === r.organizationId,
                          );
                          return (
                            <tr key={r.id}>
                              <td>
                                <div>{r.name}</div>
                                <div className="caption">{r.email}</div>
                              </td>
                              <td>{org?.name || r.organizationId || "—"}</td>
                              <td>
                                <Status status={r.status} />
                              </td>
                              <td className="row-actions">
                                {r.status === "pending" ? (
                                  <>
                                    <Button
                                      data-size="sm"
                                      disabled={busyId === r.id}
                                      onClick={() =>
                                        void setRequestStatus(r.id, "approved")
                                      }
                                    >
                                      {t("admin.orgs.approve")}
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      data-size="sm"
                                      disabled={busyId === r.id}
                                      onClick={() =>
                                        void setRequestStatus(r.id, "rejected")
                                      }
                                    >
                                      {t("admin.orgs.reject")}
                                    </Button>
                                  </>
                                ) : r.status === "approved" ? (
                                  <Button
                                    variant="secondary"
                                    data-size="sm"
                                    disabled={busyId === r.id}
                                    onClick={() =>
                                      void setRequestStatus(r.id, "revoked")
                                    }
                                  >
                                    {t("admin.orgs.revoke")}
                                  </Button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          ) : null}
          <AdminAccessRequests
            result={accessResult}
            onMembersChanged={onMembersChanged}
          />
        </div>
      )}

      {tab === "roles" && <AdminMembers />}
    </div>
  );
}
