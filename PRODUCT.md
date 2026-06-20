# Product

## Register

product

## Users

Artificer Toolkit serves two closely related groups:

- tabletop RPG homebrew creators building custom content such as classes, races, backgrounds, spells, equipment, creatures, vehicles, characters, and campaign materials
- tabletop RPG players running campaigns or one-shots who need fast, trustworthy character and reference workflows during play

Users are often switching between creative authoring and practical play support. They need the interface to feel familiar enough to move quickly, playful enough to invite experimentation, and flexible enough to support complex custom rules and nested authoring flows without boxing them into rigid templates.

## Product Purpose

Artificer Toolkit is a creative toolkit for creating, managing, and using tabletop RPG content. It exists to make deep homebrew authoring and playable character workflows feel coherent, reliable, and genuinely enjoyable across desktop and mobile.

The product should treat content creation as an authoring workspace, not as a generic admin form. The underlying implementation may be form-backed, but the user experience is modular content authoring: creators move through a structure rail, focus one meaningful piece at a time, preview authored output, and stage complex row or group changes before committing them.

Success means:

- creators can build complex homebrew content without losing track of structure or context
- players can move through characters, campaigns, sheets, and reference material without friction
- the product feels fun to return to, not monotonous or chore-like
- the product feels trustworthy and readable even when the underlying data model is complex
- advanced workflows remain approachable without flattening the product into a simplistic toy
- modular content pieces feel configurable, reusable, and understandable without exposing backend complexity

## Brand Personality

Flexible, familiar, creative, playful.

The product should feel:

- flexible enough to support serious homebrew work
- familiar enough that users can recognize patterns and move with confidence
- creative enough that making content feels like building something for the table, not completing admin work
- playful without becoming gimmicky, childish, or chaotic

The tone should support focused creative flow. It should be approachable, not sterile; expressive, not noisy; and game-adjacent without leaning on fake parchment, fantasy cliches, or novelty controls.

## Product Model

The canonical creation surface is the **Authoring Workspace**. It is not a simple form page and not an admin console. It is a focused workspace for modular tabletop content configuration.

Core vocabulary:

- **Library**: the signed-in content navigation surface for browsing authored domains and drafts
- **Create**: the signed-in creation entry point for starting new authored content across domains
- **Authoring Workspace**: the shell, structure rail, editor canvas, preview/context rail, and action bar used while editing content
- **Structure Rail**: the step map for the current authored item only, not app-wide navigation
- **Editor Canvas**: the focused working area for the current step or content module
- **Context / Preview Rail**: supporting read-only output, metadata, validation context, or rule preview when useful
- **Staged Drawer**: the add/edit pattern for row-like modular data that should not mutate the saved draft until the user commits it

The app should preserve the feeling that authored content is made of meaningful pieces. Users should be able to compare, revise, and move between those pieces without feeling like they are filling out a long bureaucratic form.

## Anti-references

- Azure DevOps forms: avoid cluttered pages, weak hierarchy, and outdated organization patterns for dense authoring flows
- D&D Beyond content creation: avoid brittle creation flows, weak data structure, and poor conditional disclosure
- Monotonous productivity apps: avoid surfaces that make character creation or homebrew authoring feel like office work
- Any UI that treats responsive support as secondary: desktop and mobile both need intentional layouts rather than desktop-first leftovers

## Design Principles

1. Make complex creation feel inviting. The product can support dense authored data, but the UI should make the next choice feel clear, approachable, and satisfying.
2. Familiar interaction beats novelty in workflow-heavy surfaces. Reuse recognizable layout and control patterns so users can focus on content, not interface interpretation.
3. Creative work needs strong orientation. Nested flows, long forms, and list-heavy screens should always make location, progress, and next actions obvious without making the experience feel bureaucratic.
4. Flexible systems still need guardrails. The interface should encourage valid, readable authoring patterns without making users fight the product.
5. Equal respect for desktop and mobile. Every core surface should feel intentionally designed for both contexts, not merely tolerated on one of them.
6. Delight belongs in feedback, transitions, copy, icons, empty states, and progress moments. It should support the task rather than decorate over it.
7. Authoring is modular configuration, not CRUD. Reusable frontend components should express structure, staged edits, preview, and progress across domains without creating domain-specific UI unless the domain truly needs a distinct interaction.

## Accessibility & Inclusion

Follow strong default accessibility practice throughout the product:

- readable contrast and clear hierarchy in both light and dark themes
- full keyboard reachability for core workflows
- reduced-motion-safe interactions
- responsive layouts that preserve usability across desktop and mobile
- plain-language labels and guidance where complex authoring decisions need explanation
