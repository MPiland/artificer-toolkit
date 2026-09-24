# Artificer Toolkit concept critique

Method: independent design assessment A (design_review), evidence assessment B (concept_evidence), primary synthesis. Target: concept PNGs 12-charcoal-social, 13-authoring-node-palette, and 14-equipment-list in docs/mockups/artificer-mind-map-concepts-2026-09-09. This is a static visual review, not implementation sign-off.

## Verdict

Keep this direction. Critique and interaction shaping should precede polish. The warm charcoal, vivid amber and cyan, restrained serif titles, monospace readouts, and fine craft ornament form a coherent visual identity. The equipment list is the strongest test: the identity survives without cinematic artwork.

The visual language is recognizable but not a defensible market advantage by itself. Alkemion already offers connected visual campaign planning (https://alkemion.com/); LegendKeeper offers connected worldbuilding (https://www.legendkeeper.com/). This limited primary-source check establishes overlap, not an exhaustive competitive audit. Artificer's stronger opportunity is carrying authored mechanics into characters and actual shared play without rebuilding content.

## Provisional heuristic assessment

| Heuristic | Score | Evidence |
|---|---|---|
| System status | Not assessed | Saved label visible; transitions untested |
| Match to users' world | 3/4 | Familiar subject vocabulary; node terminology needs clarification |
| User control | Not assessed | Undo and escape behavior untested |
| Consistency | 3/4 | Cohesive visual shell; color and action semantics vary |
| Error prevention | Not assessed | Valid connections and validation untested |
| Recognition over recall | 3/4 | Selected detail helps; edge meaning remains ambiguous |
| Efficiency | Not assessed | No runnable comparison with existing forms |
| Aesthetic minimalism | 3/4 | Strong hierarchy; authoring and social action competition |
| Error recovery | Not assessed | No error states supplied |
| Help | Not assessed | No help flow supplied |

Observable subset: 12/16. This is not an overall usability score or shipping gate.

## Strengths

- Warm and cool accents give creation energy while dark surfaces keep the work readable.
- The shared shell and typography connect discovery, creation, and reference without identical page layouts.
- The equipment list retains character with simple category icons and supports comparison better than an artwork-dependent grid.

## Priority issues

1. **P1: Node granularity and meaning are unresolved.** Duration, range, and dice should usually be fields within an effect, not independent draggable objects. Make nodes represent meaningful effects, grants, conditions, and scaling relationships supported by the authoritative schema. Define whether each edge means containment, targeting, dependency, or execution; the current picture does not establish this. Suggested next command: shape.
2. **P2: Color and actions lack stable semantics.** Amber currently means creation, selection, and rarity; cyan means selection and save. Separate category color from interaction states and make the primary action consistent. Preserve vibrancy. Suggested command: clarify.
3. **P2: Social discovery duplicates its next action.** View table and Read table details appear together with no visible distinction. Selecting a result should reveal detail, with one clear continuation action. Preserve seats, schedule, system, tone, and maturity for comparison. Suggested command: distill.
4. **P2: The concepts have not faced ordinary or large user content.** Test long labels, no images, mixed genres, many records, and large collapsed graphs. The equipment fallback is a good start. Suggested command: shape, then adapt on a working prototype.

## Nodes versus forms

Campaign relationships are a strong graph use case: places, people, clues, sessions, and encounters have meaningful cross-links. Content authoring is conditional: graphs help compare, duplicate, and understand related mechanics; compact forms usually suit entering names, ranges, weights, descriptions, and dice.

Recommended hypothesis: retain guided authoring for first-time and simple work, add a graph as an advanced structure view over the same authored content, and edit selected pieces in a focused inspector. Do not create a second rules model or assume the internal NodeMap DSL is a visual programming language. The current authoring-schema guide explicitly distinguishes it from a general rules language. Switching representations must not silently discard unsupported complexity.

For Borrowed Dawn, show spell identity with two sibling effects, Restore and Protect, and an appropriate scaling relationship. Keep amount, target, duration, and other scalar properties in the selected piece's editor. Confirm exact ownership against supported contracts before implementation.

Validate with a bounded prototype: create a simple spell, add a second conditional effect, then modify an existing complex spell. Compare completion, errors, assistance needed, and confidence with the current flow, including newcomers and experienced creators. Test keyboard operation and a realistic large example. Do not replace the forms based on screenshots.

## Persona concerns and next decision

New creators need an obvious starting action and valid contextual additions. Experienced creators need fast repeated edits without arranging nodes. Keyboard and screen-reader users need a non-drag path and an understandable structure. Responsive, focus, performance, and persistence behavior remain unassessed.

First resolve interaction structure, then implement one representative surface and polish it. Preserve the brand direction; do not undertake another wholesale visual redesign.
