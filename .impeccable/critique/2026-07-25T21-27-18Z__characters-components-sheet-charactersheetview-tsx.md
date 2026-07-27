---
target: Character Sheet content and resource corrections
total_score: 40
max_score: 40
p0_count: 0
p1_count: 0
timestamp: 2026-07-25T21-27-18Z
slug: characters-components-sheet-charactersheetview-tsx
---

## Design Health Score

| #         | Heuristic                           |     Score | Current evidence                                                                                                         |
| --------- | ----------------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------ |
| 1         | Visibility of system status         |         4 | Slot, resource, pending, disabled, and local failure states stay beside their actions.                                   |
| 2         | Match between system and real world |         4 | Spell levels, effects, charges, equipment properties, and recovery actions use player-facing tabletop language.          |
| 3         | User control and freedom            |         4 | Legal Sheet actions are direct; charge use/restore and management handoffs remain explicit.                              |
| 4         | Consistency and standards           |         4 | Desktop, tablet, and mobile use the same compact action, input, state, and section vocabulary.                           |
| 5         | Error prevention                    |         4 | Invalid casts and charge bounds are disabled, one mutation is pending at a time, and commands reconcile to server truth. |
| 6         | Recognition rather than recall      |         4 | Effects, unavailable reasons, source qualifiers, counts, and legal actions remain visible in context.                    |
| 7         | Flexibility and efficiency          |         4 | Search, ordered groups, compact rows, relevant filters, and direct actions support fast play-time scanning.              |
| 8         | Aesthetic and minimalist design     |         4 | Attacks show one bounded mechanic; features pair compact controls with at most two lines of authored description.        |
| 9         | Error recognition and recovery      |         4 | Cast, rest, charge, and Resources failures render local retry guidance and restore authoritative Sheet state.            |
| 10        | Help and documentation              |         4 | Authored reference surfaces and explicit unavailable reasons cover the implemented play workflow.                        |
| **Total** |                                     | **40/40** | **Excellent; no P1, P2, or P3 findings remain.**                                                                         |

## Findings

No current P0, P1, P2, or P3 findings.

## Corrections verified

- Equipment properties cross the Sheet contract as stable codes plus backend-authored labels; clients display `Simple, Versatile`, not enum codes.
- Resource-backed feature rows expose bounded, pending-aware use and restore controls with accessible names, live counts, de-emphasized disabled states, and local failure feedback.
- Attack rows display one backend-resolved primary mechanic without equipment properties or descriptions. Feature actions and feature-backed resources retain a compact two-line authored description.
- Explicit backend action rows are not reclassified as non-playable by the frontend; description-only actions such as Trance remain available in All and their action-kind filter.
- Recovery-only feature actions are suppressed when the matching resource row is available, so Arcane Recovery appears once as an interactive charge row.
- Mobile Actions no longer repeats the full Resources surface; Resources is its own mobile page.
- Spell groups use neutral base/cast-level headings without an `upcast` suffix.
- Cast remains visually compact while preserving a 44px coarse-pointer target.
- Repeated spell rows and Cast controls have unique accessible names including spell, source qualifier when needed, and cast level.
- Disabled spell reasons remain fully readable and are associated with the disabled Cast control.
- Mobile preserves the locked swipeable main-section pager and icon-only floating dot-grid
  launcher, with the original bottom safe inset reserved for the dock.
- Mobile and tablet spell search uses the full available width; browser checks found no document-level horizontal overflow at 390px or 700px.

## Technical audit

| Area                |     Score | Evidence                                                                                                              |
| ------------------- | --------: | --------------------------------------------------------------------------------------------------------------------- |
| Accessibility       |      9/10 | Unique names, `aria-describedby`, `aria-live`, local alerts, focus treatment, and coarse-pointer targets are present. |
| Responsive behavior |      9/10 | Desktop, 700px tablet, and 390px mobile captures preserve hierarchy and avoid content overlap.                        |
| Theming             |      9/10 | New styling uses existing semantic tokens and Mantine controls.                                                       |
| Integrity           |      9/10 | Backend labels and mechanics remain authoritative; web only adapts typed projections and commands.                    |
| Performance         |      9/10 | Lists remain lightweight and searchable without unnecessary virtualization or state layers.                           |
| **Total**           | **45/50** | Detector returned `[]`.                                                                                               |

## Validation evidence

- Focused Character Sheet unit tests: 44 passed.
- Focused Character Sheet Storybook browser tests: 27 passed.
- Complete repository type-aware Oxlint: green.
- Exact-file Oxfmt check: green.
- `git diff --check`: green.
- Responsive browser evidence:
  - `docs/mockups/character-sheet-overrides/04-actions-compact-final-desktop.png`
  - `docs/mockups/character-sheet-overrides/04-actions-compact-final-mobile.png`
  - `docs/mockups/character-sheet-overrides/04-equipment-labels-polished-desktop.png`
  - `docs/mockups/character-sheet-overrides/04-equipment-labels-polished-mobile.png`
  - `docs/mockups/character-sheet-overrides/04-spell-list-final-desktop.png`
  - `docs/mockups/character-sheet-overrides/04-spell-list-final-mobile.png`
  - `docs/mockups/character-sheet-overrides/04-spell-list-final-tablet.png`

## Remaining validation boundary

The focused checks do not replace a real-device screen-reader pass, 200% zoom review, or final hosted light-theme smoke test. Feature, item, and resource drawer resolution also remains unfinished Branch 04 scope; the compact Actions list does not synthesize unstable inspector targets from labels or presentation IDs.
