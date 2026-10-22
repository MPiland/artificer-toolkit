import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { escapeCheckApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import { encounterEscapeCheckPendingContextDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import {
  evaluateEncounterBasicActionCheck,
  storedCheckResult
} from './encounterBasicActionCheck.js'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  endedMaintenanceConditions,
  planEncounterMaintenanceOwner
} from './encounterActionMaintenance.js'
import { discoverEncounterEventHooks } from './events/encounterEventHooks.js'
import { turnEffectOwner } from './encounterTurnEffectState.js'
import { freezeD20Context } from './encounterD20Settlement.js'
import { EncounterValidationError } from './encounterErrors.js'
import {
  encounterRelationships,
  type EncounterRelationshipActiveEffectsByActorId
} from './encounterRelationshipActionFacts.js'
import {
  encounterActorsWithinReach,
  type EncounterReachScene
} from './encounterRelationshipEnds.js'
import {
  actorContestFacts,
  checkAbilityCode,
  encounterBasicActionCheckLabel
} from './encounterMovementPassagePreparation.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'

export const ESCAPE_ACTION_LABEL = 'Escape'

type EffectDefinition = Extract<ActiveRuleEffectRecord['definition'], { schemaVersion: 2 }>
type EscapeModule = Extract<
  Extract<
    EffectDefinition['stateContributions'][number],
    { kind: 'ACTOR_RELATIONSHIP' }
  >['modules'][number],
  { kind: 'ESCAPE_CHECK' }
>
type EncounterEscapeCheckPendingContextDto = ReturnType<
  typeof encounterEscapeCheckPendingContextDtoSchema.parse
>

/**
 * A fixed-DC escape the held creature itself may attempt (D105, D146). `escapeSourceId` is the
 * relationship's escape module or the zone holding a condition, and `zoneLabel` names that zone.
 */
export type EncounterHolderEscape = {
  escapeSourceId: string
  activation: EscapeModule['activation']
  checks: EscapeModule['checks']
  dc: number
  zoneLabel: string | null
}

/** Who an escape module lets attempt it: the held creature, or another creature within reach of it. */
type EscapeActorKind = EscapeModule['actorKinds'][number]

function fixedEscapeFromModules(
  modules: readonly Extract<
    EffectDefinition['stateContributions'][number],
    { kind: 'ACTOR_RELATIONSHIP' }
  >['modules'][number][],
  actorKind: EscapeActorKind
): EncounterHolderEscape | null {
  for (const module of modules)
    if (
      module.kind === 'ESCAPE_CHECK' &&
      module.dc.kind === 'FIXED' &&
      module.actorKinds.includes(actorKind)
    )
      return {
        escapeSourceId: module.id,
        activation: module.activation,
        checks: module.checks,
        dc: module.dc.value,
        zoneLabel: null
      }
  return null
}

/**
 * The fixed-DC escape an effect offers `actorKind`, or null: the held creature itself (`TARGET`,
 * the default) may also break a zone's hold, which a rescuer may not. A CONTEST DC is attempted
 * elsewhere, and only by the held creature.
 */
export function findEncounterHolderEscape(
  effect: Pick<ActiveRuleEffectRecord, 'definition'>,
  actorKind: EscapeActorKind = 'TARGET'
): EncounterHolderEscape | null {
  if (effect.definition.schemaVersion !== 2) return null
  const { stateContributions } = effect.definition
  const heldBySpatialEffectId = stateContributions.flatMap((held) =>
    held.kind === 'CONDITION_OWNERSHIP' && held.heldBySpatialEffectId
      ? [held.heldBySpatialEffectId]
      : []
  )[0]
  for (const contribution of stateContributions) {
    if (contribution.kind === 'CONDITION_ESCAPE' && heldBySpatialEffectId && actorKind === 'TARGET')
      return {
        escapeSourceId: heldBySpatialEffectId,
        activation: contribution.activation,
        checks: contribution.checks,
        dc: contribution.dc,
        zoneLabel: contribution.label
      }
    if (contribution.kind !== 'ACTOR_RELATIONSHIP') continue
    const escape = fixedEscapeFromModules(contribution.modules, actorKind)
    if (escape) return escape
  }
  return null
}

/**
 * The holds `actorId` may break for another creature (ATTACK-7.9): a fixed-DC escape whose module
 * allows `CREATURE_WITHIN_REACH`, on a creature that stands within the reach the hold sealed, and
 * not a hold `actorId` applied itself (letting go of your own hold is a release). A pair the Scene
 * does not place is not offered. A CONTEST DC is not offered to a rescuer.
 */
export function findEncounterRescues(input: {
  actorId: string
  activeEffectsByActorId: EncounterRelationshipActiveEffectsByActorId
  scene: EncounterReachScene | null
}) {
  return encounterRelationships(input.activeEffectsByActorId).flatMap(
    ({ sourceActorId, actorId: heldActorId, effect, contribution }) => {
      const escape = fixedEscapeFromModules(contribution.modules, 'CREATURE_WITHIN_REACH')
      return escape &&
        heldActorId !== input.actorId &&
        sourceActorId !== input.actorId &&
        encounterActorsWithinReach(
          input.scene,
          input.actorId,
          heldActorId,
          contribution.sealedReachFeet
        )
        ? [{ heldActorId, sourceActorId, effect, ...escape }]
        : []
    }
  )
}

/**
 * The escape a held creature may attempt from an effect whose holder contests it (D152), or null:
 * the escaper rolls one of `checks`, and the holder (`holderActorId`, the effect's source) answers
 * with one of `contestChecks`.
 */
export function findEncounterHolderContestEscape(
  effect: Pick<ActiveRuleEffectRecord, 'definition'>
) {
  if (effect.definition.schemaVersion !== 2) return null
  const { origin } = effect.definition
  if (origin.kind !== 'ENCOUNTER' || origin.sourceActorId === null) return null
  const holderActorId = origin.sourceActorId
  for (const contribution of effect.definition.stateContributions) {
    if (contribution.kind !== 'ACTOR_RELATIONSHIP') continue
    for (const module of contribution.modules)
      if (
        module.kind === 'ESCAPE_CHECK' &&
        module.dc.kind === 'CONTEST' &&
        module.actorKinds.includes('TARGET')
      )
        return {
          escapeSourceId: module.id,
          activation: module.activation,
          checks: module.checks,
          contestChecks: module.dc.checks,
          holderActorId
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

/**
 * Freezes an Escape check from the roller's own facts: the fixed DC, the chosen allowed check's
 * modifier and contributors (conditions included). `holder` is the roller; with `rescued` it is a
 * rescuer within reach (ATTACK-7.9) and `rescued.effect` is the effect the held creature carries.
 * A custom actor has no check facts.
 */
export function prepareEncounterEscapeCheck<TCharacterFacts extends CharacterMovementFacts>(input: {
  gameSystemId: string
  commandId: string
  commandFingerprint: string
  system: SystemAuthoredDto
  holder: MovementTarget<TCharacterFacts>
  rescued?: { actorId: string; effect: ActiveRuleEffectRecord }
  activeEffectId: string
  checkDefinitionId: string
}): EncounterEscapeCheckPendingContextDto {
  const { holder, rescued } = input
  if (holder.actor.kind === 'CUSTOM')
    throw new EncounterValidationError('A custom actor has no check to make.')
  const effect = rescued
    ? rescued.effect
    : holder.activeEffects.find((entry) => entry.id === input.activeEffectId)
  if (!effect || effect.id !== input.activeEffectId)
    throw new EncounterValidationError('The creature does not hold that effect.')
  const escape = findEncounterHolderEscape(effect, rescued ? 'CREATURE_WITHIN_REACH' : 'TARGET')
  if (!escape)
    throw new EncounterValidationError('This effect has no fixed-DC escape for the creature.')
  const checkKind = escape.checks.skillIds.includes(input.checkDefinitionId)
    ? 'SKILL'
    : escape.checks.abilityDefinitionIds.includes(input.checkDefinitionId)
      ? 'ABILITY'
      : null
  if (!checkKind) throw new EncounterValidationError('The escape does not allow that check.')
  const facts = actorContestFacts({
    actorId: holder.actor.id,
    checkKind,
    checkDefinitionId: input.checkDefinitionId,
    gameSystemId: input.gameSystemId,
    system: input.system,
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
    ...(rescued && { heldActorId: rescued.actorId }),
    activeEffectId: effect.id,
    escapeSourceId: escape.escapeSourceId,
    check: {
      checkDefinitionId: input.checkDefinitionId,
      dc: escape.dc,
      label: encounterBasicActionCheckLabel(input.system, input.checkDefinitionId)
    },
    d20: freezeD20Context({
      gameSystemId: input.gameSystemId,
      ...facts,
      modifier: facts.modifier
    }),
    consumedGrants: discoverEncounterEventHooks({
      effects: holder.activeEffects,
      events: [
        {
          kind: 'TEST',
          test: 'CHECK',
          ability: { code: checkAbilityCode(input.system, checkKind, input.checkDefinitionId) }
        }
      ]
    }).ended
  })
}

/**
 * The stored result of a settled Escape check. `effectStillHeld` is false when the holding effect
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
    ...(context.heldActorId && { heldActorId: context.heldActorId }),
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
