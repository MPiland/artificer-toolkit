import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import { systemTriggerStartOfTurnCommand } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { systemAbilityDefinitions } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'

/**
 * Raises the passive effects the creature whose turn just began carries for the start of its turn,
 * after the START or ADVANCE_TURN that began it. Each effect runs as its own rule-raised root, so it
 * reads the hit points the turn start left. An Encounter that already waits on a decision raises
 * nothing yet. Returns whether any root committed.
 */
export async function raiseRoomStartOfTurnEffects(input: {
  ctx: EncounterWriteTransaction
  encounterId: string
  parentCommandId: string
  execute(command: ResolveEncounterActionInputDto): Promise<unknown>
}) {
  const { ctx, encounterId } = input
  const readRun = () =>
    ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', encounterId))
      .unique()
  const first = await readRun()
  if (!first || first.status !== 'ACTIVE') return false
  const firstState = readRunState(first)
  const holder = (await readRunActors(ctx, firstState)).find(
    (actor) => actor.id === firstState.currentActorId
  )
  if (holder?.kind !== 'CREATURE') return false
  const system = await ctx.ports.requireSystem(firstState.gameSystemId)
  const { passiveStartOfTurnEffects } = discoverEncounterFeatureActions({
    actor: holder,
    conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: systemAbilityDefinitions(system)
  })
  let committed = false
  for (const { capability } of passiveStartOfTurnEffects) {
    const run = await readRun()
    const waiting = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (query) =>
        query.eq('encounterId', encounterId).eq('state', 'PENDING')
      )
      .first()
    if (!run || waiting) continue
    await input.execute(
      systemTriggerStartOfTurnCommand({
        encounterId,
        expectedVersion: run.version,
        parentCommandId: input.parentCommandId,
        holderActorId: holder.id,
        actionId: capability.actionId
      })
    )
    committed = true
  }
  return committed
}
