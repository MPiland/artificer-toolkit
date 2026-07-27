---
target: current main marketing page
total_score: 22
p0_count: 1
p1_count: 2
timestamp: 2026-07-19T13-42-10Z
slug: apps-web-src-marketing-pages-marketingpage-tsx
---

Method: dual-agent (A: /root/marketing_critique_design · B: /root/marketing_critique_evidence)

## Design Health Score

| #         | Heuristic                       |     Score | Key issue                                                                 |
| --------- | ------------------------------- | --------: | ------------------------------------------------------------------------- |
| 1         | Visibility of System Status     |       2/4 | Static page offers little location or state feedback                      |
| 2         | Match System / Real World       |       3/4 | Strong RPG language, but SRD and play-state need context                  |
| 3         | User Control and Freedom        |       3/4 | Standard links and clear return paths                                     |
| 4         | Consistency and Standards       |       2/4 | Fabricated mockup navigation conflicts with the real Library/Create shell |
| 5         | Error Prevention                |       2/4 | Copy does not separate shipped capability from roadmap claims             |
| 6         | Recognition Rather Than Recall  |       3/4 | Main actions are visible and the story is linear                          |
| 7         | Flexibility and Efficiency      |       2/4 | No demo or deeper proof path for evaluating the product                   |
| 8         | Aesthetic and Minimalist Design |       2/4 | Clean, but generic and card-heavy                                         |
| 9         | Error Recovery                  |       2/4 | Little page-local support or recovery guidance                            |
| 10        | Help and Documentation          |       1/4 | No visible help, FAQ, docs, or contact path                               |
| **Total** |                                 | **22/40** | **Acceptable; significant trust and differentiation work remains**        |

## Anti-Patterns Verdict

**LLM assessment:** High AI-slop risk. The page follows familiar generated-SaaS grammar: pill eyebrow, oversized hero, tilted fake app mockup, three micro-highlights, an icon-heading-copy card grid, and a rounded final CTA panel. Forge orange, the system type stack, and the avoidance of parchment preserve product coherence, but there is no distinctive tabletop artifact or visual point of view.

**Deterministic scan:** The CLI detector returned `[]` with exit code 0 for `apps/web/src/marketing/pages/MarketingPage.tsx`: zero findings, rules, or file locations. This is useful but narrow. The principal problems are cross-file composition, CSS contrast, synthetic proof, and claim accuracy, which the page-level syntax scan did not detect. No false positives were present.

**Visual overlays:** No reliable overlay is available. The independent browser pass reached `http://localhost:3000/`, but the route returned HTTP 500 because SSR could not find `MantineProvider`. The detector script endpoint was consequently unreachable and emitted no Impeccable console events.

## Overall Impression

The page has a strong core proposition—create content, connect it to a character, use it in play—but it asks visitors to trust claims that the visual proof does not substantiate. The largest opportunity is to replace the generic feature-card narrative and fabricated shell with one authentic, current create-to-play workflow.

## What's Working

- **Create → Connect → Play** clearly expresses the product loop and is worth preserving.
- The page shares Forge tokens, logo, system typography, and control geometry with the authenticated product.
- Pricing is already a clean optional module: navigation, hero link, and section visibility are coupled and test-covered.

## Priority Issues

### [P0] The current marketing route does not render through the documented dev path

**Why it matters:** The independent browser pass received HTTP 500 from `http://localhost:3000/`. The documented `yarn dev` server logged that SSR could not find `MantineProvider`, so the live page could not be viewed or used in this environment.

**Fix:** Diagnose the guest-root provider composition before implementing or visually validating the redesign. Keep this separate from the mockup decision unless the same provider seam is touched later.

**Suggested command:** `$impeccable audit`

### [P1] Marketing promises exceed shipped capability

**Why it matters:** Campaign prep, encounters, sharing, and table-facing workflow claims do not trace to current routes. The mockup also shows Campaigns and sharing language while the real overhaul uses Library/Create navigation. A visitor who signs up for DM workflows will feel misled.

**Fix:** Keep categorical copy to working authoring domains, character building, and play surfaces. Remove campaign/encounter/sharing claims or label them as roadmap. Base product imagery on the real shell.

**Suggested command:** `$impeccable clarify`

### [P1] Small accent and muted text fail light-theme contrast

**Why it matters:** Several 11–12px labels use Forge Orange or muted gray on near-white surfaces. Source-based contrast calculations found orange/white at 2.52:1 and muted copy around 2.8–2.9:1, below WCAG AA.

**Fix:** Use the darker text-accent token for small orange text, promote muted labels to secondary text, and verify every label/background pair at desktop and mobile.

**Suggested command:** `$impeccable audit`

### [P2] The page asserts value instead of proving it

**Why it matters:** Structured authoring, draft/master separation, and Builder-to-Sheet continuity are the differentiators, but they appear only as synthetic UI fragments. The preview does not match the current product shell.

**Fix:** Show one authentic authoring step flowing into one authentic play result. Use realistic content and current Library/Create conventions rather than a decorative dashboard montage.

**Suggested command:** `$impeccable craft`

### [P2] Mobile treatment preserves too much desktop chrome

**Why it matters:** The mockup retains an 88px rail and multiple stacked surfaces at narrow widths, while several links and the theme control are only 36px. That creates scanning and touch friction for phone users.

**Fix:** Art-direct a mobile-specific proof crop around one task, remove decorative chrome, and use 44px minimum actionable targets.

**Suggested command:** `$impeccable adapt`

### [P2] The ending repeats the CTA without resolving trust

**Why it matters:** The emotional peak arrives in the hero, the middle becomes a proof valley, and the final CTA still does not say what works today or what happens after signup. The copyright-only footer reinforces the unfinished feeling.

**Fix:** End with concise current-capability reassurance and a lightweight help, status, or contact path. Keep pricing optional; the narrative must work without it.

**Suggested command:** `$impeccable clarify`

## Persona Red Flags

- **Jordan, first-timer:** SRD, homebrew, and play-state appear without explanation; the synthetic UI does not show the first real action; there is no visible help path.
- **Riley, stress tester:** Campaign, encounter, and sharing claims do not trace to routes; mockup navigation differs from the shipped shell; dormant pricing needs revalidation before activation.
- **Casey, distracted mobile user:** 36px controls and a desktop-style proof montage create reach and scanning friction.
- **Morgan, serious homebrew creator:** The structured-authoring promise is compelling, but no authentic nested-authoring example proves complex rules remain understandable.
- **Avery, table-focused player or DM:** Character-sheet value is credible, while campaign/table-support language currently overpromises.

## Minor Observations

- Non-interactive feature cards lift on hover and look clickable.
- Repeated uppercase labels and pill kickers reinforce the template feel.
- Reduced motion covers smooth scrolling but not the card hover transform.
- Headings lack balanced/pretty wrapping.
- The optional billing cadence control is visually toggle-like but not interactive; revalidate it before pricing is enabled.

## Questions to Consider

- If every campaign-related sentence disappeared, would the shipped product still feel compelling enough to sign up for?
- Why fabricate a product shell when the real authoring workspace and character sheet are the differentiators?
- What single authentic tabletop artifact can prove “create it, then play it” in one glance?
- Should the final CTA state exactly what users can create today and reserve everything else for a labeled roadmap?
