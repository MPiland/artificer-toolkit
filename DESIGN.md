---
name: Artificer Toolkit
description: Playful tabletop RPG authoring and reliable play support across desktop and mobile.
colors:
  primary: "#0891b2"
  primary-hover: "#0ea5c5"
  primary-deep: "#0e7490"
  primary-dark: "#0ea5c5"
  secondary-accent: "#4f46e5"
  text-strong: "#151b20"
  text-muted: "#55626d"
  border-subtle: "#d7dbe4"
  surface-canvas-light: "#f3f4f6"
  surface-panel-light: "#ffffff"
  surface-subtle-light: "#ebedf2"
  surface-canvas-dark: "#0d1117"
  surface-panel-dark: "#17202a"
  surface-subtle-dark: "#171d22"
  success: "#2f9b63"
  warning: "#b7822e"
  danger: "#ea6846"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: "4rem"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "0"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: "2rem"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "0"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "0"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "0"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  xxl: "24px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  hero: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-panel-light}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface-panel-light}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.surface-panel-light}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "40px"
  input-default:
    backgroundColor: "{colors.surface-panel-light}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  card-surface:
    backgroundColor: "{colors.surface-panel-light}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.lg}"
    padding: "24px"
  nav-pill-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-panel-light}"
    rounded: "{rounded.md}"
    padding: "12px 12px"
---

# Design System: Artificer Toolkit

## Overview

**Creative North Star: "Playful Creation, Reliable Play"**

Artificer Toolkit is a product UI first, but it should not feel like office software. It is not trying to look like a marketing site dressed up as an app, and it is not trying to romanticize complexity. The system is built around one idea: serious tabletop authoring work should feel clear, reliable, and fun to return to, even when the underlying data model is dense. The interface should feel like a creative RPG tool that helps people build things for play, not like a rigid workbench or an enterprise form system.

The visual language is structured, but not monotonous. A cyan-led accent system gives the product a recognizable identity, while selective secondary color, lively icons, tactile empty states, and small feedback moments keep the app from feeling sterile. Neutral surfaces still carry most dense work, but they should be composed with rhythm, contrast, and moments of personality. Color is used to orient, confirm, reward, and prioritize. The system rejects cluttered form pages, decorative gradients as a default move, and dense authoring screens that reveal everything at once.

This system explicitly rejects the anti-references captured in [PRODUCT.md](/c:/Users/pilan/Desktop/artificer-toolkit/PRODUCT.md): Azure DevOps form clutter, D&D Beyond content-creation brittleness, and any UI that treats responsive support as secondary. Desktop and mobile are equal citizens.

**Key Characteristics:**
- Playful, not gimmicky
- Clear, not bureaucratic
- Familiar, not generic
- Creative, not ornamental
- Dense when needed, but always navigable
- Dual-theme by design, not as an afterthought

## Colors

The palette is identity-led and task-aware. Cyan carries the main brand signal, indigo is reserved for selective emphasis, and the bulk of dense authoring remains built from slightly cooled neutrals rather than blank black-and-white contrast. The app should not be monochrome by habit: use controlled accent moments to make creation feel alive, especially in onboarding, empty states, progress cues, domain headers, and playful feedback.

### Primary
- **Workshop Cyan** (`#0891b2`): The main action and orientation color in light mode. Use it for primary buttons, active emphasis, selected borders, and the strongest navigational cues.
- **Lifted Cyan** (`#0ea5c5`): The hover and active-lift state for primary actions. It adds movement without changing the character of the interface.
- **Deep Cyan** (`#0e7490`): The pressed or structural anchor for primary actions and accent borders when a sharper edge is needed.

### Secondary
- **Signal Indigo** (`#4f46e5`): Reserved for selected-state accents, completion states, and small pockets of alternate emphasis. This is not a co-primary.

### Neutral
- **Slate Ink** (`#151b20`): Primary text on light surfaces.
- **Steel Copy** (`#55626d`): Secondary text, body support copy, and quiet inline actions.
- **Mist Border** (`#d7dbe4`): Default light-theme borders and separators.
- **Paper Canvas** (`#f3f4f6`): Light-theme page canvas.
- **Panel White** (`#ffffff`): Light-theme cards, forms, and raised working surfaces.
- **Frost Surface** (`#ebedf2`): Light-theme headers, sidebars, and subtle framing bands.
- **Night Canvas** (`#0d1117`): Dark-theme page canvas.
- **Forge Panel** (`#17202a`): Dark-theme card and shell surface.
- **Night Header** (`#171d22`): Dark-theme header and framing band.

### Named Rules
**The Purposeful Accent Rule.** Cyan is the primary directional signal, not wallpaper. Dense work screens should stay readable, but accent moments are welcome when they clarify domain, progress, success, or creative momentum.

**The Dual-Surface Rule.** Light and dark themes keep the same hierarchy. Do not redesign the interface per theme. Invert the surfaces, preserve the structure.

**The No-Monotony Rule.** Avoid long stretches of identical gray panels. Use spacing rhythm, icons, section identity, progress feedback, and selective color to prevent the app from feeling like administrative work.

## Typography

**Display Font:** SF Pro Display stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', sans-serif`)
**Body Font:** SF Pro Text stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', sans-serif`)
**Label/Mono Font:** SF Mono stack (`'SFMono-Regular', 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace`) for code-like or compact utility use

**Character:** The system uses a native-feeling sans stack rather than a decorative voice. That is deliberate. The personality comes from hierarchy, copy, icons, motion, and interaction feedback, not from a loud typeface.

### Hierarchy
- **Display** (`800`, `4rem`, `1.12`): Reserved for hero-auth surfaces such as logged-out auth or marketing moments. Never use display scale inside dense product panels.
- **Headline** (`750`, `2rem`, `1.2`): Primary page-level headings and major shell titles.
- **Title** (`750`, `1.5rem`, `1.2`): Section titles, card headers, and important grouped surfaces.
- **Body** (`400`, `1rem`, `1.5`): Main application copy. Keep line length within `65ch-75ch` where prose is longer than a short paragraph.
- **Label** (`700`, `0.75rem`, `1.45`): Field labels, overlines, and compact metadata that must remain crisp.

### Named Rules
**The Density Hierarchy Rule.** Dense screens do not use hero type. Large type is reserved for true entry moments, not repeated work surfaces.

**The One-Step Rule.** Move between adjacent sizes with purpose. Flat scales make the product feel vague and cluttered.

**The Cheer Without Shouting Rule.** Playful copy and energetic headings are welcome in entry, empty, and success states. Dense forms still need quiet, readable typography.

## Elevation

Elevation is light, structural, and stateful. Cards, drawers, and raised shells use broad ambient shadows rather than sharp SaaS drops. The system is not flat, but it also does not rely on depth theatrics. In dark mode especially, tonal layering carries as much weight as the shadow itself. Interactive surfaces can feel tactile, but they should never become floaty decoration.

### Shadow Vocabulary
- **Working Surface** (`0 18px 50px rgba(7, 16, 20, 0.16)`): Use for panels, auth cards, drawers, and framed working regions that need to separate from the canvas.
- **Hover Lift** (`0 24px 64px rgba(7, 16, 20, 0.22)`): Use sparingly for interactive framed surfaces that need a clear hover response.
- **Focus Halo** (`0 0 0 4px rgba(14, 165, 197, 0.24)`): Keyboard focus and selected-input emphasis.

### Named Rules
**The Flat-at-Rest Rule.** Resting content stays quiet. Elevation appears when a surface genuinely needs separation or interaction state.

## Components

### Buttons
- **Shape:** Softly rounded, not pillowy (`8px` default, `12px` on certain auth CTAs).
- **Primary:** Cyan fill with strong contrast text, `40px` tall, medium-to-bold text, compact horizontal padding (`20px`). This is for the main task on a surface, not every action in sight.
- **Hover / Focus:** Hover moves to lifted cyan. Focus uses the cyan halo, never a browser-default mismatch.
- **Secondary / Ghost:** Secondary actions prefer bordered neutrals with restrained text. Use them to support the primary path, not compete with it.
- **Reward Moments:** Completion buttons and first-run calls to action may use slightly more expressive copy or icon support when it helps the action feel satisfying.

### Chips
- **Style:** Accent chips and badges use soft cyan backgrounds with cyan borders and compact text. They read as state or filtering aids, not as decorative pills.
- **State:** Active chips get clearer background and border contrast. Inactive chips stay quiet.

### Cards / Containers
- **Corner Style:** Standard working cards use `12px` radius. Hero mockups and major framed surfaces may go to `24px`.
- **Background:** Cards sit on neutral panel surfaces in both themes.
- **Shadow Strategy:** Use working-surface elevation for framed regions, not for every repeated cell.
- **Border:** Most framed surfaces keep a `1px` subtle border. The border often does as much work as the shadow.
- **Internal Padding:** The default content rhythm is `24px`, with tighter `16px` or `20px` use on compact controls.

### Inputs / Fields
- **Style:** Inputs are neutral fields with a clear stroke, quiet background, and `8px` radius.
- **Focus:** Focus is a border shift to cyan plus the focus halo. Visibility matters more than cleverness.
- **Error / Disabled:** Error borders move warm, disabled fields flatten toward the surface.

### Navigation
- **Style:** Navigation items are compact framed pills with an icon tile, strong label, quieter description, and explicit active fill.
- **Active State:** Active items use cyan-tinted background plus border emphasis. Hover uses a lighter cyan tint instead of inventing a separate visual language.
- **Mobile Treatment:** Mobile keeps the same structure inside drawers or compact menus. It is the same system, not a reduced afterthought.

### Empty / First-Run States
- **Style:** Empty states should feel like invitations, not blank admin pages. Use the domain icon, concise copy, and one clear next action.
- **Tone:** Speak to the creative outcome: "Create your first spell" is better than "No records found."
- **Constraint:** Do not use mascot-heavy, joke-heavy, or decorative-only empty states. Delight should point toward action.

### Motion
- **Style:** Motion should be brief and stateful: reveal a next section, confirm a save, open a drawer, or acknowledge progress.
- **Timing:** Most transitions stay in the `150ms-250ms` range with ease-out curves.
- **Constraint:** No decorative page-load choreography. Users are here to create and play.

### Theme Toggle
- **Style:** Circular `40px` control with panel fill, subtle border, and card shadow.
- **State:** Dark-mode active state uses soft cyan fill plus accent border so the mode feels chosen, not merely switched.

### Mantine-First Implementation
- **Default:** Use Mantine components where they provide accessible behavior, keyboard support, focus management, or cross-browser interaction patterns out of the box.
- **Best Fit:** Prefer Mantine for buttons, inputs, selects, segmented controls, menus, drawers, modals, tooltips, tables, layout helpers, notifications, and overlays.
- **Styling:** Keep vanilla-extract and the existing CSS layer strategy as the product styling layer. Mantine supplies behavior and accessible structure; app CSS supplies the Artificer visual system.
- **Exception:** Use semantic HTML directly when the element is static, simpler than a Mantine abstraction, or when Mantine would make the structure less faithful to Figma.

## Do's and Don'ts

### Do:
- **Do** make authored screens feel creative and approachable, with enough structure to stay readable.
- **Do** use cyan for action, focus, and state, and use selective secondary accents for domain identity or progress where helpful.
- **Do** preserve the same information hierarchy across light and dark themes.
- **Do** use framed surfaces only when they clarify structure or interaction.
- **Do** make desktop and mobile layouts feel intentionally composed, not mechanically collapsed.
- **Do** keep long-form authoring surfaces strongly sectioned, with obvious location and next-action cues.
- **Do** add delight through copy, icons, feedback states, and small motion moments.

### Don't:
- **Don't** recreate Azure DevOps forms: avoid cluttered pages, weak hierarchy, and outdated organization patterns for dense authoring flows.
- **Don't** recreate D&D Beyond content creation: avoid brittle creation flows, weak data structure, and poor conditional disclosure.
- **Don't** treat responsive support as secondary: desktop and mobile both need intentional layouts rather than desktop-first leftovers.
- **Don't** use decorative gradients, glassmorphism, or side-stripe card accents as default styling moves.
- **Don't** turn every repeated surface into an identical card grid. Density needs hierarchy, not repetition.
- **Don't** let the app feel like monotonous office software, an admin dashboard, or a chore list.
- **Don't** fake fantasy flavor with parchment, distressed textures, medieval fonts, or novelty controls.
