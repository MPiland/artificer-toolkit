import type {
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
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
import {
  discoverCastReactionActions,
  preparedSpellCastLevel
} from '@artificer-toolkit/rules-runtime/encounterCastReactionDiscovery'
import { StaleCharacterActionError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import {
  chosenEncounterReaction,
  encounterReactionPin,
  openEncounterReactionChoice,
  sameEncounterReactionCandidate,
  settleEncounterCastReactionUse,
  type EncounterCastReactionCandidate,
  type EncounterReactionSelection
} from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { encounterSceneGridPolicyRegistry } from '@artificer-toolkit/rules-runtime/sceneGridPolicyRegistry'
import { executionCancelsTriggeringEvent } from '@artificer-toolkit/rules-runtime/systems/dnd5e/cancelTriggeringEvent'

import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
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

/** A reaction its holder could use to counter the cast being resolved, prepared as it stands now. */
export type NativeCastReaction = NativeReaction<EncounterCastReactionCandidate, Prepared> & {
  /** The check its holder must pass first, because the cast is above the level it counters at. */
  check: CastReactionCheckRequirement | null
}

/**
 * The first creature, by actor id, that holds a reaction able to counter this cast, with its menu
 * (a Character has one reaction a round, so its reactions are offered together). A reaction is
 * offered when its holder can afford it now, is not suppressed (D99), reaches the caster with its own
 * range, and is cast at a level at least the cast's, or authors a check for a higher-level cast. A
 * defeated Character (D63), the caster, and a creature that already declined or failed offer nothing.
 * In a Scene a creature with no token on it cannot reach the caster.
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
    actionId: string
  ): Promise<Prepared>
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => ReturnType<LiveCaptureReads['encounterRules']>
}) {
  const { state, caster, scene } = input
  const grid = encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
    encounter: state,
    sceneGrid: scene.sceneGrid
  })
  return async (filter: {
    declinedReactorActorIds: readonly string[]
    /** Only this reaction of this creature: the offer that is being answered. */
    answering?: { reactorActorId: string; actionId: string }
  }): Promise<{
    reactor: EncounterRunActorState
    target: ReactorTarget
    reactions: NativeCastReaction[]
  } | null> => {
    const reactors = input.actors
      .filter(
        (actor) =>
          actor.kind === 'CHARACTER' &&
          actor.id !== caster.id &&
          !filter.declinedReactorActorIds.includes(actor.id) &&
          (filter.answering === undefined || actor.id === filter.answering.reactorActorId)
      )
      .sort((left, right) => left.id.localeCompare(right.id))
    for (const reactor of reactors) {
      const reactorToken = scene.tokens.find((token) => token.actorId === reactor.id)
      if (!reactorToken) continue
      const reactorTarget = await input.loadTarget(reactor)
      if (isEncounterActorDefeated(reactor, deadCharacterIdsOfTargets([reactorTarget]))) continue
      const reactions: NativeCastReaction[] = []
      for (const { actionId } of discoverCastReactionActions(reactorTarget)) {
        if (filter.answering !== undefined && actionId !== filter.answering.actionId) continue
        const prepared = await input
          .prepareReaction(reactor, reactorTarget, actionId)
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
          triggerLevel: input.triggerLevel
        })
        if (counterLevel < input.triggerLevel && !check) continue
        // A reactor with no ability to roll cannot answer the check, so the slot is not on offer.
        if (check && castReactionCheckAbility(check, reactorTarget) === undefined) continue
        const warnings = evaluateEncounterActionTargetPolicy({
          actor: prepared.actor,
          target: prepared.target,
          targetPolicy: prepared.targetPolicy,
          sceneContext: { grid, sourceToken: reactorToken, targetToken: scene.sourceToken },
          makesAttackRoll: prepared.makesAttackRoll
        })
        if (!warnings || warnings.some(({ code }) => code === 'TARGET_OUT_OF_RANGE')) continue
        const { economy, suppressed } = await evaluateNativeLiveActionEconomy({
          prepared,
          state,
          actionId,
          sourceTarget: reactorTarget,
          targetIds: [caster.id],
          capture: input.capture
        })
        if (!economy?.available || suppressed) continue
        reactions.push({
          prepared,
          economy,
          check,
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

/** What a held cast was last asked: a reactor's choice to counter, or the roll of the check that choice owes. */
export type NativeCastReactionAnswer =
  | {
      kind: 'SELECTION'
      offer: EncounterCastReactionOfferDto
      selection: EncounterReactionSelection
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
 */
export async function advanceNativeCastReactions(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  system: SystemAuthoredDto
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
  let declinedReactorActorIds = answer?.offer.declinedReactorActorIds ?? []
  const countered = async (
    found: NativeCastReaction,
    pin: EncounterFailedCounterDto['reaction'],
    choice: EncounterFailedCounterDto['choiceExecution'],
    check: EncounterCounterCheckEvidenceDto | null
  ) => ({
    kind: 'COUNTERED' as const,
    found,
    pin,
    choice,
    check,
    counterExecution: (await applyNativeCastReaction({ reaction: found, runtime, occurrenceId }))
      .execution,
    failedCounters
  })
  /** The reaction as the offer pinned it, still as affordable and as prepared as it was. */
  const current = async (pin: { reactorActorId: string; actionId: string }) => {
    const match = await input.discover({
      declinedReactorActorIds,
      answering: { reactorActorId: pin.reactorActorId, actionId: pin.actionId }
    })
    const [found] = match?.reactions ?? []
    if (!match || !found) throw new Error('Reaction evidence is stale.')
    return { found, target: match.target }
  }
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
      if (!found.check) return countered(found, reaction, choice, null)
      const prepared = prepareEncounterCastReactionCheck({
        requirement: found.check,
        gameSystemId: input.gameSystemId,
        system: input.system,
        reactor: target
      })
      const check = {
        choiceExecution: choice,
        triggerLevel: input.triggerLevel,
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
          offer: { reactions: [reaction], declinedReactorActorIds, check },
          failedCounters
        }
      rolling = {
        found,
        pin: reaction,
        check,
        continuation,
        evidence: { kind: 'AUTO_ROLL', requestId: continuation.request.requestId }
      }
    }
  }
  if (rolling) {
    const evaluated = await evaluateEncounterBasicActionCheck({
      runtime,
      context: { d20: rolling.check.d20, check: { dc: rolling.check.dc } },
      continuation: rolling.continuation,
      answer: rolling.evidence,
      rollD20: input.rollD20,
      expectedOccurrenceId: occurrenceId
    })
    const evidence = { checkDefinitionId: rolling.check.checkDefinitionId, d20: evaluated.d20 }
    if (evaluated.reachesDc)
      return countered(rolling.found, rolling.pin, rolling.check.choiceExecution, evidence)
    failedCounters.push({
      reaction: rolling.pin,
      choiceExecution: rolling.check.choiceExecution,
      triggerLevel: rolling.check.triggerLevel,
      check: evidence
    })
    declinedReactorActorIds = [...declinedReactorActorIds, rolling.pin.reactorActorId]
  }
  const next = await input.discover({ declinedReactorActorIds })
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
      reactions: next.reactions.map(({ candidate }) => encounterReactionPin(candidate)),
      declinedReactorActorIds
    },
    failedCounters
  }
}

/**
 * What each counter that failed against this cast spends with the cast's terminal commit: the reactor's
 * slot and reaction, planned against the reactor as it stands now. A reactor that changed since it
 * failed leaves the cast stale.
 */
export async function planNativeFailedCounters(input: {
  failedCounters: readonly EncounterFailedCounterDto[]
  discover: ReturnType<typeof discoverNativeCastReactions>
  state: EncounterRunState
  occurrenceId: string
  commandId: string
  occurredAt: string
  userId: string
}) {
  const planned = []
  for (const failed of input.failedCounters) {
    const match = await input.discover({
      declinedReactorActorIds: [],
      answering: {
        reactorActorId: failed.reaction.reactorActorId,
        actionId: failed.reaction.actionId
      }
    })
    const [found] = match?.reactions ?? []
    if (!found || !sameEncounterReactionCandidate(failed.reaction, found.candidate))
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
      economy: found.economy.consumption
    })
  }
  return planned
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
  // Counterspell at the caster it counters.
  const { consumedGrants, sourceReleases } = actionEndedEffects({
    holderActorId: prepared.actor.id,
    held: input.casterEffects,
    makesAttackRoll: false,
    castsSpell: true,
    againstEnemy: actsAgainstEnemy({
      actorId: prepared.actor.id,
      targetActorIds: [prepared.target.id],
      dispositions
    })
  })
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
  const spendOf = (spending: Prepared, releases: typeof sourceReleases) =>
    planNativeEncounterAreaSourceSpend(
      {
        prepared: spending,
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        occurrenceId: input.occurrenceId,
        sourceCommandId: input.commandId,
        commandId: input.commandId,
        occurredAt: input.occurredAt,
        sourceReleases: releases
      },
      input.userId
    )
  const casterSpend = spendOf(prepared, sourceReleases)
  const reactorSpend = spendOf(found.prepared, reactorEnded.sourceReleases)
  const settled = new Map([
    [
      prepared.actor.id,
      actionEconomy
        ? consumeEncounterActionEconomy({
            actor: casterSpend.settledSource,
            consumption: actionEconomy,
            overridden: overridesActionEconomy(input.ruleOverrides)
          })
        : casterSpend.settledSource
    ],
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
    consumedGrants: [...consumedGrants, ...reactorEnded.consumedGrants]
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
