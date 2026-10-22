import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRuleRollTriggerDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import {
  encounterConcealmentCheckPendingContextDtoSchema,
  type EncounterConcealmentCheckPendingContextDto
} from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import { concealmentCheckApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { prepareActiveRuleEffectRecord } from './activeRuleEffectRecords.js'
import { prepareEncounterConcealmentEffect } from './encounterActionEffectPlans.js'
import { projectNativeActionEffectTransitions } from './encounterActionEffectReceipts.js'
import { compileEncounterFeatureActionPlan } from './encounterActionEntryPointCompiler.js'
import { encounterActorRelationship } from './encounterActionTargetPolicy.js'
import type { EncounterBasicActionCapabilityDescriptor } from './encounterBasicActionCapabilityDiscovery.js'
import { storedCheckResult, type rollEncounterCheck } from './encounterBasicActionCheck.js'
import {
  concealmentsFoundBy,
  encounterConcealmentOf,
  observersHiddenFrom,
  passiveSkillDefinitionId,
  type EncounterConcealment
} from './encounterConcealment.js'
import { freezeD20Context } from './encounterD20Settlement.js'
import { rollModeCapabilityRegistry } from './platformPolicyModules.js'
import { EncounterValidationError } from './encounterErrors.js'
import { turnEffectOwner } from './encounterTurnEffectState.js'
import { discoverEncounterEventHooks } from './events/encounterEventHooks.js'
import { actorContestFacts, checkAbilityCode } from './encounterMovementPassagePreparation.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'
import { characterRuleActionSystemAdapterRegistry } from './platformEncounterPolicy.js'

type ConcealmentResolution = EncounterConcealmentCheckPendingContextDto['resolution']
type ConcealmentCheckDc = { kind: 'PASSIVE'; passiveDefinitionId: string } | { kind: 'CONCEALMENT' }

/** A concealment an actor holds, with the actor that holds it. */
type HeldConcealment = EncounterConcealment & { holderActorId: string }

/** Every concealment the actors' effects hold. */
export function heldConcealments(
  effectsByActorId: Iterable<readonly [string, readonly ActiveRuleEffectRecord[]]>
): HeldConcealment[] {
  return [...effectsByActorId].flatMap(([holderActorId, effects]) => {
    const concealment = encounterConcealmentOf(effects)
    return concealment ? [{ ...concealment, holderActorId }] : []
  })
}

/** A concealment check names no DC: its trigger shows the action and the check alone. */
export function encounterConcealmentCheckTrigger(
  context: Pick<EncounterConcealmentCheckPendingContextDto, 'actionLabel' | 'check'>
): Extract<EncounterRuleRollTriggerDto, { kind: 'BASIC_ACTION_CHECK' }> {
  return {
    kind: 'BASIC_ACTION_CHECK',
    actionLabel: context.actionLabel,
    checkLabel: context.check.label,
    dc: null
  }
}

/**
 * Freezes a concealment check (Hide, Search) from the roller's own facts and the scores it is
 * compared with: each non-allied observer's passive score (Hide), or the concealments that hide
 * someone from the roller (Search). An observer with no facts for the passive (a custom actor, or
 * one with no total) or that sees the roller clearly is left out, so a Hide never hides its roller
 * from it.
 */
export function prepareEncounterConcealmentCheck<
  TCharacterFacts extends CharacterMovementFacts
>(input: {
  gameSystemId: string
  commandId: string
  commandFingerprint: string
  actionId: string
  definition: { id: string; version: number; checksum: string; label: string }
  system: SystemAuthoredDto
  check: { checkKind: 'SKILL' | 'ABILITY'; checkDefinitionId: string }
  checkLabel: string
  dc: ConcealmentCheckDc
  /** Every actor in the Run, the roller included. */
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  rollerActorId: string
  /** The observers that see the roller clearly now; a Hide never hides it from them. */
  observersThatSee: ReadonlySet<string>
}): EncounterConcealmentCheckPendingContextDto {
  const roller = input.targets.get(input.rollerActorId)
  if (!roller) throw new EncounterValidationError('The roller is not in the Encounter.')
  if (roller.actor.kind === 'CUSTOM')
    throw new EncounterValidationError('A custom actor has no check to make.')
  const facts = actorContestFacts({
    actorId: roller.actor.id,
    checkKind: input.check.checkKind,
    checkDefinitionId: input.check.checkDefinitionId,
    gameSystemId: input.gameSystemId,
    system: input.system,
    targets: input.targets
  })
  if (facts.modifier === null)
    throw new EncounterValidationError('This actor has no total for the check.')
  const resolution: ConcealmentResolution =
    input.dc.kind === 'PASSIVE'
      ? {
          kind: 'CONCEAL',
          observers: concealmentObservers({ ...input, dc: input.dc, roller })
        }
      : {
          kind: 'DETECT',
          concealments: heldConcealments(
            [...input.targets].map(([actorId, target]) => [actorId, target.activeEffects] as const)
          )
            .filter(({ observerActorIds }) => observerActorIds.includes(roller.actor.id))
            .map(({ effect, holderActorId, concealmentTotal }) => ({
              effectId: effect.id,
              holderActorId,
              concealmentTotal
            }))
        }
  return encounterConcealmentCheckPendingContextDtoSchema.parse({
    kind: 'ENCOUNTER_CONCEALMENT_CHECK',
    schemaVersion: 1,
    commandId: input.commandId,
    commandFingerprint: input.commandFingerprint,
    definition: {
      id: input.definition.id,
      version: input.definition.version,
      checksum: input.definition.checksum
    },
    actionLabel: input.definition.label,
    actionId: input.actionId,
    actorId: roller.actor.id,
    check: { checkDefinitionId: input.check.checkDefinitionId, label: input.checkLabel },
    d20: freezeD20Context({
      gameSystemId: input.gameSystemId,
      ...facts,
      modifier: facts.modifier
    }),
    resolution,
    consumedGrants: discoverEncounterEventHooks({
      effects: roller.activeEffects,
      events: [
        {
          kind: 'TEST',
          test: 'CHECK',
          ability: {
            code: checkAbilityCode(
              input.system,
              input.check.checkKind,
              input.check.checkDefinitionId
            )
          }
        }
      ]
    }).ended
  })
}

function concealmentObservers<TCharacterFacts extends CharacterMovementFacts>(input: {
  gameSystemId: string
  system: SystemAuthoredDto
  dc: Extract<ConcealmentCheckDc, { kind: 'PASSIVE' }>
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  roller: MovementTarget<TCharacterFacts>
  observersThatSee: ReadonlySet<string>
}) {
  const skillId = passiveSkillDefinitionId(input.system, input.dc.passiveDefinitionId)
  if (!skillId) throw new EncounterValidationError('The System defines no skill for the passive.')
  return [...input.targets.values()].flatMap((observer) => {
    if (
      observer.actor.id === input.roller.actor.id ||
      observer.actor.kind === 'CUSTOM' ||
      input.observersThatSee.has(observer.actor.id) ||
      encounterActorRelationship(input.roller.actor.disposition, observer.actor.disposition) ===
        'ALLIED'
    )
      return []
    const facts = actorContestFacts({
      actorId: observer.actor.id,
      checkKind: 'SKILL',
      checkDefinitionId: skillId,
      gameSystemId: input.gameSystemId,
      system: input.system,
      targets: input.targets
    })
    return facts.modifier === null
      ? []
      : [
          {
            actorId: observer.actor.id,
            passiveScore: rollModeCapabilityRegistry.passiveScore({
              gameSystemId: input.gameSystemId,
              skillModifier: facts.modifier,
              rollMode: facts.rollMode
            })
          }
        ]
  })
}

/**
 * What a settled concealment check decided. Hide hides its roller from the observers whose frozen
 * passive score the total beats; Search finds each frozen concealment whose Stealth total the
 * total reaches and that still hides its holder from the roller. Ties go to the observer.
 */
export function decideEncounterConcealmentCheck(input: {
  context: EncounterConcealmentCheckPendingContextDto
  total: number
  /** The concealments the actors hold now; Search considers only those the check froze. */
  held: readonly HeldConcealment[]
}) {
  const { context, total } = input
  if (context.resolution.kind === 'CONCEAL')
    return {
      kind: 'CONCEAL' as const,
      hiddenFromActorIds: observersHiddenFrom(total, context.resolution.observers)
    }
  const frozen = new Set(context.resolution.concealments.map(({ effectId }) => effectId))
  return {
    kind: 'DETECT' as const,
    found: concealmentsFoundBy({
      searcherActorId: context.actorId,
      searchTotal: total,
      concealments: input.held.filter(({ effect }) => frozen.has(effect.id))
    }).map((found) => ({
      effect: found.effect,
      holderActorId: found.holderActorId,
      beforeObserverActorIds: [...found.observerActorIds],
      afterObserverActorIds: found.remainingObserverActorIds
    }))
  }
}

/**
 * The concealment a settled Hide stores on its roller, or null when its total beats no observer.
 * The roller holds and sources it; the capability supplies the authored effect plan.
 */
export function createEncounterConcealmentEffect(input: {
  id: string
  encounterId: string
  gameSystemId: string
  occurrenceId: string
  commandId: string
  occurredAt: string
  currentActorId: string | null
  roller: EncounterRunActorState
  rollerEffects: readonly ActiveRuleEffectRecord[]
  capability: EncounterBasicActionCapabilityDescriptor
  concealmentTotal: number
  observerActorIds: readonly string[]
}): ActiveRuleEffectRecord | null {
  const adapter = characterRuleActionSystemAdapterRegistry.find(input.gameSystemId)
  if (!adapter)
    throw new EncounterValidationError('The Encounter Game System cannot execute this action.')
  const plan = compileEncounterFeatureActionPlan(adapter, input.capability)
  if (plan.kind !== 'SINGLE_GRAPH')
    throw new EncounterValidationError('A concealment action compiles to one graph.')
  const [activeEffectPlan = null, ...others] =
    adapter.activeEffectPlans?.({ action: input.capability, published: plan.published }) ?? []
  if (others.length) throw new Error('Encounter action selected multiple active-effect plans.')
  const effect = prepareEncounterConcealmentEffect({
    encounterId: input.encounterId,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    sourceActorId: input.roller.id,
    sourceLabel: input.capability.label,
    sourceHidden: !input.roller.public,
    currentActorId: input.currentActorId,
    activeEffectPlan,
    concealment: {
      concealmentTotal: input.concealmentTotal,
      observerActorIds: input.observerActorIds
    },
    published: plan.published
  })
  if (!effect) return null
  return prepareActiveRuleEffectRecord({
    id: input.id,
    owner: turnEffectOwner(input.roller, input.encounterId),
    definition: effect.definition,
    lifecycle: effect.lifecycle,
    currentEffects: input.rollerEffects,
    occurredAt: input.occurredAt
  })
}

/**
 * The stored result of a settled concealment check. A Hide's created effect and a Search's found
 * concealments are the decision the caller applied; the receipt records them for the undo.
 */
export function completeEncounterConcealmentCheckResult(input: {
  context: EncounterConcealmentCheckPendingContextDto
  continuation: ServerRuleExecutionContinuationDto
  evaluated: Awaited<ReturnType<typeof rollEncounterCheck>>
  decision: ReturnType<typeof decideEncounterConcealmentCheck>
  createdEffect: ActiveRuleEffectRecord | null
  occurrenceVersion: number
  initialFactsChecksum: string
}) {
  const { context, continuation, evaluated, decision } = input
  const applicationOutputs = concealmentCheckApplicationOutputDtoSchema.parse({
    kind: 'CONCEALMENT_CHECK',
    schemaVersion: 1,
    occurrenceId: continuation.occurrenceId,
    commandId: context.commandId,
    definition: context.definition,
    actorId: context.actorId,
    check: { checkDefinitionId: context.check.checkDefinitionId },
    d20: evaluated.d20,
    resolution:
      decision.kind === 'CONCEAL'
        ? {
            kind: 'CONCEAL',
            hiddenFromActorIds: decision.hiddenFromActorIds,
            createdEffect:
              projectNativeActionEffectTransitions({
                state: null,
                recurring: input.createdEffect,
                targetActorId: context.actorId
              }).activeEffectTransitions[0] ?? null
          }
        : {
            kind: 'DETECT',
            found: decision.found.map(({ effect, ...found }) => ({
              activeEffectId: effect.id,
              ...found,
              afterVersion: effect.version + 1
            }))
          }
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
