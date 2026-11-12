import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterCastReactionOfferDto,
  EncounterUsedReactionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { LiveSessionReactionChild } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  prepareEncounterActionMechanics,
  withEncounterRollInfluences
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import type { PendingReactionChildren } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import { characterReactionCandidates } from '@artificer-toolkit/rules-runtime/encounterReactors'
import { systemTriggerCommandId } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import type { NativeEncounterActionMechanicsInput } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import { preparedSpellCastLevel } from '@artificer-toolkit/rules-runtime/encounterPreparedSpellCast'
import { projectSpellSlotSpend } from '@artificer-toolkit/rules-runtime/encounterActionProjection'
import { REACTION_TRIGGERS } from '@artificer-toolkit/rules-runtime/events/reactionTriggers'
import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import {
  authoredImposedRollMode,
  discoverNativeAimedReactions
} from './nativeEncounterAimedReaction.js'
import {
  advanceNativeCastReactions,
  advanceNativeTargetedReactions,
  discoverNativeCastReactions,
  discoverNativeTargetedReactions,
  planNativeCounteredCast,
  planNativeUsedReactions,
  type NativeCastReactionAnswer
} from './nativeEncounterCastReaction.js'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'

type Prepared = NativeEncounterActionMechanicsInput['prepared']
type MovementTargets = Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']
type LoadAttackPerception = NonNullable<
  Parameters<typeof prepareEncounterActionMechanics>[0]['loadAttackPerception']
>

/**
 * The window in which another Character may react to an action before it does anything, shared by
 * every target shape (one creature, a chosen list, a point area): counter a spell, answer being named
 * its target, or answer an attack aimed at another creature before its d20 (D217). Each moment's
 * reactions are offered by the one offer in the one prompt; no moment has a pause kind of its own. It
 * discovers the reactors once from the Scene the action names, advances the offers by the answer in
 * hand, and plans the reactions spent for the action's terminal commit to spend (D127).
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
  command: Pick<ResolveEncounterActionInputDto, 'commandId' | 'systemTrigger'>
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
  /**
   * The Scene's sight, which the reactions to an attack roll aimed at another creature read (D217);
   * null when the action is never such an attack.
   */
  aimedAttackPerception: LoadAttackPerception | null
  occurrenceId: string
  occurredAt: string
  userId: string
  /** The answer to the counter being offered, if this replay carries one. */
  answer: NativeCastReactionAnswer | null
  /** Whether this replays a pending occurrence rather than opening one. */
  resumed: boolean
  usedReactions: readonly EncounterUsedReactionDto[]
  /**
   * The reactions chosen against this action that run as their holders' own child actions (D219);
   * null when the host never resumes the action from one, so a counter to it resolves in its window.
   */
  reactionChildren: {
    /** The child the pending action records for each, with the roll mode it resumed with. */
    recorded: PendingReactionChildren
    /** Those of them that committed: who reacted with what, and whether it imposed its roll mode. */
    committed: readonly LiveSessionReactionChild[]
    /** The answered offer the room resumes this action past, its reactor's child now committed. */
    resumedOffer: {
      kind: EncounterCastReactionOfferDto['kind']
      reactorActorId: string
      declinedReactorActorIds: readonly string[]
    } | null
  } | null
}) {
  const { prepared, state, command } = input
  const children = input.reactionChildren ?? { recorded: [], committed: [], resumedOffer: null }
  const { resumedOffer } = children
  const committedChild = (commandId: string) => {
    const child = children.committed.find((child) => child.commandId === commandId)
    if (!child) throw new Error('Reaction evidence is stale.')
    return child
  }
  /**
   * The recorded children with the mode of the one the action resumes from resolved: the mode its
   * reaction authors when its committed action imposed one on the roll it answered, and none otherwise.
   */
  const resolveReactionChildren = () =>
    Promise.all(
      children.recorded.map(async (recorded) => {
        if (recorded.rollMode !== undefined) return recorded
        const { reactorActorId, actionId, imposesRollMode } = committedChild(recorded.commandId)
        if (!imposesRollMode) return { ...recorded, rollMode: null }
        const reactor = input.actors.find((actor) => actor.id === reactorActorId)
        const held = reactor
          ? characterReactionCandidates(
              input.movementTargets.get(reactor.id) ?? (await input.loadTarget(reactor))
            ).find((candidate) => candidate.actionId === actionId)
          : undefined
        const rollMode = held && authoredImposedRollMode(held)
        if (!rollMode) throw new Error('Reaction evidence is stale.')
        return { ...recorded, rollMode }
      })
    )
  /**
   * How the reactions that ran as child actions before an attack's d20 change that attack: each imposes
   * the roll mode its child resolved on the roll (D217). The attack is re-prepared as its pauses are
   * answered, so the same reactions are applied to each preparation.
   */
  const imposeChildRollModes =
    (children: PendingReactionChildren) =>
    <Attack extends Parameters<typeof withEncounterRollInfluences>[0]>(attack: Attack) =>
      withEncounterRollInfluences(
        attack,
        children.flatMap(({ commandId, rollMode }) =>
          rollMode
            ? [{ reaction: { reactorActorId: committedChild(commandId).reactorActorId }, rollMode }]
            : []
        )
      )
  const triggerLevel = preparedSpellCastLevel(prepared)
  const castConsumption = prepared.characterActionState?.spellConsumption
  /** The spell a Character casts, which a reaction to being targeted may be limited to. */
  const castOwnerId =
    prepared.source.kind === 'CHARACTER_ACTION' ? prepared.source.candidate.mechanicsOwner.id : null
  let castDiscovery: Promise<ReturnType<typeof discoverNativeCastReactions>> | undefined
  let scene: ReturnType<NonNullable<typeof input.readScene>> | undefined
  /** The Scene the action names, read once for every moment that measures on it. */
  const readScene = () => {
    if (!input.readScene) throw new Error('Reaction evidence is stale.')
    return (scene ??= input.readScene())
  }
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
  /**
   * A reaction prepared against the creature whose cast, attack or being targeted it answers. The
   * Scene's sight is read for a reaction to an attack, whose range or requirements may need it.
   */
  const prepareReaction = async (
    reactor: EncounterRunActorState,
    reactorTarget: MovementTargets,
    actionId: string,
    against: EncounterRunActorState,
    loadAttackPerception?: LoadAttackPerception
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
      ...(loadAttackPerception ? { loadAttackPerception } : {}),
      ...input.reactionSources
    })
  /** The creatures that may counter this cast, read once from the Scene the cast names. */
  const discoverCast = (level: number) =>
    (castDiscovery ??= (async () =>
      discoverNativeCastReactions({
        state,
        actors: input.actors,
        caster: prepared.actor,
        triggerLevel: level,
        scene: await readScene(),
        loadTarget: input.loadTarget,
        prepareReaction,
        capture: input.capture
      }))())
  /** The creatures beside the attack that may answer its aim at another, before its d20 (D217). */
  const discoverAimed = () => {
    const loadAttackPerception = input.aimedAttackPerception
    const attackerTarget = input.movementTargets.get(prepared.actor.id)
    if (!loadAttackPerception || !attackerTarget) throw new Error('Reaction evidence is stale.')
    return discoverNativeAimedReactions({
      state,
      actors: input.actors,
      attacker: prepared.actor,
      attackerTarget,
      attacked: prepared.target,
      loadScene: readScene,
      loadTarget: async (actor) =>
        input.movementTargets.get(actor.id) ?? (await input.loadTarget(actor)),
      loadAttackPerception,
      prepareReaction: (reactor, reactorTarget, actionId) =>
        prepareReaction(reactor, reactorTarget, actionId, prepared.actor, loadAttackPerception),
      capture: input.capture
    })
  }
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
  /**
   * What each reaction spent before the action did anything spends when it ends, planned against the
   * reactor as it stands now; the moment its trigger answers names the discovery that finds it again.
   */
  const planUsedReactions = async (counters: readonly EncounterUsedReactionDto[]) => {
    if (counters.length === 0) return []
    return planNativeUsedReactions({
      usedReactions: counters,
      discover: async (trigger) => {
        const { moment } = REACTION_TRIGGERS[trigger]
        if (moment === 'TARGETED_BY_CAST') return discoverTargeted()
        // A reaction to an attack aimed at another is spent by its own child action, never here (D219).
        if (moment !== 'SPELL_CAST_BY_OTHER' || triggerLevel === null)
          throw new Error('Reaction evidence is stale.')
        return discoverCast(triggerLevel)
      },
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
    if (input.resumed && !input.answer && !resumedOffer)
      return {
        kind: 'NONE' as const,
        usedReactions: input.usedReactions,
        reactionChildren: children.recorded
      }
    const counterResume = resumedOffer?.kind === 'COUNTER' ? resumedOffer : null
    const counteredCast = async (
      counter: Parameters<typeof planNativeCounteredCast>[0]['counter'],
      counters: readonly EncounterUsedReactionDto[]
    ) => ({
      kind: 'COUNTERED' as const,
      countered: planNativeCounteredCast({
        state,
        actors: input.actors,
        prepared,
        casterEffects: input.activeEffectsByActorId.get(prepared.actor.id) ?? [],
        counter,
        actionEconomy: cast.actionEconomy,
        ruleOverrides: cast.ruleOverrides,
        occurrenceId: input.occurrenceId,
        occurrenceVersion: cast.occurrenceVersion,
        commandId: command.commandId,
        occurredAt: input.occurredAt,
        userId: input.userId,
        usedReactions: await planUsedReactions(counters)
      })
    })
    // The counter the cast resumes from ran as its holder's own action, which spent it: when that
    // action cancelled the cast, the cast is lost with no counter of its own to spend (D219).
    if (
      counterResume &&
      children.recorded.some(
        ({ commandId, rollMode }) =>
          rollMode === undefined && committedChild(commandId).cancelsTriggeringEvent
      )
    )
      return counteredCast(null, input.usedReactions)
    const reactionChildren = resumedOffer ? await resolveReactionChildren() : children.recorded
    /**
     * The reaction chosen at any moment runs as its holder's own action at the creature acting: the
     * room commits that child, then resumes this action, which keeps the answered offer until then.
     */
    const awaitChild = async (
      advanced: Extract<
        Awaited<
          ReturnType<typeof advanceNativeCastReactions | typeof advanceNativeTargetedReactions>
        >,
        { kind: 'CHILD' }
      >
    ) => {
      const childScene = await readScene()
      const holderToken = childScene.tokens.find(
        (token) => token.actorId === advanced.child.holderActorId
      )
      return {
        kind: 'CAST_PENDING' as const,
        continuation: advanced.continuation,
        rollerActorId: advanced.child.holderActorId,
        pause: { kind: 'CAST_REACTION' as const, payload: advanced.offer },
        usedReactions: advanced.usedReactions,
        reactionChildren: [
          ...reactionChildren,
          {
            commandId: systemTriggerCommandId(
              command.commandId,
              advanced.child.holderActorId,
              advanced.child.actionId
            )
          }
        ],
        // The child is judged on the Scene the reaction was offered on.
        reactionChild: {
          ...advanced.child,
          targetActorId: prepared.actor.id,
          sceneContext: holderToken
            ? {
                sceneId: childScene.sceneId,
                expectedSceneVersion: childScene.sceneVersion,
                sourceTokenId: holderToken.tokenId,
                targetTokenId: childScene.sourceToken.tokenId
              }
            : null
        }
      }
    }
    // An answer to an offer the action resumes from was made after every counter offer was heard, and
    // one to an attack aimed at another after every offer the cast made.
    const resumeAnswer =
      input.answer?.kind === 'SELECTION' && input.answer.offer.kind !== 'COUNTER'
        ? input.answer
        : null
    const aimedAnswer = resumeAnswer?.offer.kind === 'ATTACK_ON_OTHER' ? resumeAnswer : null
    const targetedAnswer = aimedAnswer ? null : resumeAnswer
    if (input.answer && !aimedAnswer && triggerLevel === null)
      throw new Error('Reaction evidence is stale.')
    let usedReactions = input.usedReactions
    let declinedReactorActorIds: readonly string[] = []
    if (
      triggerLevel !== null &&
      !resumeAnswer &&
      (!resumedOffer || counterResume) &&
      // A counter that runs as its holder's own action is offered only when nobody can counter it.
      command.systemTrigger?.trigger !== 'REACTION' &&
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
        usedReactions,
        // The creature whose own action did not cancel the cast has been heard, like one that declined.
        declinedReactorActorIds: counterResume
          ? [...counterResume.declinedReactorActorIds, counterResume.reactorActorId]
          : [],
        runsAsChild: input.reactionChildren !== null,
        autoRoll: input.requireAutoRoll,
        rollD20: () => (input.random ?? nextRollInt)(20) + 1,
        discover: await discoverCast(triggerLevel)
      })
      if (advanced.kind === 'COUNTERED')
        return counteredCast(
          {
            countered: advanced,
            reactorEffects:
              input.activeEffectsByActorId.get(advanced.found.prepared.actor.id) ?? [],
            triggerLevel
          },
          advanced.usedReactions
        )
      if (advanced.kind === 'CHILD') return awaitChild(advanced)
      if (advanced.kind === 'OFFER' || advanced.kind === 'CHECK')
        return {
          kind: 'CAST_PENDING' as const,
          continuation: advanced.continuation,
          rollerActorId: advanced.reactor.id,
          pause: { kind: 'CAST_REACTION' as const, payload: advanced.offer },
          usedReactions: advanced.usedReactions,
          reactionChildren,
          reactionChild: null
        }
      usedReactions = advanced.usedReactions
      declinedReactorActorIds = advanced.declinedReactorActorIds
    }
    // Each moment the action resumes from offers its reactions in turn: being named a cast's target,
    // then an attack aimed at another creature. A moment already answered past is not offered again.
    for (const stage of [
      {
        kind: 'TARGETED_SELF' as const,
        offered:
          triggerLevel !== null &&
          !aimedAnswer &&
          !resumedOffer &&
          input.chosenActorIds &&
          castOwnerId,
        discover: discoverTargeted,
        answer: targetedAnswer,
        triggerLevel,
        declinedReactorActorIds,
        runsAsChild: false
      },
      {
        kind: 'ATTACK_ON_OTHER' as const,
        offered:
          prepared.makesAttackRoll &&
          prepared.actor.id !== prepared.target.id &&
          input.aimedAttackPerception &&
          input.readScene,
        discover: discoverAimed,
        answer: aimedAnswer,
        triggerLevel: null,
        // The creature whose child the action resumes from has been heard, like one that declined.
        declinedReactorActorIds:
          resumedOffer?.kind === 'ATTACK_ON_OTHER'
            ? [...resumedOffer.declinedReactorActorIds, resumedOffer.reactorActorId]
            : [],
        runsAsChild: true
      }
    ]) {
      if (!stage.offered) {
        if (stage.answer) throw new Error('Reaction evidence is stale.')
        continue
      }
      const advanced = await advanceNativeTargetedReactions({
        runtime: input.runtime,
        occurrenceId: input.occurrenceId,
        kind: stage.kind,
        casterActorId: prepared.actor.id,
        triggerLevel: stage.triggerLevel,
        discover: stage.discover(),
        answer: stage.answer,
        usedReactions,
        declinedReactorActorIds: stage.declinedReactorActorIds,
        runsAsChild: stage.runsAsChild
      })
      if (advanced.kind === 'CHILD') return awaitChild(advanced)
      if (advanced.kind === 'OFFER')
        return {
          kind: 'CAST_PENDING' as const,
          continuation: advanced.continuation,
          rollerActorId: advanced.reactor.id,
          pause: { kind: 'CAST_REACTION' as const, payload: advanced.offer },
          usedReactions: advanced.usedReactions,
          reactionChildren,
          reactionChild: null
        }
      usedReactions = advanced.usedReactions
    }
    return { kind: 'NONE' as const, usedReactions, reactionChildren }
  }
  return { advance, planUsedReactions, imposeChildRollModes }
}

export type NativeCastPause = ReturnType<typeof createNativeCastPause>
