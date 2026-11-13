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
import type { LiveSessionEncounterActionResume } from '@artificer-toolkit/schema/api/liveSessionCommandScopes'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  EncounterCastReactionOfferDto,
  EncounterUsedReactionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import {
  planNativeEncounterAreaSourceSpend,
  type NativeEncounterActionMechanicsInput
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import {
  buildEncounterCounteredCastStoredExecution,
  buildEncounterUsedReactionReceipt
} from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { encounterActionSourceLabel } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  castReactionCheckAbility,
  castReactionCheckRequirement
} from '@artificer-toolkit/rules-runtime/encounterCastReactionCheck'
import { preparedSpellCastLevel } from '@artificer-toolkit/rules-runtime/encounterPreparedSpellCast'
import { characterReactionCandidates } from '@artificer-toolkit/rules-runtime/encounterReactors'
import {
  chosenEncounterReaction,
  encounterReactionPin,
  openEncounterReactionChoice,
  sameEncounterReactionCandidate,
  settleEncounterCastReactionUse,
  type EncounterReactionCandidate
} from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'

import { planNativeLostSourceAction } from './nativeEncounterLostAction.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { offerNativeReactions, type NativeReaction } from './nativeEncounterReactionCandidate.js'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'

/** The preparation shape the source spend plans against. */
type Prepared = NativeEncounterActionMechanicsInput['prepared']
/** A reaction as the one offer prepares it. */
type PreparedReaction = Awaited<ReturnType<Parameters<typeof offerNativeReactions>[0]['prepare']>>
export type ReactorTarget = Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']
export type CastScene = Extract<
  LiveSessionEncounterRulesResponse,
  { kind: 'ACTION_AREA_SCENE' }
>['context']

/**
 * A reaction its holder could use before the action being resolved does anything, prepared as it
 * stands now.
 */
export type NativeCastResponse = NativeReaction<EncounterReactionCandidate, Prepared>

/** Which reactor and reaction a discovery looks for, and whom it has already heard from. */
type CastReactionFilter = {
  declinedReactorActorIds: readonly string[]
  /** Only this reaction of this creature: the offer that is being answered. */
  answering?: { reactorActorId: string; actionId: string }
}

/** The first creature, by actor id, holding a reaction to the cast, with its menu; null when none does. */
export type CastReactionDiscovery<Found extends NativeCastResponse> = (
  filter: CastReactionFilter
) => Promise<{
  reactor: EncounterRunActorState
  target: ReactorTarget
  reactions: Found[]
} | null>

/**
 * The first Character, by actor id, that a moment offers a reaction, with its menu (a Character has one
 * reaction a round, so its reactions are offered together). A defeated Character (D63), one the moment
 * does not concern, and one already heard from offer nothing.
 */
export async function firstNativeReactorOffered<Found>(input: {
  actors: readonly EncounterRunActorState[]
  filter: CastReactionFilter
  /** Whether the moment may concern this Character. */
  concerns(actor: EncounterRunActorState): boolean
  loadTarget(actor: EncounterRunActorState): Promise<ReactorTarget>
  offer(reactor: EncounterRunActorState, reactorTarget: ReactorTarget): Promise<Found[]>
}) {
  const { filter } = input
  const reactors = input.actors
    .filter(
      (actor) =>
        actor.kind === 'CHARACTER' &&
        input.concerns(actor) &&
        !filter.declinedReactorActorIds.includes(actor.id) &&
        (filter.answering === undefined || actor.id === filter.answering.reactorActorId)
    )
    .sort((left, right) => left.id.localeCompare(right.id))
  for (const reactor of reactors) {
    const target = await input.loadTarget(reactor)
    if (isEncounterActorDefeated(reactor, deadCharacterIdsOfTargets([target]))) continue
    const reactions = await input.offer(reactor, target)
    if (reactions.length > 0) return { reactor, target, reactions }
  }
  return null
}

/**
 * The first creature, by actor id, that holds a reaction able to counter a cast, with its menu
 * (a Character has one reaction a round, so its reactions are offered together). A reaction is
 * offered when its holder can afford it now, is not suppressed (D99), reaches the creature whose cast it
 * answers with its own range, and is cast at a level at least the cast's, or authors a check for a
 * higher-level cast. A defeated Character (D63), the creature whose cast is answered, and a creature
 * already unavailable (declined, used a counter) offer nothing. In a Scene a creature with no token on
 * it cannot reach the cast.
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
  ): Promise<PreparedReaction>
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => ReturnType<LiveCaptureReads['encounterRules']>
}): CastReactionDiscovery<NativeCastResponse> {
  const { state, caster, scene, triggerLevel } = input
  const grid = resolveEncounterSceneGrid({
    encounter: state,
    sceneGrid: scene.sceneGrid
  })
  return (filter) =>
    firstNativeReactorOffered({
      actors: input.actors,
      filter,
      concerns: (actor) =>
        actor.id !== caster.id && scene.tokens.some((token) => token.actorId === actor.id),
      loadTarget: input.loadTarget,
      offer: (reactor, reactorTarget) =>
        offerNativeReactions({
          state,
          reactorActorId: reactor.id,
          reactorTarget,
          held: characterReactionCandidates(reactorTarget),
          events: [{ kind: 'SPELL_CAST_BY_OTHER' }],
          answering: filter.answering?.actionId,
          prepare: (actionId) => input.prepareReaction(reactor, reactorTarget, actionId, caster),
          admit: (prepared) => {
            if (prepared.source.kind !== 'CHARACTER_ACTION') return null
            const level = preparedSpellCastLevel(prepared)
            if (level === null) return null
            const trigger = prepared.source.candidate.mechanicFacts.invocation.reactionTrigger
            const check = castReactionCheckRequirement({
              higherLevelCheck:
                trigger?.kind === 'SPELL_CAST' ? trigger.higherLevelCheck : undefined,
              counterLevel: level,
              triggerLevel
            })
            if (level < triggerLevel && !check) return null
            // A reactor with no ability to roll cannot answer the check, so the slot is not on offer.
            if (check && castReactionCheckAbility(check, reactorTarget) === undefined) return null
            return {}
          },
          range: {
            grid,
            sourceToken: scene.tokens.find((token) => token.actorId === reactor.id)!,
            targetToken: scene.sourceToken
          },
          targetIds: [caster.id],
          capture: input.capture
        })
    })
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
  ): Promise<PreparedReaction>
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => ReturnType<LiveCaptureReads['encounterRules']>
}): CastReactionDiscovery<NativeCastResponse> {
  return (filter) =>
    firstNativeReactorOffered({
      actors: input.actors,
      filter,
      concerns: (actor) => input.chosenActorIds.includes(actor.id),
      loadTarget: input.loadTarget,
      offer: (reactor, reactorTarget) =>
        offerNativeReactions({
          state: input.state,
          reactorActorId: reactor.id,
          reactorTarget,
          held: characterReactionCandidates(reactorTarget),
          events: [{ kind: 'TARGETED_BY_CAST', castOwnerId: input.castOwnerId }],
          answering: filter.answering?.actionId,
          prepare: (actionId) => input.prepareReaction(reactor, reactorTarget, actionId),
          // A reaction's receipt carries no pool spend, so one paid from a pool would never use it up.
          admit: (prepared) =>
            prepared.source.kind !== 'CHARACTER_ACTION' ||
            prepared.characterActionState?.resourceConsumption
              ? null
              : {},
          range: null,
          targetIds: [reactor.id],
          capture: input.capture
        })
    })
}

/** What a held cast was last asked: a reactor's choice among the reactions offered. */
export type NativeCastReactionAnswer = {
  offer: EncounterCastReactionOfferDto
  selection: EncounterSealedChoiceSelection
}

/**
 * Where the offers of one moment before an action does anything stand once an answer, if any, is
 * taken in (the creatures that may counter a cast, those it names as targets, those beside an attack
 * aimed at another): the child action of the reaction a creature chose, the next creature to ask, or
 * nobody left to ask. A decline hands the action to the next creature in turn. The action itself is
 * never held; it replays from its command with the declines recorded.
 *
 * A chosen reaction runs as its holder's own action (D219): this names that child and keeps the
 * answered offer, and the action resumes past that creature once the child has committed. A counter's
 * child is itself a cast, which offers its own counters and owes the counter's check as its own
 * incoming gate, so no check is rolled here.
 */
export async function advanceNativeCastReactions(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  /** The offer kind of the moment these reactions answer. */
  kind: EncounterCastReactionOfferDto['kind']
  discover: CastReactionDiscovery<NativeCastResponse>
  answer: NativeCastReactionAnswer | null
  /**
   * The creatures already heard from when no answer is in hand: those that declined, and the one
   * whose reaction ran as its own action.
   */
  declinedReactorActorIds: readonly string[]
}) {
  const { runtime, occurrenceId, answer } = input
  const declinedReactorActorIds = [
    ...(answer?.offer.declinedReactorActorIds ?? input.declinedReactorActorIds)
  ]
  if (answer) {
    const chosen = chosenEncounterReaction(answer.offer, answer.selection)
    if (answer.selection.kind === 'OPTION') {
      const { found } = await findNativeCastReaction(input.discover, chosen)
      await settleEncounterCastReactionUse({
        runtime,
        occurrenceId,
        offer: answer.offer,
        candidate: found.candidate,
        optionId: answer.selection.optionId
      })
      return {
        kind: 'CHILD' as const,
        child: { holderActorId: chosen.reactorActorId, actionId: chosen.actionId },
        // The offer stays as it was answered until the action resumes from the child.
        continuation: await openEncounterReactionChoice({
          runtime,
          occurrenceId,
          candidate: found.candidate
        }),
        offer: answer.offer
      }
    }
    declinedReactorActorIds.push(chosen.reactorActorId)
  }
  const next = await input.discover({ declinedReactorActorIds })
  if (!next) return { kind: 'NONE' as const, declinedReactorActorIds }
  return {
    kind: 'OFFER' as const,
    reactor: next.reactor,
    continuation: await openEncounterReactionChoice({
      runtime,
      occurrenceId,
      candidate: next.reactions[0]!.candidate
    }),
    offer: {
      kind: input.kind,
      reactions: next.reactions.map(({ candidate }) => encounterReactionPin(candidate)),
      declinedReactorActorIds
    }
  }
}

/** The reaction as an offer pinned it, still as affordable and as prepared as it was. */
async function findNativeCastReaction<Found extends NativeCastResponse>(
  discover: CastReactionDiscovery<Found>,
  pin: { reactorActorId: string; actionId: string }
) {
  const match = await discover({
    declinedReactorActorIds: [],
    answering: { reactorActorId: pin.reactorActorId, actionId: pin.actionId }
  })
  const [found] = match?.reactions ?? []
  if (!match || !found) throw new Error('Reaction evidence is stale.')
  return { found, target: match.target }
}

/**
 * What each reaction used before this action executed spends with the action's terminal commit: the
 * reactor's slot and reaction, planned against the reactor as it stands now. A reactor that changed
 * since it reacted leaves the action stale.
 */
export async function planNativeUsedReactions(input: {
  usedReactions: readonly EncounterUsedReactionDto[]
  /** The discovery that finds a spent reaction of this trigger again. */
  discover(
    trigger: EncounterUsedReactionDto['reaction']['trigger']
  ): Promise<CastReactionDiscovery<NativeCastResponse>>
  state: EncounterRunState
  occurrenceId: string
  commandId: string
  occurredAt: string
  userId: string
}) {
  const planned = []
  for (const used of input.usedReactions) {
    const { found } = await findNativeCastReaction(
      await input.discover(used.reaction.trigger),
      used.reaction
    )
    if (!sameEncounterReactionCandidate(used.reaction, found.candidate))
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
      receipt: buildEncounterUsedReactionReceipt({
        used,
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
  planned: Awaited<ReturnType<typeof planNativeUsedReactions>>,
  actorId: string
) {
  return planned.flatMap(({ receipt, spellConsumption }) =>
    receipt.reaction.reactorActorId === actorId && spellConsumption ? [spellConsumption] : []
  )
}

/**
 * The countered cast: the caster spends its slot and action and nothing the spell would have done
 * happens. The counter ran as its holder's own action (D219), which spent its slot and reaction there.
 * Nothing is stored; the commit applies the spends and the sealed record.
 */
export function planNativeCounteredCast(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  prepared: Prepared
  /** The effects the caster holds; the cast still ends those that end on a cast. */
  casterEffects: readonly ActiveRuleEffectRecord[]
  actionEconomy: NativeReaction<unknown>['economy']['consumption'] | null
  ruleOverrides: Parameters<typeof overridesActionEconomy>[0]
  occurrenceId: string
  occurrenceVersion: number
  commandId: string
  occurredAt: string
  userId: string
  usedReactions: Awaited<ReturnType<typeof planNativeUsedReactions>>
}) {
  const { state, prepared, actionEconomy } = input
  // A countered cast makes no attack roll, but it is still a cast, aimed at the cast's target. A
  // reaction of the caster's own spends in the caster's one batch with the cast.
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
    counterSpellConsumptions: counterConsumptionsOf(input.usedReactions, prepared.actor.id)
  })
  const facts = buildEncounterActorRuleFacts({
    actors: input.actors.map((actor) =>
      actor.id === prepared.actor.id ? caster.settledSource : actor
    )
  })
  return {
    storedExecution: buildEncounterCounteredCastStoredExecution({
      occurrenceId: input.occurrenceId,
      occurrenceVersion: input.occurrenceVersion,
      actorId: prepared.actor.id,
      sourceCharacterId: prepared.actor.kind === 'CHARACTER' ? prepared.actor.sourceId : null,
      spend: caster.spend,
      actionEconomy
    }),
    rules: reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
      facts,
      { output: prepared.actorRules }
    ),
    usedReactions: input.usedReactions,
    consumedGrants: caster.consumedGrants
  }
}

/** The contract the room persists to commit a countered cast in the transaction of the answer. */
export function buildNativeLiveEncounterCounteredCastCommitInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: {
    command: ResolveEncounterActionInputDto
    response: ResolveRuleOccurrenceInputDto | null
    /** The room's resume from the counter's own action, which cancelled the cast (D219). */
    resume: LiveSessionEncounterActionResume | null
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
    resume: plan.resume ?? undefined,
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
    usedReactions: countered.usedReactions.map(({ receipt, spellConsumption }) => ({
      receipt,
      spellConsumption
    })),
    consumedGrants: countered.consumedGrants,
    label: encounterActionSourceLabel(prepared.source),
    ruleOverrides: plan.ruleOverrides
  })
}
