# Phase 9.2 - Public Auth and Marketing

## Status: Not Started

## Objective

Rebuild the public experience first on the new foundation: the Figma marketing homepage, logged-out shell, and all auth routes. This establishes the non-authenticated visual system, validates SSR on public pages, and reuses Supabase auth without leaking browser auth details through the whole app.

## Inputs

- [PHASE_9_1_FRONTEND_PLATFORM_AND_TESTING_SUBPLAN.md](PHASE_9_1_FRONTEND_PLATFORM_AND_TESTING_SUBPLAN.md)
- [PHASE_8_FIGMA_OVERVIEW.md](PHASE_8_FIGMA_OVERVIEW.md)
- Figma marketing and auth screens
- `apps/web/src/domains/auth/*`
- `apps/web/src/domains/landing/Landing.tsx`
- `apps/web/src/routes/index.tsx`

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
  - auth confirmed
  - logout transition
- Thin auth adapter over Supabase session primitives
- SSR for all public/auth routes

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

- Figma-matched public shell with desktop and mobile navigation behavior.
- Marketing homepage with real content hierarchy, not placeholder copy.
- Auth pages aligned to the rebuilt public shell.
- Auth adapter with a narrow interface for session state, sign-in, sign-out, and password reset flows.
- Storybook stories for:
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

- Public and auth routes match the locked Figma direction.
- Logged-out SSR works without hydration regressions.
- Playwright covers sign-in, sign-out, reset, and confirmed flows.
- Storybook covers reusable shell and auth pieces.
- Manual review confirms the marketing page and auth routes are ready before app-shell work begins.

## Exit Criteria

- The logged-out experience is fully rebuilt on the new foundation.
- Supabase auth still works, but public/auth code no longer depends on placeholder-era UI structure.
- The next tranche can build the authenticated workspace without still relying on the old public shell.
