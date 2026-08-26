# SurgiTrack styles

`global.css` is intentionally only the stylesheet entry point.

The existing cascade was preserved exactly and split into ordered layers so that future changes can be made in the correct area instead of appending another global override.

1. `01-core-sterilization.css` — application shell, shared controls and sterilization workflow.
2. `02-assets-shared.css` — asset management and shared asset-card rules.
3. `03-registry-workspaces.css` — registries, list-only scrolling, full-screen asset workspaces and tablet behavior.
4. `04-reports-department-admin.css` — reports, chain of custody, department workspace and SurgiTrack Studio/Admin.

## Rule for future changes

Prefer editing the owning layer and existing selector. Do not add a new version-stamped override at the end of the stylesheet unless there is a temporary compatibility reason. Shared UI primitives should live with the shared/core rules; workspace-specific rules should stay in their owning layer.
