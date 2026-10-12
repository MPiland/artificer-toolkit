# Phase 8.2 open questions

> Questions waiting for the user's answer only; keep this file short. Answer inline under **Answer** (or in chat). Answered items move to [Resolved](phase-08-2-decisions.md#resolved) with the decision; decisions made on the user's behalf, approved implementation decisions and resolved questions live in [phase-08-2-decisions.md](phase-08-2-decisions.md).
>
> Updated: 2026-10-10.

## Open

### Q1. Automatic cover: on or off for a new Campaign? (SPELLS-14, not blocking yet)

An orc ducks behind a half-wall. With automatic cover on, the app gives it +2 on its save or AC from the walls on the map, and the GM can change that. With it off, the GM sets cover per target when it matters.

- **On by default:** less bookkeeping for the GM, but it relies on the Scene's walls being drawn well.
- **Off by default:** nothing happens unless the GM steps in, which suits theatre-of-the-mind tables and rough maps.

**Recommendation:** on, because the GM can always change a tier.

**Answer:**

### Q2. Caltrops: how does a creature move carefully through them? (SPELLS-17, not blocking yet)

The SRD says a creature moving at half speed through caltrops doesn't need to save. In the app, a player drags a token across the field.

- **A "move carefully" toggle on the move:** that move costs double and skips the save.
- **The GM waives the save:** the save prompt has a GM-only "moved carefully" answer.

**Recommendation:** the toggle, because the player makes the choice and the cost shows up on the move.

**Answer:**

### Q3. Token rings: show disposition or control? (VTT_UI-1.1, blocks that AC only)

A token's ring is green when the viewer controls its actor and white otherwise. The [VTT mockup](../mockups/phase-08-vtt-production-tracer.png) instead rings tokens by side (red, blue, purple), like Foundry's disposition colours. Disposition (D13) is already sent to players.

- **Disposition rings:** red Hostile, blue Friendly, purple Neutral, with the current turn kept as the teal halo; "yours" moves to the token's description and selection.
- **Keep control rings:** players spot their own token at a glance, but sides show only in the tracker.

**Recommendation:** disposition rings, because they match the mockup and the Foundry baseline, and targeting and flanking already read disposition (D17).

**Answer:**
