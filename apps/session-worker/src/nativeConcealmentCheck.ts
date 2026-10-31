import type {
  ConcealmentCheckSettlement,
  LiveSessionEncounterBasicActionCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { D20RolledCheckDto } from '@artificer-toolkit/schema/shared/ruleExecutionD20WindowOffer'
import type { EncounterConcealmentCheckPendingContextDto } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { EncounterBasicActionCapabilityDescriptor } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  encounterBasicActionCheckPendingSnapshot,
  rollEncounterCheck,
  startEncounterBasicActionCheck
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import { encounterHeldCheckDice } from '@artificer-toolkit/rules-runtime/encounterD20Window'
import { encounterBasicActionCheckLabel } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePreparation'
import {
  completeEncounterConcealmentCheckResult,
  createEncounterConcealmentEffect,
  decideEncounterConcealmentCheck,
  heldConcealments,
  prepareEncounterConcealmentCheck
} from '@artificer-toolkit/rules-runtime/encounterConcealmentCheck'
import { EncounterValidationError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { readNativeLiveObserversSeeing } from './nativeAttackPerception.js'
import {
  authoredCheckOf,
  basicCheckCapability,
  nativeLiveCheckCommitInput,
  type NativeLiveCheckActionInput
} from './nativeCheckAction.js'

/**
 * Settles a rolled concealment check (Hide, Search) against the actors as they are now: decides
 * it from the check's total, stores a Hide's concealment on its roller, and builds the stored
 * result. Convex re-derives the decision from the context and total and records it.
 */
export function settleNativeConcealmentCheck(input: {
  context: EncounterConcealmentCheckPendingContextDto
  continuation: ServerRuleExecutionContinuationDto
  /** The check's d20, as the roller rolled it or a d20 window settled it. */
  rolled: D20RolledCheckDto
  appRollId: string | null
  /** The held die a d20 window spent on the roll, when one opened. */
  window?: ConcealmentCheckSettlement['window']
  state: { id: string; gameSystemId: string; currentActorId: string | null }
  actors: readonly EncounterRunActorState[]
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  capability: EncounterBasicActionCapabilityDescriptor
  occurredAt: string
  occurrenceVersion: number
}): ConcealmentCheckSettlement {
  const { context, continuation, rolled, state } = input
  const decision = decideEncounterConcealmentCheck({
    context,
    total: rolled.d20.total,
    held: heldConcealments(input.activeEffectsByActorId)
  })
  const roller = input.actors.find((entry) => entry.id === context.actorId)
  if (!roller) throw new Error('The concealment check roller is unavailable.')
  const createdEffect =
    decision.kind === 'CONCEAL' && decision.hiddenFromActorIds.length > 0
      ? createEncounterConcealmentEffect({
          id: crypto.randomUUID(),
          encounterId: state.id,
          gameSystemId: state.gameSystemId,
          occurrenceId: continuation.occurrenceId,
          commandId: context.commandId,
          occurredAt: input.occurredAt,
          currentActorId: state.currentActorId,
          roller,
          rollerEffects: input.activeEffectsByActorId.get(roller.id) ?? [],
          capability: input.capability,
          concealmentTotal: rolled.d20.total,
          observerActorIds: decision.hiddenFromActorIds
        })
      : null
  const { result } = completeEncounterConcealmentCheckResult({
    context,
    continuation,
    evaluated: rolled,
    decision,
    createdEffect,
    occurrenceVersion: input.occurrenceVersion,
    initialFactsChecksum: rolled.initialFactsChecksum
  })
  return {
    context,
    execution: result,
    appRollId: input.appRollId,
    createdEffect,
    ...(input.window && { window: input.window })
  }
}

/**
 * Plans a concealment CHECK action (Hide, Search): the actor makes its one authored check, and the
 * result is compared per creature, each observer's passive score or each concealment's Stealth
 * total. The check pends on the actor's d20, or settles here when the roller's preference rolls
 * for them. Convex records the plan; it evaluates none of it.
 */
export async function planNativeLiveConcealmentCheckAction(
  input: NativeLiveCheckActionInput & {
    /** Every actor in the Run, loaded: a concealment check compares the roller with each. */
    targets: ReadonlyMap<string, NativeLiveCheckActionInput['actor']>
    state: Parameters<typeof readNativeLiveObserversSeeing>[0]['state']
    activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
    /** The action's locked Scene; null for an action without Scene positions. */
    sceneContext: Parameters<typeof readNativeLiveObserversSeeing>[0]['sceneContext'] | null
    capture: Parameters<typeof readNativeLiveObserversSeeing>[0]['capture']
  }
) {
  const { command, state, actor, targets } = input
  const capability = basicCheckCapability(input.source)
  const { checkKind, checkDefinitionId, dc } = authoredCheckOf(capability)
  if (dc.kind !== 'PASSIVE' && dc.kind !== 'CONCEALMENT')
    throw new EncounterValidationError('The selected action makes no concealment check.')
  // On a Scene a Hide cannot hide its roller from an observer that sees it clearly. Without one
  // (the neutral environment, where everyone sees everyone) the GM decides the circumstances.
  const observersThatSee =
    dc.kind === 'PASSIVE' && input.sceneContext
      ? await readNativeLiveObserversSeeing({
          state,
          system: input.system,
          subject: actor,
          observers: [...targets.values()].filter(
            (target) => target.actor.id !== actor.actor.id && target.actor.kind !== 'CUSTOM'
          ),
          sceneContext: input.sceneContext,
          capture: input.capture
        })
      : new Set<string>()
  const context = prepareEncounterConcealmentCheck({
    gameSystemId: state.gameSystemId,
    commandId: command.commandId,
    commandFingerprint: input.fingerprint,
    actionId: capability.actionId,
    definition: {
      id: capability.definitionId,
      version: capability.definitionVersion,
      checksum: capability.definitionChecksum,
      label: capability.label
    },
    system: input.system,
    check: { checkKind, checkDefinitionId },
    checkLabel: encounterBasicActionCheckLabel(input.system, checkDefinitionId),
    dc,
    targets,
    rollerActorId: actor.actor.id,
    observersThatSee
  })
  const occurrenceId = crypto.randomUUID()
  const continuation = await startEncounterBasicActionCheck({
    runtime: input.runtime,
    gameSystemId: state.gameSystemId,
    occurrenceId,
    addedDice: context.d20.addedDice
  })
  // A roller holding after-roll dice sees its d20 before the check settles, so it rolls the d20 itself.
  const autoRoll =
    encounterHeldCheckDice(input.system, input.actorEffects, checkDefinitionId).length > 0
      ? null
      : input.autoRoll
  const check: LiveSessionEncounterBasicActionCommitInput['check'] = autoRoll
    ? {
        kind: 'SETTLED',
        settlement: settleNativeConcealmentCheck({
          context,
          continuation,
          rolled: {
            ...(await rollEncounterCheck({
              gameSystemId: state.gameSystemId,
              runtime: input.runtime,
              context,
              continuation,
              answer: { kind: 'AUTO_ROLL', requestId: continuation.request.requestId },
              rollD20: () => autoRoll(20) + 1,
              random: autoRoll,
              expectedOccurrenceId: occurrenceId
            })),
            initialFactsChecksum: checksumRuleDocument(continuation.facts)
          },
          appRollId: null,
          state,
          actors: input.actors,
          activeEffectsByActorId: input.activeEffectsByActorId,
          capability,
          occurredAt: new Date().toISOString(),
          occurrenceVersion: 0
        })
      }
    : {
        kind: 'PENDING',
        snapshot: encounterBasicActionCheckPendingSnapshot({
          continuation,
          context,
          optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
        })
      }
  return {
    kind: 'CHECK' as const,
    input: nativeLiveCheckCommitInput(input, { check, consumedGrants: context.consumedGrants })
  }
}
