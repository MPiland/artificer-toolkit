import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterFailedCounterDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import type { NativeEncounterActionMechanicsInput } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import { preparedSpellCastLevel } from '@artificer-toolkit/rules-runtime/encounterCastReactionDiscovery'
import { projectSpellSlotSpend } from '@artificer-toolkit/rules-runtime/encounterActionProjection'
import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import {
  advanceNativeCastReactions,
  advanceNativeTargetedReactions,
  discoverNativeCastReactions,
  discoverNativeTargetedReactions,
  planNativeCounteredCast,
  planNativeFailedCounters,
  type NativeCastReactionAnswer
} from './nativeEncounterCastReaction.js'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'

type Prepared = NativeEncounterActionMechanicsInput['prepared']
type MovementTargets = Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']

/**
 * The window in which another Character may counter a spell before it does anything, shared by every
 * target shape (one creature, a chosen list, a point area). It discovers the reactors once from the
 * Scene the cast names, advances the offers by the answer in hand, and plans the counters that failed
 * for the cast's terminal commit to spend (D127).
 */
export function createNativeCastPause(input: {
  runtime: RulesRuntimeService
  random?: (maximum: number) => number
  state: EncounterRunState
  system: SystemAuthoredDto
  actors: readonly EncounterRunActorState[]
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  loadTarget: (actor: EncounterRunActorState) => Promise<MovementTargets>
  capture: Parameters<typeof discoverNativeCastReactions>[0]['capture']
  requireAutoRoll: (actorId: string) => boolean
  command: Pick<ResolveEncounterActionInputDto, 'commandId'>
  /** The caster's preparation of the cast; an area or a list uses its lead creature's. */
  prepared: Prepared
  movementTargets: ReadonlyMap<string, MovementTargets>
  reactionSources: Pick<
    Parameters<typeof prepareEncounterActionMechanics>[0],
    'loadSource' | 'loadRelationshipFacts'
  >
  /** The Scene the cast names, where range is read; a cast made without one offers no reaction. */
  readScene: (() => Promise<Parameters<typeof discoverNativeCastReactions>[0]['scene']>) | null
  /** The creatures the cast names as its targets, when it names them (a chosen list); null otherwise. */
  chosenActorIds: readonly string[] | null
  occurrenceId: string
  occurredAt: string
  userId: string
  /** The answer to the counter being offered, if this replay carries one. */
  answer: NativeCastReactionAnswer | null
  /** Whether this replays a pending occurrence rather than opening one. */
  resumed: boolean
  failedCounters: readonly EncounterFailedCounterDto[]
}) {
  const { prepared, state, command } = input
  const triggerLevel = preparedSpellCastLevel(prepared)
  const castConsumption = prepared.characterActionState?.spellConsumption
  /** The spell a Character casts, which a reaction to being targeted may be limited to. */
  const castOwnerId =
    prepared.source.kind === 'CHARACTER_ACTION' ? prepared.source.candidate.mechanicsOwner.id : null
  let castDiscovery: Promise<ReturnType<typeof discoverNativeCastReactions>> | undefined
  /**
   * A reactor counters against the slots it has left. The cast's own caster counters a counter cast
   * against its cast with the cast's slot already spent, on the Character version both spends commit in.
   */
  const castSpentTarget = (reactorActorId: string, reactorTarget: MovementTargets) =>
    castConsumption && reactorActorId === prepared.actor.id
      ? projectSpellSlotSpend({
          target: reactorTarget,
          consumption: castConsumption,
          campaignId: state.campaignId,
          gameSystemId: state.gameSystemId,
          occurredAt: input.occurredAt
        })
      : reactorTarget
  /** A reaction prepared against the creature whose cast (or being targeted) it answers. */
  const prepareReaction = async (
    reactor: EncounterRunActorState,
    reactorTarget: MovementTargets,
    actionId: string,
    against: EncounterRunActorState
  ) =>
    prepareEncounterActionMechanics({
      state,
      actor: reactor,
      target: against,
      actors: input.actors,
      actionId,
      wieldConflictAcceptance: { kind: 'UNPROMPTED' },
      overridable: false,
      movementTargets: new Map(input.movementTargets)
        .set(reactor.id, castSpentTarget(reactor.id, reactorTarget))
        .set(
          against.id,
          input.movementTargets.get(against.id) ?? (await input.loadTarget(against))
        ),
      sceneContext: null,
      ...input.reactionSources
    })
  /** The creatures that may counter this cast, read once from the Scene the cast names. */
  const discoverCast = (level: number) =>
    (castDiscovery ??= (async () => {
      if (!input.readScene) throw new Error('Reaction evidence is stale.')
      return discoverNativeCastReactions({
        state,
        actors: input.actors,
        caster: prepared.actor,
        triggerLevel: level,
        scene: await input.readScene(),
        loadTarget: input.loadTarget,
        prepareReaction,
        capture: input.capture
      })
    })())
  /** The chosen creatures that may answer being chosen; needs no Scene, only the spell and its targets. */
  const discoverTargeted = () => {
    if (!input.chosenActorIds || !castOwnerId) throw new Error('Reaction evidence is stale.')
    return discoverNativeTargetedReactions({
      state,
      actors: input.actors,
      chosenActorIds: input.chosenActorIds,
      castOwnerId,
      loadTarget: input.loadTarget,
      prepareReaction: (reactor, reactorTarget, actionId) =>
        prepareReaction(reactor, reactorTarget, actionId, reactor),
      capture: input.capture
    })
  }
  /** What each failed counter spends when the cast ends, planned against the reactor as it stands now. */
  const planFailedCounters = async (counters: readonly EncounterFailedCounterDto[]) => {
    if (counters.length === 0) return []
    if (triggerLevel === null) throw new Error('Reaction evidence is stale.')
    return planNativeFailedCounters({
      failedCounters: counters,
      discover: async (trigger) =>
        trigger === 'TARGETED_SELF' ? discoverTargeted() : discoverCast(triggerLevel),
      state,
      occurrenceId: input.occurrenceId,
      commandId: command.commandId,
      occurredAt: input.occurredAt,
      userId: input.userId
    })
  }
  /**
   * Before a Character's spell does anything, another Character in range may counter it. A cast that
   * already offered itself replays past this point once answered: a decline moves to the next creature,
   * and an answer to a later decision (dice, a Legendary Resistance) was made after every offer.
   */
  const advance = async (cast: {
    actionEconomy: Parameters<typeof planNativeCounteredCast>[0]['actionEconomy']
    ruleOverrides: Parameters<typeof planNativeCounteredCast>[0]['ruleOverrides']
    occurrenceVersion: number
  }) => {
    if (input.answer && triggerLevel === null) throw new Error('Reaction evidence is stale.')
    if (triggerLevel === null || (input.resumed && !input.answer))
      return { kind: 'NONE' as const, failedCounters: input.failedCounters }
    // An answer to a targeted offer was made after every counter offer was heard.
    const targetedAnswer =
      input.answer?.kind === 'SELECTION' && input.answer.offer.kind === 'TARGETED_SELF'
        ? input.answer
        : null
    let failedCounters = input.failedCounters
    let declinedReactorActorIds: readonly string[] = []
    if (
      !targetedAnswer &&
      input.readScene &&
      input.actors.some((actor) => actor.kind === 'CHARACTER' && actor.id !== prepared.actor.id)
    ) {
      const advanced = await advanceNativeCastReactions({
        runtime: input.runtime,
        occurrenceId: input.occurrenceId,
        gameSystemId: state.gameSystemId,
        system: input.system,
        casterActorId: prepared.actor.id,
        triggerLevel,
        answer: input.answer,
        failedCounters,
        autoRoll: input.requireAutoRoll,
        rollD20: () => (input.random ?? nextRollInt)(20) + 1,
        discover: await discoverCast(triggerLevel)
      })
      if (advanced.kind === 'COUNTERED')
        return {
          kind: 'COUNTERED' as const,
          countered: planNativeCounteredCast({
            state,
            actors: input.actors,
            prepared,
            casterEffects: input.activeEffectsByActorId.get(prepared.actor.id) ?? [],
            reactorEffects:
              input.activeEffectsByActorId.get(advanced.found.prepared.actor.id) ?? [],
            triggerLevel,
            actionEconomy: cast.actionEconomy,
            ruleOverrides: cast.ruleOverrides,
            occurrenceId: input.occurrenceId,
            occurrenceVersion: cast.occurrenceVersion,
            commandId: command.commandId,
            occurredAt: input.occurredAt,
            userId: input.userId,
            countered: advanced,
            failedCounters: await planFailedCounters(advanced.failedCounters)
          })
        }
      if (advanced.kind === 'OFFER' || advanced.kind === 'CHECK')
        return {
          kind: 'CAST_PENDING' as const,
          continuation: advanced.continuation,
          rollerActorId: advanced.reactor.id,
          castReaction: advanced.offer,
          failedCounters: advanced.failedCounters
        }
      failedCounters = advanced.failedCounters
      declinedReactorActorIds = advanced.declinedReactorActorIds
    }
    if (input.chosenActorIds && castOwnerId) {
      const advanced = await advanceNativeTargetedReactions({
        runtime: input.runtime,
        occurrenceId: input.occurrenceId,
        casterActorId: prepared.actor.id,
        triggerLevel,
        discover: discoverTargeted(),
        answer: targetedAnswer,
        failedCounters,
        declinedReactorActorIds
      })
      if (advanced.kind === 'OFFER')
        return {
          kind: 'CAST_PENDING' as const,
          continuation: advanced.continuation,
          rollerActorId: advanced.reactor.id,
          castReaction: advanced.offer,
          failedCounters: advanced.failedCounters
        }
      failedCounters = advanced.failedCounters
    }
    return { kind: 'NONE' as const, failedCounters }
  }
  return { advance, planFailedCounters }
}

export type NativeCastPause = ReturnType<typeof createNativeCastPause>
