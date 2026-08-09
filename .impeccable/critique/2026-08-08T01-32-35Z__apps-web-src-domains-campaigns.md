---
target: Campaign and Session pages
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-08T01-32-35Z
slug: apps-web-src-domains-campaigns
---
Method: dual-agent (A: impeccable_campaign_assessment_a_retry · B: impeccable_campaign_assessment_b)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 2 | Session and Encounter states are visible, but the live turn did not dominate the workspace. |
| 2 | Match between system and real world | 2 | Strong tabletop language was undermined by template, run, actor, and CRUD terminology. |
| 3 | User control and freedom | 2 | Exit and lifecycle actions existed, but Open and Edit split one conceptual destination. |
| 4 | Consistency and standards | 2 | Rows, cards, and actions used multiple competing interaction patterns. |
| 5 | Error prevention | 2 | Disabled states helped, but Encounter prerequisites and attendance remained visually secondary. |
| 6 | Recognition rather than recall | 2 | Destinations were visible on desktop, while mobile tabs clipped important sections. |
| 7 | Flexibility and efficiency | 2 | Common actions were available, but repeated panels and duplicate row actions slowed scanning. |
| 8 | Aesthetic and minimalist design | 2 | Repeated borders, helper copy, and the trailing Session divider weakened the hierarchy. |
| 9 | Error recovery | 2 | Existing recovery paths were serviceable but still relied on generic messages. |
| 10 | Help and documentation | 2 | Helper copy existed, but some of it described implementation instead of the next GM action. |
| **Total** | | **20/40** | **Usable foundation; hierarchy and interaction semantics needed a focused polish pass.** |

## Design Specificity Verdict

**Product-specific in language, generic in composition.** The Forge palette, campaign clock, Session lifecycle, and Encounter state are unmistakably tabletop-oriented. The main weakness was an admin-dashboard interaction model: equal-weight panels, duplicated actions, and implementation terminology made the GM interpret the system instead of following the table workflow.

The deterministic scan returned zero findings across `apps/web/src/domains/campaigns`; the issues were compositional rather than common markup-rule violations.

## Overall Impression

The revised Campaign architecture is directionally right: Campaign management is the GM workspace, Sessions hold preparation and live Encounter runs, and chat stays in its drawer. The UI still needed one more pass to make each Session row one destination, distinguish planning from live play, and give mobile an intentional navigation pattern.

## What's Working

- Campaign identity, world time, privacy roles, and Session state are legible.
- Chat now feels like chat rather than an embedded administration form.
- Encounters are attached to Sessions and preserve a reusable build-then-run flow.
- The visual system is consistent with the existing Forge register.

## Cognitive Load

Four of eight checks failed before polish: single focus, hierarchy, minimal choices, and progressive disclosure. The largest avoidable costs were the Open/Edit split, nested bordered panels, an ambiguous Encounter count, and equal emphasis across preparation and turn controls.

## Emotional Journey

The Campaign header establishes ownership and continuity well. The Session list then became procedural, and the Encounter view felt like another form. The intended peak is a clear transition from preparation into live turn management; the current-turn actor and sole primary Advance action should carry that moment.

## Priority Issues

### P1 · Open and Edit describe the same Session destination

Make the whole Session row open its workspace. Move detail editing into that workspace, and reserve the row overflow menu for lifecycle actions such as Finish or Reopen.

### P1 · Live Encounter hierarchy is too weak

Auto-select the active Encounter, make Advance turn the sole primary action, move Complete behind an overflow action, and mark the current combatant without flooding its expanded editor with accent color.

### P1 · Mobile Campaign navigation clips destinations

Replace the overflowing horizontal tab rail with an explicit Campaign section selector at compact breakpoints.

### P2 · Planning and live controls share too much card chrome

Use two compact planning panels for attendance and adding an Encounter, then one integrated Session encounters surface. Remove nested panel borders and ambiguous count badges.

### P3 · The final Session row leaves a trailing divider

Apply separators only between rows. The final item should terminate cleanly against the panel padding.

## Persona Red Flags

- **Mara, live-session GM:** duplicate Session actions and equal-weight controls interrupt table momentum.
- **Alex, experienced power user:** implementation labels and nested panels slow recognition of the next action.
- **Sam, accessibility-dependent user:** clipped mobile tabs hide destinations; a labeled section selector is easier to discover and operate.
- **Casey, distracted mobile user:** stacked controls need clear grouping and no horizontal overflow.

## Questions to Consider

- When a Session is open, should its title and date remain editable until it is finished?
- Should the active Encounter always pin itself above prepared Encounters when a Session contains several?
- What completion summary should a finished Session preserve for historical review?

## Run Notes

- Target slug resolved to `apps-web-src-domains-campaigns`.
- No critique ignore file was present.
- Assessment A used rendered desktop and mobile Campaign/Session evidence plus source inspection.
- Assessment B verified routes and ran the deterministic detector; the detector returned zero findings.
