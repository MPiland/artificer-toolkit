import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterCastReactionOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type {
  LiveSessionReactionAncestor,
  LiveSessionReactionChild
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
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
import { StaleCharacterActionError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import {
  authoredImposedRollMode,
  discoverNativeAimedReactions
} from './nativeEncounterAimedReaction.js'
import {
  advanceNativeCastReactions,
  discoverNativeCastReactions,
  discoverNativeTargetedReactions,
  planNativeCounteredCast,
  type CastReactionDiscovery,
  type NativeCastReactionAnswer,
  type NativeCastResponse
} from './nativeEncounterCastReaction.js'
import { planNativeResolvedAttackOffers } from './nativeEncounterResolvedReaction.js'
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
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  loadTarget: (actor: EncounterRunActorState) => Promise<MovementTargets>
  capture: Parameters<typeof discoverNativeCastReactions>[0]['capture']
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
  /**
   * The Scene's sight, which the reactions to an attack roll read: those to its aim at another
   * creature (D217) and those to its hit or miss (D219); null when the action is never an attack.
   */
  aimedAttackPerception: LoadAttackPerception | null
  occurrenceId: string
  occurredAt: string
  userId: string
  /** The answer to the counter being offered, if this replay carries one. */
  answer: NativeCastReactionAnswer | null
  /** Whether this replays a pending occurrence rather than opening one. */
  resumed: boolean
  /** The reactions chosen against this action that run as their holders' own child actions (D219). */
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
    /** The held actions above this one, when it is itself a reaction's child. */
    ancestors: readonly LiveSessionReactionAncestor[]
  }
}) {
  const { prepared, state, command } = input
  const children = input.reactionChildren
  const { resumedOffer } = children
  /**
   * A creature whose reaction is spent on a held action above this one has been heard at every
   * moment, like one that declined: nothing of that action has committed, so its reaction still
   * reads as unspent.
   */
  const heardAbove =
    <Found extends NativeCastResponse>(
      discover: CastReactionDiscovery<Found>
    ): CastReactionDiscovery<Found> =>
    (filter) =>
      discover({
        ...filter,
        declinedReactorActorIds: [
          ...filter.declinedReactorActorIds,
          ...children.ancestors.flatMap(({ actorId, reaction }) => (reaction ? [actorId] : []))
        ]
      })
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
        if (recorded.resumeOutcome !== undefined) return recorded
        const { reactorActorId, actionId, imposesRollMode } = committedChild(recorded.commandId)
        if (!imposesRollMode) return { ...recorded, resumeOutcome: null }
        const reactor = input.actors.find((actor) => actor.id === reactorActorId)
        const held = reactor
          ? characterReactionCandidates(
              input.movementTargets.get(reactor.id) ?? (await input.loadTarget(reactor))
            ).find((candidate) => candidate.actionId === actionId)
          : undefined
        const rollMode = held && authoredImposedRollMode(held)
        if (!rollMode) throw new Error('Reaction evidence is stale.')
        return { ...recorded, resumeOutcome: { kind: 'ROLL_MODE' as const, rollMode } }
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
        children.flatMap(({ commandId, resumeOutcome }) =>
          resumeOutcome?.kind === 'ROLL_MODE'
            ? [
                {
                  reaction: { reactorActorId: committedChild(commandId).reactorActorId },
                  rollMode: resumeOutcome.rollMode
                }
              ]
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
   * against its cast with the cast's slot already spent, on the Character version both spends commit
   * in; the caster of a held action above this one reacts with that action's slot spent, which its
   * commit still owes.
   */
  const heldSlotKeys = (reactorActorId: string) =>
    children.ancestors.flatMap(({ actorId, castSlotKey }) =>
      actorId === reactorActorId && castSlotKey !== null ? [castSlotKey] : []
    )
  const castSpentTarget = (reactorActorId: string, reactorTarget: MovementTargets) =>
    [
      ...(castConsumption && reactorActorId === prepared.actor.id ? [castConsumption.slotKey] : []),
      ...heldSlotKeys(reactorActorId)
    ].reduce(
      (target, slotKey) =>
        projectSpellSlotSpend({
          target,
          slotKey,
          campaignId: state.campaignId,
          gameSystemId: state.gameSystemId,
          occurredAt: input.occurredAt
        }),
      reactorTarget
    )
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
  ) => {
    const againstTarget = input.movementTargets.get(against.id) ?? (await input.loadTarget(against))
    const prepareWith = (target: MovementTargets) =>
      prepareEncounterActionMechanics({
        state,
        actor: reactor,
        target: against,
        actors: input.actors,
        actionId,
        wieldConflictAcceptance: { kind: 'UNPROMPTED' },
        overridable: false,
        movementTargets: new Map(input.movementTargets)
          .set(reactor.id, target)
          .set(against.id, againstTarget),
        sceneContext: null,
        ...(loadAttackPerception ? { loadAttackPerception } : {}),
        ...input.reactionSources
      })
    const offered = await prepareWith(castSpentTarget(reactor.id, reactorTarget))
    // A reaction that runs as its holder's own action spends from the slots the Character stores,
    // where a held action above it has spent nothing yet. One that would take another slot there
    // than the offer counted, the slot the held action owes, is not offered; the cast at the level
    // of the slot that is left is.
    if (
      heldSlotKeys(reactor.id).length > 0 &&
      (await prepareWith(reactorTarget)).characterActionState?.spellConsumption?.slotKey !==
        offered.characterActionState?.spellConsumption?.slotKey
    )
      throw new StaleCharacterActionError()
    return offered
  }
  /** The creatures that may counter this cast, read once from the Scene the cast names. */
  const discoverCast = (level: number) =>
    (castDiscovery ??= (async () =>
      heardAbove(
        discoverNativeCastReactions({
          state,
          actors: input.actors,
          caster: prepared.actor,
          triggerLevel: level,
          scene: await readScene(),
          loadTarget: input.loadTarget,
          prepareReaction,
          capture: input.capture
        })
      ))())
  /** The creatures beside the attack that may answer its aim at another, before its d20 (D217). */
  const discoverAimed = () => {
    const loadAttackPerception = input.aimedAttackPerception
    const attackerTarget = input.movementTargets.get(prepared.actor.id)
    if (!loadAttackPerception || !attackerTarget) throw new Error('Reaction evidence is stale.')
    return heardAbove(
      discoverNativeAimedReactions({
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
    )
  }
  /**
   * The reaction offers the attack leaves for its commit to queue once it has hit or missed (D219).
   * Range and sight are read from the Scene, so an attack made without one offers none.
   */
  const planResolvedOffers = async (hit: boolean) => {
    const loadAttackPerception = input.aimedAttackPerception
    const attackerTarget = input.movementTargets.get(prepared.actor.id)
    if (!input.readScene || !loadAttackPerception || !attackerTarget) return []
    return planNativeResolvedAttackOffers({
      state,
      attacker: prepared.actor,
      attackerTarget,
      attacked: prepared.target,
      hit,
      parentCommandId: command.commandId,
      parentOccurrenceId: input.occurrenceId,
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
    return heardAbove(
      discoverNativeTargetedReactions({
        state,
        actors: input.actors,
        chosenActorIds: input.chosenActorIds,
        castOwnerId,
        loadTarget: input.loadTarget,
        prepareReaction: (reactor, reactorTarget, actionId) =>
          prepareReaction(reactor, reactorTarget, actionId, reactor),
        capture: input.capture
      })
    )
  }
  /**
   * The reaction chosen at any moment runs as its holder's own action at the creature its moment
   * names (D219): the pending action records the child command, and the room commits that child, then
   * resumes the action, which keeps the answered offer until then.
   */
  const launchReactionChild = async (
    recorded: PendingReactionChildren,
    child: { holderActorId: string; actionId: string },
    targetActorId: string
  ) => {
    // A cast that names its targets off any Scene still offers them their reactions to being named.
    const childScene = input.readScene ? await readScene() : null
    const tokenOf = (actorId: string) =>
      actorId === prepared.actor.id
        ? childScene?.sourceToken
        : childScene?.tokens.find((token) => token.actorId === actorId)
    const holderToken = tokenOf(child.holderActorId)
    const targetToken = tokenOf(targetActorId)
    return {
      reactionChildren: [
        ...recorded,
        {
          commandId: systemTriggerCommandId(command.commandId, child.holderActorId, child.actionId)
        }
      ],
      // The child is judged on the Scene the reaction was offered on.
      reactionChild: {
        ...child,
        targetActorId,
        sceneContext:
          childScene && holderToken && targetToken
            ? {
                sceneId: childScene.sceneId,
                expectedSceneVersion: childScene.sceneVersion,
                sourceTokenId: holderToken.tokenId,
                targetTokenId: targetToken.tokenId
              }
            : null
      }
    }
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
        reactionChildren: children.recorded
      }
    // A hit's offer is made by the attack's roll, after every moment here: its answer, and the resume
    // from the child it chose, pass them all.
    if (input.answer?.offer.kind === 'HIT_BY_ATTACK' || resumedOffer?.kind === 'HIT_BY_ATTACK')
      return {
        kind: 'NONE' as const,
        reactionChildren: resumedOffer ? await resolveReactionChildren() : children.recorded
      }
    const counterResume = resumedOffer?.kind === 'COUNTER' ? resumedOffer : null
    // The counter the cast resumes from ran as its holder's own action, which spent it: when that
    // action cancelled the cast, the cast is lost with no counter of its own to spend (D219).
    if (
      counterResume &&
      children.recorded.some(
        ({ commandId, resumeOutcome }) =>
          resumeOutcome === undefined && committedChild(commandId).cancelsTriggeringEvent
      )
    )
      return {
        kind: 'COUNTERED' as const,
        countered: planNativeCounteredCast({
          state,
          actors: input.actors,
          prepared,
          casterEffects: input.activeEffectsByActorId.get(prepared.actor.id) ?? [],
          actionEconomy: cast.actionEconomy,
          ruleOverrides: cast.ruleOverrides,
          occurrenceId: input.occurrenceId,
          occurrenceVersion: cast.occurrenceVersion,
          commandId: command.commandId,
          occurredAt: input.occurredAt,
          userId: input.userId
        })
      }
    const reactionChildren = resumedOffer ? await resolveReactionChildren() : children.recorded
    /** The action held on the answered offer while the reaction chosen from it runs as a child. */
    const awaitChild = async (
      advanced: Extract<Awaited<ReturnType<typeof advanceNativeCastReactions>>, { kind: 'CHILD' }>,
      targetActorId: string
    ) => ({
      kind: 'CAST_PENDING' as const,
      continuation: advanced.continuation,
      rollerActorId: advanced.child.holderActorId,
      pause: { kind: 'CAST_REACTION' as const, payload: advanced.offer },
      ...(await launchReactionChild(reactionChildren, advanced.child, targetActorId))
    })
    // An answer to an offer the action resumes from was made after every counter offer was heard, and
    // one to an attack aimed at another after every offer the cast made.
    const resumeAnswer = input.answer && input.answer.offer.kind !== 'COUNTER' ? input.answer : null
    const aimedAnswer = resumeAnswer?.offer.kind === 'ATTACK_ON_OTHER' ? resumeAnswer : null
    const targetedAnswer = aimedAnswer ? null : resumeAnswer
    if (input.answer && !aimedAnswer && triggerLevel === null)
      throw new Error('Reaction evidence is stale.')
    let declinedReactorActorIds: readonly string[] = []
    if (
      triggerLevel !== null &&
      !resumeAnswer &&
      (!resumedOffer || counterResume) &&
      input.readScene &&
      input.actors.some((actor) => actor.kind === 'CHARACTER' && actor.id !== prepared.actor.id)
    ) {
      const advanced = await advanceNativeCastReactions({
        runtime: input.runtime,
        occurrenceId: input.occurrenceId,
        kind: 'COUNTER',
        answer: input.answer,
        // The creature whose own action did not cancel the cast has been heard, like one that declined.
        declinedReactorActorIds: counterResume
          ? [...counterResume.declinedReactorActorIds, counterResume.reactorActorId]
          : [],
        discover: await discoverCast(triggerLevel)
      })
      if (advanced.kind === 'CHILD') return awaitChild(advanced, prepared.actor.id)
      if (advanced.kind === 'OFFER')
        return {
          kind: 'CAST_PENDING' as const,
          continuation: advanced.continuation,
          rollerActorId: advanced.reactor.id,
          pause: { kind: 'CAST_REACTION' as const, payload: advanced.offer },
          reactionChildren,
          reactionChild: null
        }
      declinedReactorActorIds = advanced.declinedReactorActorIds
    }
    // Each moment the action resumes from offers its reactions in turn: being named a cast's target,
    // then an attack aimed at another creature. A moment already answered past is not offered again,
    // and the creature whose child the action resumes from has been heard, like one that declined.
    const targetedResume = resumedOffer?.kind === 'TARGETED_SELF' ? resumedOffer : null
    for (const stage of [
      {
        kind: 'TARGETED_SELF' as const,
        offered:
          triggerLevel !== null &&
          !aimedAnswer &&
          // A counter whose own action did not cancel the cast leaves it to name its targets.
          (!resumedOffer || counterResume || targetedResume) &&
          input.chosenActorIds &&
          castOwnerId,
        discover: discoverTargeted,
        answer: targetedAnswer,
        declinedReactorActorIds: targetedResume
          ? [...targetedResume.declinedReactorActorIds, targetedResume.reactorActorId]
          : declinedReactorActorIds,
        // The reaction answers its holder being named, so its action is the holder's on itself.
        childTargetActorId: (holderActorId: string) => holderActorId
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
        declinedReactorActorIds:
          resumedOffer?.kind === 'ATTACK_ON_OTHER'
            ? [...resumedOffer.declinedReactorActorIds, resumedOffer.reactorActorId]
            : [],
        childTargetActorId: () => prepared.actor.id
      }
    ]) {
      if (!stage.offered) {
        if (stage.answer) throw new Error('Reaction evidence is stale.')
        continue
      }
      const advanced = await advanceNativeCastReactions({
        runtime: input.runtime,
        occurrenceId: input.occurrenceId,
        kind: stage.kind,
        discover: stage.discover(),
        answer: stage.answer,
        declinedReactorActorIds: stage.declinedReactorActorIds
      })
      if (advanced.kind === 'CHILD')
        return awaitChild(advanced, stage.childTargetActorId(advanced.child.holderActorId))
      if (advanced.kind === 'OFFER')
        return {
          kind: 'CAST_PENDING' as const,
          continuation: advanced.continuation,
          rollerActorId: advanced.reactor.id,
          pause: { kind: 'CAST_REACTION' as const, payload: advanced.offer },
          reactionChildren,
          reactionChild: null
        }
    }
    return { kind: 'NONE' as const, reactionChildren }
  }
  return {
    advance,
    imposeChildRollModes,
    planResolvedOffers,
    launchReactionChild,
    resolveReactionChildren
  }
}

export type NativeCastPause = ReturnType<typeof createNativeCastPause>
