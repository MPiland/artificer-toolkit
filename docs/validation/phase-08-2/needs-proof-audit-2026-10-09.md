# Needs-proof audit closures (2026-10-09)

Evidence for "needs proof" criteria closed by inspection rather than by a new test. Source:
`codex/phase-08-2-convex-cutover`.

## PLATFORM-14.2: the Convex hook no longer misfires

- The rename landed in a7fe02631: `apps/web/tests/convex` became `apps/web/tests/live-backend`. The old
  folder no longer exists.
- The Convex plugin's hooks (`convex-lint.mjs` PreToolUse, `convex-typecheck.mjs` Stop, plugin 1.14.0)
  fire only on a `.ts`/`.tsx` path that has a `convex/` segment (`/(^|\/)convex\//`).
- `git ls-files` shows no tracked `.ts` file with a `convex/` segment outside `apps/apis/convex/`. The
  only other match is a Markdown skill file, which the hooks ignore.

So the hooks select only the real Convex backend.

## PLATFORM-14.3: Storybook and the app boot on the upgraded versions

Versions: TanStack Start 1.168.60, Storybook 10.6.1, Vite 8.3.3.

- **Storybook:** `yarn workspace @artificer-toolkit/web storybook --no-open` reported ready on port 6006. The
  manager listed and rendered stories.
  - One play function, Backgrounds › Create › Create Empty, failed `toBeVisible` on `input[name="label"]`.
    The browser pane was hidden (`document.hidden`), so the guided screen's `reveal` keyframe animation
    (`guidedAuthoring.css.ts`, fill `both`, starting at opacity 0) never advanced, and the input's ancestor
    stayed at opacity 0.
  - This is an artifact of a hidden tab, not of the upgrade. The Storybook test runner drives a rendering
    page.
- **App:** `yarn workspace @artificer-toolkit/web dev` was run with the process environment from
  `local-validation/local-convex/local.application.env`. Vite reported ready in about 60 s on port 3000.
  - `/` server-rendered the home page with no failed resources.
  - `/spells` resolved the session through local Convex and redirected to `/sign-in?redirect=%2Fspells`.
  - Without those variables (the root `.env.local` has no Convex URL), SSR fails in `getRouter` with
    `ConvexQueryClient` given no URL. That is an expected configuration requirement.
