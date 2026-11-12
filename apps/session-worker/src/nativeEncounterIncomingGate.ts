import type {
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { liveSessionEncounterGatedActionCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  EncounterIncomingGateOfferDto,
  EncounterSettledIncomingGateDto
} from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { NativeEncounterActionMechanicsInput } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import { buildEncounterGatedActionStoredExecution } from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { encounterActionSourceLabel } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  evaluateEncounterBasicActionCheck,
  startEncounterBasicActionCheck
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import {
  encounterAttackRetargetOffer,
  openEncounterAttackRetargetChoice,
  type EncounterAttackRetargetCandidate
} from '@artificer-toolkit/rules-runtime/encounterAttackRetarget'
import {
  castReactionCheckRequirement,
  prepareEncounterCastReactionCheck
} from '@artificer-toolkit/rules-runtime/encounterCastReactionCheck'
import {
  preparedCastsSpell,
  preparedSpellCastLevel
} from '@artificer-toolkit/rules-runtime/encounterPreparedSpellCast'
import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import {
  heldIncomingGate,
  incomingGateOffer
} from '@artificer-toolkit/rules-runtime/encounterIncomingAttackGate'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'

import { planNativeLostSourceAction } from './nativeEncounterLostAction.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'

type Prepared = NativeEncounterActionMechanicsInput['prepared']
type MovementTarget = Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']

/** The source's answer to the roll a pending gate waits on. */
export type NativeIncomingGateAnswer = {
  offer: EncounterIncomingGateOfferDto
  continuation: ServerRuleExecutionContinuationDto
  evidence: EncounterEvidenceAnswer
}

/**
 * The check a reaction's child action owes before it runs (D219): the one its authored trigger asks
 * when the cast it answers is cast above the level the reaction is cast at. Null when it owes none.
 */
export function owedNativeTriggerCheck(prepared: Prepared, triggerLevel: number | null) {
  const counterLevel = preparedSpellCastLevel(prepared)
  if (triggerLevel === null || counterLevel === null || prepared.source.kind !== 'CHARACTER_ACTION')
    return null
  const trigger = prepared.source.candidate.mechanicFacts.invocation.reactionTrigger
  const requirement = castReactionCheckRequirement({
    higherLevelCheck: trigger?.kind === 'SPELL_CAST' ? trigger.higherLevelCheck : undefined,
    counterLevel,
    triggerLevel
  })
  return requirement && { requirement, triggerLevel }
}

/** What the action's source owes: the ward of the creature it aims at, or its own trigger's check. */
type NativeOwedIncomingGate =
  | {
      kind: 'WARD'
      holderActorId: string
      holderEffects: readonly ActiveRuleEffectRecord[]
      holderGrantFold: Parameters<typeof heldIncomingGate>[0]['grantFold']
      /** The attacker's Creature type; null for a Character. */
      attackerCreatureTypeId: string | null
      /** The ward owner's facts as they stand now; null when the owner is no longer in the encounter. */
      owner: (
        ownerActorId: string
      ) => Promise<Pick<
        MovementTarget,
        'effectiveRulePolicyOutput' | 'effectiveScalarValues'
      > | null>
    }
  | ({ kind: 'TRIGGER'; system: SystemAuthoredDto } & NonNullable<
      ReturnType<typeof owedNativeTriggerCheck>
    >)

/**
 * The window in which an action's source owes a roll before its action does anything: the saving throw
 * of the warded creature it attacks, or the check its own reaction trigger asks (D219). A player who
 * prompts for the roll is asked for it; an auto-roll player or a creature is rolled for. A pass lets
 * the action go on with the gate remembered, so no later pause of the same action asks again; a fail
 * loses the action.
 */
export async function advanceNativeIncomingGate(input: {
  runtime: RulesRuntimeService
  random?: (maximum: number) => number
  gameSystemId: string
  occurrenceId: string
  owed: NativeOwedIncomingGate
  /** The action's source, who rolls. */
  attacker: MovementTarget
  autoRoll: boolean
  /** The gate an earlier request of this action already passed. */
  passed: EncounterSettledIncomingGateDto | undefined
  answer: NativeIncomingGateAnswer | null
}) {
  const { owed, passed } = input
  const held =
    owed.kind === 'WARD'
      ? heldIncomingGate({
          holderActorId: owed.holderActorId,
          effects: owed.holderEffects,
          grantFold: owed.holderGrantFold,
          attackerCreatureTypeId: owed.attackerCreatureTypeId,
          attacker: {
            actorId: input.attacker.actor.id,
            characterId:
              input.attacker.actor.kind === 'CHARACTER' ? input.attacker.actor.sourceId : null
          }
        })
      : null
  if (
    owed.kind === 'WARD'
      ? !held || (passed?.origin.kind === 'WARD' && passed.origin.effectId === held.wardId)
      : passed?.origin.kind === 'TRIGGER'
  ) {
    if (input.answer) throw new Error('The incoming gate is no longer owed.')
    // A ward an earlier request of this action passed still owes its success immunity at the commit.
    return { kind: 'NONE' as const, passed: held }
  }
  let offer: EncounterIncomingGateOfferDto
  if (owed.kind === 'TRIGGER') {
    const check = prepareEncounterCastReactionCheck({
      requirement: owed.requirement,
      gameSystemId: input.gameSystemId,
      system: owed.system,
      reactor: input.attacker
    })
    offer = {
      origin: { kind: 'TRIGGER', triggerLevel: owed.triggerLevel },
      checkDefinitionId: check.checkDefinitionId,
      dc: owed.requirement.dc,
      d20: check.d20
    }
  } else {
    const owner = await owed.owner(held!.ownerActorId)
    if (!owner) throw new Error('The owner of the incoming gate is no longer in the encounter.')
    offer = incomingGateOffer({
      gameSystemId: input.gameSystemId,
      held: held!,
      holderActorId: owed.holderActorId,
      owner,
      attacker: input.attacker
    })
  }
  if (input.answer && checksumRuleDocument(input.answer.offer) !== checksumRuleDocument(offer))
    throw new Error('The incoming gate changed.')
  const continuation =
    input.answer?.continuation ??
    (await startEncounterBasicActionCheck({
      runtime: input.runtime,
      gameSystemId: input.gameSystemId,
      occurrenceId: input.occurrenceId,
      addedDice: offer.d20.addedDice
    }))
  if (!input.answer && !input.autoRoll)
    return {
      kind: 'PENDING' as const,
      continuation,
      rollerActorId: input.attacker.actor.id,
      pause: { kind: 'INCOMING_GATE' as const, payload: offer }
    }
  const random = input.random ?? nextRollInt
  const evaluated = await evaluateEncounterBasicActionCheck({
    gameSystemId: input.gameSystemId,
    runtime: input.runtime,
    context: { d20: offer.d20, check: { dc: offer.dc } },
    continuation,
    answer: input.answer?.evidence ?? {
      kind: 'AUTO_ROLL',
      requestId: continuation.request.requestId
    },
    rollD20: () => random(20) + 1,
    random,
    expectedOccurrenceId: input.occurrenceId
  })
  const gate: EncounterSettledIncomingGateDto = {
    origin: offer.origin,
    checkDefinitionId: offer.checkDefinitionId,
    dc: offer.dc,
    d20: evaluated.d20
  }
  return evaluated.reachesDc
    ? { kind: 'PASSED' as const, gate, passed: held }
    : { kind: 'FAILED' as const, gate }
}

/**
 * The offer to turn an action a ward stopped on another creature before it is lost, or null when
 * there is nobody to turn it on. Only creatures the attacker's own list shows are offered: a hidden
 * creature's id never leaves. A failed trigger check offers nothing: its action answers one cast.
 */
export async function offerNativeAttackRetarget(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  gate: EncounterSettledIncomingGateDto
  command: ResolveEncounterActionInputDto
  actors: readonly EncounterRunActorState[]
  prepared: Prepared
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => ReturnType<LiveCaptureReads['encounterRules']>
}) {
  const { gate, prepared } = input
  const { origin } = gate
  if (origin.kind !== 'WARD' || input.command.target.kind !== 'ACTOR') return null
  const bindings = input.command.sceneContext
    ? await input.capture({ kind: 'ACTOR_TOKEN_BINDINGS' })
    : null
  if (bindings && bindings.kind !== 'ACTOR_TOKEN_BINDINGS')
    throw new Error('Retarget bindings are unavailable.')
  const seen = await input.capture({ kind: 'SEEN_ACTORS' })
  if (seen.kind !== 'SEEN_ACTORS') throw new Error('Retarget sight is unavailable.')
  const seenIds = new Set(seen.actorIds)
  const candidates = input.actors.flatMap((actor): EncounterAttackRetargetCandidate[] => {
    if (actor.id === prepared.actor.id || actor.id === prepared.target.id) return []
    if (!seenIds.has(actor.id)) return []
    if (!bindings) return [{ actorId: actor.id, tokenId: null }]
    const binding = bindings.bindings.find((entry) => entry.actorId === actor.id)
    return binding ? [{ actorId: actor.id, tokenId: binding.tokenId }] : []
  })
  if (!candidates.length) return null
  return {
    continuation: await openEncounterAttackRetargetChoice({
      runtime: input.runtime,
      occurrenceId: input.occurrenceId,
      gameSystemId: input.gameSystemId,
      optionCount: candidates.length
    }),
    rollerActorId: prepared.actor.id,
    pause: {
      kind: 'ATTACK_RETARGET' as const,
      payload: encounterAttackRetargetOffer({ ...gate, origin }, candidates)
    }
  }
}

/**
 * The action its gate stopped: the source spends its slot, resource, item and action and nothing the attack
 * or spell would have done happens. Nothing is stored; the commit applies the spend and the sealed record.
 */
export function planNativeGatedAction(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  prepared: Prepared
  sourceEffects: readonly ActiveRuleEffectRecord[]
  actionEconomy: Parameters<typeof planNativeLostSourceAction>[0]['actionEconomy']
  ruleOverrides: Parameters<typeof overridesActionEconomy>[0]
  occurrenceId: string
  occurrenceVersion: number
  commandId: string
  occurredAt: string
  userId: string
  failed: Extract<Awaited<ReturnType<typeof advanceNativeIncomingGate>>, { kind: 'FAILED' }>
}) {
  const { state, prepared } = input
  const castsSpell = preparedCastsSpell(prepared)
  const lost = planNativeLostSourceAction({
    state,
    actors: input.actors,
    prepared,
    sourceEffects: input.sourceEffects,
    makesAttackRoll: typeof prepared.binding.actionMechanic.attackBonus === 'number',
    castsSpell,
    actionEconomy: input.actionEconomy,
    ruleOverrides: input.ruleOverrides,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    occurredAt: input.occurredAt,
    userId: input.userId
  })
  const facts = buildEncounterActorRuleFacts({
    actors: input.actors.map((actor) =>
      actor.id === prepared.actor.id ? lost.settledSource : actor
    )
  })
  return {
    storedExecution: buildEncounterGatedActionStoredExecution({
      occurrenceId: input.occurrenceId,
      occurrenceVersion: input.occurrenceVersion,
      actorId: prepared.actor.id,
      sourceCharacterId: prepared.actor.kind === 'CHARACTER' ? prepared.actor.sourceId : null,
      spend: lost.spend,
      actionEconomy: input.actionEconomy,
      lost: castsSpell ? 'SPELL' : 'ATTACK',
      gate: input.failed.gate
    }),
    rules: reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
      facts,
      { output: prepared.actorRules }
    ),
    consumedGrants: lost.consumedGrants
  }
}

/** The contract the room persists to commit a gated action in the transaction of the roll that failed it. */
export function buildNativeLiveEncounterGatedActionCommitInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: {
    command: ResolveEncounterActionInputDto
    response: ResolveRuleOccurrenceInputDto | null
    revisions: LiveSessionRulesRevisions
    occurredAt: string
    prepared: Prepared
    currentnessChecksum: string
    ruleOverrides: Parameters<typeof overridesActionEconomy>[0]
    gated: ReturnType<typeof planNativeGatedAction>
  }
) {
  const { prepared, gated } = plan
  return liveSessionEncounterGatedActionCommitInputSchema.parse({
    ...scope,
    command: plan.command,
    response: plan.response,
    revisions: plan.revisions,
    occurredAt: plan.occurredAt,
    currentnessChecksum: plan.currentnessChecksum,
    initialDefinitionId:
      prepared.plan.kind === 'SINGLE_GRAPH'
        ? prepared.plan.published.id
        : prepared.plan.test.published.id,
    execution: gated.storedExecution,
    rules: gated.rules,
    resourceConsumption: prepared.characterActionState?.resourceConsumption ?? null,
    itemConsumption: prepared.characterActionState?.itemConsumption ?? null,
    spellConsumption: prepared.characterActionState?.spellConsumption ?? null,
    consumedGrants: gated.consumedGrants,
    label: encounterActionSourceLabel(prepared.source),
    ruleOverrides: plan.ruleOverrides
  })
}
