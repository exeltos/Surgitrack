# SurgiTrack CI checks

The same verification command is used locally and by GitHub Actions:

```bash
npm ci
npm run ci
```

`npm run ci` runs, in order:

1. Prettier formatting check
2. TypeScript typecheck
3. ESLint
4. Vitest unit tests
5. Production build

The project is pinned to Node.js 22 via `.nvmrc` and GitHub Actions reads the same file.

Do not use `npm audit fix --force` as part of CI stabilization. Dependency upgrades should be reviewed separately.
