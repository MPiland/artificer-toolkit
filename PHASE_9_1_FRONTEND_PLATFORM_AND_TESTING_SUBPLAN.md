# Phase 9.1 - Frontend Platform and Testing

## Status: Ready for Review - Follow-Up Fixes Landed

## Objective

Stabilize `apps/web` as the implementation foundation before any feature rebuilds begin. This tranche upgrades the toolchain in a coordinated way, preserves the locked styling architecture, defines SSR defaults, and installs the shared review stack: Vitest, Testing Library, MSW, Storybook, and Playwright.

## Inputs

- [PHASE_9_CODE_OVERVIEW.md](PHASE_9_CODE_OVERVIEW.md)
- [PHASE_8_FIGMA_OVERVIEW.md](PHASE_8_FIGMA_OVERVIEW.md)
- `apps/web/package.json`
- `apps/web/src/router.tsx`
- `apps/web/src/server.ts`
- `apps/web/src/css/*`
- Current `apps/web` compile failures and alias drift

## Locked Decisions

- Keep `TanStack Start`.
- Keep Mantine, vanilla-extract, and the existing CSS layer strategy.
- Treat SSR as a default capability, not an optional add-on.
- Do not start domain rebuilds until the platform and test harness exist.
- Storybook and Playwright are part of the review process, not follow-up chores.

## Scope

- Coordinated dependency upgrade for:
  - `@tanstack/react-start`
  - `@tanstack/react-router`
  - `@tanstack/react-query`
  - `vite`
- Fix frontend config drift:
  - add `apps/web/tsconfig.build.json`
  - normalize the active alias scheme
  - keep SSR integration working during the upgrade
- Add the frontend test and review stack:
  - Vitest
  - Testing Library
  - `jsdom`
  - MSW
  - Storybook
  - Playwright

## Deliverables

- Clean, current frontend dependency set compatible with the workspace Node version.
- `apps/web` build and typecheck commands that reflect the real project layout.
- Shared test utilities for:
  - Mantine provider wrapping
  - router context
  - auth mocking
  - API mocking
- Storybook configured for `apps/web` with vanilla-extract, Mantine theme, and app CSS layers.
- Playwright configured for:
  - Storybook component verification
  - running app route verification
- Baseline smoke coverage for the new foundation.

## Implemented In This Tranche

- Upgraded the active `apps/web` platform stack around the new Phase 9 slice:
  - `@tanstack/react-start`
  - `@tanstack/react-router`
  - `@tanstack/react-query`
  - `vite`
- Added `apps/web/tsconfig.build.json` and normalized the active web typecheck path around:
  - `src/app/**/*`
  - shared CSS/theme files
  - Supabase helpers
  - frontend test harness files
- Moved the active TanStack Start route tree onto `apps/web/src/app/routes` so the provisional legacy route graph is no longer the active build target.
- Preserved the locked styling stack:
  - Mantine
  - vanilla-extract
  - existing CSS layer ordering
  - shared theme token plumbing
- Added the shared provider/runtime foundation:
  - `AppProviders`
  - shared query client factory
  - public shell frame
  - authenticated shell frame
  - base auth forms
  - route error/not-found states
- Added the frontend test/review stack in `apps/web`:
  - Vitest
  - Testing Library
  - `jsdom`
  - MSW
  - Storybook with a dedicated Vite builder config
  - Playwright route smoke tests
  - Vitest browser mode using Playwright for component-level browser verification
- Seeded the first shell stories and smoke tests for:
  - `PublicShellFrame`
  - `AppShellFrame`
- Initialized `public/mockServiceWorker.js` so Storybook MSW stories render correctly.

## Validation Completed

- `yarn workspace @artificer-toolkit/web build`
- `yarn workspace @artificer-toolkit/web typecheck`
- `yarn workspace @artificer-toolkit/web test`
- `yarn workspace @artificer-toolkit/web test:browser`
- `yarn workspace @artificer-toolkit/web build-storybook`
- `yarn workspace @artificer-toolkit/web test:e2e:storybook`
- `yarn workspace @artificer-toolkit/web test:e2e:app`

## Review Follow-Ups Landed

- Added a route-aware shared test provider so component tests get TanStack Router context plus the normal app providers.
- Added the same route-aware provider to Storybook preview decorators so route-aware stories can render safely.
- Scoped Playwright web server startup to requested projects so `--project=app` does not boot Storybook, and `--project=storybook` does not boot the app.
- Added Vitest browser dependency optimization for router/icon dependencies to avoid browser-test reload flake.

## Carry-Forward Warnings

- Yarn still reports an `eslint` peer mismatch because the repo is on `eslint@10` while some React ESLint plugins still declare `^9`.
- Yarn still reports a `vite` peer mismatch because `@vanilla-extract/vite-plugin` currently declares `^7.0.0` while the tranche is running on `vite@8.0.9`.
- Tooling prints a `baseline-browser-mapping` freshness warning during several browser-oriented commands. This is non-blocking for 9.1 but should be refreshed in a later maintenance pass.

## SSR Defaults

- SSR these surfaces by default:
  - marketing
  - logged-out auth pages
  - app shell chrome
  - list pages
  - detail/edit page shells plus first query payload
  - character builder shell plus initial builder payload
  - character sheet shell plus initial sheet payload
- Client-hydrate these behaviors after SSR:
  - drawers and modals
  - section navigation
  - nested form editing
  - builder choice interactivity
  - sheet command interactions

## Implementation Plan

1. Upgrade TanStack Start, Router, Query, and Vite together so router, SSR, and query hydration stay aligned.
2. Add or repair missing frontend config artifacts, especially the build tsconfig and any Start/Vite integration drift.
3. Normalize the surviving app to one alias scheme and quarantine dead legacy modules from the active compile path.
4. Add Vitest and Testing Library configuration for `apps/web`.
5. Add MSW for deterministic Storybook and frontend test fixtures.
6. Add Storybook with the app theme, Mantine provider, and CSS layer order intact.
7. Add Playwright for both Storybook and real app flows.
8. Seed smoke stories and smoke tests for the shell/theme layer before the next tranche starts.

## Review Gate

- `apps/web` typecheck passes on the active compile path.
- Frontend build succeeds with SSR enabled.
- Storybook boots and renders the base providers and shell primitives.
- Playwright can run at least one Storybook smoke check and one app smoke check.
- Manual review confirms theme, fonts, tokens, and Mantine overrides still behave correctly.

## Review Pause

Phase 9.1 is implemented and validated, but the tranche should pause here for Storybook and Playwright review before Phase 9.2 begins.

## Exit Criteria

- The frontend platform is current, buildable, and testable.
- Storybook, Playwright, and Vitest are ready before any shared component or route rebuild work.
- No feature tranche has to invent its own testing or provider harness.
