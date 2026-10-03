import type { GmCampaignRollDto, RollRevealModeDto } from '@artificer-toolkit/schema/api/rolls'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterReadContext } from './store.js'

/**
 * The deterministic chat nonce of a roll's NOTICE entry. A FULL reveal already uses the roll id,
 * so the notice flips the id's first hex digit, which keeps it a valid UUID and keeps both reveals
 * idempotent per roll.
 */
export function rollNoticeNonce(rollId: string): string {
  const id = rollId.toLowerCase()
  return `${(Number.parseInt(id[0]!, 16) ^ 8).toString(16)}${id.slice(1)}`
}

/** Why this reveal cannot happen, or null. Each mode posts once; a FULL may still follow a NOTICE. */
export function readRollRevealRefusal(
  gmCampaignRoll: GmCampaignRollDto,
  mode: RollRevealModeDto
): string | null {
  if (mode === 'FULL' && gmCampaignRoll.revealedAt !== null)
    return 'This roll was already revealed.'
  if (mode === 'NOTICE' && gmCampaignRoll.noticedAt !== null)
    return 'This roll was already announced.'
  return null
}

export function withRollRevealed(
  gmCampaignRoll: GmCampaignRollDto,
  mode: RollRevealModeDto,
  at: string
): GmCampaignRollDto {
  return mode === 'FULL'
    ? { ...gmCampaignRoll, revealedAt: at }
    : { ...gmCampaignRoll, noticedAt: at }
}

/**
 * The rolling creature's name for a "Show that I rolled" notice, or null when players cannot
 * currently see it (D62: a creature is hidden from every player while its `public` flag is off),
 * when the roll had no creature, or when the creature is gone. Read at reveal time, so a creature
 * revealed after it rolled is named and one hidden since is not.
 */
export async function readRollNoticeCreatureLabel(
  ctx: EncounterReadContext,
  creature: GmCampaignRollDto['creature']
): Promise<string | null> {
  if (!creature) return null
  const row = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) =>
      q.eq('encounterId', creature.encounterId).eq('id', creature.actorId)
    )
    .unique()
  if (!row) return null
  const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
  return actor.public ? actor.label : null
}
