import type {
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterSealedChoiceSelection } from '@artificer-toolkit/rules-runtime/encounterSealedChoice'
import { liveSessionEncounterCounteredCastCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  EncounterCastReactionOfferDto,
  EncounterCounterCheckEvidenceDto,
  EncounterFailedCounterDto
} from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { advanceNativeActionGraphs } from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import {
  planNativeEncounterAreaSourceSpend,
  type NativeEncounterActionMechanicsInput
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import {
  buildEncounterCounteredCastStoredExecution,
  buildEncounterFailedCounterReceipt
} from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import {
  actionEndedEffects,
  actsAgainstEnemy
} from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { encounterActionSourceLabel } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { evaluateEncounterActionTargetPolicy } from '@artificer-toolkit/rules-runtime/encounterActionTargetPolicy'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  evaluateEncounterBasicActionCheck,
  startEncounterBasicActionCheck
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import {
  castReactionCheckAbility,
  castReactionCheckRequirement,
  prepareEncounterCastReactionCheck,
  type CastReactionCheckRequirement
} from '@artificer-toolkit/rules-runtime/encounterCastReactionCheck'
import { preparedSpellCastLevel } from '@artificer-toolkit/rules-runtime/encounterPreparedSpellCast'
import { characterReactionCandidates } from '@artificer-toolkit/rules-runtime/encounterReactors'
import { discoverEncounterEventHooks } from '@artificer-toolkit/rules-runtime/events/encounterEventHooks'
import { StaleCharacterActionError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import {
  chosenEncounterReaction,
  encounterReactionPin,
  openEncounterReactionChoice,
  sameEncounterReactionCandidate,
  settleEncounterCastReactionUse,
  type EncounterCastReactionCandidate
} from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { encounterSceneGridPolicyRegistry } from '@artificer-toolkit/rules-runtime/sceneGridPolicyRegistry'
import { executionCancelsTriggeringEvent } from '@artificer-toolkit/rules-runtime/systems/dnd5e/cancelTriggeringEvent'

import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import { planNativeLostSourceAction } from './nativeEncounterLostAction.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import {
  nativeReactionCandidate,
  unsupportedReaction,
  type NativeReaction
} from './nativeEncounterReactionCandidate.js'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'

/** The preparation shape the source spend plans against. */
type Prepared = NativeEncounterActionMechanicsInput['prepared']
type ReactorTarget = Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']
type CastScene = Extract<
  LiveSessionEncounterRulesResponse,
  { kind: 'ACTION_AREA_SCENE' }
>['context']

/** A reaction its holder could use against the cast being resolved, prepared as it stands now. */
type NativeCastResponse = NativeReaction<EncounterCastReactionCandidate, Prepared>

/** A reaction its holder could use to counter the cast being resolved, prepared as it stands now. */
export type NativeCastReaction = NativeCastResponse & {
  /** The check its holder must pass first, because the cast is above the level it counters at. */
  check: CastReactionCheckRequirement | null
  /** The level its holder casts it at. */
  level: number
}

/** Which reactor and reaction a discovery looks for, and whom it has already heard from. */
type CastReactionFilter = {
  declinedReactorActorIds: readonly string[]
  /** Only this reaction of this creature: the offer that is being answered. */
  answering?: { reactorActorId: string; actionId: string }
  /** The cast the reactions answer, when it is not the original caster's own. */
  against?: { actorId: string; level: number }
}

/** The first creature, by actor id, holding a reaction to the cast, with its menu; null when none does. */
type CastReactionDiscovery<Found extends NativeCastResponse> = (
  filter: CastReactionFilter
) => Promise<{
  reactor: EncounterRunActorState
  target: ReactorTarget
  reactions: Found[]
} | null>

/**
 * The first creature, by actor id, that holds a reaction able to counter a cast, with its menu
 * (a Character has one reaction a round, so its reactions are offered together). A reaction is
 * offered when its holder can afford it now, is not suppressed (D99), reaches the creature whose cast it
 * answers with its own range, and is cast at a level at least the cast's, or authors a check for a
 * higher-level cast. A defeated Character (D63), the creature whose cast is answered, and a creature
 * already unavailable (declined, used a counter) offer nothing. In a Scene a creature with no token on
 * it cannot reach the cast. The cast answered is the original caster's unless `against` names a counter
 * cast, itself a cast another creature may counter, the original caster included.
 */
export function discoverNativeCastReactions(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  caster: EncounterRunActorState
  /** The level the cast is cast at; a counter cast lower owes its authored check. */
  triggerLevel: number
  /** The Scene the cast is made in; range is measured on it. */
  scene: CastScene
  loadTarget(actor: EncounterRunActorState): Promise<ReactorTarget>
  prepareReaction(
    reactor: EncounterRunActorState,
    reactorTarget: ReactorTarget,
    actionId: string,
    /** The creature whose cast the reaction answers. */
    against: EncounterRunActorState
  ): Promise<Prepared>
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => ReturnType<LiveCaptureReads['encounterRules']>
}): CastReactionDiscovery<NativeCastReaction> {
  const { state, caster, scene } = input
  const grid = encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
    encounter: state,
    sceneGrid: scene.sceneGrid
  })
  return async (filter) => {
    const againstActorId = filter.against?.actorId ?? caster.id
    const triggerLevel = filter.against?.level ?? input.triggerLevel
    const against = input.actors.find((actor) => actor.id === againstActorId)
    const tokenOf = (actorId: string) =>
      actorId === caster.id
        ? scene.sourceToken
        : scene.tokens.find((token) => token.actorId === actorId)
    const againstToken = tokenOf(againstActorId)
    if (!against || !againstToken) return null
    const reactors = input.actors
      .filter(
        (actor) =>
          actor.kind === 'CHARACTER' &&
          actor.id !== againstActorId &&
          !filter.declinedReactorActorIds.includes(actor.id) &&
          (filter.answering === undefined || actor.id === filter.answering.reactorActorId)
      )
      .sort((left, right) => left.id.localeCompare(right.id))
    for (const reactor of reactors) {
      const reactorToken = tokenOf(reactor.id)
      if (!reactorToken) continue
      const reactorTarget = await input.loadTarget(reactor)
      if (isEncounterActorDefeated(reactor, deadCharacterIdsOfTargets([reactorTarget]))) continue
      const reactions: NativeCastReaction[] = []
      const { reactions: hooks } = discoverEncounterEventHooks({
        reactions: characterReactionCandidates(reactorTarget),
        events: [{ kind: 'SPELL_CAST_BY_OTHER' }]
      })
      for (const {
        reaction: { actionId }
      } of hooks) {
        if (filter.answering !== undefined && actionId !== filter.answering.actionId) continue
        const prepared = await input
          .prepareReaction(reactor, reactorTarget, actionId, against)
          .catch((error: unknown) => {
            // A reaction its holder cannot pay for (no slot, not prepared) is simply not offered.
            if (error instanceof StaleCharacterActionError) return null
            throw error
          })
        if (!prepared || prepared.source.kind !== 'CHARACTER_ACTION') continue
        const counterLevel = preparedSpellCastLevel(prepared)
        if (counterLevel === null) continue
        const trigger = prepared.source.candidate.mechanicFacts.invocation.reactionTrigger
        const check = castReactionCheckRequirement({
          higherLevelCheck: trigger?.kind === 'SPELL_CAST' ? trigger.higherLevelCheck : undefined,
          counterLevel,
          triggerLevel
        })
        if (counterLevel < triggerLevel && !check) continue
        // A reactor with no ability to roll cannot answer the check, so the slot is not on offer.
        if (check && castReactionCheckAbility(check, reactorTarget) === undefined) continue
        const warnings = evaluateEncounterActionTargetPolicy({
          actor: prepared.actor,
          target: prepared.target,
          targetPolicy: prepared.targetPolicy,
          sceneContext: { grid, sourceToken: reactorToken, targetToken: againstToken },
          makesAttackRoll: prepared.makesAttackRoll
        })
        if (!warnings || warnings.some(({ code }) => code === 'TARGET_OUT_OF_RANGE')) continue
        const { economy, suppressed } = await evaluateNativeLiveActionEconomy({
          prepared,
          state,
          actionId,
          sourceTarget: reactorTarget,
          targetIds: [againstActorId],
          capture: input.capture
        })
        if (!economy?.available || suppressed) continue
        reactions.push({
          prepared,
          economy,
          check,
          level: counterLevel,
          candidate: nativeReactionCandidate({
            trigger: 'SPELL_CAST',
            reactorActorId: reactor.id,
            source: prepared.source,
            actionId,
            consumption: economy.consumption,
            gameSystemId: state.gameSystemId
          })
        })
      }
      if (reactions.length > 0) return { reactor, target: reactorTarget, reactions }
    }
    return null
  }
}

/**
 * The first creature, by actor id, among those the cast names as targets that holds a reaction to being
 * chosen (Shield against Magic Missile), with its menu. A reaction is offered when its holder can
 * afford it now and is not suppressed (D99), and it answers a cast of `castOwnerId` (the spell cast).
 * It is prepared against its holder alone, so no range is measured. A defeated Character (D63) and one
 * already heard from offer nothing. The caster may be among the targets.
 */
export function discoverNativeTargetedReactions(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  /** The creatures the cast names as its targets. */
  chosenActorIds: readonly string[]
  castOwnerId: string
  loadTarget(actor: EncounterRunActorState): Promise<ReactorTarget>
  prepareReaction(
    reactor: EncounterRunActorState,
    reactorTarget: ReactorTarget,
    actionId: string
  ): Promise<Prepared>
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => ReturnType<LiveCaptureReads['encounterRules']>
}): CastReactionDiscovery<NativeCastResponse> {
  const { state } = input
  return async (filter) => {
    const reactors = input.actors
      .filter(
        (actor) =>
          actor.kind === 'CHARACTER' &&
          input.chosenActorIds.includes(actor.id) &&
          !filter.declinedReactorActorIds.includes(actor.id) &&
          (filter.answering === undefined || actor.id === filter.answering.reactorActorId)
      )
      .sort((left, right) => left.id.localeCompare(right.id))
    for (const reactor of reactors) {
      const reactorTarget = await input.loadTarget(reactor)
      if (isEncounterActorDefeated(reactor, deadCharacterIdsOfTargets([reactorTarget]))) continue
      const reactions: NativeCastResponse[] = []
      const { reactions: hooks } = discoverEncounterEventHooks({
        reactions: characterReactionCandidates(reactorTarget),
        events: [{ kind: 'TARGETED_BY_CAST', castOwnerId: input.castOwnerId }]
      })
      for (const {
        reaction: { actionId }
      } of hooks) {
        if (filter.answering !== undefined && actionId !== filter.answering.actionId) continue
        const prepared = await input
          .prepareReaction(reactor, reactorTarget, actionId)
          .catch((error: unknown) => {
            // A reaction its holder cannot pay for (no slot, not prepared) is simply not offered.
            if (error instanceof StaleCharacterActionError) return null
            throw error
          })
        if (!prepared || prepared.source.kind !== 'CHARACTER_ACTION') continue
        // A reaction's receipt carries no pool spend, so one paid from a pool would never use it up.
        if (prepared.characterActionState?.resourceConsumption) continue
        const { economy, suppressed } = await evaluateNativeLiveActionEconomy({
          prepared,
          state,
          actionId,
          sourceTarget: reactorTarget,
          targetIds: [reactor.id],
          capture: input.capture
        })
        if (!economy?.available || suppressed) continue
        reactions.push({
          prepared,
          economy,
          candidate: nativeReactionCandidate({
            trigger: 'TARGETED_SELF',
            reactorActorId: reactor.id,
            source: prepared.source,
            actionId,
            consumption: economy.consumption,
            gameSystemId: state.gameSystemId
          })
        })
      }
      if (reactions.length > 0) return { reactor, target: reactorTarget, reactions }
    }
    return null
  }
}

/** What a held cast was last asked: a reactor's choice to counter, or the roll of the check that choice owes. */
export type NativeCastReactionAnswer =
  | {
      kind: 'SELECTION'
      offer: EncounterCastReactionOfferDto
      selection: EncounterSealedChoiceSelection
    }
  | {
      kind: 'CHECK'
      offer: EncounterCastReactionOfferDto & {
        check: NonNullable<EncounterCastReactionOfferDto['check']>
      }
      continuation: ServerRuleExecutionContinuationDto
      evidence: EncounterEvidenceAnswer
    }

/**
 * Where the offers to counter a cast stand once an answer, if any, is taken in: the counter a creature
 * used, the roll its counter waits on, the next creature to ask, or nobody left to ask. A decline hands
 * the cast to the next creature in turn; so does a failed check, which also keeps the failed attempt for
 * the cast's terminal commit (D127). The cast itself is never held; it replays from its command with the
 * declines recorded.
 *
 * A counter that stands is itself a cast, so the other creatures are offered a counter to it in turn: the
 * chain grows by one counter per answer, a fresh level of offers for each, and resolves innermost first
 * once nobody is left to ask. An odd chain leaves its first counter standing, which counters the cast;
 * an even one is spent without effect and the cast is offered again at its own level. Every counter in
 * the chain but the one that stands is kept for the terminal commit to spend.
 */
export async function advanceNativeCastReactions(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  system: SystemAuthoredDto
  /** The creature casting the spell, whose own offers are measured from it. */
  casterActorId: string
  /** The level the cast is cast at. */
  triggerLevel: number
  discover: ReturnType<typeof discoverNativeCastReactions>
  answer: NativeCastReactionAnswer | null
  /** The attempts that already failed against this cast. */
  failedCounters: readonly EncounterFailedCounterDto[]
  /** Whether a reactor's player has the app roll their dice, so its check settles without a pause. */
  autoRoll: (actorId: string) => boolean
  rollD20: () => number
}) {
  const { runtime, occurrenceId, answer } = input
  const failedCounters = [...input.failedCounters]
  const chain = [...(answer?.offer.chain?.counters ?? [])]
  /** The declines of the cast itself, kept while counters stand to the level above. */
  let castDeclinedReactorActorIds = answer?.offer.chain?.castDeclinedReactorActorIds
  /** The level of the cast the offers now answer: the last counter's, or the cast's own. */
  let castLevel = answer?.offer.chain?.castLevel ?? input.triggerLevel
  let declinedReactorActorIds = [...(answer?.offer.declinedReactorActorIds ?? [])]
  const reactorOf = ({ reaction }: EncounterFailedCounterDto) => reaction.reactorActorId
  const against = () => ({
    actorId: chain.at(-1)?.reaction.reactorActorId ?? input.casterActorId,
    level: castLevel
  })
  const chainOffer = () =>
    chain.length > 0
      ? {
          chain: {
            counters: chain,
            castDeclinedReactorActorIds: castDeclinedReactorActorIds ?? [],
            castLevel
          }
        }
      : {}
  /** A counter that stands against the cast the offers answer; the next level counters it. */
  const stand = (
    found: NativeCastReaction,
    pin: EncounterFailedCounterDto['reaction'],
    choiceExecution: EncounterFailedCounterDto['choiceExecution'],
    check: EncounterCounterCheckEvidenceDto | null
  ) => {
    chain.push({
      reaction: pin,
      choiceExecution,
      triggerLevel: castLevel,
      againstActorId: against().actorId,
      check
    })
    castDeclinedReactorActorIds ??= declinedReactorActorIds
    declinedReactorActorIds = []
    castLevel = found.level
  }
  /** The reaction as the offer pinned it, still as affordable and as prepared as it was. */
  const current = (pin: { reactorActorId: string; actionId: string }) =>
    findNativeCastReaction(input.discover, pin, against())
  let rolling: {
    found: NativeCastReaction
    pin: EncounterFailedCounterDto['reaction']
    check: NonNullable<EncounterCastReactionOfferDto['check']>
    continuation: ServerRuleExecutionContinuationDto
    evidence: EncounterEvidenceAnswer
  } | null = null
  if (answer?.kind === 'CHECK') {
    const pin = answer.offer.reactions[0]!
    const { found } = await current(pin)
    if (
      !sameEncounterReactionCandidate(pin, found.candidate) ||
      found.check?.dc !== answer.offer.check.dc
    )
      throw new Error('Reaction evidence is stale.')
    rolling = {
      found,
      pin,
      check: answer.offer.check,
      continuation: answer.continuation,
      evidence: answer.evidence
    }
  } else if (answer) {
    const chosen = chosenEncounterReaction(answer.offer, answer.selection)
    if (answer.selection.kind === 'DECLINE')
      declinedReactorActorIds = [...declinedReactorActorIds, chosen.reactorActorId]
    else {
      const { found, target } = await current(chosen)
      const { reaction, choice } = await settleEncounterCastReactionUse({
        runtime,
        occurrenceId,
        offer: answer.offer,
        candidate: found.candidate,
        optionId: answer.selection.optionId
      })
      if (found.check) {
        const prepared = prepareEncounterCastReactionCheck({
          requirement: found.check,
          gameSystemId: input.gameSystemId,
          system: input.system,
          reactor: target
        })
        const check = {
          choiceExecution: choice,
          triggerLevel: castLevel,
          checkDefinitionId: prepared.checkDefinitionId,
          dc: found.check.dc,
          d20: prepared.d20
        }
        const continuation = await startEncounterBasicActionCheck({
          runtime,
          gameSystemId: input.gameSystemId,
          occurrenceId
        })
        if (!input.autoRoll(chosen.reactorActorId))
          return {
            kind: 'CHECK' as const,
            reactor: found.prepared.actor,
            continuation,
            offer: {
              kind: 'COUNTER' as const,
              reactions: [reaction],
              declinedReactorActorIds,
              check,
              ...chainOffer()
            },
            failedCounters
          }
        rolling = {
          found,
          pin: reaction,
          check,
          continuation,
          evidence: { kind: 'AUTO_ROLL', requestId: continuation.request.requestId }
        }
      } else stand(found, reaction, choice, null)
    }
  }
  if (rolling) {
    const evaluated = await evaluateEncounterBasicActionCheck({
      gameSystemId: input.gameSystemId,
      runtime,
      context: { d20: rolling.check.d20, check: { dc: rolling.check.dc } },
      continuation: rolling.continuation,
      answer: rolling.evidence,
      rollD20: input.rollD20,
      expectedOccurrenceId: occurrenceId
    })
    const evidence = { checkDefinitionId: rolling.check.checkDefinitionId, d20: evaluated.d20 }
    if (evaluated.reachesDc)
      stand(rolling.found, rolling.pin, rolling.check.choiceExecution, evidence)
    else {
      failedCounters.push({
        reaction: rolling.pin,
        choiceExecution: rolling.check.choiceExecution,
        triggerLevel: rolling.check.triggerLevel,
        againstActorId: against().actorId,
        check: evidence
      })
      declinedReactorActorIds = [...declinedReactorActorIds, rolling.pin.reactorActorId]
    }
  }
  for (;;) {
    const next = await input.discover({
      declinedReactorActorIds: [
        ...declinedReactorActorIds,
        ...failedCounters.map(reactorOf),
        ...chain.map(reactorOf)
      ],
      against: against()
    })
    if (next)
      return {
        kind: 'OFFER' as const,
        reactor: next.reactor,
        continuation: await openEncounterReactionChoice({
          runtime,
          occurrenceId,
          candidate: next.reactions[0]!.candidate
        }),
        offer: {
          kind: 'COUNTER' as const,
          reactions: next.reactions.map(({ candidate }) => encounterReactionPin(candidate)),
          declinedReactorActorIds,
          ...chainOffer()
        },
        failedCounters
      }
    if (chain.length === 0)
      return { kind: 'NONE' as const, failedCounters, declinedReactorActorIds }
    if (chain.length % 2 === 1) {
      // Nobody counters the first counter, so it stands and counters the cast; the rest are spent.
      const standing = chain[0]!
      const { found } = await findNativeCastReaction(input.discover, standing.reaction, {
        actorId: standing.againstActorId,
        level: standing.triggerLevel
      })
      if (!sameEncounterReactionCandidate(standing.reaction, found.candidate))
        throw new Error('Reaction evidence is stale.')
      return {
        kind: 'COUNTERED' as const,
        found,
        pin: standing.reaction,
        choice: standing.choiceExecution,
        check: standing.check,
        counterExecution: (
          await applyNativeCastReaction({ reaction: found, runtime, occurrenceId })
        ).execution,
        failedCounters: [...failedCounters, ...chain.slice(1)]
      }
    }
    // Every counter was countered in turn, so none has an effect and the cast is offered again.
    failedCounters.push(...chain.splice(0))
    declinedReactorActorIds = castDeclinedReactorActorIds ?? []
    castDeclinedReactorActorIds = undefined
    castLevel = input.triggerLevel
  }
}

/**
 * Where the offers to the creatures a cast names as targets stand once an answer, if any, is taken in:
 * the reaction a creature used (kept with the cast's other spent reactions, to be spent and applied at
 * its terminal commit), the next creature to ask, or nobody left. A decline and a use both hand the
 * cast to the next creature in turn; the creature heard from is not asked again.
 */
export async function advanceNativeTargetedReactions(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  /** The creature casting the spell. */
  casterActorId: string
  /** The level the cast is cast at. */
  triggerLevel: number
  discover: CastReactionDiscovery<NativeCastResponse>
  answer: Extract<NativeCastReactionAnswer, { kind: 'SELECTION' }> | null
  /** The reactions already spent against this cast. */
  failedCounters: readonly EncounterFailedCounterDto[]
  /** The creatures the counter offers already heard from, which the first targeted offer carries on. */
  declinedReactorActorIds: readonly string[]
}) {
  const { runtime, occurrenceId, answer } = input
  const failedCounters = [...input.failedCounters]
  const declinedReactorActorIds = [
    ...(answer ? answer.offer.declinedReactorActorIds : input.declinedReactorActorIds)
  ]
  if (answer) {
    const chosen = chosenEncounterReaction(answer.offer, answer.selection)
    declinedReactorActorIds.push(chosen.reactorActorId)
    if (answer.selection.kind === 'OPTION') {
      const { found } = await findNativeCastReaction(input.discover, chosen, {
        actorId: input.casterActorId,
        level: input.triggerLevel
      })
      const { reaction, choice } = await settleEncounterCastReactionUse({
        runtime,
        occurrenceId,
        offer: answer.offer,
        candidate: found.candidate,
        optionId: answer.selection.optionId
      })
      failedCounters.push({
        reaction,
        choiceExecution: choice,
        triggerLevel: input.triggerLevel,
        againstActorId: input.casterActorId,
        check: null
      })
    }
  }
  const next = await input.discover({
    declinedReactorActorIds: [
      ...declinedReactorActorIds,
      ...failedCounters.map(({ reaction }) => reaction.reactorActorId)
    ]
  })
  if (!next) return { kind: 'NONE' as const, failedCounters }
  return {
    kind: 'OFFER' as const,
    reactor: next.reactor,
    continuation: await openEncounterReactionChoice({
      runtime,
      occurrenceId,
      candidate: next.reactions[0]!.candidate
    }),
    offer: {
      kind: 'TARGETED_SELF' as const,
      reactions: next.reactions.map(({ candidate }) => encounterReactionPin(candidate)),
      declinedReactorActorIds
    },
    failedCounters
  }
}

/** The reaction as an offer pinned it, still as affordable and as prepared as it was. */
async function findNativeCastReaction<Found extends NativeCastResponse>(
  discover: CastReactionDiscovery<Found>,
  pin: { reactorActorId: string; actionId: string },
  against: { actorId: string; level: number }
) {
  const match = await discover({
    declinedReactorActorIds: [],
    answering: { reactorActorId: pin.reactorActorId, actionId: pin.actionId },
    against
  })
  const [found] = match?.reactions ?? []
  if (!match || !found) throw new Error('Reaction evidence is stale.')
  return { found, target: match.target }
}

/**
 * What each counter that failed against this cast spends with the cast's terminal commit: the reactor's
 * slot and reaction, planned against the reactor as it stands now. A reactor that changed since it
 * failed leaves the cast stale.
 */
export async function planNativeFailedCounters(input: {
  failedCounters: readonly EncounterFailedCounterDto[]
  /** The discovery that finds a spent reaction of this trigger again. */
  discover(
    trigger: EncounterFailedCounterDto['reaction']['trigger']
  ): Promise<CastReactionDiscovery<NativeCastResponse>>
  state: EncounterRunState
  occurrenceId: string
  commandId: string
  occurredAt: string
  userId: string
}) {
  const planned = []
  for (const failed of input.failedCounters) {
    const { found } = await findNativeCastReaction(
      await input.discover(failed.reaction.trigger),
      failed.reaction,
      { actorId: failed.againstActorId, level: failed.triggerLevel }
    )
    if (!sameEncounterReactionCandidate(failed.reaction, found.candidate))
      throw new Error('Reaction evidence is stale.')
    const spend = planNativeEncounterAreaSourceSpend(
      {
        prepared: found.prepared,
        encounterId: input.state.id,
        expectedEncounterVersion: input.state.version,
        occurrenceId: input.occurrenceId,
        sourceCommandId: input.commandId,
        commandId: input.commandId,
        occurredAt: input.occurredAt
      },
      input.userId
    )
    const spellConsumption = found.prepared.characterActionState?.spellConsumption
    planned.push({
      receipt: buildEncounterFailedCounterReceipt({
        failed,
        spellConsumption,
        characterStreamVersion: spend.sourceCharacterStreamVersion,
        economy: found.economy.consumption
      }),
      spellConsumption: spellConsumption ?? null,
      economy: found.economy.consumption,
      found
    })
  }
  return planned
}

/** The slots the failed counters of one actor spend, for the batch its own cast spends in. */
export function counterConsumptionsOf(
  planned: Awaited<ReturnType<typeof planNativeFailedCounters>>,
  actorId: string
) {
  return planned.flatMap(({ receipt, spellConsumption }) =>
    receipt.reaction.reactorActorId === actorId && spellConsumption ? [spellConsumption] : []
  )
}

/**
 * The countered cast: the caster spends its slot and action and nothing the spell would have done
 * happens, while the creature that countered it spends its own slot and reaction. Nothing is stored;
 * the commit applies both spends and the sealed record.
 */
export function planNativeCounteredCast(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  prepared: Prepared
  /** The effects the caster holds; the cast still ends those that end on a cast. */
  casterEffects: readonly ActiveRuleEffectRecord[]
  /** The effects the countering reactor holds; its Counterspell is a cast too. */
  reactorEffects: readonly ActiveRuleEffectRecord[]
  /** The level the countered cast was cast at. */
  triggerLevel: number
  actionEconomy: NativeReaction<unknown>['economy']['consumption'] | null
  ruleOverrides: Parameters<typeof overridesActionEconomy>[0]
  occurrenceId: string
  occurrenceVersion: number
  commandId: string
  occurredAt: string
  userId: string
  countered: Extract<Awaited<ReturnType<typeof advanceNativeCastReactions>>, { kind: 'COUNTERED' }>
  failedCounters: Awaited<ReturnType<typeof planNativeFailedCounters>>
}) {
  const { state, prepared, countered, actionEconomy } = input
  const { found } = countered
  const dispositions = new Map(input.actors.map(({ id, disposition }) => [id, disposition]))
  // A countered cast makes no attack roll, but it is still a cast: aimed at the cast's target, and the
  // Counterspell at the caster it counters. The caster's counter to a counter cast against its cast spends
  // in the caster's one batch with the cast.
  const caster = planNativeLostSourceAction({
    state,
    actors: input.actors,
    prepared,
    sourceEffects: input.casterEffects,
    makesAttackRoll: false,
    castsSpell: true,
    actionEconomy,
    ruleOverrides: input.ruleOverrides,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    occurredAt: input.occurredAt,
    userId: input.userId,
    counterSpellConsumptions: counterConsumptionsOf(input.failedCounters, prepared.actor.id)
  })
  const casterSpend = caster.spend
  const reactorEnded = actionEndedEffects({
    holderActorId: found.prepared.actor.id,
    held: input.reactorEffects,
    makesAttackRoll: false,
    castsSpell: true,
    againstEnemy: actsAgainstEnemy({
      actorId: found.prepared.actor.id,
      targetActorIds: [prepared.actor.id],
      dispositions
    })
  })
  const reactorSpend = planNativeEncounterAreaSourceSpend(
    {
      prepared: found.prepared,
      encounterId: state.id,
      expectedEncounterVersion: state.version,
      occurrenceId: input.occurrenceId,
      sourceCommandId: input.commandId,
      commandId: input.commandId,
      occurredAt: input.occurredAt,
      sourceReleases: reactorEnded.sourceReleases,
      counterSpellConsumptions: []
    },
    input.userId
  )
  const settled = new Map([
    [prepared.actor.id, caster.settledSource],
    [
      found.prepared.actor.id,
      consumeEncounterActionEconomy({
        actor: reactorSpend.settledSource,
        consumption: found.economy.consumption,
        overridden: false
      })
    ]
  ])
  const facts = buildEncounterActorRuleFacts({
    actors: input.actors.map((actor) => settled.get(actor.id) ?? actor)
  })
  return {
    storedExecution: buildEncounterCounteredCastStoredExecution({
      occurrenceId: input.occurrenceId,
      occurrenceVersion: input.occurrenceVersion,
      actorId: prepared.actor.id,
      sourceCharacterId: prepared.actor.kind === 'CHARACTER' ? prepared.actor.sourceId : null,
      spend: casterSpend,
      actionEconomy,
      counter: {
        reaction: countered.pin,
        choiceExecution: countered.choice,
        counterExecution: countered.counterExecution,
        triggerLevel: input.triggerLevel,
        check: countered.check,
        spellConsumption: found.prepared.characterActionState?.spellConsumption,
        applications: reactorSpend.sourceApplications,
        characterStreamVersion: reactorSpend.sourceCharacterStreamVersion,
        economy: found.economy.consumption
      }
    }),
    rules: reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
      facts,
      { output: prepared.actorRules }
    ),
    reactionSpellConsumption: found.prepared.characterActionState?.spellConsumption ?? null,
    failedCounters: input.failedCounters,
    consumedGrants: [...caster.consumedGrants, ...reactorEnded.consumedGrants]
  }
}

/** The contract the room persists to commit a countered cast in the transaction of the answer. */
export function buildNativeLiveEncounterCounteredCastCommitInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: {
    command: ResolveEncounterActionInputDto
    response: ResolveRuleOccurrenceInputDto | null
    revisions: LiveSessionRulesRevisions
    occurredAt: string
    prepared: Prepared
    ruleOverrides: Parameters<typeof overridesActionEconomy>[0]
    countered: ReturnType<typeof planNativeCounteredCast>
  }
) {
  const { prepared, countered } = plan
  return liveSessionEncounterCounteredCastCommitInputSchema.parse({
    ...scope,
    command: plan.command,
    response: plan.response,
    revisions: plan.revisions,
    occurredAt: plan.occurredAt,
    initialDefinitionId:
      prepared.plan.kind === 'SINGLE_GRAPH'
        ? prepared.plan.published.id
        : prepared.plan.test.published.id,
    execution: countered.storedExecution,
    rules: countered.rules,
    resourceConsumption: prepared.characterActionState?.resourceConsumption ?? null,
    itemConsumption: prepared.characterActionState?.itemConsumption ?? null,
    spellConsumption: prepared.characterActionState?.spellConsumption ?? null,
    reactionSpellConsumption: countered.reactionSpellConsumption,
    failedCounters: countered.failedCounters.map(({ receipt, spellConsumption }) => ({
      receipt,
      spellConsumption
    })),
    consumedGrants: countered.consumedGrants,
    label: encounterActionSourceLabel(prepared.source),
    ruleOverrides: plan.ruleOverrides
  })
}

/**
 * Runs a used counter and refuses one that is not an unconditional cancel of the cast: a counter that
 * asks for rolls pauses, and one whose execution never cancelled the event has nothing to apply.
 * Nothing is stored; the commit spends what the counter cost.
 */
export async function applyNativeCastReaction(input: {
  reaction: NativeCastReaction
  runtime: RulesRuntimeService
  occurrenceId: string
}) {
  const { prepared } = input.reaction
  const execution = await advanceNativeActionGraphs({
    runtime: input.runtime,
    adapter: prepared.adapter,
    plan: prepared.plan,
    occurrenceId: input.occurrenceId,
    // A counter that asks for dice is not resolved inline; it pauses and is refused below.
    autoRoll: { SOURCE: false, TARGET: false },
    binding: prepared.binding,
    afterTest: async () => undefined
  })
  if (execution.kind !== 'COMPLETE' || !executionCancelsTriggeringEvent(execution.execution))
    throw unsupportedReaction('A reaction to a cast must cancel it without rolls.')
  return execution
}
