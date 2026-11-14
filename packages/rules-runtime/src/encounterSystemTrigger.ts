import { v5 as uuidv5 } from 'uuid'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { AreaAimDto } from '@artificer-toolkit/schema/shared/spatialFacts'
import type { AttackOccasionCode } from '@artificer-toolkit/shared/core'

const NAMESPACE = '6b0c2f0e-3d0a-5c1e-9f55-0a7f1d9a4c21'

/** A reaction attack provoked by movement is an opportunity attack. */
export const MOVEMENT_REACTION_ATTACK_OCCASION: AttackOccasionCode = 'OPPORTUNITY'

/** One trigger per parent command, holder and effect, so a replayed parent never raises it twice. */
export function systemTriggerCommandId(
  parentCommandId: string,
  holderActorId: string,
  actionId: string
) {
  return uuidv5(`${parentCommandId}:${holderActorId}:${actionId}:system-trigger`, NAMESPACE)
}

/**
 * The child command of a reaction chosen at a paused Scene move's contact (D219). The move's
 * occurrence version at the choice is part of it, so a reaction chosen again after the GM voided its
 * held child never reuses an id.
 */
export function movementReactionChildCommandId(input: {
  parentCommandId: string
  holderActorId: string
  actionId: string
  occurrenceVersion: number
}) {
  return uuidv5(
    `${input.parentCommandId}:${input.holderActorId}:${input.actionId}:${input.occurrenceVersion}:system-trigger`,
    NAMESPACE
  )
}

/**
 * The reaction offer a committed attack raises for one reactor (D219): one per attack command and
 * reactor, so a replayed attack never offers twice, and a reaction's own attack raises an offer of
 * its own, which is how a chain of reactions ends.
 */
export function reactionOfferOccurrenceId(parentCommandId: string, reactorActorId: string) {
  return uuidv5(`${parentCommandId}:${reactorActorId}:reaction-offer`, NAMESPACE)
}

/** The root command a reaction offer is stored under: the rules raise it, so no client names it. */
export function reactionOfferCommandId(occurrenceId: string) {
  return uuidv5(`${occurrenceId}:reaction-offer-command`, NAMESPACE)
}

/**
 * The entry a paused Scene move records in its own history for a reaction child (D219): its resume
 * from the child's commit, or its release when the GM voids the held child. One per move, child,
 * kind and occurrence version, so a retry never records it twice and a reaction chosen again after a
 * release never repeats an id.
 */
export function reactionChildMoveCommandId(input: {
  parentCommandId: string
  childCommandId: string
  kind: 'REACTION_CHILD_RESUME' | 'REACTION_CHILD_RELEASE'
  occurrenceVersion: number
}) {
  return uuidv5(
    `${input.parentCommandId}:${input.childCommandId}:${input.kind}:${input.occurrenceVersion}`,
    NAMESPACE
  )
}

/**
 * The ADVANCE_TURN that finishes a turn end split around a delegated Legendary Action: the remaining
 * windows and the next turn's start, once the delegated action has resolved.
 */
export function delegatedLegendaryContinuationCommandId(parentCommandId: string) {
  return uuidv5(`${parentCommandId}:legendary-continuation`, NAMESPACE)
}

/**
 * The ADVANCE_TURN that ends the turn of a conjured creature whose carrier ended while it was acting
 * (D200), keyed to the command that ended the carrier and the Run version it left, so a retry of
 * that command cannot advance twice.
 */
export function summonEndAdvanceCommandId(parentCommandId: string, version: number) {
  return uuidv5(`${parentCommandId}:summon-end-advance:${version}`, NAMESPACE)
}

/**
 * The root command for a rule the Encounter raises on a creature's behalf, such as a passive effect
 * on reaching 0 hit points or a Legendary Action delegated from a turn end. It aims at the holder's
 * own space, or where the aim a delegated Legendary Action retained puts it: the committed parent
 * command is the only caller of this builder, and admission proves the link against that command's
 * receipt.
 */
export function systemTriggerAreaCommand(input: {
  encounterId: string
  expectedVersion: number
  parentCommandId: string
  holderActorId: string
  actionId: string
  scene: { sceneId: string; expectedSceneVersion: number }
  trigger?: 'LEGENDARY_ACTION'
  aim?: AreaAimDto
}): ResolveEncounterActionInputDto {
  return {
    type: 'RESOLVE_ACTION',
    encounterId: input.encounterId,
    expectedVersion: input.expectedVersion,
    commandId: systemTriggerCommandId(input.parentCommandId, input.holderActorId, input.actionId),
    actorId: input.holderActorId,
    actionId: input.actionId,
    target: { ...(input.aim ?? { kind: 'CASTER_CENTERED' }), ...input.scene },
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    sceneContext: null,
    systemTrigger: {
      parentCommandId: input.parentCommandId,
      ...(input.trigger ? { trigger: input.trigger } : {})
    }
  }
}

/**
 * The root command for an action the rules raise on its holder itself: a passive effect at the start
 * of its turn, admitted against the START or ADVANCE_TURN that began the turn, or a rule's own action,
 * admitted against the receipt of the rule's failed save.
 */
export function systemTriggerSelfCommand(input: {
  encounterId: string
  expectedVersion: number
  parentCommandId: string
  holderActorId: string
  actionId: string
  trigger: 'START_OF_TURN' | 'RULE'
}): ResolveEncounterActionInputDto {
  return {
    type: 'RESOLVE_ACTION',
    encounterId: input.encounterId,
    expectedVersion: input.expectedVersion,
    commandId: systemTriggerCommandId(input.parentCommandId, input.holderActorId, input.actionId),
    actorId: input.holderActorId,
    actionId: input.actionId,
    target: { kind: 'ACTOR', actorId: input.holderActorId },
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    sceneContext: null,
    systemTrigger: { parentCommandId: input.parentCommandId, trigger: input.trigger }
  }
}

/**
 * The root command for the action of a reaction its holder chose (D219): the holder's own action at
 * the creature the reaction names, raised by the root command of the action it answers. Admission
 * proves it against a record of this command id: the pending action's, for a reaction chosen while
 * the action was held, or the answer of the offer a committed attack raised. It names the
 * tokens of the Scene the reaction was offered on, so its range is judged there like any action's.
 * A reaction chosen at a paused Scene move's contact passes that move's occurrence version at the
 * choice, which its command id then carries.
 */
export function systemTriggerReactionCommand(input: {
  encounterId: string
  expectedVersion: number
  parentCommandId: string
  holderActorId: string
  actionId: string
  targetActorId: string
  sceneContext: ResolveEncounterActionInputDto['sceneContext']
  moveOccurrenceVersion?: number
}): ResolveEncounterActionInputDto {
  return {
    type: 'RESOLVE_ACTION',
    encounterId: input.encounterId,
    expectedVersion: input.expectedVersion,
    commandId:
      input.moveOccurrenceVersion === undefined
        ? systemTriggerCommandId(input.parentCommandId, input.holderActorId, input.actionId)
        : movementReactionChildCommandId({
            parentCommandId: input.parentCommandId,
            holderActorId: input.holderActorId,
            actionId: input.actionId,
            occurrenceVersion: input.moveOccurrenceVersion
          }),
    actorId: input.holderActorId,
    actionId: input.actionId,
    target: { kind: 'ACTOR', actorId: input.targetActorId },
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    sceneContext: input.sceneContext,
    systemTrigger: { parentCommandId: input.parentCommandId, trigger: 'REACTION' }
  }
}
