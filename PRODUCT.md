# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Artificer Toolkit serves two equal primary audiences:

- tabletop RPG creators building, sharing, and eventually selling custom content such as classes, races, backgrounds, spells, equipment, creatures, vehicles, characters, and campaign materials
- tabletop RPG players finding tables, building characters, participating in campaigns or one-shots, and using fast, trustworthy play and reference workflows at virtual or local tables

Neither audience is subordinate to the other. Creators need expressive, structured tools that can carry their work into actual play; players need dependable play surfaces and communities that make that content useful. The same person may move between both roles.

## Product Purpose

Artificer Toolkit is a creative toolkit for creating, managing, and using tabletop RPG content. It exists to make deep homebrew authoring and playable character workflows feel coherent, reliable, and genuinely enjoyable across desktop and mobile.

The product should treat content creation as an authoring workspace, not as a generic admin form. The underlying implementation may be form-backed, but the user experience is modular content authoring: creators move through a structure rail, focus one meaningful piece at a time, preview authored output, and stage complex row or group changes before committing them.

The Character Sheet is the product's primary play surface. It should help a player recognize their current state, choose an action, and resolve it quickly. Immediate play information stays visible and compact; reference prose, provenance, customization, and management remain close at hand through focused inspectors, popovers, or drawers rather than competing with the play surface.

The long-term product is a one-stop TTRPG experience: content creation, free sharing and paid marketplace distribution, a Social Hub for posting, hosting, and finding virtual or local tables, Campaigns, Encounters, subscription tiers, native play, and a VTT should operate as one connected product rather than unrelated utilities.

Success means:

- creators can build complex homebrew content without losing track of structure or context
- creators can move authored work into sharing, discovery, purchase, character building, and play without rebuilding it in disconnected tools
- players can move through characters, campaigns, sheets, and reference material without friction
- players can find, host, and join virtual or local tables through the same product they use to play
- players can find and act on the information needed for the current moment without scanning ancillary detail
- the product feels fun to return to, not monotonous or chore-like
- the product feels trustworthy and readable even when the underlying data model is complex
- advanced workflows remain approachable without flattening the product into a simplistic toy

## Positioning

Artificer Toolkit is the connected workspace and play platform for the full TTRPG lifecycle. Its differentiating mechanism is one structured content and rules foundation that can carry creator work from authoring through distribution, character building, Campaign and Encounter play, social table discovery, and VTT use while giving each client a platform-appropriate interface.

The current alpha proves the first part of that lifecycle through reusable authored content, Character Builder, Character Sheet play surfaces, and reference workflows. Marketplace, Social Hub, Campaign, Encounter, subscription, native, and VTT capabilities are committed roadmap direction and must not be presented as current behavior until their phases ship.

## Operating Context

Creators work between sessions on content that may be private, freely shared, or eventually sold. Players use the product before play to find tables and prepare characters, and during play to make quick decisions, resolve actions, inspect rules, manage state, and coordinate with a virtual or local group.

The web application currently owns the complete authoring experience and first play surfaces. Native iOS and Android clients are required first-class product surfaces, initially play-first, and must adapt interaction and composition to their platforms rather than wrap the website. Web, native, backend services, and future VTT rendering share product contracts and authoritative rules without requiring identical presentation.

## Capabilities and Constraints

The canonical creation surface is the **Authoring Workspace**. It is not a simple form page and not an admin console. It is a focused workspace for modular tabletop content configuration.

Core vocabulary:

- **Library**: the signed-in content navigation surface for browsing authored domains and drafts
- **Create**: the signed-in creation entry point for starting new authored content across domains
- **Authoring Workspace**: the shell, structure rail, editor canvas, preview/context rail, and action bar used while editing content
- **Structure Rail**: the step map for the current authored item only, not app-wide navigation
- **Editor Canvas**: the focused working area for the current step or content module
- **Context / Preview Rail**: supporting read-only output, metadata, validation context, or rule preview when useful
- **Staged Drawer**: the add/edit pattern for row-like modular data that should not mutate the saved draft until the user commits it
- **Character Sheet Play Surface**: the compact, stateful runtime view used to make and resolve immediate play decisions
- **Focused Inspector**: a Sheet-owned overlay that reveals detail, provenance, customization, or management without displacing the play surface

The app should preserve the feeling that authored content is made of meaningful pieces. Users should be able to compare, revise, and move between those pieces without feeling like they are filling out a long bureaucratic form.

Current and committed constraints:

- Builder owns structural character intent; Sheet owns immediate play state.
- Backend rules and semantic contracts remain authoritative. Web and native clients own accessible platform presentation and do not reproduce mechanical calculations.
- D&D 5e 2014 is the first ruleset, but the rules-system seam must support additional systems without accumulating D&D-specific conditionals in shared product infrastructure.
- Complex authoring and seller administration remain web-first initially. Native is a required first-class play client, not an optional companion or WebView wrapper.
- Marketplace, Social Hub, Campaigns, Encounters, paid subscriptions, and VTT remain roadmap capabilities until their documented phases ship.
- Prices, subscription limits, marketplace fees, revenue shares, and exact commercial packaging are unresolved product decisions.

## Brand Commitments

The product name is **Artificer Toolkit**. Its personality is flexible, familiar, creative, playful, and modern. It should feel capable enough for serious homebrew, familiar enough to use with confidence, and expressive enough that creating and playing feel like preparing something for the table rather than completing administrative work.

The tone is approachable, not sterile; expressive, not noisy; and game-adjacent without fake parchment, distressed textures, fantasy cliches, medieval display fonts, or novelty controls. D&D Beyond is a functional capability reference, not a visual authority. Azure DevOps-style form clutter, brittle content-creation workflows, monotonous productivity surfaces, and desktop-first responsive leftovers are explicit anti-references.

Play surfaces should feel compact and purposeful. Minimalism means reducing cognitive and spatial overhead while preserving the facts and controls that matter during play; it does not mean removing useful capability.

## Evidence on Hand

- The repository contains working authored-content, Character Builder, Character Sheet, rules-engine, persistence, API, and reference implementations with focused tests.
- `docs/mockups` contains approved and locked visual references, including responsive Character Sheet and focused-inspector states.
- Route-backed Storybook fixtures exercise production Character Sheet components with representative data and responsive states.
- `docs/roadmap` records the planned path from the current alpha through native clients, Campaigns, Encounters, Social Hub, Marketplace, subscriptions, VTT, and release validation.
- No canonical customer testimonials, marketplace performance, pricing validation, conversion benchmarks, or published usage claims are currently recorded. Future product and marketing work must not fabricate them.

## Product Principles

1. Treat creators and players as equal participants in one connected TTRPG lifecycle.
2. Let structured content travel from creation to distribution and play without forcing users to rebuild it in disconnected systems.
3. Keep rules, permissions, and semantic actions authoritative and portable while each client remains intentionally native to its platform.
4. Make creation modular and inviting, and make play surfaces compact, trustworthy, and optimized for immediate decisions.
5. Use familiar interaction, progressive disclosure, accessible feedback, and responsive composition so complexity remains powerful without becoming bureaucratic.

## Accessibility & Inclusion

Follow strong default accessibility practice throughout the product:

- readable contrast and clear hierarchy in both light and dark themes
- full keyboard reachability for core workflows
- reduced-motion-safe interactions
- responsive layouts that preserve usability across desktop and mobile
- plain-language labels and guidance where complex authoring decisions need explanation
