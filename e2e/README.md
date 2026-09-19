# Playwright E2E

Phase 1 covers public-page smoke tests only. Authenticated flows are intentionally deferred until the test environment has an isolated Supabase instance and reusable authenticated storage state.

## Local run

From the repository root:

```bash
npm install
npm install --prefix e2e
npx --prefix e2e playwright install chromium
npm --prefix e2e test
```

The Playwright config starts the root Next.js development server automatically on `127.0.0.1:3000`.

Useful commands:

```bash
npm --prefix e2e run test:headed
npm --prefix e2e run test:ui
```

## Scope

The initial suite verifies:

- landing page rendering and primary public navigation
- login form rendering
- registration page availability
- privacy page rendering without private-service credentials
- public navigation from `/` to `/login`
- baseline security headers applied by middleware

## Deferred to Phase 2

Authenticated listener/artist flows, `/home`, `/dashboard`, `/upload`, and other private routes need deterministic Supabase test fixtures. They should use an isolated local/test Supabase environment plus Playwright `storageState`, rather than production credentials or ad-hoc browser-only mocks.
