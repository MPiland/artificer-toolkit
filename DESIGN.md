---
name: Artificer Toolkit
description: Playful tabletop RPG creation and reliable play across web, iOS, and Android.
colors:
  primary: '#ec8c06'
  primary-hover: '#f97316'
  primary-deep: '#c95704'
  primary-active: '#b84a04'
  primary-contrast: '#241002'
  primary-dark: '#ec8c06'
  secondary-accent: '#0891b2'
  secondary-accent-dark: '#6bd8cb'
  warm-accent: '#ec8c06'
  text-strong: '#151b20'
  text-muted: '#55626d'
  border-subtle: '#d7dbe4'
  surface-canvas-light: '#f7f9fb'
  surface-panel-light: '#ffffff'
  surface-subtle-light: '#eef2f6'
  surface-canvas-dark: '#101315'
  surface-panel-dark: '#171a1d'
  surface-subtle-dark: '#141719'
  surface-sidebar-dark: '#121517'
  surface-header-dark: '#07090b'
  surface-raised-dark: '#262a2f'
  success: '#2f9b63'
  warning: '#8a5a00'
  danger: '#c15336'
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: '4rem'
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: '0'
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: '2rem'
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: '0'
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: '1.5rem'
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: '0'
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', sans-serif"
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: '0'
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', sans-serif"
    fontSize: '0.75rem'
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: '0'
rounded:
  sm: '4px'
  md: '8px'
  lg: '12px'
  xl: '16px'
  xxl: '24px'
  pill: '9999px'
spacing:
  xs: '8px'
  sm: '12px'
  md: '16px'
  lg: '24px'
  xl: '32px'
  xxl: '48px'
  hero: '64px'
components:
  button-primary:
    backgroundColor: 'light: {colors.primary}; dark: transparent'
    borderColor: 'light: {colors.primary-deep}; dark: {colors.primary-dark}'
    textColor: 'light: {colors.primary-contrast}; dark: #ffb690'
    rounded: '{rounded.md}'
    padding: '0 20px'
    height: '40px'
  button-primary-hover:
    backgroundColor: 'light: {colors.primary-hover}; dark: rgba(236, 106, 6, 0.18)'
    textColor: 'light: {colors.primary-contrast}; dark: #ffb690'
    rounded: '{rounded.md}'
    padding: '0 20px'
    height: '40px'
  button-secondary:
    backgroundColor: '{colors.surface-panel-light}'
    textColor: '{colors.text-muted}'
    rounded: '{rounded.md}'
    padding: '0 20px'
    height: '40px'
  input-default:
    backgroundColor: '{colors.surface-panel-light}'
    textColor: '{colors.text-strong}'
    rounded: '{rounded.md}'
    padding: '8px 12px'
    height: '40px'
  card-surface:
    backgroundColor: '{colors.surface-panel-light}'
    textColor: '{colors.text-strong}'
    rounded: '{rounded.lg}'
    padding: '24px'
  nav-pill-active:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface-panel-light}'
    rounded: '{rounded.md}'
    padding: '12px 12px'
---

# Design System: Artificer Toolkit

## Overview

**Creative North Star: "Forge Clarity, Reliable Play"**

Artificer Toolkit is a product UI first, but it should not feel like office software. It is not trying to look like a marketing site dressed up as an app, and it is not trying to romanticize complexity. The system is built around one idea: serious tabletop authoring work should feel clear, reliable, and fun to return to, even when the underlying data model is dense. The interface should feel like a creative RPG tool that helps people build things for play, not like a rigid workbench or an enterprise form system.

The canonical creation surface is the Authoring Workspace. It is form-backed, but it should never feel like a long generic form. The experience is modular content configuration: the app shell handles Library and Create navigation, the authoring structure rail handles the current item only, the editor canvas focuses the active step, the preview/context rail shows supporting output, and drawers stage complex row or group edits before they mutate draft data.

The Character Sheet is the runtime counterpart: modern, compact, and play-first. Its default view exposes current state and the facts needed to choose and resolve an action. Long descriptions, source provenance, customization, and management remain immediately available through focused overlays without competing for permanent space.

The visual language is structured, but not monotonous. A Forge surface system gives dense authoring screens a calmer foundation: black and charcoal carry dark mode, crisp white and cool gray carry light mode, forge orange identifies primary action and craft momentum, and teal stays reserved for focus and technical state. Neutral surfaces still carry most dense work, but they should be composed with rhythm, contrast, and moments of personality. Color is used to orient, confirm, reward, and prioritize. On native clients, Forge identity maps through platform-native color roles, typography, navigation, controls, materials, and motion rather than recreating web components. The system rejects cluttered form pages, decorative gradients as a default move, and dense authoring screens that reveal everything at once.

This system explicitly rejects the anti-references captured in [PRODUCT.md](PRODUCT.md): Azure DevOps form clutter, D&D Beyond content-creation brittleness, and any UI that treats responsive support as secondary. Desktop and mobile are equal citizens.

**Key Characteristics:**

- Playful, not gimmicky
- Clear, not bureaucratic
- Familiar, not generic
- Creative, not ornamental
- Dense when needed, but always navigable
- Modern, compact, and play-first
- Dual-theme by design, not as an afterthought
- Modular content authoring, not admin CRUD
- Form-backed, but not form-shaped

## Colors

The palette is identity-led and task-aware. Black Forge uses near-black canvas and charcoal panels; White Forge uses white, cool gray, and crisp ink. Forge Orange is the main brand/action color for primary CTAs, active creation states, draft/progress moments, and dice/data highlights. Teal is secondary and functional: focus rings, technical selection, and supportive navigation. Purple stays rare for arcane emphasis. The app should not become blue-on-blue or monochrome by habit: use controlled accent moments to make creation feel alive, especially in onboarding, empty states, progress cues, domain headers, and playful feedback.

The frontmatter records current web primitives. Native implementations preserve the roles, not the raw hex application: iOS uses semantic system colors and one Forge tint; Android maps Forge identity through Material 3 color roles with a tested static fallback when Dynamic Color is enabled.

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
- **Night Canvas** (`#101315`): Dark-theme page canvas and recessed working field.
- **Forge Panel** (`#171a1d`): Dark-theme card, sheet, and working-panel surface.
- **Night Header** (`#07090b`): Dark-theme app header; a cooler near-black frame keeps the global shell visually behind the authoring workspace.
- **Raised Iron** (`#262a2f`): Dark-theme lifted surface for active panels, compact drawers, and strong section headers.

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

Web uses the recorded SF Pro/Segoe UI system stack. Native clients use platform type roles and user scaling: Dynamic Type and San Francisco on iOS/iPadOS, and the Material type scale with Roboto on Android. Do not hard-code web sizes into native screens.

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

## Layout

Artificer Toolkit uses responsive composition and deliberate density rather than one universal grid. Authoring surfaces make structure and progression legible; play surfaces optimize recognition and action speed. Space is a functional resource: a region, wrapper, or persistent control must improve hierarchy, comparison, navigation, or interaction to earn its footprint.

### Character Sheet Play Surfaces

- **Play-first hierarchy:** Keep current state, legal actions, availability, and the facts needed to resolve those actions visible. Move long descriptions, source references, provenance, customization, and infrequent management into a focused inspector, popover, or drawer.
- **Compact repeated data:** Prefer aligned, repeatable columns and divider-separated rows when players compare the same facts across actions, spells, equipment, or other collections. Use cards for meaningful group boundaries or standalone interactions, not for every list item.
- **Minimal supporting copy:** Do not repeat self-evident panel descriptions or metadata. Quiet subtext may disambiguate a source or state when it materially changes a play decision.
- **Consistent parsing:** Comparable facts keep the same order, alignment, label treatment, and unit presentation within a collection. Compact does not mean cramped; hit targets, focus treatment, and text remain accessible.
- **One scroll owner:** Each visible region has one deliberate same-axis scroll owner. Do not nest a scrolling list inside a page or panel already intended to scroll that list.

### Responsive Composition

- Desktop, tablet landscape, tablet portrait, and phone layouts are composed for their available space rather than mechanically collapsed from desktop.
- Focused Sheet inspectors overlay the play surface. Desktop and tablet normally use a right-side inspector; phones use a bottom or full-height sheet. A small, local management task may use a popover where space and input behavior support it.
- Opening an inspector must not resize the underlying Sheet or create a second competing content column. Preserve the user's visual position and return focus to the invoking control when the overlay closes.
- Native clients preserve the same information hierarchy while using platform navigation and modality. iOS keeps safe areas, system navigation stacks, edge-swipe Back, sheets, and `44pt` touch targets; Android uses size-aware Material navigation, predictive Back, window insets, and `48dp` touch targets.

### Named Rules

**The Play-First Rule.** If information does not help the player understand current state, choose an action, or resolve it now, keep it one interaction away instead of permanently occupying the play surface.

**The Space Must Earn Itself Rule.** Extra wrappers, repeated headings, decorative containers, and explanatory copy are not neutral; remove them unless they clarify structure or interaction.

**The One-Scroll-Owner Rule.** A user should never have to discover which of two nested regions will move for the same gesture.

## Elevation & Depth

Elevation is restrained, structural, and stateful. Repeated cards and working panels remain flat at rest; borders and tonal layering establish their hierarchy in both Forge themes. Compact shadows are reserved for controls that physically float above the workspace, while the focus halo communicates keyboard and selected-input state.

### Shadow Vocabulary

- **Card** (`none`): Repeated cards and panels rely on surface contrast and borders at rest.
- **Card Hover** (`none`): Hover state uses color and border changes instead of decorative lift.
- **Floating Control** (`0 6px 8px rgba(0, 0, 0, 0.22)`): Floating authoring actions that must remain distinct from content beneath them.
- **Focus Halo** (`0 0 0 4px rgba(14, 165, 197, 0.24)`): Keyboard focus and selected-input emphasis.

### Named Rules

**The Flat-at-Rest Rule.** Resting content stays quiet. Elevation appears when a surface genuinely needs separation or interaction state.

## Shapes

The Forge form language uses gently rounded working geometry, crisp dividers, and restrained borders. Standard controls use medium corners (`8px`), grouped working surfaces use larger corners (`12px`), major framed surfaces may use extra-large corners (`16px`–`24px`), and circular controls use the pill radius. Repeated data rows normally rely on rules and alignment rather than individually rounded containers.

Web shapes come from the shared radius scale. Native implementations map the same restrained character through platform components and shape systems: do not force web radii onto iOS sheets, Android Material surfaces, switches, dialogs, or navigation.

## Components

### Buttons

- **Shape:** Softly rounded, not pillowy (`8px` default, `12px` on certain auth CTAs).
- **Primary:** Light mode uses an orange fill with Anvil Contrast text. Dark mode uses a transparent surface, orange outline, and warm accent text to avoid a visually dominant solid block. Both are `40px` tall with medium-to-bold text and compact horizontal padding (`20px`). This is for the main task on a surface, not every action in sight.
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

- **App Shell:** Signed-in desktop and tablet landscape use a top header with brand, breadcrumb context, Library and Create menu buttons, direct Social Hub navigation, search, theme, and account. Library and Create are separate menus because browsing and starting new content are different intents. Signed-out pages use the marketing/auth header and do not render signed-in app navigation.
- **Mobile App Navigation:** Mobile and tablet portrait use a sticky app footer for Library, Create, Social, Search, and Account. Search opens a bottom drawer; account uses the same menu actions as desktop. The mobile footer is app-wide navigation and must never appear on desktop.
- **Structure Rail:** The rail belongs to the current authoring item only. It shows the step hierarchy, active step, child steps for the active branch, completion/dirty/warning markers, and the contextual footer summary. It is not a domain library, not a sidebar replacement, and not a place for global Create actions.
- **Rail Behavior:** At wide desktop (`>=1280px`), the Structure rail and useful Preview rail stay inline for the whole authoring session; they are the studio composition, not optional chrome. Smaller widths use the existing drawer pattern for both rails, and those overlays start closed.
- **Active State:** Active authoring rows use orange text and a restrained left fill/marker. Avoid loud full-row fills unless needed for clarity.

### Empty / First-Run States

- **Style:** Empty states should feel like invitations, not blank admin pages. Use the domain icon, concise copy, and one clear next action.
- **Tone:** Speak to the creative outcome: "Create your first spell" is better than "No records found."
- **Constraint:** Do not use mascot-heavy, joke-heavy, or decorative-only empty states. Delight should point toward action.

### Social Hub

- **Purpose:** Help authenticated users 13 and older find or form a free table without exposing the private Campaign behind it.
- **Composition:** Use the existing app Shell. Discovery keeps search visible and moves secondary filters into one focused drawer at every breakpoint, grouped into collapsible Game style, When & where, and Table needs sections. Omit explanations that merely restate a control's behavior. Keep the active-filter count and one page scroll owner. Listing rows remain information-dense and readable rather than becoming a generic card framework.
- **Information hierarchy:** Lead with the Campaign-derived title, format, tone, maturity, system, play mode, schedule, location scope, and available seats. Expectations and safety practices belong in clearly labelled sections on detail and hosting forms; they are not decorative tags.
- **Hosting form:** Select an owned Campaign once; do not ask for a duplicate listing title, table type, tone, maturity, or language. Show city and state only for in-person or hybrid play, and clear them when play becomes online. One-shot schedules offer flexible or one-time choices only.
- **Privacy:** Public Social surfaces show only the Social profile ID and username. Never display or encode Campaign IDs, account IDs, email, bio, exact venue, application text, report evidence, or invitation credentials in routes or listing projections.
- **Maturity preference:** User settings default to Standard. Selecting Mature opens an 18+ self-attestation when none is on file; the date field explains that the birth date is used once and not stored. The preference changes server-side Social presentation, not Campaign maturity or authorization.
- **Interaction:** URL state owns the `discover`, `applications`, `invitations`, and `hosting` views. Desktop uses a single active underline with text-only hover treatment; mobile replaces the tab row with a current-view control and bottom navigation drawer. My applications is the applicant-owned status and withdrawal inbox; GM review remains scoped to each hosted table through directly addressable `Listing details` and `Applications` views. Social Hub is a direct destination in the desktop Shell header and mobile app footer. Social posting stays out of the global Create menu; an eligible host uses the persistent `New Post` action in Social Hub. Mutations announce success or failure, return focus after drawers, and preserve keyboard, reduced-motion, contrast, and light/dark theme behavior.
- **Tone:** Table formation should feel welcoming and practical. Use the Forge palette and strong editorial hierarchy without parchment, fantasy novelty controls, glass effects, or an admin-dashboard grid.

### Motion

- **Style:** Motion should be brief and stateful: reveal a next section, confirm a save, open a drawer, or acknowledge progress.
- **Timing:** Most transitions stay in the `150ms-250ms` range with ease-out curves.
- **Constraint:** No decorative page-load choreography. Users are here to create and play.

### Authoring Workspace

- **Visual Thesis:** Authoring is a dense creative studio, not a generic form floating in empty space. Wide desktop is an edge-to-edge composition of near-black structural panels, hairline borders, restrained orange lifecycle accents, and teal authored-output accents.
- **Structure:** The workspace is a layered document header, Structure rail, bounded editor stage, useful Live output rail, and structural action dock. At wide desktop, both rails are present whenever the preview adds useful output; the editor stage stays centered and bounded between them. Below that threshold, rails become contextual drawers. The editor canvas owns the current step.
- **Surface Hierarchy:** Rails and editor meet edge-to-edge. Header bands, the active-step banner, the working section, and the bottom dock create hierarchy through surface shifts and rules rather than isolated floating cards or large empty gutters.
- **Foundation Roles:** The shared design system owns the semantic authoring palette for canvas, rail, band, document header, panel, preview, row, active state, dock, recessed field, field stroke, structural border, and notice surfaces in both themes. Authoring components consume those roles through the web foundation contract rather than choosing generic surfaces or local color values.
- **Black Forge Reference Values:** Dark surfaces use the measured mockup palette: app header `#07090b`; band and document header `#101214`; canvas and recessed fields `#101315`; rail `#121517`; row `#141719`; preview sheet `#15181a`; panel, active banner, and dock `#171a1d`; notice `#191917`; field stroke `#343a40`; structural rules `rgba(255, 255, 255, 0.07)`. The app-wide surface roles and authoring-specific roles derive from the same shared Black Forge scale so authoring, reference, Builder, and Sheet surfaces keep one brand foundation while preserving their semantic composition.
- **Structure Rows:** Top-level steps are authored rows with real semantic destinations such as Basics, Effects, Grants, and Features; do not add a generic Mechanics bucket around those modules. Charges and restrictions stay with the Basics destination of their owning source. Step numbers are omitted because order and hierarchy already communicate sequence. A populated collection heading navigates to its overview, while its chevron expands or collapses children without navigation; do not add a redundant Overview child. The active row may use a restrained orange-to-iron gradient that reads as forge light rather than a loud fill. Nested navigation remains visibly hierarchical and denser so deep collection targets stay scannable without imitating another top-level step.
- **Editor Sections:** Sections share one bounded working panel and use subtly inset horizontal rules to mark transitions. Pair short, independent fields and keep collections scannable as edge-to-edge compact ledgers whose rows touch and share hairline boundaries; reserve full rows for prose, rich text, or structurally wide content. Section headings keep a compact inset while comparable row data uses the available width.
- **Field Layout:** Use responsive Mantine-backed controls styled through vanilla-extract. Field grids should collapse by content need, not by arbitrary copied dimensions. Numeric inputs use Mantine `NumberInput` with controls hidden where spinner arrows make the row feel noisy.
- **Row Modules:** Repeated modular rows should support scanning first, editing second. Wide layouts may allow inline editing for existing rows. Add actions sit as the final, left-aligned ledger row and open a staged drawer so accidental adds do not mutate draft data.
- **Staged Drawer:** Drawers stage add/edit changes and require explicit commit actions such as `Add tier` or `Save tier`. Cancel closes the drawer and discards the staged draft. Mobile portrait uses a minimal-height bottom drawer; mobile landscape and tablet can use the drawer pattern that best preserves reach and readable fields.
- **Context / Preview:** Live output reads as one subtly warm, opaque sheet-like artifact with the real item identity and internally divided sections, not a loose stack of unrelated cards. Equipment identity combines a category-aware placeholder visual, title metadata, compact stats including weight and value when available, and flowing prose; charges use the same label/value row rhythm (`Uses`, `Resets`) rather than a chip. Do not add redundant headings such as "Item Snapshot" or "Description." Preview content should render the authored output users will see after activation. Avoid generic "outcome context" cards unless the active step genuinely has an outcome to summarize.
- **Progress and Actions:** The Structure rail footer is the single progress summary. Do not duplicate progress in the editor dock. Wide desktop uses a compact dock with clearly labelled Back and Next actions; compact actions remain above the app footer and never replace app navigation.

### Character Sheet Inspectors

- **Purpose:** Inspectors reveal Sheet detail, calculation provenance, customization, and focused management while preserving the compact play surface underneath.
- **Geometry:** Use one overlay inspector at a time. Desktop and tablet use the right edge by default; phone uses a bottom or full-height sheet. The client owns geometry and responsive composition.
- **Interaction:** Sheet toggles, additions, removals, resource use, and discrete state changes persist immediately. Text and numeric edits commit on blur or Enter. Do not add a general Sheet Save action; staged rest configuration remains an explicit exception.
- **Separation from authoring:** A Sheet inspector is immediate play-state interaction, not an Authoring Workspace staged drawer. Reuse accessible overlay infrastructure without merging their commit semantics.

### Storybook Review Surface

- **Component Stories:** Small reusable components use inline minimal data and decorators for visual framing.
- **Composite Stories:** Shell and authoring workspace stories compose the real components and should not use custom story-only CSS that hides layout bugs.
- **Route-Backed Stories:** Migrated domains should get a route-backed Storybook story before visual sign-off. Use mocked auth/data behavior rather than real Better Auth login.
- **Controls:** Stories should expose useful controls for theme, active step, responsive mode, dirty/valid/error state, drawer opened state, and preview presence when those controls help inspect UI behavior.

### Theme Toggle

- **Style:** Circular `40px` control with panel fill and a subtle border; it remains flat at rest.
- **State:** Dark-mode active state uses a soft accent fill plus border so the mode feels chosen, not merely switched.

### Mantine-First Implementation

- **Default:** Use Mantine components where they provide accessible behavior, keyboard support, focus management, or cross-browser interaction patterns out of the box.
- **Best Fit:** Prefer Mantine for buttons, inputs, selects, segmented controls, menus, drawers, modals, tooltips, tables, layout helpers, notifications, and overlays.
- **Styling:** Keep vanilla-extract and the existing CSS layer strategy as the product styling layer. Mantine supplies behavior and accessible structure; app CSS supplies the Artificer visual system.
- **Exception:** Use semantic HTML directly when the element is static, simpler than a Mantine abstraction, or when Mantine would make the structure less faithful to Figma.

### Native-First Implementation

- **iOS / iPadOS:** Use native navigation stacks, tab bars, sheets, action sheets, pickers, switches, steppers, context menus, Dynamic Type, SF Symbols, and system materials. Preserve the edge-swipe Back gesture and safe areas.
- **Android:** Use Material 3 navigation appropriate to window size, top app bars, sheets, dialogs, switches, chips, snackbars, predictive Back, edge-to-edge insets, and Material motion.
- **Shared boundary:** Reuse backend semantics, rules, authorization, command contracts, and information hierarchy. Do not share web component geometry or substitute a WebView for a native product surface.
- **Accessibility:** Respect Reduce Motion on Apple platforms, Remove animations on Android, system font scaling, contrast preferences, and platform minimum touch targets.

## Do's and Don'ts

### Do:

- **Do** make authored screens feel creative and approachable, with enough structure to stay readable.
- **Do** use orange for primary action and craft momentum, teal for focus and technical state, and selective secondary accents for domain identity or progress where helpful.
- **Do** preserve the same information hierarchy across light and dark themes.
- **Do** use framed surfaces only when they clarify structure or interaction.
- **Do** make desktop and mobile layouts feel intentionally composed, not mechanically collapsed.
- **Do** preserve Forge identity on native through platform roles and interaction patterns rather than copied web controls.
- **Do** make Character Sheet collections compact, consistently aligned, and optimized for at-a-glance play.
- **Do** keep ancillary descriptions, references, provenance, and customization available through focused overlays.
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
- **Don't** ship native clients that feel like the website inside a wrapper or like one mobile platform wearing the other's controls.
- **Don't** use decorative gradients, glassmorphism, or side-stripe card accents as default styling moves.
- **Don't** turn every repeated surface into an identical card grid. Density needs hierarchy, not repetition.
- **Don't** make play surfaces compete with long descriptions, redundant summaries, or infrequent management controls.
- **Don't** nest same-axis scrolling regions or resize the Sheet when a focused inspector opens.
- **Don't** let the app feel like monotonous office software, an admin dashboard, or a chore list.
- **Don't** fake fantasy flavor with parchment, distressed textures, medieval fonts, or novelty controls.
- **Don't** build domain-specific authoring UI unless the domain requires a genuinely distinct interaction that reusable workspace components cannot support.
- **Don't** put app-wide domain navigation inside the structure rail or put structure-step navigation inside Library/Create menus.
- **Don't** use modals as the default answer for nested authoring. Prefer inline editing, focused workspace sections, staged drawers, or route-backed flows.
- **Don't** let Storybook stories rely on fixture-only harnesses for migrated domains when a route-backed story can exercise the real workflow shape.
