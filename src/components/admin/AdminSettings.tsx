import { Link } from "react-router-dom";
import { useApp } from "../../context";
import { useT } from "../../i18n";
import { canManagePortal } from "../../../shared/adminAccess";

export function AdminSettings() {
  const { config, user } = useApp();
  const { t } = useT();
  const portalAdmin = canManagePortal(user);

  return (
    <div className="settings-grid">
      <section className="settings-card settings-card-span settings-status">
        <header className="settings-card-header">
          <div className="settings-card-heading">
            <h2>{t("admin.settings_portal_status")}</h2>
            <p>{t("admin.settings_portal_status_caption")}</p>
          </div>
        </header>
        <div className="settings-card-body">
          <ul className="settings-status-list">
            <li>
              <span className="settings-status-label">
                {t("admin.settings_mode")}
              </span>
              <span className="settings-access-pill">
                {config?.mode === "live"
                  ? t("admin.settings_mode_live")
                  : t("admin.settings_mode_demo")}
              </span>
            </li>
            <li>
              <span className="settings-status-label">
                {t("admin.settings_digilist_auth")}
              </span>
              <span
                className={
                  config?.digilistAuthConfigured
                    ? "settings-access-pill"
                    : "settings-access-pill is-warning"
                }
              >
                {config?.digilistAuthConfigured
                  ? t("admin.settings_digilist_auth_ready")
                  : t("admin.settings_digilist_auth_missing")}
              </span>
            </li>
            <li>
              <span className="settings-status-label">
                {t("admin.settings_your_role")}
              </span>
              <span className="settings-access-pill">
                {portalAdmin
                  ? t("admin.members.role_portal_admin")
                  : user?.isAdmin
                    ? t("admin.members.role_operations")
                    : t("admin.members.role_member")}
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="settings-card">
        <header className="settings-card-header">
          <div className="settings-card-heading">
            <h2>{t("admin.settings_building")}</h2>
            <p>{t("admin.settings_building_caption")}</p>
          </div>
        </header>
        <div className="settings-card-body">
          <dl className="settings-rows">
            <div>
              <dt>{t("admin.settings_name")}</dt>
              <dd>{config?.buildingName}</dd>
            </div>
            <div>
              <dt>{t("admin.settings_address")}</dt>
              <dd className={config?.address ? undefined : "settings-missing"}>
                {config?.address || t("admin.address_missing")}
              </dd>
            </div>
            <div>
              <dt>{t("admin.settings_contact")}</dt>
              <dd
                className={
                  config?.contactEmail ? undefined : "settings-missing"
                }
              >
                {config?.contactEmail || t("admin.address_missing")}
              </dd>
            </div>
            <div>
              <dt>{t("admin.settings_timezone")}</dt>
              <dd>{t("admin.timezone_value")}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="settings-card">
        <header className="settings-card-header">
          <div className="settings-card-heading">
            <h2>{t("admin.settings_access")}</h2>
            <p>{t("admin.settings_access_caption")}</p>
            <div className="settings-access">
              <span className="settings-access-pill">
                {config?.access === "members"
                  ? t("admin.access_members")
                  : t("admin.access_public_short")}
              </span>
              <p className="caption">
                {config?.access === "members"
                  ? t("admin.access_members_hint")
                  : t("admin.access_public")}
              </p>
            </div>
          </div>
          {portalAdmin ? (
            <Link to="/admin/users" className="ds-button" data-size="sm">
              {t("admin.settings_manage_users")}
            </Link>
          ) : null}
        </header>
      </section>

      <section className="settings-card settings-card-span">
        <header className="settings-card-header">
          <div className="settings-card-heading">
            <h2>{t("admin.settings_rules")}</h2>
            <p>{t("admin.settings_rules_caption")}</p>
          </div>
          {portalAdmin ? (
            <Link to="/admin/rooms" className="ds-button" data-size="sm">
              {t("admin.settings_open_rooms")}
            </Link>
          ) : null}
        </header>
        <div className="settings-card-body">
          <dl className="settings-rows">
            <div>
              <dt>{t("admin.settings_rule_approval")}</dt>
              <dd>
                <span>{t("admin.settings_rule_approval_value")}</span>
              </dd>
            </div>
            <div>
              <dt>{t("admin.settings_rule_hours")}</dt>
              <dd>{t("admin.settings_rule_hours_value")}</dd>
            </div>
            <div>
              <dt>{t("admin.settings_rule_payment")}</dt>
              <dd>{t("admin.settings_rule_payment_value")}</dd>
            </div>
          </dl>
        </div>
      </section>

      {config?.mode === "demo" && (
        <aside
          className="settings-card-span settings-callout"
          aria-labelledby="settings-prelaunch-title"
        >
          <h2 id="settings-prelaunch-title">{t("admin.prelaunch_title")}</h2>
          <p>{t("admin.prelaunch_body")}</p>
        </aside>
      )}
    </div>
  );
}
