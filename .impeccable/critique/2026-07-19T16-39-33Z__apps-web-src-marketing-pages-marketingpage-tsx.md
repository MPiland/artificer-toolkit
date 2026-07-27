---
target: current marketing page
total_score: 23
p0_count: 0
p1_count: 2
timestamp: 2026-07-19T16-39-33Z
slug: apps-web-src-marketing-pages-marketingpage-tsx
---

# Current Marketing Page Critique and Audit

Method: dual-agent (A: /root/current_marketing_design · B: /root/current_marketing_evidence)

Target: `apps/web/src/marketing/pages/MarketingPage.tsx` and its owned marketing components, content, and styles.

## Verdict

The current page is the right foundation. Its palette, typography, tone, responsive behavior, and central value proposition fit Artificer Toolkit much better than the alternative mockups. It does not need another concept reset.

It is not yet launch-ready. The page promises a connected **Create → Connect → Play** workflow, but visually proves only **Create**. The sole product image is a handcrafted authoring-form mockup. The character builder and character sheet—the two screens that make the product proposition distinctive—never appear. That leaves the page clear but under-evidenced.

## Design Health

| Principle                           |     Score | Assessment                                                                                                                                |
| ----------------------------------- | --------: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Visibility of system status         |       2/4 | The mockup shows save state and authoring completion, but there is no proof that authored content reached the builder or sheet.           |
| Match between system and real world |       3/4 | Copy uses real tabletop language and product concepts. The pictured screen is plausible, but simplified.                                  |
| User control and freedom            |       3/4 | Sign-in, signup, theme control, and section navigation are obvious. The marketing journey itself offers only one conversion path.         |
| Consistency and standards           |       3/4 | Palette, type hierarchy, spacing, and CTA treatment are coherent across themes and breakpoints. Repeated card grammar becomes monotonous. |
| Error prevention                    |       3/4 | Claims are mostly specific and credible. Calling the handcrafted mockup “Current Artificer Toolkit” creates an avoidable fidelity claim.  |
| Recognition rather than recall      |       2/4 | The page names Create, Connect, and Play but asks visitors to imagine the latter two states.                                              |
| Flexibility and efficiency          |       2/4 | The page speaks to several audiences, but does not provide a fast proof path for players versus homebrewers.                              |
| Aesthetic and minimalist design     |       2/4 | The hero is controlled and strong. The four-card feature grid and boxed final CTA add a recognizable generated-SaaS scaffold.             |
| Error recovery                      |       2/4 | Not a task-heavy flow, but there is no FAQ, trust/reassurance block, or alternative next step for hesitant visitors.                      |
| Help and documentation              |       1/4 | Product concepts are described, but onboarding expectations and what “free” includes are not explained.                                   |
| **Total**                           | **23/40** | **Solid foundation; major product-proof gap.**                                                                                            |

## Technical Audit

| Dimension         |     Score | Key finding                                                                                                                                                                                        |
| ----------------- | --------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility     |       2/4 | Strong landmarks, heading order, contrast, image labeling, and reduced-motion handling. Missing skip link; custom hash scrolling leaves focus in the header; the mobile brand target is 32px high. |
| Performance       |       3/4 | Static and animation-light, with no marketing image requests. The non-interactive product mockup hydrates roughly 98 JSX nodes and 14 icons.                                                       |
| Theming           |       4/4 | Light and dark themes both render cleanly using shared foundation tokens; sampled contrast passes AA.                                                                                              |
| Responsive design |       3/4 | 1440×900 and 390×844 were inspected live with no horizontal overflow. Mobile composition is strong, but the page becomes long and the brand target misses 44px.                                    |
| Anti-patterns     |       2/4 | Product-specific copy and the forge palette help, but the repeated icon-card grid, stacked kickers, and boxed CTA are familiar landing-page templates.                                             |
| **Total**         | **14/20** | **Good, with focused accessibility and brand work remaining.**                                                                                                                                     |

## Anti-pattern Verdict

**LLM review: fail, moderate template risk.** The hero eyebrow, split hero, three mini highlights, four repeated icon/audience/title/copy cards, bordered final CTA, and bare footer combine into a common generated-SaaS structure. The product-specific writing keeps it from feeling generic end to end, but the middle of the page is less distinctive than the app it represents.

**CLI detector:** 964 findings were emitted because the required command’s trailing `.` widened the scan to generated Storybook output, `.agents`, and `output`. **Zero findings were located in `apps/web/src/marketing/**`; all 964 are out-of-scope contaminants.\*\*

**Live browser detector:** injection succeeded and reported five anti-patterns. Three were false positives on TanStack devtools UI. Two “cramped padding” hits targeted the primary CTAs, but live measurement showed those controls are 44px high, so they are not actionable. Browser visibility remained false after the visibility request, so no reliable user-visible `[Human]` tab is claimed.

## What Is Working

1. **The value proposition is right.** “Create the content, then bring it straight into play” accurately expresses the repo’s Builder/Sheet ownership split and is more specific than generic campaign-management positioning.
2. **The visual system is cohesive.** Forge orange, dark neutral surfaces, bold display type, and high contrast feel like Artificer Toolkit. Both themes retain hierarchy without losing the product identity.
3. **The responsive implementation is deliberate.** The hero, highlights, product mockup, and cards recompose rather than merely shrink. The 390px layout has no horizontal clipping and keeps the CTA readable.

## Priority Issues

### [P1] The central promise is visually unproven

**Why it matters:** A new visitor can see that the app has a structured authoring form, but cannot verify the differentiator: content moves from authoring into a character and then becomes usable at the table.

**Fix:** Use the same named artifact—`Stormbound Strike`—through three real product states:

- Author it in the spell workspace, preferably on **Casting** or **Effects**, where structured authoring is visibly differentiated from a generic form.
- Select or grant it in the **Character Builder**.
- Cast it in the **Character Sheet**, showing the spell/action surface and its slot or resource update.

Keep this to two visual moments: one dominant authoring frame, then one connected Builder → Sheet proof strip. Do not add a separate Library screenshot; that would add volume without proving the core promise.

**Suggested command:** `$impeccable shape`

### [P1] Keyboard navigation lacks a bypass and destination-focus contract

**Why it matters:** There is no skip-to-content link. Activating the custom Features hash link scrolls the custom root but does not move focus to the destination; live keyboard inspection left focus on the header link rather than the feature heading.

**Fix:** Add a focus-visible skip link to `<main>`. Prefer native anchor behavior plus `scroll-margin-top`; if the custom root remains necessary, make the target heading programmatically focusable with `tabIndex={-1}` and focus it after navigation.

**Suggested command:** `$impeccable audit`

### [P2] The current product mockup is close, but not trustworthy enough to label “Current”

**Why it matters:** The mockup captures the broad authoring anatomy, yet several details drift from the current product: text-based Account treatment, simplified save/undo controls, omitted floating action treatment, and a handcrafted preview. Visitors who enter the app will notice the mismatch.

**Fix:** Prefer route-backed captures or compositions made from real production components. If the illustration remains handcrafted, change the label from “Current Artificer Toolkit…” to language that does not make a literal-current-state claim.

**Suggested command:** `$impeccable polish`

### [P2] The feature section looks more generic than the product

**Why it matters:** Four near-identical rounded cards with icon blocks, uppercase audience labels, paragraphs, dividers, and bullets flatten different benefits into one repeated rhythm. It is clear, but not memorable.

**Fix:** Keep the claims, replace the grid with product-specific evidence: the connected Builder → Sheet sequence should carry the player claim; a compact draft/active comparison can carry the creator claim; reference content can become a small supporting proof point rather than another equal card.

**Suggested command:** `$impeccable bolder`

### [P2] Pre-signup reassurance is missing

**Why it matters:** “Start building for free” is decisive, but visitors are not told what they can do immediately, whether the page is aimed at players, homebrewers, or both, or what happens after signup. With pricing disabled, “free” has no nearby qualification.

**Fix:** Add one short reassurance line near the primary CTA based on the real product state—for example, what the user can create first and whether a card is required. Do not invent promises. Keep the optional pricing section disabled until plan boundaries are settled; the page does not need pricing to fix its product-proof gap.

**Suggested command:** `$impeccable clarify`

### [P3] Runtime and mobile polish

**Why it matters:** The mobile brand link measures 32px high while adjacent controls are 44px. The live console also logged two React errors about Mantine `<style>` elements rendered outside the main document; the page still renders, and the source appears app-root/provider-owned rather than marketing-owned.

**Fix:** Expand the brand link hit area to at least 44px. Trace the style-tag warning through the app provider/SSR boundary separately; do not couple that root fix to the marketing redesign.

**Suggested command:** `$impeccable polish`

## Persona Red Flags

**Jordan, first-time tabletop creator:** Understands the headline and CTA, then sees a generic Basics form. Jordan cannot tell how this differs from a form builder or whether the authored spell becomes playable without manual copying.

**Riley, active player:** Reads “Characters stay playable” and “Play,” but never sees the character sheet, action handling, spells, slots, or resources. The page asks Riley to trust the most relevant claim without evidence.

**Casey, experienced homebrewer:** Appreciates structured steps, draft/active language, and locked-master copying. Casey will notice that Basics is the least differentiating authoring step and may question how deep Effects, relationships, and nested rules actually go.

**Avery, accessibility-conscious visitor:** Gets strong contrast, semantic regions, real links, and reduced-motion behavior. Avery still must traverse the sticky header because there is no skip link, and in-page navigation does not announce/focus its destination.

## Cognitive-load Check

Four of eight checks are weak:

- **One clear focus:** the hero says three things but the image proves one.
- **Chunking:** four equal feature cards give unlike benefits identical weight.
- **One thing at a time:** Create, Connect, and Play are introduced simultaneously without a visual sequence.
- **Working memory:** visitors must remember the authoring artifact while imagining its unseen builder and sheet states.

## Minor Observations

- The desktop Features and Sign in links are visually only about 22px high. They pass pointer use but are less forgiving than the 44px primary controls.
- The current footer is legally adequate but emotionally abrupt and offers no secondary trust or product-navigation path.
- The page uses a custom scroll root; this complicates full-page capture, focus management, and native anchor behavior without adding visible product value.
- Pricing is cleanly feature-flagged off. That is the correct state until the plan names and boundaries are confirmed.
- Existing tests cover section visibility, links, hash behavior, and reduced-motion logic, but not axe checks, keyboard destination focus, responsive overflow, or visual regression.
