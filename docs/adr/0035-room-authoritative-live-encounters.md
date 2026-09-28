# ADR 0035: The room is authoritative for live Encounters; Convex is the record

- **Status:** decision (approved 2026-09-27; implementation not started)
- **Date:** 2026-09-27
- **Scope:** who owns live Encounter state and combat play state while a table is live, how commands are authorized and made durable, how Convex receives the result, how views outside the room see it, and the free-tier cost budget for live play
- **Update when:** live Encounter authority, checkpointing, the room's durability, outside-the-room reads or edits, or the live-play cost budget changes
- **Supersedes:**
  - The per-command Convex path for Encounter commands in [ADR 0029](0029-convex-backend-cutover.md) ("Convex independently revalidates each ordered publication", and the live rules clarification's capture and validated commit boundary).
  - The D27 Convex-first external commits, the D52 capture-then-commit chain and D64 as they apply to Encounter commands.
  - Everything else in 0029, 0033 and 0034 stays in force, including rules and dice running in the room (D41).

## Context

Phase 8.2 moved rules execution into the Session Durable Object ("the room"), but Convex stayed the per-command authority. For every combat command the room:
1. captured its inputs from Convex (about 250 KB of reads);
2. evaluated them;
3. had Convex re-read and verify them in a fenced commit (400–800 KB);
4. triggered every player's Encounter projection to re-run in Convex (about 34 KB × players).

The V15 workload measured about 1 MB of Convex reads and two Convex round trips per command. A four-hour session therefore reads about 0.3 GB.

The product has to run on free hosting tiers at launch and until paying customers justify a paid plan. A 1 GB monthly database allowance would cover about three sessions for the whole user base. The same per-command round trips also keep reaction answers at the one-second latency budget.

Foundry VTT, the play baseline, keeps the live world in one server process and persists it locally. Owlbear Rodeo also keeps the live table in a single room.

## Decision

**Convex is the record of truth. While a table is live, the room is the source of truth.**

1. **Authority.** While a Campaign's room holds live authority and an Encounter Run is ACTIVE, the room owns:
   - the Run's live state;
   - the combat play state of every actor in it: hit points, temporary hit points, maximum hit point reductions, conditions and active effects, resources and spell slots, concentration, death saves and action economy.

   Every connected client reads that state from the room, over the socket it already holds.
2. **Commands never call Convex.**
   - An Encounter command is authorized against the room's cached membership, role and control data (ADR 0034).
   - It is evaluated by the existing rules runtime against in-memory state.
   - State, receipt and replay evidence are committed to the room's SQLite storage in one transaction before the room acknowledges.
   - The result is broadcast to each recipient through the existing privacy projection: hidden actors, GM-only rolls and redactions (D62, Q14).
   - Receipts keep commands idempotent on retry.
3. **Checkpoints to Convex.**
   - **When:** the room writes a checkpoint at each round boundary, on Run pause, complete or delete, before an idle release or drain, and otherwise at most every 30 seconds while state has changed.
   - **Fencing:** a checkpoint is one idempotent Convex mutation carrying the room's authority epoch and sequence. Convex accepts only a newer sequence under the current authority, so the existing authority fencing is reused.
   - **Contents:** the checkpoint writes the Run, the actors, Character play state, timeline entries and receipts that Convex's own features need, such as history, the Sheet outside play and audits.
4. **Durability.**
   - A Durable Object's SQLite commit survives crashes and restarts, so an acknowledged command is never lost.
   - A restarted room rehydrates from its own storage, not from Convex.
   - Only if that storage were lost would the room fall back to the last checkpoint, bounding the loss to about 30 seconds or one round. That case is treated as an incident, not a design path.
5. **Loading inputs.**
   - When the room hydrates, or a Run starts, it loads everything once: the compiled rules inputs for each Character and Creature, the Scene and the Run.
   - System and published content come from their version-stamped snapshots (Q15 option a).
   - After that, only invalidations cause reloads.
6. **Edits made outside the room.** A Builder save, GM content edits, and membership or assignment changes still go through Convex; the live table is never locked (Foundry allows editing at any time).
   - Convex then notifies the room.
   - The room reloads the affected rules inputs at the next command boundary, keeping live play state.
   - Membership and role revocations take effect immediately through the existing eviction path.
7. **Views outside the room.**
   - A player's Character Sheet, opened for a Character in an active live Run, shows the room's live play state, and its play actions (HP, slots, conditions) go to the room as commands. The Sheet still owns play interaction, but its authority during live play is the room.
   - Pages that are not live (Campaign overview, history, admin) read the last checkpoint.
8. **Convex's role.**
   - Convex owns accounts, auth, Campaigns, authoring, the Builder, content publication, Scenes outside play, invitations, notifications and the durable record.
   - It stops subscribing players to per-command Encounter projections during live play.
9. **Cost budget (D, gated).**
   - Live play must fit the free tier.
   - V15 gains hard budgets for Convex reads per command and per session, alongside the existing latency budgets.
   - The Builder gains a budget for reads per edit.
   - Budgets derive from the free allowances and a target number of active groups per month (Q16).

## Consequences

**Benefits:**
- Combat commands need no Convex round trips, so latency is bounded by room CPU (tens of milliseconds), not two HTTP calls.
- Convex reads for live play drop from about 1 MB per command to a checkpoint every 30 seconds or round.
- Subscriber re-runs during play disappear.
- The capture bundle, fenced commit, write-ahead journal and resolve route for Encounter commands are deleted, along with their per-command checksum verification (D52, D64 and much of D27).

**Costs and risks:**
- Two copies exist during play. Convex's copy lags by up to one checkpoint, so every reader must know which copy it reads.
- The room's cache of authorization data must be invalidated correctly. Security tests cover revocation during live play.
- Room rehydration, checkpoint idempotency and replay need their own tests.
- Acceptance cases that assume per-command Convex commits (R06, V05, V08, V09, V15 and the fenced-commit cases) must be reworded, with the user's approval recorded, before this lands.
- This is a large change late in Phase 8.2. Work already done on capture and commit is partly retired.

**Unchanged:** rules and dice run in the room (D41); privacy projection; player control and GM override (ADR 0034); Campaign-owned play and the implicit live table (ADR 0033).

## Amendments from implementation planning (2026-09-27)

Accepted after the code mapping in [the implementation plan](../handoffs/adr-0035-implementation-plan.md).

1. **Steady-state commands never call Convex. Lifecycle commands do.** START, COMPLETE, DELETE, and adding or removing a Character actor wait for a synchronous checkpoint before they acknowledge. The first command after an invalidation reloads only the stale inputs.
2. **Rehydrating.**
   - Within an authority epoch, the room rehydrates from its own storage.
   - Across epochs, for example after an idle release, it starts from Convex's acknowledged final checkpoint. That is the normal path, not an incident.
   - If storage is lost within an epoch, the room forces a new epoch and resynchronizes clients.
3. **Character play state is explicit.** A `CharacterPlayState` contract names exactly the play-state fields held today in `characters.documentJson.state`, `sheetState.resourceUsage`, `campaignCharacterStates` and `characterActiveRuleEffects`.
   - While a Character is held by a live Run (`liveCharacterHolds`), Convex refuses writes to those fields.
   - Checkpoints merge only those fields and bump `streamVersion` once per checkpoint.
   - Rests are refused while the Character is held.
4. **Cadence.** A checkpoint is sent no later than N seconds after the first unsent change, and at every round boundary and lifecycle event.
   - Checkpoints carry only the records that changed (deltas), never whole documents.
   - N is a tunable constant sized by the Q16 budget (Convex I/O counts checkpoint bytes). The room's SQLite already makes acknowledged commands durable, so N only bounds how stale pages outside the room are.
5. **Revocation has a bound.**
   - The room holds authorization under a lease of about 60 s, renewed by each checkpoint response and token renewal.
   - A lost `INVALIDATE_INPUTS` or eviction notification is therefore corrected within the lease.
   - Membership departure and account deletion only evict and notify while a Run is held. The room applies the change, and checkpoints filter controller lists.
6. **The Scene lane is included.**
   - Bound moves, fog changes, movement decisions and Encounter binding become room commands.
   - Scene publications fold into checkpoints, replacing per-command `state:publish` and the Convex-first external commit path (D27 and D52).
   - Transient preview samples must not write a SQLite row per sample, because the free plan's rows-written limit is 100,000 a day.
7. **Replay.** A same-sequence checkpoint retry returns `REPLAYED`. Command replay across epochs is served by a replay index loaded from Convex receipts at hydrate.
8. **The broadcast fan-out is new work.** Other members see pending decisions, timeline entries and roll cards through the room with the privacy projection, not through Convex subscriptions. Chat roll cards go live through the room and are persisted to Convex chat by checkpoint with stable IDs.
9. **Decision 9 budgets include Cloudflare.** They cover Durable Object requests, duration, rows written and CPU per command, alongside Convex I/O. Checked 2026-09-27: Durable Objects on Workers Free get 30 s of CPU per request (the 10 ms Workers Free limit does not apply); 100,000 requests a day; 13,000 GB-s a day; 5M rows read and 100,000 rows written a day; 5 GB stored.
10. **Also superseded:**
    - ADR 0034 §4's "the Sheet is the single writer of play state" while a Character is held;
    - ADR 0029's Character authority amendment and per-publication Scene re-check for live Runs;
    - ADR 0033's per-command outbox drain, which becomes a final checkpoint.
11. **Until content snapshots (Q15 option a) land,** System content is loaded through the existing capture builders at hydrate.

## Also decided with this ADR

- **Development and tests use the local backend only (Q15 option c).** Development, automated tests, load checks and agents run against the local Docker backend. Cloud deployments are touched only for a deliberate, approved staging smoke check.
- **Read budgets in the gates (Q15 option d).** See Decision 9.
