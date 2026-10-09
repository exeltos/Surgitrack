# SurgiTrack styles

`global.css` is intentionally only the stylesheet entry point.

`tokens.css` comes first: the color palette as custom properties (`--c-<hue>-<lightness>`, e.g.
`--c-teal-45`, plus `--c-white`). Shades the eye cannot tell apart were merged into one token.

The existing cascade was preserved exactly and split into ordered layers so that future changes can be made in the correct area instead of appending another global override.

1. `01-core-sterilization.css` — application shell, shared controls and sterilization workflow.
2. `02-assets-shared.css` — asset management and shared asset-card rules.
3. `03-registry-workspaces.css` — registries, list-only scrolling, full-screen asset workspaces and tablet behavior.
4. `04-reports-department-admin.css` — reports, chain of custody, department workspace and SurgiTrack Studio/Admin.

## Rule for future changes

Prefer editing the owning layer and existing selector. Do not add a new version-stamped override at the end of the stylesheet unless there is a temporary compatibility reason. Shared UI primitives should live with the shared/core rules; workspace-specific rules should stay in their owning layer.

## Colors

Use a palette token (`color: var(--c-gray-40)`) instead of a new hex value. If no token is close, add one to
`tokens.css` named by hue family and CIE lightness. The `--st-*` names in `02-assets-shared.css` are the
semantic layer on top (ink, muted, line, teal, red…) and are the ones to prefer for new rules.

## Unused selectors

`npm run css:unused` lists the class selectors in these files that no string in `src/` can produce (it exits 1
when there are some); `node scripts/css-unused.mjs --fix` removes them. Check with the screenshot harness
(`scripts/screens`) before and after.
