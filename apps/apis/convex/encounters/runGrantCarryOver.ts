import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { endCarriedGrantsOfConcentratingCasters } from '@artificer-toolkit/encounter-persistence/characterRunEffects'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { absoluteMinute, deriveClock } from '@artificer-toolkit/rules-runtime/campaignClock'
import { planCarriedOverGrants } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { campaignClockDtoSchema } from '@artificer-toolkit/schema/api/campaignSessions'
import type { MutationCtx } from '../_generated/server'
import { readFightingCharacters } from '../liveSessions/characterHolds'
import { encounterWriteTransaction } from './encounterPorts'

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
  const fighting = new Set(
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
  const assignments = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .collect()
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
    holderCharacterIds: assignments
      .map(({ characterId }) => characterId)
      .filter((characterId) => !fighting.has(characterId))
      .sort(),
    occurredAt: new Date().toISOString()
  })
}

/**
 * D99: a completed Run's Characters keep their timed grants on the Campaign clock. Runs in the
 * checkpoint that completes the Run, after the room released the Characters; returns the
 * Characters whose grants changed, so the room reloads them instead of adopting the revision.
 */
export async function carryOverRunGrants(
  ctx: MutationCtx,
  campaignId: string,
  encounterId: string
): Promise<string[]> {
  const clockRow = await ctx.db
    .query('campaignClocks')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .unique()
  let clockMinute: number | null = null
  if (clockRow) {
    const { _id, _creationTime, ...stored } = clockRow
    const { clock } = deriveClock(campaignClockDtoSchema.parse(stored), new Date().toISOString())
    clockMinute = absoluteMinute(clock.day, clock.minuteOfDay)
  }
  const store = createActiveRuleEffectStore(encounterWriteTransaction(ctx))
  const changed: string[] = []
  for (const row of await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
    .collect()) {
    const actor = readStoredRunActor(row)
    if (actor.kind !== 'CHARACTER') continue
    const owner = { kind: 'CHARACTER', characterId: actor.sourceId } as const
    const carried = planCarriedOverGrants({ effects: await store.list(owner), clockMinute })
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
