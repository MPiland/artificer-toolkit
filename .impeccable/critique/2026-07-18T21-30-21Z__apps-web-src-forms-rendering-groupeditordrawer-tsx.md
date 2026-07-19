---
target: shared authoring drawer and collection frontend
total_score: 35
p0_count: 0
p1_count: 0
timestamp: 2026-07-18T21-30-21Z
slug: apps-web-src-forms-rendering-groupeditordrawer-tsx
---
# Authoring Drawer and Collection Critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 4 | Saved state, validation progress, selected rail target, and editor state remain visible. |
| 2 | Match between system and real world | 3 | D&D authoring language is appropriate, though deeply nested effect terminology still assumes system knowledge. |
| 3 | User control and freedom | 4 | Leaf edits have Cancel, close, Escape behavior, staged rollback, and focus restoration. |
| 4 | Consistency and standards | 4 | Shared actions, drawer geometry, field recipes, and responsive semantics now apply across all authored domains. |
| 5 | Error prevention | 3 | AND/OR structure and distinct removal affordances are clear; option removal still depends partly on its trash icon and tooltip. |
| 6 | Recognition rather than recall | 3 | The rail keeps location visible, but repeated deep labels such as Features and Options require some ancestry tracking. |
| 7 | Flexibility and efficiency | 3 | Direct rail navigation and inline-versus-focused editing are efficient; dedicated power-user shortcuts are outside this pass. |
| 8 | Aesthetic and minimalist design | 4 | The Forge drawer is compact, quiet, token-driven, and reserves orange for commit actions. |
| 9 | Error recognition and recovery | 4 | Validation stays at the repair location and staged cancellation restores the exact subtree. |
| 10 | Help and documentation | 3 | Tooltips and information affordances exist, but the most advanced authoring concepts still rely on product documentation. |
| **Total** |  | **35/40** | **Good; MVP-ready for this surface with later P2 polish available.** |

## Anti-Patterns Verdict

**LLM assessment:** The final drawer no longer reads as generic AI-generated form scaffolding. Its hierarchy is deliberate: one persistent header, numbered content sections, compact label/control alignment on wide screens, stacked fields on compact screens, restrained option cards, and one clear commit action. The AND/OR model is visible without redundant group titles or indentation.

**Deterministic scan:** The final Impeccable detector returned zero findings across the shared drawer, action adapter, collection styles, authoring layout, theme adapter, and facet authoring schema.

**Visual overlays:** Browser injection was attempted in the independent technical assessment, but the detector script endpoint failed to initialize in the sampled Storybook manager pages. No reliable user-visible overlay was claimed. Direct iframe Playwright evidence and the 13-case authoring browser suite were used instead.

## Overall Impression

The authoring drawer now feels like one intentional Forge workspace rather than a collection of nested form shells. The largest improvement is restraint: quiet structural actions remain quiet, destructive scope is differentiated, fields share one rhythm, and the underlying canvas no longer resizes or scrolls away when a leaf editor opens.

## What's Working

- The Equipment restriction editor communicates Boolean structure with simple option cards, AND separators only between conditions, and OR separators only between alternatives.
- The overlay preserves the canvas width while keeping a sticky title, close affordance, and equal Cancel/Save footer controls reachable in long Spell outcome editors.
- Responsive semantics adapt without domain inference: wide layouts use quiet text actions and horizontal fields; compact layouts use neutral full-width add controls, stacked 44px fields, and a bottom leaf editor above app navigation.

## Priority Issues

### [P2] Deep rail ancestry can still become visually repetitive

**Why it matters:** Choice-heavy Race structures repeat labels such as Options and Features at several levels. The selected leaf is clear, but reconstructing its full ancestry takes a moment.

**Fix:** In a later navigation pass, strengthen the active-parent chain or tree connector treatment without adding breadcrumbs or deeper indentation.

**Suggested command:** `$impeccable clarify`

### [P2] Collection row editability could be more discoverable outside focus

**Why it matters:** The minimalist modifier summaries are easy to scan, but a first-time author may not immediately infer that the row opens a leaf editor.

**Fix:** Preserve the quiet row design while ensuring hover, focus, and keyboard states reveal the edit affordance consistently.

**Suggested command:** `$impeccable polish`

### [P3] Advanced authoring concepts need task-focused help

**Why it matters:** Experienced D&D authors understand facets, outcome paths, and scaling sources, but novice homebrewers may need concise definitions at the decision point.

**Fix:** Add task-focused help content through the existing information affordances after the authoring terminology is finalized.

**Suggested command:** `$impeccable document`

## Persona Red Flags

**Jordan, first-time homebrewer:** The clean restriction editor is understandable, but advanced effect vocabulary can still require documentation. The separate Add condition and Add option controls now reduce the risk of building the wrong Boolean structure.

**Sam, keyboard and assistive-technology user:** All controls retain semantic labels, visible focus, 44px targets, and dialog escape/cancel behavior. The remaining risk is validating the entire deep rail workflow with a screen reader, not just keyboard and ARIA assertions.

**Casey, distracted mobile author:** The editor is now a bottom overlay with sticky actions above app navigation, stacked fields, and full-width neutral add controls. Long editors still require scrolling, but context and the exit path stay visible.

## Minor Observations

- Disabled Activate correctly loses primary emphasis while a staged editor is open; this is state feedback, not cross-domain drift.
- The Storybook route root originally allowed the whole workspace to grow and scroll. Bounding the shared authoring canvas to `100dvh` restored production-like scroll containment and made the sticky drawer header testable.
- The mobile add controls intentionally use a stronger full-width shape than desktop, but remain secondary so Save keeps the only filled-orange emphasis.

## Questions to Consider

- When advanced authoring help is written, should it teach D&D rules concepts, the toolkit's authoring model, or both in separate layers?
- Would a subtle active-parent connector improve deep Race navigation without reintroducing the visual noise that earlier nested-container designs created?
