import type { Creature } from './creatures'

/* 
──────────────────────────────────────────────────────────────────────────────
MONSTER TYPE — HOSTILE OR NEUTRAL CREATURES WITH CHALLENGE RATING
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Represents monsters from bestiaries or SRDs. Extends Creature with 
challenge-based and encounter-specific fields.

Structure:
----------
• `challengeRating` — Standard CR (e.g., 1/4, 5, 20).
• `xp` — Experience points gained for defeating.
• `environments` — Terrain or biomes where it appears.
• `variantOfId` — Reference if it’s a variant of another monster.
──────────────────────────────────────────────────────────────────────────────
*/
export interface Monster extends Creature {
  challengeRating: string
  xp: number // int
  environments: string[] | null // [Terrain IDs]
  variantOfId: string | null // FK → parent monster
}
