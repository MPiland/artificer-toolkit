---
name: Artificer Toolkit
description: Playful tabletop RPG authoring and reliable play support across desktop and mobile.
colors:
  primary: "#ec8c06"
  primary-hover: "#f97316"
  primary-deep: "#c95704"
  primary-active: "#b84a04"
  primary-contrast: "#241002"
  primary-dark: "#ec8c06"
  secondary-accent: "#0891b2"
  secondary-accent-dark: "#6bd8cb"
  warm-accent: "#ec8c06"
  text-strong: "#151b20"
  text-muted: "#55626d"
  border-subtle: "#d7dbe4"
  surface-canvas-light: "#f7f9fb"
  surface-panel-light: "#ffffff"
  surface-subtle-light: "#eef2f6"
  surface-canvas-dark: "#0a0f0e"
  surface-panel-dark: "#171d1c"
  surface-subtle-dark: "#1b2120"
  surface-sidebar-dark: "#0f1413"
  surface-raised-dark: "#262b2a"
  success: "#2f9b63"
  warning: "#8a5a00"
  danger: "#c15336"
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
    textColor: "{colors.primary-contrast}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-contrast}"
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

**Creative North Star: "Forge Clarity, Reliable Play"**

Artificer Toolkit is a product UI first, but it should not feel like office software. It is not trying to look like a marketing site dressed up as an app, and it is not trying to romanticize complexity. The system is built around one idea: serious tabletop authoring work should feel clear, reliable, and fun to return to, even when the underlying data model is dense. The interface should feel like a creative RPG tool that helps people build things for play, not like a rigid workbench or an enterprise form system.

The canonical creation surface is the Authoring Workspace. It is form-backed, but it should never feel like a long generic form. The experience is modular content configuration: the app shell handles Library and Create navigation, the authoring structure rail handles the current item only, the editor canvas focuses the active step, the preview/context rail shows supporting output, and drawers stage complex row or group edits before they mutate draft data.

The visual language is structured, but not monotonous. A Forge surface system gives dense authoring screens a calmer foundation: black and charcoal carry dark mode, crisp white and cool gray carry light mode, forge orange identifies primary action and craft momentum, and teal stays reserved for focus and technical state. Neutral surfaces still carry most dense work, but they should be composed with rhythm, contrast, and moments of personality. Color is used to orient, confirm, reward, and prioritize. The system rejects cluttered form pages, decorative gradients as a default move, and dense authoring screens that reveal everything at once.

This system explicitly rejects the anti-references captured in [PRODUCT.md](PRODUCT.md): Azure DevOps form clutter, D&D Beyond content-creation brittleness, and any UI that treats responsive support as secondary. Desktop and mobile are equal citizens.

**Key Characteristics:**
- Playful, not gimmicky
- Clear, not bureaucratic
- Familiar, not generic
- Creative, not ornamental
- Dense when needed, but always navigable
- Dual-theme by design, not as an afterthought
- Modular content authoring, not admin CRUD
- Form-backed, but not form-shaped

## Colors

The palette is identity-led and task-aware. Black Forge uses near-black canvas and charcoal panels; White Forge uses white, cool gray, and crisp ink. Forge Orange is the main brand/action color for primary CTAs, active creation states, draft/progress moments, and dice/data highlights. Teal is secondary and functional: focus rings, technical selection, and supportive navigation. Purple stays rare for arcane emphasis. The app should not become blue-on-blue or monochrome by habit: use controlled accent moments to make creation feel alive, especially in onboarding, empty states, progress cues, domain headers, and playful feedback.

### Primary
- **Forge Orange** (`#ec8c06`): The main action and brand color. Use it for primary buttons, active authoring states, progress/craft moments, and high-value data highlights.
- **Lifted Orange** (`#f97316`): The hover and active-lift state for primary actions. It adds warmth without turning the workspace into a warning surface.
- **Deep Orange** (`#c95704`): The pressed or structural anchor for primary actions and accent borders when a sharper edge is needed.
- **Anvil Contrast** (`#241002`): The text color on orange-filled controls. Use it for primary button labels when the orange surface is light enough to support dark text.

### Secondary
- **Workshop Teal** (`#0891b2`): Reserved for focus, technical selection, secondary navigation, and precision states. This is not the general CTA color.
- **Lit Teal** (`#6bd8cb`): The dark-theme teal accent for focus and precision states that need stronger contrast on Black Forge surfaces.
- **Arcane Purple** (`#8b5cf6`): Reserved for rare magic-adjacent emphasis and special states. This is not a co-primary.

### Neutral
- **Slate Ink** (`#151b20`): Primary text on light surfaces.
- **Steel Copy** (`#55626d`): Secondary text, body support copy, and quiet inline actions.
- **Mist Border** (`#d7dbe4`): Default light-theme borders and separators.
- **Paper Canvas** (`#f7f9fb`): Light-theme page canvas.
- **Panel White** (`#ffffff`): Light-theme cards, forms, and raised working surfaces.
- **Frost Surface** (`#eef2f6`): Light-theme headers, sidebars, and subtle framing bands.
- **Night Canvas** (`#0a0f0e`): Dark-theme page canvas.
- **Forge Panel** (`#171d1c`): Dark-theme card and shell surface.
- **Night Header** (`#0f1413`): Dark-theme header and framing band.
- **Raised Iron** (`#262b2a`): Dark-theme lifted surface for active panels, compact drawers, and strong section headers.

### Named Rules
**The Purposeful Accent Rule.** Orange is the primary action and craft signal, not wallpaper. Teal sharpens focus and technical states. Purple is rare. Dense work screens should stay readable, but accent moments are welcome when they clarify domain, progress, success, or creative momentum.

**The Dual-Surface Rule.** Light and dark themes keep the same hierarchy. Do not redesign the interface per theme. Invert the surfaces, preserve the structure.

**The No-Monotony Rule.** Avoid long stretches of identical gray panels. Use spacing rhythm, icons, section identity, progress feedback, and selective color to prevent the app from feeling like administrative work.

**The Orange-Is-Action Rule.** Orange can mark craft, current authoring state, and primary action. It must not be used as a warning substitute; warning and destructive states keep their own semantic colors.

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

Elevation is restrained, structural, and stateful. Repeated cards and working panels remain flat at rest; borders and tonal layering establish their hierarchy in both Forge themes. Compact shadows are reserved for controls that physically float above the workspace, while the focus halo communicates keyboard and selected-input state.

### Shadow Vocabulary
- **Card** (`none`): Repeated cards and panels rely on surface contrast and borders at rest.
- **Card Hover** (`none`): Hover state uses color and border changes instead of decorative lift.
- **Floating Control** (`0 6px 8px rgba(0, 0, 0, 0.22)`): Floating authoring actions that must remain distinct from content beneath them.
- **Focus Halo** (`0 0 0 4px rgba(14, 165, 197, 0.24)`): Keyboard focus and selected-input emphasis.

### Named Rules
**The Flat-at-Rest Rule.** Resting content stays quiet. Elevation appears when a surface genuinely needs separation or interaction state.

## Components

### Buttons
- **Shape:** Softly rounded, not pillowy (`8px` default, `12px` on certain auth CTAs).
- **Primary:** Orange fill with Anvil Contrast text, `40px` tall, medium-to-bold text, compact horizontal padding (`20px`). This is for the main task on a surface, not every action in sight.
- **Hover / Focus:** Hover moves to lifted orange. Focus uses the teal halo, never a browser-default mismatch.
- **Secondary / Ghost:** Secondary actions prefer bordered neutrals with restrained text. Use them to support the primary path, not compete with it.
- **Reward Moments:** Completion buttons and first-run calls to action may use slightly more expressive copy or icon support when it helps the action feel satisfying.

### Chips
- **Style:** Accent chips and badges use soft orange or teal backgrounds with matching borders and compact text. Orange marks craft, draft, and primary action states; teal marks technical focus or precision states.
- **State:** Active chips get clearer background and border contrast. Inactive chips stay quiet.

### Cards / Containers
- **Corner Style:** Standard working cards use `12px` radius. Hero mockups and major framed surfaces may go to `24px`.
- **Background:** Cards sit on neutral panel surfaces in both themes.
- **Shadow Strategy:** Repeated content stays flat. Use the floating-control shadow only when a control genuinely overlays the workspace.
- **Border:** Most framed surfaces keep a `1px` subtle border. The border often does as much work as the shadow.
- **Internal Padding:** The default content rhythm is `24px`, with tighter `16px` or `20px` use on compact controls.

### Inputs / Fields
- **Style:** Inputs are neutral fields with a clear stroke, quiet background, and `8px` radius.
- **Focus:** Focus is a border shift to teal plus the focus halo. Visibility matters more than cleverness.
- **Error / Disabled:** Error borders move warm, disabled fields flatten toward the surface.

### Navigation
- **App Shell:** Signed-in desktop and tablet landscape use a top header with brand, breadcrumb context, Library and Create menu buttons, search, theme, and account. Library and Create are separate menus because browsing and starting new content are different intents. Signed-out pages use the marketing/auth header and do not render signed-in app navigation.
- **Mobile App Navigation:** Mobile and tablet portrait use a sticky app footer for Library, Create, Search, and Account. Search opens a bottom drawer; account uses the same menu actions as desktop. The mobile footer is app-wide navigation and must never appear on desktop.
- **Structure Rail:** The rail belongs to the current authoring item only. It shows the step hierarchy, active step, child steps for the active branch, completion/dirty/warning markers, and the contextual footer summary. It is not a domain library, not a sidebar replacement, and not a place for global Create actions.
- **Rail Behavior:** Desktop and tablet landscape can render the structure rail inline beside the editor. Mobile and tablet portrait open the rail in a drawer. Closing the desktop rail removes the rail column and lets the editor expand; overlay rails start closed.
- **Active State:** Active authoring rows use orange text and a restrained left fill/marker. Avoid loud full-row fills unless needed for clarity.

### Empty / First-Run States
- **Style:** Empty states should feel like invitations, not blank admin pages. Use the domain icon, concise copy, and one clear next action.
- **Tone:** Speak to the creative outcome: "Create your first spell" is better than "No records found."
- **Constraint:** Do not use mascot-heavy, joke-heavy, or decorative-only empty states. Delight should point toward action.

### Motion
- **Style:** Motion should be brief and stateful: reveal a next section, confirm a save, open a drawer, or acknowledge progress.
- **Timing:** Most transitions stay in the `150ms-250ms` range with ease-out curves.
- **Constraint:** No decorative page-load choreography. Users are here to create and play.

### Authoring Workspace
- **Structure:** The workspace is header, optional structure rail, editor canvas, optional context/preview rail, and persistent action bar. The editor canvas owns the current step. The preview rail appears only when it adds useful output or context.
- **Editor Sections:** Sections are modular working surfaces sized to their content. Avoid full-width slabs unless the content truly needs the full row. Section headers should be compact, readable, and visually tied to the section body.
- **Field Layout:** Use responsive Mantine-backed controls styled through vanilla-extract. Field grids should collapse by content need, not by arbitrary copied dimensions. Numeric inputs use Mantine `NumberInput` with controls hidden where spinner arrows make the row feel noisy.
- **Row Modules:** Repeated modular rows should support scanning first, editing second. Wide layouts may allow inline editing for existing rows. Add actions open a staged drawer so accidental adds do not mutate draft data.
- **Staged Drawer:** Drawers stage add/edit changes and require explicit commit actions such as `Add tier` or `Save tier`. Cancel closes the drawer and discards the staged draft. Mobile portrait uses a minimal-height bottom drawer; mobile landscape and tablet can use the drawer pattern that best preserves reach and readable fields.
- **Context / Preview:** Preview cards should render the authored output users will see after activation, including rich prose. Avoid generic "outcome context" cards unless the active step genuinely has an outcome to summarize.

### Storybook Review Surface
- **Component Stories:** Small reusable components use inline minimal data and decorators for visual framing.
- **Composite Stories:** Shell and authoring workspace stories compose the real components and should not use custom story-only CSS that hides layout bugs.
- **Route-Backed Stories:** Migrated domains should get a route-backed Storybook story before visual sign-off. Use mocked auth/data behavior rather than real Supabase login.
- **Controls:** Stories should expose useful controls for theme, active step, responsive mode, dirty/valid/error state, drawer opened state, and preview presence when those controls help inspect UI behavior.

### Theme Toggle
- **Style:** Circular `40px` control with panel fill and a subtle border; it remains flat at rest.
- **State:** Dark-mode active state uses a soft accent fill plus border so the mode feels chosen, not merely switched.

### Mantine-First Implementation
- **Default:** Use Mantine components where they provide accessible behavior, keyboard support, focus management, or cross-browser interaction patterns out of the box.
- **Best Fit:** Prefer Mantine for buttons, inputs, selects, segmented controls, menus, drawers, modals, tooltips, tables, layout helpers, notifications, and overlays.
- **Styling:** Keep vanilla-extract and the existing CSS layer strategy as the product styling layer. Mantine supplies behavior and accessible structure; app CSS supplies the Artificer visual system.
- **Exception:** Use semantic HTML directly when the element is static, simpler than a Mantine abstraction, or when Mantine would make the structure less faithful to Figma.

## Do's and Don'ts

### Do:
- **Do** make authored screens feel creative and approachable, with enough structure to stay readable.
- **Do** use orange for primary action and craft momentum, teal for focus and technical state, and selective secondary accents for domain identity or progress where helpful.
- **Do** preserve the same information hierarchy across light and dark themes.
- **Do** use framed surfaces only when they clarify structure or interaction.
- **Do** make desktop and mobile layouts feel intentionally composed, not mechanically collapsed.
- **Do** keep long-form authoring surfaces strongly sectioned, with obvious location and next-action cues.
- **Do** add delight through copy, icons, feedback states, and small motion moments.
- **Do** describe the creation experience as an Authoring Workspace or modular content authoring, not as "just forms" in product-facing design language.
- **Do** keep `apps/web/src/forms` as the implementation platform while making the user-facing experience feel like focused content configuration.
- **Do** build reusable form/workspace components first, then migrate one domain at a time through Storybook and route-backed visual review.
- **Do** use staged drawers for row-like add/edit operations when immediate mutation would create accidental blank rows or unclear commit behavior.
- **Do** keep Library/Create navigation separate from the structure rail. Library/Create are app navigation; the rail is current-item authoring navigation.

### Don't:
- **Don't** recreate Azure DevOps forms: avoid cluttered pages, weak hierarchy, and outdated organization patterns for dense authoring flows.
- **Don't** recreate D&D Beyond content creation: avoid brittle creation flows, weak data structure, and poor conditional disclosure.
- **Don't** treat responsive support as secondary: desktop and mobile both need intentional layouts rather than desktop-first leftovers.
- **Don't** use decorative gradients, glassmorphism, or side-stripe card accents as default styling moves.
- **Don't** turn every repeated surface into an identical card grid. Density needs hierarchy, not repetition.
- **Don't** let the app feel like monotonous office software, an admin dashboard, or a chore list.
- **Don't** fake fantasy flavor with parchment, distressed textures, medieval fonts, or novelty controls.
- **Don't** build domain-specific authoring UI unless the domain requires a genuinely distinct interaction that reusable workspace components cannot support.
- **Don't** put app-wide domain navigation inside the structure rail or put structure-step navigation inside Library/Create menus.
- **Don't** use modals as the default answer for nested authoring. Prefer inline editing, focused workspace sections, staged drawers, or route-backed flows.
- **Don't** let Storybook stories rely on fixture-only harnesses for migrated domains when a route-backed story can exercise the real workflow shape.
