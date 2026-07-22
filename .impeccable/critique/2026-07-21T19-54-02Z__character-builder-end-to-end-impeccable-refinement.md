---
target: Character Builder End-to-End Impeccable Refinement
total_score: 26
p0_count: 0
p1_count: 6
timestamp: 2026-07-21T19-54-02Z
slug: character-builder-end-to-end-impeccable-refinement
---

# Character builder critique

## Heuristic assessment

| Area | Score | Finding |
|---|---:|---|
| Hierarchy | 3/5 | Step content repeated context and nested too many bordered containers. |
| Density | 2/5 | Class, equipment, ability, and HP workflows consumed excessive vertical space. |
| Consistency | 3/5 | Race, class, and background selection used different interaction patterns. |
| Responsiveness | 3/5 | Narrow controls wrapped, but grouping and modal behavior were not consistently intentional. |
| Feedback | 3/5 | Resolver updates visibly dimmed content and delayed backend-derived feature presentation. |
| Accessibility | 4/5 | Most controls were labeled, but repeated class and assignment controls lacked unique names. |
| Player-facing copy | 3/5 | Several labels exposed implementation language or repeated surrounding context. |
| Backend portability | 5/5 | Existing resolver and schema seams provided the right place for portable rules and content. |

## Anti-pattern verdict

The flow did not exhibit generic AI-dashboard styling, but it did show incremental UI drift: nested cards, duplicated labels, generic warnings, wide empty regions, and one-off selection patterns accumulated across steps.

## Priority issues

1. Unify race, class, and background selection with staged radio cards, one scrollbar, and responsive modal sizing.
2. Remove duplicated headings, source labels, class summaries, and visible resolver-update status.
3. Flatten class features while keeping proficiencies and individual features visually distinct.
4. Group Score/Ability pairs and rebuild HP as semantic tabular data.
5. Make equipment groups responsive and keep dependent selectors aligned with their owning option.
6. Drive previews, provenance, background details, and validation copy from builder contracts rather than React literals.

## Persona red flags

- A new player could not tell why fixed HP or included equipment behaved differently from editable choices.
- A multiclass player could not reliably distinguish known-spell choices, prepared-spell state, and source ownership.
- A keyboard or screen-reader user encountered repeated accessible names for class levels and ability assignments.

## Minor observations

- Use `Activate` consistently with other domain lifecycle forms.
- Keep full feature prose readable in a single column.
- Preserve neutral surfaces; reserve orange for primary actions and teal for focus or staged selection.
