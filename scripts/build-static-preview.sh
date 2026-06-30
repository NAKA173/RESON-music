#!/usr/bin/env bash
# Static preview build for GitHub Pages.
# Server-only code (API routes, middleware) can't run on Pages, so we
# temporarily remove them for this build only and restore them afterwards.
set -euo pipefail

cd "$(dirname "$0")/.."

restore() {
  [ -d /tmp/reson-api-bak ] && rm -rf app/api && mv /tmp/reson-api-bak app/api
  [ -f /tmp/reson-middleware-bak ] && rm -f middleware.ts && mv /tmp/reson-middleware-bak middleware.ts
}
trap restore EXIT

[ -d app/api ] && mv app/api /tmp/reson-api-bak
[ -f middleware.ts ] && mv middleware.ts /tmp/reson-middleware-bak

STATIC_PREVIEW=true \
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_test_placeholder}" \
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-placeholder}" \
NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://placeholder.supabase.co}" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-placeholder}" \
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-placeholder}" \
npx next build
