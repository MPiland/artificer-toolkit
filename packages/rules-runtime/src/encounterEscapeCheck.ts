import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { escapeCheckApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import { encounterEscapeCheckPendingContextDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  encounterBasicActionCheckLabel,
  evaluateEncounterBasicActionCheck,
  storedCheckResult
} from './encounterBasicActionCheck.js'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  endedMaintenanceConditions,
  planEncounterMaintenanceOwner
} from './encounterActionMaintenance.js'
import { turnEffectOwner } from './encounterTurnEffectState.js'
import { EncounterValidationError } from './encounterErrors.js'
import { actorContestFacts } from './encounterMovementPassagePreparation.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'

export const ESCAPE_ACTION_LABEL = 'Escape'

type EffectDefinition = Extract<ActiveRuleEffectRecord['definition'], { schemaVersion: 2 }>
type RelationshipContribution = Extract<
  EffectDefinition['stateContributions'][number],
  { kind: 'ACTOR_RELATIONSHIP' }
>
type EscapeModule = Extract<RelationshipContribution['modules'][number], { kind: 'ESCAPE_CHECK' }>
type EncounterEscapeCheckPendingContextDto = ReturnType<
  typeof encounterEscapeCheckPendingContextDtoSchema.parse
>

/**
 * The fixed-DC escape the held creature itself may attempt from an effect, or null: a CONTEST DC
 * and a `CREATURE_WITHIN_REACH` rescuer are attempted elsewhere.
 */
export function findEncounterHolderEscape(
  effect: Pick<ActiveRuleEffectRecord, 'definition'>
): { relationshipOutcomeId: string; module: EscapeModule; dc: number } | null {
  if (effect.definition.schemaVersion !== 2) return null
  for (const contribution of effect.definition.stateContributions) {
    if (contribution.kind !== 'ACTOR_RELATIONSHIP') continue
    for (const module of contribution.modules) {
      if (
        module.kind === 'ESCAPE_CHECK' &&
        module.dc.kind === 'FIXED' &&
        module.actorKinds.includes('TARGET')
      )
        return {
          relationshipOutcomeId: contribution.relationshipOutcomeId,
          module,
          dc: module.dc.value
        }
    }
  }
  return null
}

/**
 * The conditions an escape from `activeEffectId` removes from its holder: those only that effect
 * held, in a stable order. The room plans them and the commit re-derives them.
 */
export function encounterEscapeEndedConditionIds(
  holderEffects: readonly ActiveRuleEffectRecord[],
  activeEffectId: string
): string[] {
  return [
    ...endedMaintenanceConditions(
      holderEffects.filter((effect) => effect.id === activeEffectId),
      holderEffects.filter((effect) => effect.id !== activeEffectId)
    )
  ].sort()
}

/**
 * The Run actors once `holderId` has escaped `activeEffectId`: a creature loses the conditions only
 * that effect held. A Character's conditions live on its Sheet, which the rules never read.
 */
export function encounterActorsAfterEscape(input: {
  encounterId: string
  actors: readonly EncounterRunActorState[]
  holderId: string
  holderEffects: readonly ActiveRuleEffectRecord[]
  activeEffectId: string
}): EncounterRunActorState[] {
  const holder = input.actors.find((actor) => actor.id === input.holderId)
  const effect = input.holderEffects.find((entry) => entry.id === input.activeEffectId)
  if (!holder || !effect) throw new Error('The escaping actor is unavailable.')
  if (holder.kind !== 'CREATURE') return [...input.actors]
  const released = planEncounterMaintenanceOwner({
    owner: turnEffectOwner(holder, input.encounterId),
    removed: [effect],
    remaining: input.holderEffects.filter((entry) => entry.id !== effect.id),
    actors: input.actors,
    character: null
  }).actors.find((planned) => planned.before.id === holder.id)
  return input.actors.map((actor) => (actor.id === holder.id && released ? released.after : actor))
}

/** The check's name as the roller reads it: "Strength" or "Strength (Athletics)". */
export function encounterEscapeCheckLabel(
  system: SystemAuthoredDto,
  checkDefinitionId: string
): string {
  if ('schemaVersion' in system && system.schemaVersion === 4) {
    const ability = system.abilities.find((entry) => entry.id === checkDefinitionId)
    if (ability) return ability.label
  }
  return encounterBasicActionCheckLabel(system, checkDefinitionId)
}

/**
 * Freezes a held creature's Escape check from its own facts: the fixed DC, the chosen allowed
 * check's modifier and contributors (conditions included). A custom actor has no check facts.
 */
export function prepareEncounterEscapeCheck<TCharacterFacts extends CharacterMovementFacts>(input: {
  gameSystemId: string
  commandId: string
  commandFingerprint: string
  system: SystemAuthoredDto
  holder: MovementTarget<TCharacterFacts>
  activeEffectId: string
  checkDefinitionId: string
}): EncounterEscapeCheckPendingContextDto {
  const { holder } = input
  if (holder.actor.kind === 'CUSTOM')
    throw new EncounterValidationError('A custom actor has no check to make.')
  const effect = holder.activeEffects.find((entry) => entry.id === input.activeEffectId)
  if (!effect) throw new EncounterValidationError('The creature does not hold that effect.')
  const escape = findEncounterHolderEscape(effect)
  if (!escape)
    throw new EncounterValidationError('This effect has no fixed-DC escape for the creature.')
  const { module } = escape
  const checkKind = module.checks.skillIds.includes(input.checkDefinitionId)
    ? 'SKILL'
    : module.checks.abilityDefinitionIds.includes(input.checkDefinitionId)
      ? 'ABILITY'
      : null
  if (!checkKind) throw new EncounterValidationError('The escape does not allow that check.')
  const facts = actorContestFacts({
    actorId: holder.actor.id,
    checkKind,
    checkDefinitionId: input.checkDefinitionId,
    gameSystemId: input.gameSystemId,
    targets: new Map([[holder.actor.id, holder]])
  })
  if (facts.modifier === null)
    throw new EncounterValidationError('This actor has no total for the check.')
  return encounterEscapeCheckPendingContextDtoSchema.parse({
    kind: 'ENCOUNTER_ESCAPE_CHECK',
    schemaVersion: 1,
    commandId: input.commandId,
    commandFingerprint: input.commandFingerprint,
    actionLabel: ESCAPE_ACTION_LABEL,
    actorId: holder.actor.id,
    activeEffectId: effect.id,
    relationshipOutcomeId: escape.relationshipOutcomeId,
    escapeModuleId: module.id,
    check: {
      checkDefinitionId: input.checkDefinitionId,
      dc: escape.dc,
      label: encounterEscapeCheckLabel(input.system, input.checkDefinitionId)
    },
    d20: {
      rollMode: facts.rollMode,
      contributors: facts.contributors,
      contributorChecksum: checksumRuleDocument(facts.contributors),
      modifier: facts.modifier
    }
  })
}

/**
 * The stored result of a settled Escape check. `effectStillHeld` is false when the relationship
 * ended while a prompted roll waited; `removedConditionIds` are the conditions an escape removed.
 */
export function completeEncounterEscapeCheckResult(input: {
  context: EncounterEscapeCheckPendingContextDto
  continuation: ServerRuleExecutionContinuationDto
  evaluated: Awaited<ReturnType<typeof evaluateEncounterBasicActionCheck>>
  effectStillHeld: boolean
  removedConditionIds: readonly string[]
  occurrenceVersion: number
  initialFactsChecksum: string
}) {
  const { context, continuation, evaluated } = input
  const applicationOutputs = escapeCheckApplicationOutputDtoSchema.parse({
    kind: 'ESCAPE_CHECK',
    schemaVersion: 1,
    occurrenceId: continuation.occurrenceId,
    commandId: context.commandId,
    actorId: context.actorId,
    activeEffectId: context.activeEffectId,
    check: { checkDefinitionId: context.check.checkDefinitionId, dc: context.check.dc },
    d20: evaluated.d20,
    outcome: !input.effectStillHeld ? 'ALREADY_ENDED' : evaluated.reachesDc ? 'ESCAPED' : 'FAILED',
    removedConditionIds:
      input.effectStillHeld && evaluated.reachesDc ? input.removedConditionIds : []
  })
  return {
    result: storedCheckResult({
      evaluated,
      continuation,
      occurrenceVersion: input.occurrenceVersion,
      initialFactsChecksum: input.initialFactsChecksum,
      applicationOutputs
    }),
    applicationOutputs
  }
}
