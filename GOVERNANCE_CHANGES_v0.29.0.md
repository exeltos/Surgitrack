# SurgiTrack v0.29.0 — Governance Core

- Central configuration audit model for libraries, users, permissions, system settings and CSSD workflow changes.
- Versioned CSSD workflow snapshots; every workflow modification creates a new immutable-style version snapshot.
- Workflow version captured on receipt, preparation, checkpoints, loads, sterilization cycles, release and delivery records.
- Operational audit event model for critical operational/security actions.
- Recall case model created from released sterilization loads, including affected assets, department/patient context when available, reason and workflow version.
- Recall restricted to released loads; recalled assets are routed to reprocessing and blocked from normal delivery through state control.
- Hard stop for assets (and set members) whose permitted usage limit is exhausted when sending to CSSD or delivering to department.
- No design expansion in this release: governance data remains in the domain/store layer so UI simplification can follow separately.

Production note: backend persistence, append-only database audit enforcement and transactional operations remain required before production deployment.
