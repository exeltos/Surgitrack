# SurgiTrack v0.29.0 — Governance & Safety Core

Built on the uploaded `surgitrack-step1-4` / v0.28.5 base.

## Completed

- Common configuration audit model for workflow, settings, libraries, users and role permissions.
- Workflow version history with immutable-style snapshots in the current demo persistence layer.
- Workflow version attached to CSSD process records (receipt, checkpoints, preparation, loads/cycles, release and delivery).
- Recall case model with load/cycle/sterilizer/reason, item-level status, patient-code context where available, return/reprocessing tracking and automatic closure after successful re-release.
- Hard stops for exhausted limited-use assets, including exhausted member instruments inside a Set.
- Active recall blocks clinical delivery but still permits required CSSD reprocessing.
- Compact, collapsed workflow-version and configuration-audit views to avoid adding unnecessary visual load.
- Active recall summary in the release workspace.

## Production note

The current audit/version records are protected by the application layer and demo/local persistence. True immutable audit enforcement must be implemented server-side when the production backend is connected.
