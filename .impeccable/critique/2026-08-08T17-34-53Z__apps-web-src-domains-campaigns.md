---
target: Campaign and connected play surfaces
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 5
timestamp: 2026-08-08T17-34-53Z
slug: apps-web-src-domains-campaigns
---
Method: dual-agent (A: campaign_web_now · B: encounter_gap_now)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Session, turn, unread, save, and lifecycle state are visible; a few nested overlays obscure where focus will return. |
| 2 | Match between system and real world | 2 | Raw serialized movement data and actionable attacks labelled as traits break the GM mental model. |
| 3 | User control and freedom | 3 | Most overlays and destructive actions have exits, but mobile dice cannot reach Roll and stacked notes can close the underlying Sheet. |
| 4 | Consistency and standards | 3 | Campaign notes are editable on the Campaign page but read-only in the Sheet drawer, despite one agreed permission model. |
| 5 | Error prevention | 3 | Destructive Session and Encounter paths are guarded; Campaign-note authority remains too permissive. |
| 6 | Recognition rather than recall | 3 | Prepare, Run, Closeout, conversations, and roster states are discoverable; unassigned members disappear from the GM roster. |
| 7 | Flexibility and efficiency | 3 | GM and player paths are direct on desktop, but mobile dice and chat actions are obstructed. |
| 8 | Aesthetic and minimalist design | 3 | The live workflow is coherent; mobile catalogue spacing and overlay composition still feel mechanically collapsed. |
| 9 | Error recovery | 3 | Autosave conflicts preserve drafts and removal confirms; nested overlay escape behavior can discard the inspector context. |
| 10 | Help and documentation | 3 | Domain copy is generally clear, but the Campaign-notes collaborative label promises the wrong behavior. |
| **Total** | | **29/40** | **Good foundation; bounded P1 correction required before visual sign-off.** |

## Design Specificity Verdict

The Campaign and Session workflow is now authored for tabletop play rather than a generic admin dashboard. Prepare, Run, Closeout, world time, party attendance, chat destinations, and creature action rolls form a coherent GM path. The remaining defects are seam failures between otherwise strong surfaces: mobile play controls do not fit their context, Campaign-note permissions disagree, and generic creature serialization leaks into the GM presentation.

The deterministic scan returned zero findings for the Campaign and connected Character Sheet surfaces. The meaningful defects required rendered role/device testing.

## Overall Impression

The structure is ready. The highest-value move is not another recomposition; it is making the connected player and GM tools trustworthy at mobile width and making the visible controls match the actual authority model.

## What's Working

- Session Prepare, Run, Closeout, and finished-history states now have one clear destination and no duplicated Encounter identity.
- Chat uses recognizable conversations, bubbles, unread badges, anchored history, and correct Table/Party/Direct privacy composition.
- Real SRD creatures expose initiative, HP, visibility, defenses, features, structured rolls, and event history in the Encounter workspace.

## Priority Issues

### P1 · Mobile manual dice cannot complete a roll

At 390px the roller creates horizontal overflow and places the Roll action off-screen. Reflow the compact controls, constrain children, and keep the primary action inside the viewport.

### P1 · Campaign-note permissions contradict the agreed workflow

Players can create, edit, and delete GM-shared Campaign sections on the Campaign page, while the Character drawer renders them read-only. Enforce GM-only Campaign-note mutation in both service and UI; keep Session sections collaborative.

### P1 · Mobile chat composer is covered by app navigation

The message voice and Send controls fall underneath the sticky mobile footer. Make the Drawer the top interaction layer and preserve a safe bottom inset.

### P1 · GM Party roster hides active unassigned members

Only assigned Characters render, so the GM cannot see or manage an active player who has not selected a Character. Render every active player member and show assignment state in the same roster.

### P1 · Creature mechanics leak raw data and wrong labels

Movement displays raw object fields and UUIDs, while actionable attacks such as Morningstar and Javelin fall back to Trait. Format movement as table language and use a neutral Feature fallback when source categorization is absent.

## Persona Red Flags

- **Live-session GM:** raw speed serialization and hidden unassigned members undermine trust during time-sensitive table management.
- **Assigned mobile player:** the dice Roll action and chat Send controls are physically inaccessible in common one-handed play.
- **Accessibility-dependent user:** the Notes drawer close control needs an accessible name, and Escape must not close both a nested drawer and its underlying Character inspector.
- **Campaign organizer:** two contradictory Campaign-note editors make it impossible to know whether shared lore is GM-authored or table-authored.

## Minor Observations

- Mobile Campaign catalogues stretch the two grid rows across the viewport, creating an unnecessary blank gulf before the first card.
- The Character Sheet notes drawer calls GM-authored Campaign notes Collaborative.
- Inventory activity correctly remains empty until a mutation flows through the audited service; fixture inserts alone are not an audit event.

## Questions to Consider

Questions skipped: the approved Campaign plan already defines note authority, roster visibility, mobile access, and Encounter terminology, so each finding has one bounded correction.
