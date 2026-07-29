---
target: current desktop authoring workspace
total_score: 19
p0_count: 0
p1_count: 3
timestamp: 2026-07-15T01-45-43Z
slug: apps-web-src-forms-layout-authoringlayout-tsx
---

# Current desktop authoring workspace critique

## Verdict

The workspace is disciplined and token-consistent, but framework-first and transitional. The principal failure is interaction architecture rather than styling: the structure rail, canvas, nested renderer, staged drawer, and Preview do not yet form one predictable authoring journey.

Nielsen score: **19/40**. Cognitive-load failures: **6/8**. Static detector: **0 findings** with no ignore file or suppressed findings.

## P1 findings

1. **Preview blocks desktop authoring.** The auto-open 352px modal drawer overlaps the right edge of the editor and completely covers the 44px Next action. The editor remains 1120px wide underneath it, so the overlay neither becomes a companion rail nor exposes the hidden content. Desktop needs an inline/collapsible companion preview or a non-auto-open modal with a visible close action.
2. **Navigation exposes backend shape.** Structurally similar content switches among recursive rail branches, inline object groups, nested shells, and focused drawers based on group metadata. Define presentation from creator intent: structural modules in the rail/canvas, supporting fields inline, and atomic repeated leaves in one staged drawer.
3. **Deep context collapses into indentation and generic labels.** Repeated Basics, Mechanics, Options, and Overview labels lose their owner. Keep the permanent rail shallow, cap indentation, and show a compact active path above the canvas.

## P2 findings

1. Leaf drawers can currently launch another drawer through the generic renderer. Enforce one overlay layer, include the owning path, and edit atomic leaves only.
2. The workspace reads as an administrative record form. Strengthen module identity and current-module preview synchronization without adding more nested cards or decorative fantasy styling.

## Evidence

- Fresh 1440x900 Storybook inspection measured a 320px rail, 1120px editor, 352px Preview drawer, and 60px absolute action bar.
- The Preview covers 331-332px of several editor controls and all 44px of the Next action.
- The editor reports equal client and scroll widths, confirming the overlay does not resize or provide horizontal access.
- The main authoring canvas ends near y=767 in a 900px viewport while Preview continues to full height.
- Mutable browser injection failed before any overlay or detector script was installed, so no live overlay claim was made.

## Direction for craft

- Retain the Black Forge palette and current accessible primitives.
- Keep a shallow structural rail for meaningful branches.
- Present one active module in a spacious canvas with compact path context.
- Treat effect outcomes as one scannable collection.
- Open only an atomic outcome editor in a slimmer true overlay drawer with scrim; never stack drawers or resize the underlying canvas.
- Keep Preview subordinate and explicitly controllable on desktop.
