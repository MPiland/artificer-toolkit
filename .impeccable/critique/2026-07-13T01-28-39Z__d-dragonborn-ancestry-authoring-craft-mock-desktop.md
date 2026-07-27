---
target: generated Dragonborn ancestry authoring craft mock desktop
total_score: 19
p0_count: 0
p1_count: 3
timestamp: 2026-07-13T01-28-39Z
slug: d-dragonborn-ancestry-authoring-craft-mock-desktop
---

# Dragonborn Ancestry Authoring Craft Mock Critique

## Design Health Score

| #         | Heuristic                       |     Score | Key issue                                                                                           |
| --------- | ------------------------------- | --------: | --------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     |         2 | Saved and unsaved states appear simultaneously without clear aggregate versus staged scope.         |
| 2         | Match System / Real World       |         3 | RPG language is strong, but Activated and On Use are elevated into implementation-like navigation.  |
| 3         | User Control and Freedom        |         2 | Cancel, close, Save Changes, and Save Draft do not communicate their boundaries.                    |
| 4         | Consistency and Standards       |         2 | Components are coherent, but several competing orientation systems are active at once.              |
| 5         | Error Prevention                |         2 | Staging is promising; commit and destructive scopes remain ambiguous.                               |
| 6         | Recognition Rather Than Recall  |         3 | Context is visible, but users must infer which surface owns each edit.                              |
| 7         | Flexibility and Efficiency      |         2 | Direct selection exists, but the extra path/navigation chrome does not prove a faster workflow.     |
| 8         | Aesthetic and Minimalist Design |         1 | Four work zones, tabs, accordions, pills, toolbars, and the bottom trail create a high noise floor. |
| 9         | Error Recovery                  |         1 | Validation and preservation behavior cannot be inferred.                                            |
| 10        | Help and Documentation          |         1 | Nested editing and save scope lack contextual explanation.                                          |
| **Total** |                                 | **19/40** | **Poor: coherent visual language, structurally over-instrumented.**                                 |

## Anti-Patterns Verdict

The mock does not immediately look AI-generated. Its failure is product noise: too many simultaneous location, status, and transaction systems. The deterministic detector reported zero findings in the current `AuthoringLayout.tsx`, but that source is not the generated mock and cannot validate the raster concept.

## Overall Impression

The mock successfully reduces the current 3813px recursively expanded form, but replaces vertical nesting with horizontal chrome density. The useful direction is the scan-first option/feature summary and rule preview. The ancestry pane, option pane, focused editor, tabs, global rail, and bottom trail should not all remain active together.

## What's Working

1. Domain labels and iconography make Red Dragon, Breath Weapon, and Fire Damage recognizable.
2. The rule preview translates configuration into playable output and provides valuable reassurance.
3. Orange selection and green status are restrained and mostly semantic.

## Priority Issues

- **[P1] No single owner of the active task.** Opening Breath Weapon should replace the Red Dragon detail surface or use one clearly modal overlay; it should not add another permanent column while every ancestor remains active-looking.
- **[P1] Transaction scope is contradictory.** Distinguish feature staging from aggregate draft persistence. Use `Cancel` / `Apply to Red Dragon` locally and one global Save Draft status/action.
- **[P1] Density blocks scan-first authoring.** Remove low-value borders, pills, duplicate status, and inactive chrome. Show one effect/outcome editing decision at a time while preserving the rule preview.
- **[P2] Bottom path bar is redundant.** Remove it. Use a compact local header with `Back to Red Dragon` and `Breath Weapon`; keep Activated, On Use, and Damage inside the feature editor rather than global navigation.
- **[P2] Accessibility depends on subtle visuals.** Preserve text labels for consequential actions, strengthen muted contrast, keep 44px targets, and expose selected/expanded state semantically.

## Persona Red Flags

- **First-time creator:** cannot predict whether Save Changes saves the feature or the race draft.
- **Power user:** must traverse four work zones while the bottom path consumes space without proving faster access.
- **Keyboard/low-vision user:** numerous icon-only controls and repeated navigation landmarks create long, ambiguous focus order.
- **Homebrew creator:** editor machinery receives more emphasis than the authored rule output.

## Minor Observations

- The top toolbar is crowded.
- Repeated Active pills add unsupported noise; current contracts do not expose per-effect or per-outcome activation status.
- The mock invents several ancestry options not present in the current Storybook fixture.
- The global Save Draft should be disabled while a staged editor is open, matching current form-state behavior.
- The bottom trail and sticky action footer form two competing shelves at the commitment point.

## Cleaner Direction

Keep three stable levels: global workspace toolbar, top-level step rail, and one focused editor canvas. Selecting Red Dragon shows its details and owned features. Opening Breath Weapon replaces that detail surface with a focused staged editor headed `Back to Red Dragon`, `Breath Weapon`, and `Feature changes are staged`. Retain Details / Effects / Preview inside that editor. End with `Cancel` and `Apply to Red Dragon`; after applying, return to Red Dragon with Breath Weapon still selected. Remove the bottom trail completely.

## Questions to Consider

- Should the focused Breath Weapon editor replace the Red Dragon pane or open as a single modal drawer?
- Is rule preview valuable enough to remain visible beside Effects, or should it become the third editor tab?
- Which objects are durable direct-entry targets: features only, or effects and outcomes as well?
