---
target: current authoring workspace
total_score: 18
p0_count: 0
p1_count: 3
timestamp: 2026-07-12T18-04-52Z
slug: apps-web-src-forms
---

# Current Authoring Workspace Critique

Method: dual-agent (A: current_forms_design_review · B: current_forms_detector)

## Design Health Score

| #         | Heuristic                       |     Score | Key issue                                                                                                          |
| --------- | ------------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------ |
| 1         | Visibility of System Status     |         2 | Progress and Draft exist, but saved/dirty and nested commit state are unclear.                                     |
| 2         | Match System / Real World       |         3 | Domain language is mostly sound; Overview, Details, Selection Model, and Starts From leak implementation language. |
| 3         | User Control and Freedom        |         2 | Back/reset exist, but complex Add/remove operations mutate the live form without a staged cancel boundary.         |
| 4         | Consistency and Standards       |         3 | Controls are coherent; page titles and Add/action placement vary.                                                  |
| 5         | Error Prevention                |         1 | Conditional clearing and populated removal lack clear prevention/recovery.                                         |
| 6         | Recognition Rather Than Recall  |         2 | Desktop rail helps; mobile loses object and branch identity.                                                       |
| 7         | Flexibility and Efficiency      |         1 | No compact comparison, duplicate, reorder, or expert path for nested effects.                                      |
| 8         | Aesthetic and Minimalist Design |         2 | Restrained shell, but simple states are vacant and deep states expose the schema at equal weight.                  |
| 9         | Error Recovery                  |         1 | Warnings do not visibly diagnose or route to repair.                                                               |
| 10        | Help and Documentation          |         1 | Complex effect concepts and consequences lack contextual guidance.                                                 |
| **Total** |                                 | **18/40** | **Poor, with a strong shell worth preserving.**                                                                    |

## Anti-Patterns Verdict

The baseline passes the AI-slop test: no gratuitous gradients, glass, pill-everything, ghost-card grids, or fantasy ornament. The deterministic detector also returned zero findings. Its risk is the opposite: dotted group boundaries, generic Add controls, large unused regions, and recursively expanded schema sections make it feel like a capable internal form renderer rather than a finished creative authoring product.

No reliable browser overlay was produced because the available browser evaluation surface was read-only. The fallback evidence is the clean deterministic scan, baseline source, and five captured desktop/mobile screenshots.

## Overall Impression

Keep the three-region desktop topology, Forge palette, rail, field vocabulary, and compact shell. The single biggest opportunity is to change only the transition into complex child objects: scan-first summaries in the canvas, then a true portal-backed overlay drawer with backdrop, independent scrolling, explicit cancel/commit, and no page reflow.

## What's Working

1. The desktop structure rail/editor/preview topology is a credible scalable authoring workspace.
2. Forge restraint gives the product a trustworthy identity without fantasy kitsch.
3. Mobile correctly becomes a usable single-column form rather than squeezing desktop rails into narrow columns.

## Priority Issues

- **[P1] Complex groups lack a staged editing contract.** Add/remove mutate the root form immediately and deep objects expand into long recursive pages. Keep compact summaries in the canvas and use a real overlay drawer with Cancel and Add/Save, focus trapping/restoration, and transactional rollback. Suggested command: `$impeccable craft`.
- **[P1] Mobile loses nested orientation.** The generic Details title does not identify the effect or outcome branch. Keep compact object identity and progress in the header; keep actions in the thumb zone; expose structure and preview through overlay drawers. Suggested command: `$impeccable adapt`.
- **[P1] Conditional/destructive transitions lack prevention and recovery.** Explain exactly what populated descendants will be removed, allow cancellation, and preserve state on validation/network failure. Suggested command: `$impeccable harden`.
- **[P2] Hierarchy swings from vacant to overwhelming.** Improve the empty Effects invitation, tighten simple-field measure, and progressively disclose deep decisions instead of using layout-pushing collapses. Suggested command: `$impeccable layout`.
- **[P2] Critical actions rely on small icons and color.** Add text at high-stakes actions, 44px touch targets, non-color state cues, and visible focus. Suggested command: `$impeccable polish`.

## Cognitive Load

Six of eight checklist items fail in the deep Effect state: single focus, chunking, hierarchy, one decision at a time, minimal choices, working-memory support on mobile, and progressive disclosure. Deep desktop exposes at least 18 decisions/actions above the fold. Deep mobile shows fewer simultaneously but increases recall cost because rail and preview disappear.

## Persona Red Flags

- **Jordan (first-timer):** Cannot infer icon-only header/footer actions, gets no useful Effects example, and encounters an abrupt jump from an empty canvas to internal terms and nested mechanics.
- **Sam (accessibility-dependent):** Several visible targets appear small; statuses depend heavily on colored circles; the deep inline editor creates a long screen-reader and keyboard sequence. Runtime focus, trapping, and contrast still need measurement.
- **Casey (distracted mobile):** Important actions sit at the top, branch identity disappears, and interruption recovery requires scrolling and reconstructing context.
- **Homebrew power creator:** Cannot scan, compare, duplicate, or reorder effect summaries and cannot safely stage speculative changes.

## Minor Observations

- Retain authored identity in titles instead of Basics, Overview, or Details alone.
- The empty Effects CTA is too quiet and spatially detached from the message.
- The dashed nested shell reads as a debug/schema boundary.
- The preview needs to interpret the current effect; otherwise it has not earned permanent width.
- Blank activation/range surfaces do not explain whether they are inputs, unresolved state, or disabled.

## Questions to Consider

1. Is the creator authoring a playable spell or operating a visual node-map editor?
2. If Preview cannot explain the current Effect decision, should it be persistent or on demand?
3. Should Add Effect feel like inserting a row or choosing and configuring meaningful spell behavior?
4. What exact location must survive interruption so the creator can return without reconstructing the tree?
