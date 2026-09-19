# Playwright E2E

The E2E suite runs public smoke tests plus authenticated listener/artist flows against an isolated local Supabase stack.

## Requirements

- Node.js 20+
- Docker-compatible container runtime
- Supabase CLI 2.117.0
- Chromium installed by Playwright

## Local run

From the repository root:

```bash
npm install
npm install --prefix e2e
npx --prefix e2e playwright install chromium
supabase start
```

Export the local Supabase credentials into the variables used by the Next.js app:

```bash
set -a
source <(supabase status -o env)
set +a

export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export ENABLE_DEV_SEED_ACCOUNT=true
export CRON_SECRET=e2e-local-cron-secret
export E2E_CRON_SECRET=e2e-local-cron-secret

npm --prefix e2e test
```

The Playwright config starts the root Next.js development server automatically on `127.0.0.1:3000`.

When finished:

```bash
supabase stop
```

## Projects

- `public-chromium`: landing, login, register, privacy, navigation, and middleware security headers
- `setup`: creates an isolated development artist account through the development-only seed endpoint, signs in, and saves browser authentication state
- `authenticated-chromium`: reuses that `storageState` for `/home`, `/dashboard`, and `/upload`

The seed endpoint remains disabled unless both development mode and `ENABLE_DEV_SEED_ACCOUNT=true` are active. CI uses only the local Supabase service-role key.

## External services

Authenticated smoke tests do not call Stripe or Cloudflare R2. Upload/payment transactions remain outside this phase and will be tested later with explicit network-boundary mocks rather than real external credentials.
