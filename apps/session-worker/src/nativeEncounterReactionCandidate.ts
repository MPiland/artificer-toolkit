import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { NativeEncounterActionMechanicsInput } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import { evaluateEncounterActionTargetPolicy } from '@artificer-toolkit/rules-runtime/encounterActionTargetPolicy'
import {
  EncounterValidationError,
  StaleCharacterActionError
} from '@artificer-toolkit/rules-runtime/encounterErrors'
import { encounterFacingRule } from '@artificer-toolkit/rules-runtime/encounterFacing'
import { ASSISTED_REACTION_CHOICE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/encounterMovementReactionDecision'
import type { EncounterReactionCandidate } from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import { discoverEncounterEventHooks } from '@artificer-toolkit/rules-runtime/events/encounterEventHooks'
import type {
  EncounterEvent,
  EncounterReactionHook
} from '@artificer-toolkit/rules-runtime/events/encounterEventTable'
import { createReactionChoiceDefinition } from '@artificer-toolkit/rules-runtime/reactionChoiceDefinition'

import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'

type Prepared = NativeEncounterActionMechanicsInput['prepared']

/** A reaction its holder could use now, prepared against its reactor's own facts. */
export type NativeReaction<Candidate, Spend = Prepared> = {
  candidate: Candidate
  prepared: Spend
  economy: NonNullable<Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>['economy']>
}

/**
 * The one offer of reactions (QUALITY-7.1): the reactions `events` offer one reactor, by held order.
 * The event table decides which of the reactions it holds an event meets and names the authored
 * trigger each answers, which is the trigger the offer seals. A reaction is offered when it prepares
 * (its holder can pay for it, and the creature it answers meets its target requirements), the moment
 * admits it, it reaches the creature it answers with its own range when one is measured, and its
 * holder can afford it now and is not suppressed (D99). Every moment that offers a reaction (a hit, a
 * cast, being named a target, an attack aimed at another, a rolled d20) discovers its reactors and
 * raises its event; this decides the offer.
 */
export async function offerNativeReactions<Extra extends object>(input: {
  state: EncounterRunState
  reactorActorId: string
  /** The reactor's facts, which pay for the reaction. */
  reactorTarget: Parameters<typeof evaluateNativeLiveActionEconomy>[0]['sourceTarget']
  /** The reactions the reactor holds. */
  held: readonly (Pick<CharacterActionCandidate, 'mechanicFacts'> & { actionId: string })[]
  events: readonly EncounterEvent[]
  /** Only this reaction: the offer being answered. */
  answering: string | undefined
  prepare(actionId: string): Promise<Prepared>
  /** What the moment adds to a reaction it admits (a counter's level, a die); null when it refuses it. */
  admit(prepared: Prepared, hook: EncounterReactionHook): Extra | null
  /** The tokens the reaction's own range is measured between; null when none is measured. */
  range: NonNullable<
    Parameters<typeof evaluateEncounterActionTargetPolicy>[0]['sceneContext']
  > | null
  /** The creatures the reaction is aimed at, which its economy reads. */
  targetIds: readonly string[]
  capture: Parameters<typeof evaluateNativeLiveActionEconomy>[0]['capture']
}): Promise<(NativeReaction<EncounterReactionCandidate> & Extra)[]> {
  const { state } = input
  const offered: (NativeReaction<EncounterReactionCandidate> & Extra)[] = []
  const { reactions: hooks } = discoverEncounterEventHooks({
    reactions: input.held,
    events: input.events
  })
  for (const hook of hooks) {
    const { actionId } = hook.reaction
    if (input.answering !== undefined && actionId !== input.answering) continue
    const prepared = await input.prepare(actionId).catch((error: unknown) => {
      // A reaction its holder cannot pay for (no slot, not prepared), or whose target requirements the
      // creature it answers fails, is simply not offered.
      if (error instanceof StaleCharacterActionError || error instanceof EncounterValidationError)
        return null
      throw error
    })
    if (!prepared) continue
    const { source } = prepared
    if (source.kind !== 'CHARACTER_ACTION' && source.kind !== 'CREATURE') continue
    const extra = input.admit(prepared, hook)
    if (!extra) continue
    if (input.range) {
      const warnings = evaluateEncounterActionTargetPolicy({
        actor: prepared.actor,
        target: prepared.target,
        targetPolicy: prepared.targetPolicy,
        sceneContext: input.range,
        makesAttackRoll: prepared.makesAttackRoll,
        facing: encounterFacingRule(state)
      })
      if (!warnings || warnings.some(({ code }) => code === 'TARGET_OUT_OF_RANGE')) continue
    }
    const { economy, suppressed } = await evaluateNativeLiveActionEconomy({
      prepared,
      state,
      actionId,
      sourceTarget: input.reactorTarget,
      targetIds: [...input.targetIds],
      capture: input.capture
    })
    if (!economy?.available || suppressed) continue
    offered.push({
      ...extra,
      prepared,
      economy,
      candidate: nativeReactionCandidate({
        trigger: hook.trigger,
        reactorActorId: input.reactorActorId,
        source,
        actionId,
        consumption: economy.consumption,
        gameSystemId: state.gameSystemId
      })
    })
  }
  return offered
}

/** The reaction a Character or creature holds and can afford now, as the offer will seal it. */
function nativeReactionCandidate(input: {
  trigger: EncounterReactionCandidate['trigger']
  reactorActorId: string
  source: Extract<Prepared['source'], { kind: 'CHARACTER_ACTION' | 'CREATURE' }>
  actionId: string
  consumption: Pick<
    NativeReaction<unknown>['economy']['consumption'],
    'definitionId' | 'beforeUsed' | 'maximum'
  >
  gameSystemId: string
}): EncounterReactionCandidate {
  const { source, consumption } = input
  return {
    trigger: input.trigger,
    reactorActorId: input.reactorActorId,
    ...(source.kind === 'CHARACTER_ACTION'
      ? {
          characterId: source.characterId,
          characterStreamVersion: source.characterStreamVersion,
          effectId: source.candidate.effectId
        }
      : { characterId: null, characterStreamVersion: null, effectId: source.capability.effectId }),
    actionId: input.actionId,
    allowance: {
      definitionId: consumption.definitionId,
      beforeUsed: consumption.beforeUsed,
      maximum: consumption.maximum
    },
    choiceGraph: createReactionChoiceDefinition({
      definitionId: ASSISTED_REACTION_CHOICE_DEFINITION_ID,
      gameSystemId: input.gameSystemId
    })
  }
}

/** The user-safe refusal of a reaction this System cannot resolve inline. */
export const unsupportedReaction = (message: string) =>
  new LiveSessionDomainRejectionError(422, {
    code: 'DOMAIN_REJECTED',
    reason: 'REACTION_UNSUPPORTED',
    message
  })
