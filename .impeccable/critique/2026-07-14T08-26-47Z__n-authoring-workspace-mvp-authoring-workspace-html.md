---
target: desktop MVP authoring workspace
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-07-14T08-26-47Z
slug: n-authoring-workspace-mvp-authoring-workspace-html
---

Method: dual-agent (A: `/root/impeccable_assessment_a` · B: `/root/impeccable_assessment_b`)

# Desktop authoring workspace critique

## Design Health Score

| #         | Heuristic                       |     Score | Key issue                                                                                          |
| --------- | ------------------------------- | --------: | -------------------------------------------------------------------------------------------------- |
| 1         | Visibility of system status     |         3 | Saved, warning, staged, and draft states are clear.                                                |
| 2         | Match system / real world       |         3 | D&D terminology is appropriate; the initial outcome ownership was ambiguous.                       |
| 3         | User control and freedom        |         3 | Commit/cancel are explicit; the initial overlay left global navigation active.                     |
| 4         | Consistency and standards       |         4 | All three views share one coherent Forge shell and component vocabulary.                           |
| 5         | Error prevention                |         3 | Staging prevents accidental mutation; unsaved-exit behavior remains an implementation proof.       |
| 6         | Recognition rather than recall  |         2 | The initial generic Outcomes label required remembering the selected option.                       |
| 7         | Flexibility and efficiency      |         3 | Rail branches and row edit actions support direct access.                                          |
| 8         | Aesthetic and minimalist design |         3 | The hierarchy is calm; the original instructional callout and broad simple-form slabs added noise. |
| 9         | Error recovery                  |         2 | Static mocks cannot prove validation repair or exact staged cancellation.                          |
| 10        | Help and documentation          |         2 | Helper copy exists, but production contextual guidance is not yet demonstrated.                    |
| **Total** |                                 | **28/40** | **Good foundation; correct the P1 interaction boundary before locking.**                           |

## Anti-patterns verdict

The design does not read as generic AI output. It avoids decorative gradients, glass, repeated dashboard-card grids, fantasy ornament, oversized radii, and ornamental shadows. Orange communicates craft/current action, while teal remains a technical state accent.

The initial deterministic scan reported tiny metadata text, token drift, off-scale radii, and a single-font warning. The first three groups were corrected. The single-font warning is a false positive because `DESIGN.md` explicitly defines the SF/system product family as the canonical typography stack.

Browser overlay injection was unavailable because the Impeccable browser client failed with `Cannot redefine property: process`. Evidence came from original-resolution browser captures, pixel-boundary checks, and source box-model inspection; no user-visible diagnostic overlay was claimed.

## Overall impression

The direction solves the core nested-authoring problem: branches stay navigable in a stable structure rail, while leaf rows open one staged overlay drawer. The largest initial weakness was not visual style but ownership and modal safety at the deepest path.

## What's working

- The structure rail exposes the complex ancestry path without creating a drawer stack.
- Effect outcomes remain one scannable collection instead of one navigation step per outcome.
- Persistent save/warning/staged states and explicit drawer actions make destructive authoring feel controlled.
- The canvas stays at full width behind a real overlay rather than being compressed by a side column.

## Priority issues and resolution

### [P1] Feature-option outcome ownership was ambiguous

The initial `Outcomes` panel and drawer path did not prove whether rows belonged to the feature or selected feature option. This could cause authors to edit the wrong branch.

**Resolved:** the rail, panel, and drawer now identify `Black Dragon → Breath Weapon → Acid Breath → Outcomes`, while individual outcomes remain rows inside one collection.

### [P1] The initial drawer was not a safe modal boundary

The initial scrim began below the global header, and the drawer body clipped its final field with `overflow: hidden`.

**Resolved:** the scrim covers and inerts the full application viewport; the drawer is a modal dialog, its body scrolls independently, its footer is a separate grid row, and all fields clear the footer at 1440×900.

### [P2] Deep labels and small controls reduced scanability

The initial rail truncated `Damage Resistance`, used 10–11px metadata, and contained several 24–38px controls.

**Resolved in the mock:** indentation consumption is capped, labels can wrap to two lines, metadata is at least 12px, and high-value controls use 40–44px targets.

### [P2] Prototype narration and token drift

The explanatory callout described the interaction instead of letting the structure communicate it, and concept-only literals drifted from the canonical tokens.

**Resolved:** the callout was removed, section width was tightened for the simple domain, undocumented colors/radii were replaced, and the deterministic detector is clean except for the documented single-font false positive.

## Persona red flags

- **Alex, power author:** direct rail access is strong; production still needs keyboard tree navigation and reliable focus return from a staged drawer.
- **Jordan, first-time homebrewer:** ownership is now explicit, but unfamiliar effect terms will still need concise field help and useful empty states.
- **Sam, keyboard/low-vision user:** the mock now declares a modal boundary and larger targets, but focus trapping, Escape behavior, contrast, and accessible tree relationships require browser acceptance.
- **Riley, stress tester:** long labels now wrap and drawer content scrolls; large collections, destructive branch clearing, refresh, and unsaved navigation remain implementation acceptance items.

## Minor observations

- Keep the simple-domain canvas content-sized rather than allowing every section to become a full-width slab.
- Preserve only one primary CTA per surface.
- Use the context/preview rail only when it adds meaningful authored output.

## Questions to consider

- Does the corrected rail expose enough of the deepest real ancestry path to lock this desktop topology?
- Should keyboard accelerators be visible in the first implementation, or remain a post-MVP enhancement after correct tree navigation ships?
