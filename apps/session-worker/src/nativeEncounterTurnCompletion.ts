import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  encounterRunStateSchema,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { prepareEncounterTurn } from '@artificer-toolkit/rules-runtime/encounterTurnPreparation'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import {
  labelTurnEffectDamage,
  legendaryActionDamage,
  nativeConcentrationDamageApplications,
  nativeConcentrationDamageSourceLabels
} from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { buildMovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import { applyEncounterConditionMechanics } from '@artificer-toolkit/rules-runtime/encounterConditionMechanics'
import { withInterceptionSaveRolls } from '@artificer-toolkit/rules-runtime/encounterInterceptionSaveRolls'
import { planNativeLiveConcentration } from './nativeEncounterConcentration.js'
import { readNativeLiveMaintenanceSlot } from './nativeEncounterMaintenance.js'
import type { PreparedLiveCharacterSheet } from './nativeCharacterRules.js'

type CharacterFacts = PreparedLiveCharacterSheet

/** Projects the same post-turn state that the terminal transaction will expose to concentration. */
export async function prepareNativeLiveTurnCompletion(input: {
  state: EncounterRunState
  prepared: Extract<
    Awaited<ReturnType<typeof prepareEncounterTurn<CharacterFacts>>>,
    { kind: 'COMPLETE' }
  >
  occurrenceId: string
  occurredAt: string
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  capture(request: LiveSessionEncounterRulesRequest): Promise<LiveSessionEncounterRulesResponse>
  runtime: RulesRuntimeService
  random(maximum: number): number
  /** Each actor's roller preference; a Concentration check goes to its actor's controllers. */
  autoRollByActorId: Readonly<Record<string, boolean>>
}) {
  const { prepared, state } = input
  const executions = [prepared.outgoing?.plan, prepared.incoming.plan].flatMap(
    (plan) => plan?.executions ?? []
  )
  const lifecycleById = new Map(
    executions.map((execution) => [execution.activeEffectId, execution.lifecycle])
  )
  const projectEffect = (effect: ActiveRuleEffectRecord): ActiveRuleEffectRecord[] => {
    const lifecycle = lifecycleById.get(effect.id)
    if (!lifecycle) return [effect]
    if (lifecycle.kind === 'EXPIRE') return []
    return [
      {
        ...effect,
        version: lifecycle.afterVersion,
        lifecycle: {
          ...effect.lifecycle,
          remainingTicks: lifecycle.afterRemainingTicks,
          ...(lifecycle.afterSaveTally ? { saveTally: lifecycle.afterSaveTally } : {})
        },
        lifecycleChecksum: lifecycle.afterLifecycleChecksum
      }
    ]
  }
  const activeEffectsByActorId = new Map(
    [...input.activeEffectsByActorId].map(([actorId, effects]) => [
      actorId,
      effects.flatMap(projectEffect)
    ])
  )
  const projectedTargets = new Map(prepared.incoming.movementTargets)
  for (const [actorId, target] of projectedTargets) {
    const actor = prepared.actors.find((value) => value.id === actorId)
    if (!actor) throw new Error('Turn concentration actor is unavailable.')
    projectedTargets.set(
      actorId,
      withInterceptionSaveRolls({
        gameSystemId: state.gameSystemId,
        target: applyEncounterConditionMechanics({
          target: {
            ...buildMovementTarget({
              actor,
              activeEffects: activeEffectsByActorId.get(actorId) ?? [],
              characterFacts: target.characterFacts,
              campaignId: state.campaignId,
              gameSystemId: state.gameSystemId,
              includeReactionSources: target.characterReactionSource !== undefined
            }),
            conditionDefinitions: target.conditionDefinitions
          },
          gameSystemId: state.gameSystemId
        }),
        random: input.random
      })
    )
  }
  const endedStates = new Set<string>()
  const touchedStates = new Set(
    [...input.activeEffectsByActorId.values()].flatMap((effects) =>
      effects.flatMap((effect) =>
        effect.maintainedEffectStateId && lifecycleById.get(effect.id)?.kind === 'EXPIRE'
          ? [effect.maintainedEffectStateId]
          : []
      )
    )
  )
  for (const stateId of touchedStates) {
    const response = await input.capture({ kind: 'MAINTENANCE_STATE', stateId })
    if (response.kind !== 'MAINTENANCE_STATE' || !response.state)
      throw new Error('Turn maintenance state is unavailable.')
    const maintained = response.state
    if (maintained.descriptor.emptyDependentPolicy !== 'TERMINATE_WHEN_EMPTY') continue
    const slot = await readNativeLiveMaintenanceSlot({
      encounterId: state.id,
      actorId: maintained.ownerActorId,
      definitionId: maintained.maintenanceDefinitionId,
      capture: input.capture
    })
    if (slot.state?.id !== stateId) throw new Error('Turn maintenance slot changed.')
    if (slot.dependents.flatMap(projectEffect).length === 0 && slot.zoneIds.length === 0)
      endedStates.add(stateId)
  }
  const nextState = encounterRunStateSchema.parse({
    ...state,
    ...prepared.root.proposedTerminalTransition,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const readLabel = async (definitionId: string) => {
    const response = await input.capture({ kind: 'DEFINITION', definitionId })
    if (response.kind !== 'DEFINITION') throw new Error('Turn effect definition is unavailable.')
    return response.definition?.label ?? null
  }
  // The same order the terminal receipt keeps: outgoing effects, Legendary Actions, incoming effects.
  const damage = [
    ...(await labelTurnEffectDamage(prepared.outgoing?.plan?.executions ?? [], readLabel)),
    ...legendaryActionDamage(prepared.root.completedLegendaryActions),
    ...(await labelTurnEffectDamage(prepared.incoming.plan?.executions ?? [], readLabel))
  ]
  const concentration = await planNativeLiveConcentration({
    state: nextState,
    autoRollByActorId: input.autoRollByActorId,
    parentOccurrenceId: input.occurrenceId,
    parentCommandFingerprint: prepared.root.commandFingerprint,
    applications: nativeConcentrationDamageApplications(damage),
    sourceLabels: nativeConcentrationDamageSourceLabels(damage),
    occurredAt: input.occurredAt,
    settlement: {
      actors: prepared.actors,
      projectedTargets,
      activeEffectsByActorId,
      maintenanceOwners: [],
      maintainedState: null,
      createdEffects: []
    },
    capture: async (request) => {
      const response = await input.capture(request)
      if (
        response.kind === 'MAINTENANCE_SLOT' &&
        response.state &&
        endedStates.has(response.state.id)
      )
        return { ...response, state: null }
      if (response.kind === 'MAINTENANCE_DEPENDENTS')
        return { ...response, effects: response.effects.flatMap(projectEffect) }
      return response
    },
    runtime: input.runtime,
    random: input.random
  })
  const facts = buildEncounterActorRuleFacts({ actors: concentration.actors })
  const rules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
    facts
  )
  return { concentration, rules }
}
