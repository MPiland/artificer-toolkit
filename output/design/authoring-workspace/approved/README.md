# Approved Desktop Authoring Workspace

The canonical desktop authoring reference is
[`desktop-authoring-approved.png`](desktop-authoring-approved.png).

Approved on 2026-07-16 for implementation against the existing Artificer Toolkit design system.

## Execution notes

- Keep `Save Draft` and `Activate` grouped with the same width and height.
- Keep drawer `Cancel` and `Save` grouped, right-aligned, and equal in size.
- Use the canonical Forge Orange primary-action token for every primary fill; hover and active states may use their existing semantic state tokens.
- Preserve the true overlay drawer: the workspace and preview retain their dimensions beneath the backdrop.
- Preserve the current app-shell logo and global `Library`, `Create`, search, and account structure.
- Preserve the rail validation markers, progress summary, and floating previous/next navigation.

## Token direction

The mock is a visual calibration target, not a replacement token source. Continue using
`apps/web/src/css/foundations.css.ts` and the semantic `foundationVars` contract as the canonical runtime system.

Use the existing flat Black Forge surfaces from the canonical token system. The approved MVP direction does not add slate or marble surface treatments. Marble remains an uncommitted future exploration and must not appear in implementation or marketing without a separate design decision.
