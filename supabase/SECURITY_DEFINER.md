# Security definer functions

These functions run with their owner's rights, past row security. Every one pins `search_path`.
`supabase/tests/sql/05_security_definer.sql` fails when a new one appears, when one loses its pinned
`search_path`, or when the set callable by signed-in users changes: review the new function, then add it
here and to that test's list. State checked against the live project on 09/10/2026 (47 functions).

## Callable by signed-out visitors

| Function                  | What it does                                                       | Guard                                                                       |
| ------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `signup_link_info(token)` | The signup page: hospital name, link expiry and active departments | Only for a valid, unrevoked, unexpired link of an active, non-Demo hospital |

## Callable by signed-in users

| Function                                                                                                                                                              | What it does                                                                             | Guard inside                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `current_org_id()`, `current_role()`, `is_viewer()`, `is_platform_admin()`, `is_org_admin(org)`, `is_asset_manager()`, `is_cssd_operator()`, `role_has_permission(p)` | Who the caller is; used by the row security policies                                     | Read the caller's own active profile                                       |
| `current_org_locked()`                                                                                                                                                | Whether the caller's hospital is a trial that has ended                                  | Caller's own hospital                                                      |
| `app_record_writable(collection)`                                                                                                                                     | Whether the caller may write a collection (Viewers may not)                              | Caller's own role                                                          |
| `can_import_assets(org)`                                                                                                                                              | Bulk import allowed: platform owner, or the hospital's admin or Sterilization supervisor | Checks the caller against `org`                                            |
| `demo_seats_left(org)`                                                                                                                                                | Colleagues a Demo hospital may still add                                                 | No caller check; returns one number, and only for Demo hospitals           |
| `my_access_request()`                                                                                                                                                 | The caller's own signup request, for the waiting screen                                  | `auth.uid()`                                                               |
| `hospital_create_signup_link(org)`, `hospital_revoke_signup_links(org)`                                                                                               | The hospital's staff signup link                                                         | `is_org_admin(org)`; no link for Demo hospitals                            |
| `hospital_decide_access_request(…)`                                                                                                                                   | Approve or reject a signup request                                                       | `is_org_admin` of the request's hospital; only requests awaiting approval  |
| `claim_platform_admin()`                                                                                                                                              | First sign-in of the platform owner                                                      | Only for the JWT email of the platform owner; relies on email confirmation |
| `platform_list_departments()`                                                                                                                                         | Departments the caller may see                                                           | Platform owner: all; others: their own hospital                            |
| `platform_create_organization`, `platform_update_organization`, `platform_create_department`, `platform_update_department`                                            | Hospitals and departments                                                                | Platform owner                                                             |
| `platform_create_demo_account`, `platform_ensure_demo_organization`, `platform_reset_demo_organization`, `platform_convert_demo`                                      | Demo hospitals                                                                           | Platform owner                                                             |
| `platform_delete_movements(org, ids)`                                                                                                                                 | Cleaning the movement history                                                            | Platform owner; only rows of `org`                                         |
| `platform_undo_asset_import(org, batch, by)`                                                                                                                          | Undo a bulk import                                                                       | `can_import_assets(org)`, and the hospital must not be a locked trial      |

## Not callable by users (triggers, cron, service role)

`accept_surgitrack_invitation`, `asset_manufacturers_to_library`, `assign_user_code`, `demo_cron_secret_ok`,
`demo_user_limit`, `generate_user_code`, `handle_new_user`, `hospital_settings_keep_manufacturers`,
`hospital_settings_to_audit`, `merge_used_manufacturers`, `purge_recycle_bin`, `record_deletion`,
`rename_department_references`, `reserve_login_attempt`, `staff_request_email_confirmed`,
`supervisor_guard_insert`, `supervisor_guard_instrument`, `supervisor_guard_set`.
