import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { endCarriedGrantsOfConcentratingCasters } from '@artificer-toolkit/encounter-persistence/characterRunEffects'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { planCarriedOverEffects } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import type { MutationCtx } from '../_generated/server'
import { readCampaignClockMinute } from '../campaigns/clockReads'
import { readFightingCharacters } from '../liveSessions/characterHolds'
import { encounterWriteTransaction } from './encounterPorts'

/** The Campaign's Characters that an ACTIVE Run's room holds. */
export async function readFightingCharacterIds(
  ctx: MutationCtx,
  campaignId: string
): Promise<Set<string>> {
  return new Set(
    (
      await readFightingCharacters(
        ctx,
        campaignId,
        await ctx.db
          .query('encounterRuns')
          .withIndex('by_campaignId_status', (q) =>
            q.eq('campaignId', campaignId).eq('status', 'ACTIVE')
          )
          .collect()
      )
    ).map((entry) => entry.characterId)
  )
}

/**
 * D99, SPELLS-5.7: Characters that started a Concentration in a Run end the carried grants they cast
 * earlier on the Campaign's Characters outside it. `casterCharacterIds` are the ids this checkpoint
 * first adds to the Run's `concentrationCasterCharacterIds`. The Run's own Characters are the room's
 * to settle, and a Character in another ACTIVE Run belongs to that room, so both are skipped.
 */
export async function endOutsideCarriedGrants(
  ctx: MutationCtx,
  campaignId: string,
  encounterId: string,
  casterCharacterIds: readonly string[]
): Promise<void> {
  const fighting = await readFightingCharacterIds(ctx, campaignId)
  for (const row of await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
    .collect()) {
    const actor = readStoredRunActor(row)
    if (actor.kind === 'CHARACTER') fighting.add(actor.sourceId)
  }
  await endCarriedGrantsOfConcentratingCasters(encounterWriteTransaction(ctx), {
    encounterId,
    casterCharacterIds,
    includesHolder: (characterId) => !fighting.has(characterId),
    occurredAt: new Date().toISOString()
  })
}

/**
 * D99, SPELLS-5.14: a completed Run's Characters keep their timed grants and condition effects on
 * the Campaign clock. Runs in the
 * checkpoint that completes the Run, after the room released the Characters; returns the
 * Characters whose grants changed, so the room reloads them instead of adopting the revision.
 */
export async function carryOverRunGrants(
  ctx: MutationCtx,
  campaignId: string,
  encounterId: string
): Promise<string[]> {
  const clockMinute = await readCampaignClockMinute(ctx.db, campaignId)
  const store = createActiveRuleEffectStore(encounterWriteTransaction(ctx))
  const changed: string[] = []
  for (const row of await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
    .collect()) {
    const actor = readStoredRunActor(row)
    if (actor.kind !== 'CHARACTER') continue
    const owner = { kind: 'CHARACTER', characterId: actor.sourceId } as const
    const carried = planCarriedOverEffects({
      effects: await store.list(owner),
      clockMinute,
      form: actor.form
    })
    for (const { effect, lifecycle } of carried)
      await store.updateLifecycleCas({
        id: effect.id,
        owner,
        expectedVersion: effect.version,
        lifecycle
      })
    if (carried.length > 0) changed.push(actor.sourceId)
  }
  return changed
}
