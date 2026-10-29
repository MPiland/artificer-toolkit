import { TARGET_NOTHING_TO_END_WARNING } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  encounterBasicActionDefinitionId,
  isEncounterBasicActionId
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  actionEndedEffects,
  actionUsedOnHolderEndedEffects,
  actsAgainstEnemy,
  actorCreatureTypeIdsOf,
  offerEndEffects,
  selectedEndedEffects
} from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import {
  preparedCastsSpell,
  preparedSpellCastLevel
} from '@artificer-toolkit/rules-runtime/encounterPreparedSpellCast'
import type { CommittedExecutionTrace } from '@artificer-toolkit/rules-runtime/executionOutcomeCapability'
import {
  encounterBasicActionCheckPendingSnapshot,
  startEncounterBasicActionCheck
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import { prepareEncounterCastReactionCheck } from '@artificer-toolkit/rules-runtime/encounterCastReactionCheck'
import { encounterActionSourceLabel } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { encounterBasicActionCheckLabel } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePreparation'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { executionOutcomeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformEncounterPolicy'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { encounterCheckActionContextDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCheckAction'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'

import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'

/**
 * An end-effects action's legal list is the target's own held effects it could end: one match is
 * picked for the caster, several need the caster's pick (a cast without one is rejected), none is
 * an overridable warning when ending is all the action does.
 */
export function planEndEffects(
  outcomes: readonly {
    kind: string
    endEffects?: Parameters<typeof offerEndEffects>[0]['endEffects']
  }[],
  held: readonly ActiveRuleEffectRecord[],
  target: { kind: string; chosenEffectId?: string },
  prepared: Parameters<typeof preparedSpellCastLevel>[0] & {
    actors: Parameters<typeof actorCreatureTypeIdsOf>[0]
  }
) {
  const [endEffects] = outcomes.flatMap((outcome) =>
    outcome.kind === 'EFFECT' && outcome.endEffects ? [outcome.endEffects] : []
  )
  const actorCreatureTypeIds = actorCreatureTypeIdsOf(prepared.actors)
  const offer = offerEndEffects({
    endEffects,
    held,
    actorCreatureTypeIds,
    chosenEffectId: target.chosenEffectId,
    castLevel: preparedSpellCastLevel(prepared)
  })
  if (offer.pick?.kind === 'UNCHOSEN')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: 'Choose which effect on the target this ends.'
    })
  // Nothing to end breaks a rule only when ending is all the action does; an action that also
  // grants (Fiendish Resilience replacing its earlier resistance) simply has nothing to replace yet.
  const onlyEnds = outcomes.every((outcome) => outcome.kind === 'EFFECT' && outcome.endEffects)
  const warnings: EncounterRuleWarningDto[] =
    endEffects && onlyEnds && offer.candidates.length === 0 && offer.checks.length === 0
      ? [TARGET_NOTHING_TO_END_WARNING]
      : []
  return { endEffects, offer, actorCreatureTypeIds, warnings }
}

/**
 * The effects the committed action ends: what a basic action used on the holder ends (rousing a
 * sleeper), else what the action's own end-effects outcome selects when the System says its
 * execution ends effects.
 */
export function endedByAction(
  plan: ReturnType<typeof planEndEffects>,
  command: { actorId: string; actionId: string },
  execution: CommittedExecutionTrace,
  held: readonly ActiveRuleEffectRecord[],
  {
    actor,
    target,
    state
  }: { actor: { id: string }; target: { id: string }; state: { gameSystemId: string } }
) {
  if (isEncounterBasicActionId(command.actorId, command.actionId))
    return actionUsedOnHolderEndedEffects({
      holderActorId: target.id,
      held,
      usedByActorId: actor.id,
      basicActionDefinitionId: encounterBasicActionDefinitionId(command.actionId)
    })
  const { endEffects, offer } = plan
  return endEffects &&
    executionOutcomeCapabilityRegistry.require(state.gameSystemId).endsEffects(execution)
    ? selectedEndedEffects({
        holderActorId: target.id,
        held,
        selectors: offer.selectors,
        castLevel: offer.castLevel,
        actorCreatureTypeIds: plan.actorCreatureTypeIds,
        originCreatureTypeIds: endEffects.originCreatureTypeIds,
        scope: endEffects.scope,
        chosenEffectId: offer.pick?.kind === 'CHOSEN' ? offer.pick.effectId : undefined
      })
    : null
}

/**
 * A reaction that casts a spell (Shield) ends the reactor's own cast-ended effects too, with the
 * reactor's one batch: the hit target's, since the reaction answers an attack on its caster.
 */
export function reactionCastEnded(
  reactionUse: {
    prepared: Parameters<typeof preparedCastsSpell>[0] & {
      actor: { id: string }
      target: { id: string }
    }
  } | null,
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>,
  consumedGrants: readonly { id: string }[],
  dispositions: Parameters<typeof actsAgainstEnemy>[0]['dispositions']
) {
  if (!reactionUse || !preparedCastsSpell(reactionUse.prepared)) return null
  const { actor, target } = reactionUse.prepared
  return actionEndedEffects({
    holderActorId: actor.id,
    held: (activeEffectsByActorId.get(actor.id) ?? []).filter(
      (effect) => !consumedGrants.some((ended) => ended.id === effect.id)
    ),
    makesAttackRoll: false,
    castsSpell: true,
    againstEnemy: actsAgainstEnemy({
      actorId: actor.id,
      targetActorIds: [target.id],
      dispositions
    })
  })
}

/**
 * The pending ability check a cast owes for the higher-level effects it may end (D182): the caster's
 * frozen d20 against the first candidate's DC, rolled under the cast's own command. Null when the cast
 * ends nothing by checks. The room persists it with the cast; each answer settles one candidate.
 */
export async function planEndEffectsChecks(input: {
  plan: ReturnType<typeof planEndEffects>
  executionOptions: { runtime: RulesRuntimeService }
  system: SystemAuthoredDto
  state: { gameSystemId: string; optionalCombatSnapshotChecksum: string | null }
  movementTargets: ReadonlyMap<string, MovementTarget>
  prepared: {
    actor: { id: string }
    target: { id: string }
    source: Parameters<typeof encounterActionSourceLabel>[0]
  }
  castOccurrenceId: string
  command: ResolveEncounterActionInputDto
  fingerprint: string
}) {
  const { plan, prepared } = input
  const entries = plan.offer.checks
  const [first] = entries
  const caster = input.movementTargets.get(prepared.actor.id)
  if (!plan.endEffects?.levelCheck || !first || !caster) return null
  const { checkDefinitionId, d20 } = prepareEncounterCastReactionCheck({
    requirement: { ability: plan.endEffects.levelCheck.ability, dc: first.dc },
    gameSystemId: input.state.gameSystemId,
    system: input.system,
    reactor: caster
  })
  const context = encounterCheckActionContextDtoSchema.parse({
    kind: 'ENCOUNTER_CHECK_ACTION',
    schemaVersion: 1,
    commandId: input.command.commandId,
    commandFingerprint: input.fingerprint,
    source: { kind: 'SPELL_CAST', castOccurrenceId: input.castOccurrenceId },
    actionLabel: encounterActionSourceLabel(prepared.source),
    actorId: prepared.actor.id,
    targetActorId: prepared.target.id,
    check: {
      checkDefinitionId,
      dc: first.dc,
      label: encounterBasicActionCheckLabel(input.system, checkDefinitionId)
    },
    d20,
    consumedGrants: [],
    candidates: { entries, cursor: 0 }
  })
  return encounterBasicActionCheckPendingSnapshot({
    continuation: await startEncounterBasicActionCheck({
      runtime: input.executionOptions.runtime,
      gameSystemId: input.state.gameSystemId,
      occurrenceId: crypto.randomUUID(),
      addedDice: d20.addedDice
    }),
    context: {
      ...context,
      commandJson: JSON.stringify(input.command),
      phase: { kind: 'CHECK' }
    },
    optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum
  })
}
