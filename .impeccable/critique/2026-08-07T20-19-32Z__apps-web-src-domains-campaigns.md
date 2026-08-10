---
target: Campaign management and GM play surfaces
total_score: 18
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 4
timestamp: 2026-08-07T20-19-32Z
slug: apps-web-src-domains-campaigns
---

Method: dual-agent (A: impeccable_critique_a · B: impeccable_critique_b)

## Design Health Score

| #         | Heuristic                           |     Score | Key issue                                                                                      |
| --------- | ----------------------------------- | --------: | ---------------------------------------------------------------------------------------------- |
| 1         | Visibility of system status         |         2 | Session, clock, Encounter, and party state are fragmented across equal-weight panels.          |
| 2         | Match between system and real world |         2 | TTRPG language is strong, but administration forms dominate live-table actions.                |
| 3         | User control and freedom            |         2 | Exit paths exist, but session and Encounter completion lack reassuring recovery or closure.    |
| 4         | Consistency and standards           |         2 | Run Campaign conflicts with GM Screen, and dice uses multiple unrelated interaction patterns.  |
| 5         | Error prevention                    |         2 | Disabled states help, but assignment eligibility and Encounter prerequisites are exposed late. |
| 6         | Recognition rather than recall      |         2 | Major tools are visible, but mobile overflow and secondary controls obscure destinations.      |
| 7         | Flexibility and efficiency          |         1 | Experienced GMs must scroll and operate one actor or panel at a time.                          |
| 8         | Aesthetic and minimalist design     |         2 | Repeated bordered panels, helper copy, and duplicate tools weaken the hierarchy.               |
| 9         | Error recovery                      |         1 | Generic alerts and implementation-shaped errors do not provide a clear recovery path.          |
| 10        | Help and documentation              |         2 | Help copy exists, but it explains implementation more often than the user's next action.       |
| **Total** |                                     | **18/40** | **Poor: the live-play surface needs structural polish before release.**                        |

## Design Specificity Verdict

**Partially specific, structurally generic.** Forge color, campaign vocabulary, privacy roles, the world clock, and Encounter states are unmistakably TTRPG. The composition is still a generic administration dashboard: stacked bordered panels, form rows, explanatory copy, a utility rail, and a form-like chat feed. Product character currently lives in nouns and data rather than the interaction design.

The deterministic scan returned zero findings across `apps/web/src/domains/campaigns`. That is useful evidence that the problems are not the detector's common markup-rule violations; they are higher-level hierarchy, composition, and workflow problems. No reliable visual overlay was available because the required Impeccable live config was absent.

## Overall Impression

The foundation is competent and role-aware, but the GM Screen asks the GM to administer the Campaign while they are trying to run it. The biggest opportunity is to make live state and next actions dominate, then move preparation and record-keeping one interaction away.

## What's Working

- Role privacy is visible and trustworthy: GM, party, table, and direct-message boundaries are understandable.
- Forge color and typography are consistent across desktop and mobile.
- Prepared and active Encounter states already provide the right vocabulary for a build-then-run flow.

## Cognitive Load

Five of eight checks fail: single focus, visual hierarchy, one thing at a time, minimal choices, and progressive disclosure. Campaign management exposes six tabs plus GM Screen, Chat, and Invite. The first GM viewport exposes time setup, session controls, Encounter creation, roster, chat, and dice at equal weight. Expanded Encounter actors expose more than four simultaneous decisions without sequencing.

## Emotional Journey

Campaign identity creates a promising entry moment, then collapses into configuration cards. Starting a session, beginning an Encounter, rolling, and sending an in-character message should be the peaks of live play, but they currently look like ordinary form submissions. Ending a session or Encounter lacks a confident saved-and-complete moment.

## Priority Issues

### P1 · GM Screen behaves like administration

Clock, Encounter, adjustments, notes, roster, and dice compete in one stacked grid. Prioritize live session, persistent clock, active Encounter, and party state. Move preparation and management behind focused entry points. Pair Day with Time and Dawn with Dusk on mobile, with explicit Start and Pause.

### P1 · Chat behaves like a form feed

Messages are identical full-width cards above a conventional form and another dice form. Use a full-height history, self/opposite message bubbles with restrained tails and primary accent, an anchored composer, the voice control inside that composer, and Direct as the final destination. Remove repeated conversation headings and inline dice.

### P1 · Dice is duplicated

The GM Screen and chat each expose their own roller even though the Character Sheet already has the correct floating play pattern. Reuse that interaction on the GM Screen with GM-private and table destinations.

### P1 · Character assignment exposes the wrong choice model

A flat select does not let players recognize their Character or understand eligibility. Replace it with an Add Character modal containing scannable cards and only unassigned, eligible Characters, including useful empty and conflict states.

### P2 · Entry naming and routes obscure Campaign identity

Run Campaign conflicts with the visible GM Screen destination and ID-only URLs are hard to recognize. Use GM Screen consistently and canonical ID-plus-name-slug routes.

## Persona Red Flags

- **Alex, experienced power user:** unrelated panels and duplicate dice slow every live action; no compact path preserves table momentum.
- **Sam, accessibility-dependent user:** horizontal tab overflow hides destinations; icon controls and disabled number inputs need stronger accessible names and focus feedback.
- **Casey, distracted mobile user:** clock fields wrap into unrelated pairs, chat composition is not thumb-anchored, and the quick tools arrive after a long card stack.
- **Mara, live-session GM:** ten seconds between turns is not enough to rediscover current state among preparation forms and record-keeping panels.

## Minor Observations

- Full locale timestamps compete with message content.
- Edit and Unsend are permanently visible under every authored message.
- Empty roster and Encounter states consume space without a strong recovery action.
- Conditions and resources expose JSON rather than tabletop concepts.

## Questions to Consider

- If a GM has ten seconds between turns, which three facts or actions must never leave the viewport?
- Should prepared Encounters act as an ordered session queue feeding one focused active Encounter?
- What visual and behavioral moment should make ending a session feel complete and trustworthy?
