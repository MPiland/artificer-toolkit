import { v5 as uuidv5 } from 'uuid'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'

const NAMESPACE = '6b0c2f0e-3d0a-5c1e-9f55-0a7f1d9a4c21'

/** One trigger per parent command, holder and effect, so a replayed parent never raises it twice. */
export function systemTriggerCommandId(
  parentCommandId: string,
  holderActorId: string,
  actionId: string
) {
  return uuidv5(`${parentCommandId}:${holderActorId}:${actionId}:system-trigger`, NAMESPACE)
}

/**
 * The ADVANCE_TURN that finishes a turn end split around a delegated Legendary Action: the remaining
 * windows and the next turn's start, once the delegated action has resolved.
 */
export function delegatedLegendaryContinuationCommandId(parentCommandId: string) {
  return uuidv5(`${parentCommandId}:legendary-continuation`, NAMESPACE)
}

/**
 * The root command for a rule the Encounter raises on a creature's behalf, such as a passive effect
 * on reaching 0 hit points or a Legendary Action delegated from a turn end. It aims at the holder's
 * own space: the committed parent command is the only caller of this builder, and admission proves
 * the link against that command's receipt.
 */
export function systemTriggerAreaCommand(input: {
  encounterId: string
  expectedVersion: number
  parentCommandId: string
  holderActorId: string
  actionId: string
  scene: { sceneId: string; expectedSceneVersion: number }
  trigger?: 'LEGENDARY_ACTION'
}): ResolveEncounterActionInputDto {
  return {
    type: 'RESOLVE_ACTION',
    encounterId: input.encounterId,
    expectedVersion: input.expectedVersion,
    commandId: systemTriggerCommandId(input.parentCommandId, input.holderActorId, input.actionId),
    actorId: input.holderActorId,
    actionId: input.actionId,
    target: { kind: 'CASTER_CENTERED', ...input.scene },
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
