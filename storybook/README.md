# Storybook

RESON component development uses Storybook as the isolated UI layer alongside Jest and Playwright.

## Local usage

From the repository root:

```bash
npm install
npm install --prefix storybook
npm --prefix storybook run dev
```

Open Storybook on port 6006.

Build the static Storybook:

```bash
npm --prefix storybook run build
```

## Initial scope

Stories currently cover:

- ThemeToggle dark/light states
- SupportButton success/error interaction boundaries
- BoostButton available/limit-reached states
- Player default, long-content, and queue-control states

API-dependent components use Storybook-local fetch mocks so stories do not require Supabase, Stripe, or R2.

`@storybook/addon-a11y` is enabled globally. Stories can opt into stricter automated accessibility checks through their `a11y` parameters.

Stripe Elements itself is intentionally not rendered as a standalone story yet because its hosted payment UI requires a dedicated Stripe test wrapper. Payment entry remains covered indirectly through its parent components and Playwright network-boundary tests.
