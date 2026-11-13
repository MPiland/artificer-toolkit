import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import { systemTriggerAreaCommand } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { systemAbilityDefinitions } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { discoverEncounterEventHooks } from '@artificer-toolkit/rules-runtime/events/encounterEventHooks'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { raiseRoomChild } from './roomEncounterChildRaise.js'
import type { RoomTransaction } from './roomEncounterStore.js'
import { readRoomScene } from './roomSceneRead.js'

/**
 * Raises the actions the event table subscribes to their holder's defeat, once per committed command:
 * the one place that sees every transition to defeated, whichever root caused it. Each effect runs as
 * its own rule-raised root after the parent, so it reads the hit points the parent left. The roots
 * it raises never raise further effects, and a holder with no token in a Scene, or an Encounter that
 * already waits on a decision, raises nothing yet.
 * Returns whether any root committed.
 */
export async function raiseRoomHpZeroEffects(input: {
  ctx: EncounterWriteTransaction
  transaction: RoomTransaction
  encounterId: string
  parentCommandId: string
  defeatedBefore: ReadonlySet<string>
  execute(command: ResolveEncounterActionInputDto): Promise<unknown>
}) {
  const { ctx, encounterId } = input
  const first = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', encounterId))
    .unique()
  if (!first || first.status !== 'ACTIVE') return false
  const firstState = readRunState(first)
  const system = await ctx.ports.requireSystem(firstState.gameSystemId)
  const raised = []
  for (const actor of await readRunActors(ctx, firstState)) {
    if (actor.kind !== 'CREATURE' || !actor.defeated || input.defeatedBefore.has(actor.id)) continue
    const { raisedActions } = discoverEncounterFeatureActions({
      actor,
      conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: systemAbilityDefinitions(system),
      spells: new Map()
    })
    for (const { capability } of discoverEncounterEventHooks({
      raisedActions,
      events: [{ kind: 'DEFEATED' }]
    }).raisedActions)
      raised.push({ holderActorId: actor.id, actionId: capability.actionId })
  }
  let committed = false
  for (const { holderActorId, actionId } of raised) {
    const outcome = await raiseRoomChild({
      ctx,
      encounterId,
      execute: input.execute,
      command: async (run) => {
        const binding = await ctx.db
          .query('encounterActorTokenBindings')
          .withIndex('by_encounterId_actorId', (query) =>
            query.eq('encounterId', encounterId).eq('actorId', holderActorId)
          )
          .unique()
        return binding
          ? systemTriggerAreaCommand({
              encounterId,
              expectedVersion: run.version,
              parentCommandId: input.parentCommandId,
              holderActorId,
              actionId,
              scene: {
                sceneId: binding.sceneId,
                expectedSceneVersion: readRoomScene(input.transaction, binding.sceneId).header
                  .version
              }
            })
          : null
      }
    })
    if (outcome === 'RAISED') committed = true
  }
  return committed
}
