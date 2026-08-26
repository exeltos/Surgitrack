# SurgiTrack CI checks

Use the same verification command locally and in GitHub Actions:

```bash
npm ci
npm run ci
```

`npm run ci` now runs, in order:

1. Prettier auto-format (`npm run format`)
2. Prettier verification (`npm run format:check`)
3. TypeScript typecheck
4. ESLint
5. Vitest unit tests
6. Production build

This intentionally normalizes formatting before verification, so formatting drift does not abort the CI pipeline before the functional checks run. GitHub Actions uses the same command.

The project is pinned to Node.js 22 via `.nvmrc`.
