# Phase 06 — Live Campaign play

> **Status:** planned
> **Depends on:** [Phase 02](02-media-and-file-pipeline.md), [Phase 03](03-campaign-core.md), and [Phase 05](05-notifications-and-delivery.md)
> **Unlocks:** [Phase 07 Encounters](07-encounters.md), [Phase 08 VTT](08-vtt.md), and [Phase 10 paid-table session operations](10-paid-tables.md)
> **Primary ADRs:** [0001](../adr/0001-package-boundaries.md), [0006](../adr/0006-character-builder-sheet-boundary.md), and [0009](../adr/0009-vtt-encounter-event-boundary.md)

## Goal

Extend Campaign Core with a lightweight prepare/run/closeout loop for sessions, vehicles, supporting files and handouts, a manual authoritative Campaign clock, richer live-play workflows, and GM Campaign announcements delivered through Phase 05 notifications.

## Current starting point

- Phase 03 already owns party inventory/currency, durable Campaign rolls/chat, Campaign and session notes, and private Broadcast reconciliation.
- Phase 02 provides ready asset identity and private transfer/delivery. This phase owns Campaign file/handout references, not another asset lifecycle.
- Phase 05 owns the Knock-backed inbox, email delivery, preferences, and reliable delivery intents. No Campaign-announcement, live-session, or Campaign-clock domain exists yet.

## Requirements

### Vehicles, files, sessions, and clock

- Extend inventory ownership to `VEHICLE`; a vehicle pins an authored Vehicle revision and has its own inventory. Automated vehicle combat remains deferred.
- Authorized members upload/download size-limited Campaign files through the Phase 02 pipeline. Attachments record uploader, asset, Campaign, display metadata, and optional session/note association; removed members lose future API and Storage access.
- `CAMPAIGN_HANDOUT_MAP` is an ordinary ready Campaign asset and cannot gain VTT behavior or bypass the separate `VTT_MAP` profile.
- Campaign live-session records are `OPEN` or `FINISHED`. A Campaign may keep multiple sessions `OPEN` while the GM prepares them; opening a session is navigation, not a singleton live-state transition. A Campaign clock is independent from session state and persists across sessions unless the GM explicitly resets it.
- A session has an immutable Campaign-scoped number, optional title, optional scheduled start/end with an explicit timezone, RSVP state, actual attendance, and versioned GM commands. Campaign Settings may provide a normal cadence, expected duration, quorum, and absent-character policy without forcing every group through a scheduling poll. Free games may omit a schedule; a paid session must later provide one before Phase 10 can book or charge it.
- Session preparation stays flexible and GM-private. The GM can keep a short opening/agenda, possible scenes or beats, secrets/clues, rewards, and a scratchpad; attach Encounter templates and handouts; and pin existing Campaign notes or authored rules, Creatures, Items, and Spells for one-click reference. These are optional blocks, not a mandatory adventure-authoring workflow.
- During play, the Session workspace keeps the current plan, pinned references, party summaries, chat/dice, handouts, Encounter runs, and quick-capture notes reachable without presenting them as one long form. The GM can add an improvised note or reference without leaving the Session.
- Finishing records actual attendance and supports a short recap, the party's ending location/state, improvised people or facts that became canon, unresolved threads or rulings, rewards/milestone decisions, and follow-up tasks. Existing collaborative Session notes remain editable after finish; finishing does not freeze the historical record.
- Campaign Settings keep player-facing table expectations, allowed content/rules, attendance policy, content boundaries, and selected safety practices available to every active member. Live play exposes the chosen pause/change/skip method without persisting sensitive boundary details in chat or analytics.
- The manual Campaign clock stores start/stop segments and derives authoritative in-game time as `Day N` plus time of day without a background timer service. A Campaign configures dawn and dusk; custom calendars are out of scope.
- GM start, pause, and advance commands move the clock forward. Rewind is a correction-only GM command with an explicit correction reason. Reset-boundary processing is monotonic: a processed boundary is never replayed by a rewind.
- Campaign management is the GM workspace and launch point for live session controls. It composes existing Campaign controls and live-state projections; it is not a second Campaign aggregate.

### Campaign announcements

- Owners may publish Campaign announcements stored independently from Phase 03's 500-entry chat cap and addressed only to current authorized Campaign members.
- Publishing an announcement inserts a Phase 05 delivery intent after the announcement source is committed. The source public ID and safe summary are sufficient; private Campaign or party-only text is never copied into Knock or email payloads.
- Announcement delivery is idempotent and auditable. Opening an announcement reauthorizes current Campaign membership, and removal closes the destination even when an older feed item remains.
- Party-only sources preserve Phase 03 room isolation across recipient selection, counts, delivery, and destination reads.

## Design

```mermaid
flowchart LR
  Announcement["GM Campaign announcement source"] --> Intent["Phase 05 delivery intent"]
  Intent --> Knock["Knock workflow"]
  Knock --> Inbox["In-app feed"]
  Knock --> Email["Resend email when enabled"]
  Inbox --> Read["Authorized Campaign read"]
  Email --> Read
```

The Campaign announcement is the product truth. Phase 05 handles delivery and preferences; every destination read still applies Campaign authority.

```mermaid
stateDiagram-v2
  [*] --> OPEN
  OPEN --> FINISHED: GM ends
```

Clock start, pause, advance, and correction commands persist before any derived live-state projection is published. The system does not run a timer or schedule work in the background.

## Ordered workstreams

1. **Extend live-play capability rules.** Cover vehicles, file references, session lifecycle, GM controls, clock, announcements, and source visibility.
2. **Add vehicles and Campaign file references.** Reuse Phase 02 profiles, access, ready-state checks, and asset IDs.
3. **Add sessions and clock.** Persist `OPEN`/`FINISHED` sessions, scheduling/RSVP/attendance, optional prep blocks and reference pins, quick capture and closeout, Campaign workspace controls, clock segments and configurable dawn/dusk, and correction-only rewind plus monotonic reset boundaries.
4. **Add Campaign announcements.** Persist the authorized source and insert Phase 05 delivery intents without duplicating inbox, preference, or channel state.
5. **Ship responsive web.** Cover the Session list, optional preparation, in-play reference workspace, closeout, attendance, vehicle custody, files, clock, and announcement composition/history.
6. **Validate authorization and recovery.** Test announcement recipient isolation and idempotency, member removal, deep-link failure, file access revocation, and clock concurrency.

## Acceptance gates

- Campaign announcements survive independently of chat retention and reach only current authorized members.
- A player-only source cannot create a GM-visible announcement delivery intent, count, or destination.
- Announcement notifications and links reveal no protected Campaign content without a fresh authorized API read.
- Removed members cannot list, download, or refresh private Campaign files through prior routes.
- Multiple Campaign sessions may remain `OPEN`; clock controls and announcements remain available from Campaign management regardless of which session the GM is viewing.
- A GM can move from session list to preparation, live reference, and closeout without duplicating a Session or losing notes; finished sessions retain editable collaborative notes and immutable attendance history.
- Session reference pins resolve through existing authorized content rather than copying mutable rules text, and removed members cannot use a prior pin to bypass access. The GM can keep the small working set visible without opening a pile of overlapping sheets or notes.
- Player-facing expectations and the selected live safety method remain accessible without exposing private safety responses or boundary details.
- Clock segments, Day N projection, dawn/dusk configuration, correction-only rewind, and monotonic reset boundaries remain correct across retries, reconnects, and concurrent GM commands.
- Vehicle custody remains isolated from Builder aggregate replacement.

## Out of scope

- Party inventory/currency, conversations/rolls, base notes/collaborative session sections, and Broadcast reconciliation: [Phase 03](03-campaign-core.md).
- Notification inbox, preferences, email delivery, and retry state: [Phase 05](05-notifications-and-delivery.md). Paid-game sources and reminders belong to [Phase 10](10-paid-tables.md).
- Native push and device registration: [Phase 11](11-cross-platform-foundation.md). Co-GMs, custom calendars, and automatic clock-driven jobs remain later work.
- VTT maps/scenes/tokens, voice/video, automated recaps or session transcription, end-to-end encryption, unlimited history, and general background-job infrastructure.

## New-session instruction

Reuse Phase 05 notification workflows and delivery intents directly. Do not create another notification store, preference model, provider facade, or delivery worker in this phase.
