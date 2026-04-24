# Phase 9.2 - Public Auth and Marketing

## Status: Complete

## Objective

Rebuild the public experience first on the new foundation: the Figma marketing homepage, logged-out shell, and all auth routes. This establishes the non-authenticated visual system, validates SSR on public pages, and reuses Supabase auth without leaking browser auth details through the whole app.

## Inputs

- [PHASE_9_1_FRONTEND_PLATFORM_AND_TESTING_SUBPLAN.md](PHASE_9_1_FRONTEND_PLATFORM_AND_TESTING_SUBPLAN.md)
- [PHASE_8_FIGMA_OVERVIEW.md](PHASE_8_FIGMA_OVERVIEW.md)
- Figma marketing and auth screens
- `apps/web/src/app/auth/*`
- `apps/web/src/app/public/*`
- `apps/web/src/app/routes/index.tsx`

## Scope

- Public shell:
  - header
  - navigation
  - footer
  - logged-out layout structure
- Marketing homepage at `/`
- Auth routes:
  - login
  - signup
  - reset password
  - update password
  - auth confirmed
  - logout transition
- Thin auth adapter over Supabase session primitives
- SSR for all public/auth routes

## Supabase Free-Tier Auth Constraint

- Keep the public/auth UX compatible with the hosted Supabase free-tier posture unless the project explicitly moves to custom SMTP.
- Do not assume high-volume or production-grade auth email delivery during this phase.
- Password reset and signup confirmation must degrade gracefully when emails are rate-limited, restricted to allowed recipients, or delayed.
- Storybook and Playwright coverage should validate routes, form behavior, redirects, and update-password handling without requiring live email delivery.
- Product copy should avoid guaranteeing email arrival; prefer neutral language such as "If the address can receive project auth emails, instructions will be sent."

## Reuse Now

- Existing Supabase provider and session wiring
- Existing auth domain entry points where they remain structurally useful
- Shared Mantine theme and token system from Phase 9.1

## Replace

- Placeholder landing page content
- Hardcoded logged-out navigation links
- Route drift such as old `/register` assumptions
- Auth shell visuals that do not match the locked Figma

## Deliverables

- [x] Figma-matched public shell with desktop and mobile navigation behavior.
- [x] Marketing homepage with real content hierarchy, not placeholder copy.
- [x] Auth pages aligned to the rebuilt public shell.
- [x] Auth adapter with a narrow interface for session state, sign-in, sign-out, and password reset flows.
- [x] Recovery emails redirect to a password-update route that calls Supabase password update.
- [x] Supabase free-tier email delivery constraints are captured for auth UX and test planning.
- [x] Storybook stories for:
  - public header
  - footer
  - hero sections
  - auth shells
  - auth forms

## Implementation Plan

1. Rebuild the public shell and map it to the marketing and auth routes.
2. Build the marketing homepage sections and responsive behavior from the locked Figma.
3. Refactor the current auth provider surface into a thinner app-facing auth adapter.
4. Rebuild login, signup, reset, confirmation, and logout transition screens on the new shell.
5. Ensure public and auth routes SSR correctly and hydrate only the interactive pieces.
6. Add Storybook stories for public shell and auth patterns.
7. Add Playwright coverage for logged-out navigation and all auth flows.

## Review Gate

- [x] Public and auth routes match the locked Figma direction.
- [x] Logged-out SSR builds without hydration regressions.
- [x] Playwright covers marketing, login, signup navigation, reset, update password, confirmed, and Storybook shell stories.
- [x] Storybook covers reusable shell and auth pieces.
- [x] Manual review confirms the marketing page and auth routes are ready before app-shell work begins.

## Gate Results

- `yarn build:web` passed.
- `yarn workspace @artificer-toolkit/web test` passed.
- `yarn workspace @artificer-toolkit/web test:browser` passed.
- `yarn workspace @artificer-toolkit/web build` passed.
- `yarn workspace @artificer-toolkit/web build-storybook` passed.
- `yarn workspace @artificer-toolkit/web test:e2e:app` passed.
- `yarn workspace @artificer-toolkit/web test:e2e:storybook` passed.
- `yarn workspace @artificer-toolkit/web test:e2e` passed.

## Exit Criteria

- [x] The logged-out experience is fully rebuilt on the new foundation.
- [x] Supabase auth still works, but public/auth code no longer depends on placeholder-era UI structure.
- [x] The next tranche can build the authenticated workspace without still relying on the old public shell.
