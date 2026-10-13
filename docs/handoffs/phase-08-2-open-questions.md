# Phase 8.2 open questions

> Questions waiting for the user's answer only; keep this file short. Answer inline under **Answer** (or in chat). Answered items move to [Resolved](phase-08-2-decisions.md#resolved) with the decision; decisions made on the user's behalf, approved implementation decisions and resolved questions live in [phase-08-2-decisions.md](phase-08-2-decisions.md).
>
> Updated: 2026-10-13.

## Open

### OQ-1 Authoring form context store (RELIABILITY-9.5)

**Context.** `AuthoringFormContext` (884-line provider, about 70 fields, 26 consumers) holds state that `FormRenderer.tsx:441-459` copies up from the form through effects, and `AuthoringLayoutProvider` stacks a 17-field context on top. AGENTS.md forbids context as a general store and controller objects passed through trees. Fixing it touches every authored domain form. It already causes a bug: the character builder has two writers that set `isSubmitting`, `canSubmit` and `canFinalize` to different values, and whichever runs last wins.

**Options.**

1. Split by behaviour: the TanStack form is the only value store; small contexts for navigation/cancel, layout and the page actions, each read where needed; delete the effect mirroring.
2. Keep one context but remove the child-to-parent mirroring only.
3. Defer until after the authoring PBIs land.

**Research (2026-10-13, TanStack Form 1.33.5, react-store 0.11.2).** Narrow subscriptions in many components are TanStack's intended design: `useSelector` re-renders only when the selected value changes by `===`, so primitive selectors (`s => s.canSubmit`) are cheap. What is slow is subscribing broadly (`s.values` and `s.fieldMeta` get new references on every keystroke) or returning new objects or arrays from a selector (tanstack/form#2090, still open; pass `{ compare: shallow }` to `useSelector`). Very large forms (around 900 fields) have a separate, acknowledged v1 cost in store updates and validation (tanstack/form#1786), whichever pattern is used. Today `FormRenderer.tsx:126` and `:138` subscribe to all values and all field meta, then copy about 20 derived fields into the context through an effect. That re-renders the renderer root and every context consumer on each keystroke, a frame late. This is the costliest of the three patterns. The cost is inferred from the code, not profiled.

**Recommendation.** Option 1, as its own PBI after RELIABILITY-8.1's typed form factory, which removes most of the per-domain plumbing first. Each component selects only the primitives it renders. Derived values such as progress and the step tree are computed where they are rendered. Contexts hold only stable, non-form coordination. Measure with React Profiler before and after.

**Answer.**
