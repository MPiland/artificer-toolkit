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

### Q4. Who can see a player's profile? (ACCOUNTS-8, blocks closing it)

ACCOUNTS-8 is called "Control who sees my profile", but there is nothing to control: only the owner can read their own profile (ACs 8.1 to 8.3). Other players see only the public social profile they choose to publish. The open journey gap asks for a test of "each privacy setting", and none exists to test.

- **Owner-only is the scope:** rename the PBI to match, close the gap with the existing `profile-browser` proof, and add nothing.
- **Add a visibility setting:** register a new PBI, for example "Profile visible to: only me / my Campaign members / everyone". Every read path then needs that rule enforced, and each option needs its own proof.

**Recommendation:** owner-only for now. Social profiles already handle opt-in public visibility, and a second visibility model would duplicate that and widen the privacy surface before alpha. If you want Campaign members to see more, that belongs on the social profile.

**Answer:**
