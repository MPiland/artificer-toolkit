# Slice SPELLS-4.T2n: derived or modified healing

Status: **design packet, awaiting orchestrator ruling (no product code).** Class B under D156. AC SPELLS-4.1. Unblocks SPELLS-31.T4n, SPELLS-33.T4n and SPELLS-33.T6b1.

Brief: convert `BEACON_OF_HOPE`, `VAMPIRIC_TOUCH`, `WARDING_BOND`, `GOODBERRY` and `HEROES_FEAST` from `CLOSED_RULE` kinds to authored options, delete the five kinds, prove each with an authoring-parity test (ADR 0038). No per-spell branch (D156), no new plan shape (ADR 0039).

## What the five kinds really need

Only the spell source files reference the kinds (`spells/*.ts`, `ids.ts`, `closedRuleKind.ts`); no runtime branches on them. Each is a pure label today, so conversion is authoring plus engine seams.

| Kind | Mechanic | Existing seam | Gap |
| --- | --- | --- | --- |
| Beacon of Hope | Advantage on Wisdom saves and death saves; healing takes the maximum | `SAVING_THROW_MODIFIER` grant (ability filter) | A grant that changes how the holder's incoming healing resolves (maximize dice); death-save advantage (to confirm) |
| Vampiric Touch | Melee spell attack, 3d6 necrotic, caster regains half the damage dealt; repeatable each turn as an action | `DAMAGE` outcome, `HEAL` outcome, concentration | Heal whose amount derives from damage actually dealt on the same path, aimed at the source; a repeatable granted action |
| Warding Bond | +1 AC and saves, resistance to all damage, while within 60 ft; damage taken is also taken by the caster; ends at 0 hp or separation | `ARMOR_CLASS`, `SAVING_THROW_MODIFIER`, `DAMAGE_RESISTANCE` grants, `DAMAGE_INTERCEPTION` hook | Damage mirrored to the source (not healing); distance restriction on the grant; lifecycle end on distance or source at 0 hp |
| Goodberry | Up to ten berries, each eaten as an action restores 1 hp | `HEAL` FIXED 1, `CHARGE_LIMIT` domain, consumed-grant restore (Decoys) | A granted action with N charges that heals its user; 24 h expiry via duration |
| Heroes' Feast | Up to 12 creatures: cured of disease and poison, poison and frightened immunity, Wisdom save advantage, max hp +2d10 and heal the same number | `HIT_POINTS_MAX` bonus grant and `HEAL` (Aid), `CONDITION_IMMUNITY`, `SAVING_THROW_MODIFIER`, `END_EFFECTS` condition selector (D174) | One 2d10 roll shared by the max-hp bonus and the heal; 1-hour consumption delay |

## Options

**A. Four narrow generic options, one slice split into four cards (recommended).**
1. `HEALING_RECEIVED` value domain with a `MAXIMIZE_DICE` modifier kind on the holder (Beacon of Hope, plus Wisdom and death-save advantage from existing save grants). Reusable by any "regain the maximum" rule.
2. `HEAL.valueKind: 'DAMAGE_DEALT'` with `fraction` (rounding down) and `recipient: 'SOURCE'`, resolved from the sibling `DAMAGE` outcome's committed applied amount on the same path (Vampiric Touch; also Life Drinker, Vampire bite and Vampire Spawn once their kinds convert). Repeat-attack action uses the existing concentration-granted action pattern if one exists (question 2).
3. Shared roll across a grant and a heal (`HEAL.valueKind: 'GRANTED_AMOUNT'`: heal equals the max-hp bonus rolled in the same result block) plus charged granted action (`chargeLimit` on a granted heal action) for Goodberry and Heroes' Feast. Reuses `HIT_POINTS_MAX` bonus with `DICE` payload (check Aid pattern) and `CHARGE_LIMIT`.
4. Damage mirror to source: `DAMAGE_INTERCEPTION` variant `MIRROR_TO_SOURCE` (holder takes damage, source takes the same amount after resistance) with a `WITHIN_DISTANCE_OF_SOURCE` grant restriction and a lifecycle end on source 0 hp or separation (Warding Bond).

**B. One broad "derived healing" outcome** holding all of the above as sub-kinds. Rejected: couples four unrelated seams (save/heal modifier, damage-to-heal derivation, shared roll, damage mirror) in one payload; AGENTS.md prefers focused options, and it would make parity tests unreadable.

**C. Description-only for Warding Bond's mirror and the Heroes' Feast delay.** Warding Bond's mirror is the spell's identity, so leaving it off would convert the kind into a weaker spell. Heroes' Feast's 1-hour consumption delay and Goodberry's nourishment are description-only under every option (no meal/time-delay model). Warding Bond ends on "cast again on either creature" also stays description-only.

## Recommendation and split

Option A. Size is over 5 (four independent seams), so split:

- **T2n1 (size 3):** `HEALING_RECEIVED` maximize + Beacon of Hope.
- **T2n2 (size 3):** damage-dealt-derived heal to source + Vampiric Touch.
- **T2n3 (size 4):** shared-roll max-hp heal + charged granted heal action: Heroes' Feast and Goodberry.
- **T2n4 (size 4):** damage mirror, distance restriction, lifecycle end: Warding Bond.

Each card deletes its kinds and has an authoring-parity proof (SRD effect and a homebrew variant pass the node map and resolve alike) plus a room journey. T2n2 and T2n3 are what SPELLS-31.T4n, SPELLS-33.T4n and SPELLS-33.T6b1 most likely wait on; please confirm which of the three blocks which.

## Questions for the orchestrator

1. Split into T2n1–T2n4 as above (register as ledger tasks, replacing T2n)? Or hold Warding Bond back to a separate task since it is damage, not healing?
2. Is there an existing "granted repeatable action while concentrating" seam (for Vampiric Touch's reuse each turn, and Flame Blade/Produce Flame)? I found none yet in `rules-runtime`; if one is planned elsewhere, T2n2 should depend on it rather than invent one.
3. Death saving throws: does a `SAVING_THROW_MODIFIER` grant already cover death saves? If not, Beacon's death-save advantage needs a one-line ability filter value or stays description-only.
4. Heroes' Feast "cured of all diseases and poison": use `END_EFFECTS` condition selector for poisoned only, and leave disease description-only (disease is not a condition model today). OK?
5. The mirror in Warding Bond: bonded-source damage after the holder's resistance, and not mirrored again if the source is also bonded (no ping-pong). Accept as the rule?

## Caveats

This packet is from reading the type surface and a few call sites; the interception, charged-action and heal-application paths named above need confirmation when each card starts. No product code was touched.
