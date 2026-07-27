---
target: nested authoring drawer breadcrumb and direct-entry navigation
total_score: 24
p0_count: 0
p1_count: 4
timestamp: 2026-07-12T23-09-46Z
slug: g-workspace-2026-07-12-md-nested-editor-navigation
---

# Nested Editor Navigation Critique

## Design Health Score

| #         | Heuristic                       |     Score | Key issue                                                                                   |
| --------- | ------------------------------- | --------: | ------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     |         3 | A path helps, but transaction root, dirty state, and commit scope need persistent status.   |
| 2         | Match System / Real World       |         3 | Breadcrumbs are familiar only when segments use authored names rather than schema terms.    |
| 3         | User Control and Freedom        |         2 | Back, jump, close, cancel, and commit semantics are not yet distinct.                       |
| 4         | Consistency and Standards       |         3 | One overlay is conventional; a drawer acting like a sequential wizard is not.               |
| 5         | Error Prevention                |         2 | Ambiguous nested save scope risks accidental loss or unintended root commits.               |
| 6         | Recognition Rather Than Recall  |         2 | Breadcrumbs expose ancestors but not known descendants or siblings.                         |
| 7         | Flexibility and Efficiency      |         2 | Sequential drill-in penalizes expert re-entry into deep effects and grants.                 |
| 8         | Aesthetic and Minimalist Design |         3 | One drawer is clean, but arbitrary depth can overfill its header and body.                  |
| 9         | Error Recovery                  |         2 | Validation paths are structured but are not yet mapped to stable direct navigation targets. |
| 10        | Help and Documentation          |         2 | Deep domain choices still need contextual labels and consequences.                          |
| **Total** |                                 | **24/40** | **Acceptable foundation; breadcrumb-only navigation is not sufficient.**                    |

## Anti-Patterns Verdict

The proposed single-overlay direction avoids stacked-drawer focus traps and occlusion. The visual treatment is restrained and credible. The product-level risk is turning a drawer into a narrow wizard or schema browser. Breadcrumbs reduce disorientation but do not provide efficient non-linear access to descendants.

The deterministic detector reported zero static anti-pattern findings in `apps/web/src/forms/rendering/FormRenderer.tsx`. This does not validate runtime focus, semantics, or the proposed navigation because those behaviors are not implemented in the supplied mock/source.

## Overall Impression

Keep one physical overlay and the desktop step rail. Reject breadcrumb-only drill-in. Use breadcrumbs as secondary orientation and upward navigation, supported by a scan-first nested contents model that lets users directly open known descendants.

## What's Working

1. One drawer produces one modal focus boundary, one backdrop, and one staged transaction.
2. The existing desktop structure rail remains a sound top-level navigation and completion surface.
3. Compact summaries in the canvas create a stable origin for focused editing and focus restoration.

## Priority Issues

- **[P1] Breadcrumbs cannot reach known descendants.** A user editing a Damage outcome must not traverse Feature and Feature Option again. Provide direct Edit actions in nested summaries and a labeled local Contents outline for larger trees.
- **[P1] Current targets are not stable enough for deep direct entry.** Navigation IDs are schema/index-derived and some nested arrays are intentionally omitted. Direct-entry targets need stable row-ID lineage plus derived authored labels.
- **[P1] Commit scope becomes ambiguous at depth.** Keep one transaction rooted at the object originally opened. Back and jumps preserve staged edits; Cancel discards the transaction; the persistent primary action names and commits the transaction root.
- **[P1] Replacing drawer content can erase parent context.** Preserve a compact transaction-root/current-parent context band and announce level changes to assistive technology.
- **[P2] Long breadcrumbs do not adapt cleanly to mobile.** Use a text Back action and current title in a full-screen sheet; expose the full local outline through Contents rather than forcing a multi-segment path into the header.

## Persona Red Flags

- **First-timer:** cannot infer whether Back preserves edits or whether Save commits Damage, Feature Option, or Feature.
- **Keyboard and screen-reader user:** in-place content replacement can be silent without heading focus, status announcements, semantic breadcrumb markup, and reliable focus restoration.
- **Experienced homebrew creator:** repeated Next traversal makes iterative balancing of effects and grants impractical.
- **Distracted mobile user:** a long top breadcrumb is difficult to scan and reach; direct entry and sticky root actions are required.

## Minor Observations

- Use authored labels such as `Infernal Legacy / Hellish Rebuke / Damage`, never raw map IDs, indices, or field paths.
- Ancestor breadcrumb segments may be interactive; the current segment is plain text with `aria-current="page"`.
- Do not hide descendant menus inside breadcrumb segments. Use a separately labeled Contents control.
- Duplicate labels such as `On Hit` or `Damage` require parent context in the direct-entry outline.
- `Direct Damage` is currently presentation copy, not a canonical node-map label.

## Questions to Consider

- Should opening a Feature begin at a local overview of its Options, Grants, and Effects, with each descendant directly editable?
- At what complexity threshold should a focused drawer promote into a dedicated full-screen authoring workspace?
- Should the desktop step rail expose immediate authored objects while the drawer Contents outline owns deeper descendants?

## Recommendation

Define the pattern as a single transactional nested editor, not a breadcrumb wizard:

1. Keep the stable desktop step rail for top-level authoring structure.
2. Open one overlay transaction rooted at Feature, Option, Effect, or another focused object.
3. Give the transaction root a scan-first overview with direct Edit actions for known descendants.
4. Add a keyboard-accessible Contents outline for large/deep subtrees, using stable row IDs and contextual authored labels.
5. Use compact interactive ancestor breadcrumbs on desktop only as orientation and upward navigation.
6. Keep Back, Cancel, and root Save semantically distinct and stable at every depth.
7. Use a full-screen mobile sheet with current title, `Back to ...`, Contents, and sticky transaction actions.
