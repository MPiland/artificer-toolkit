import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import {
  planNativeEncounterAreaSourceSpend,
  type NativeEncounterActionMechanicsInput
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  actionEndedEffects,
  actsAgainstEnemy
} from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'

type Prepared = NativeEncounterActionMechanicsInput['prepared']

/**
 * What the source of an action that did nothing (countered, or stopped by a ward) still pays: its slot,
 * resource or item, its action economy, and the effects of its own that end on an attack or a cast. Nothing
 * is stored; the terminal commit applies the spend and the sealed record.
 */
export function planNativeLostSourceAction(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  prepared: Prepared
  /** The effects the source holds; the lost action still ends those that end on an attack or a cast. */
  sourceEffects: readonly ActiveRuleEffectRecord[]
  makesAttackRoll: boolean
  castsSpell: boolean
  actionEconomy: Parameters<typeof consumeEncounterActionEconomy>[0]['consumption'] | null
  ruleOverrides: Parameters<typeof overridesActionEconomy>[0]
  occurrenceId: string
  commandId: string
  occurredAt: string
  userId: string
  /** Counters the source cast against a counter of its own cast, spent in the source's one batch. */
  counterSpellConsumptions?: Parameters<
    typeof planNativeEncounterAreaSourceSpend
  >[0]['counterSpellConsumptions']
}) {
  const { state, prepared, actionEconomy } = input
  const dispositions = new Map(input.actors.map(({ id, disposition }) => [id, disposition]))
  const { consumedGrants, sourceReleases } = actionEndedEffects({
    holderActorId: prepared.actor.id,
    held: input.sourceEffects,
    makesAttackRoll: input.makesAttackRoll,
    castsSpell: input.castsSpell,
    againstEnemy: actsAgainstEnemy({
      actorId: prepared.actor.id,
      targetActorIds: [prepared.target.id],
      dispositions
    })
  })
  const spend = planNativeEncounterAreaSourceSpend(
    {
      prepared,
      encounterId: state.id,
      expectedEncounterVersion: state.version,
      occurrenceId: input.occurrenceId,
      sourceCommandId: input.commandId,
      commandId: input.commandId,
      occurredAt: input.occurredAt,
      sourceReleases,
      counterSpellConsumptions: input.counterSpellConsumptions ?? []
    },
    input.userId
  )
  return {
    spend,
    consumedGrants,
    settledSource: actionEconomy
      ? consumeEncounterActionEconomy({
          actor: spend.settledSource,
          consumption: actionEconomy,
          overridden: overridesActionEconomy(input.ruleOverrides)
        })
      : spend.settledSource
  }
}
