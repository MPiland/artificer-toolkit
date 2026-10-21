import type {
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { liveSessionEncounterGatedActionCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterIncomingGateOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
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
import { preparedCastsSpell } from '@artificer-toolkit/rules-runtime/encounterPreparedSpellCast'
import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import {
  heldIncomingGate,
  incomingGateOffer
} from '@artificer-toolkit/rules-runtime/encounterIncomingAttackGate'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'

import { planNativeLostSourceAction } from './nativeEncounterLostAction.js'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'

type Prepared = NativeEncounterActionMechanicsInput['prepared']
type MovementTarget = Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']

/** The attacker's answer to the save a pending gate waits on. */
export type NativeIncomingGateAnswer = {
  offer: EncounterIncomingGateOfferDto
  continuation: ServerRuleExecutionContinuationDto
  evidence: EncounterEvidenceAnswer
}

/**
 * The window in which an attacker of a warded creature owes the ward's saving throw, before the attack
 * or harmful spell does anything. A player who prompts for saves is asked for the roll; an auto-roll
 * player or a creature is rolled for. A pass lets the action go on with the ward remembered, so no later
 * pause of the same action asks again; a fail loses the action.
 */
export async function advanceNativeIncomingGate(input: {
  runtime: RulesRuntimeService
  random?: (maximum: number) => number
  gameSystemId: string
  occurrenceId: string
  holderActorId: string
  holderEffects: readonly ActiveRuleEffectRecord[]
  holderGrantFold: Parameters<typeof heldIncomingGate>[0]['grantFold']
  attacker: MovementTarget
  /** The attacker's Creature type; null for a Character. */
  attackerCreatureTypeId: string | null
  /** The ward owner's facts as they stand now; null when the owner is no longer in the encounter. */
  owner: (
    ownerActorId: string
  ) => Promise<Pick<MovementTarget, 'effectiveRulePolicyOutput' | 'effectiveScalarValues'> | null>
  autoRoll: boolean
  /** The ward whose save an earlier request of this action already passed. */
  passedEffectId: string | undefined
  answer: NativeIncomingGateAnswer | null
}) {
  const held = heldIncomingGate({
    holderActorId: input.holderActorId,
    effects: input.holderEffects,
    grantFold: input.holderGrantFold,
    attackerCreatureTypeId: input.attackerCreatureTypeId,
    attacker: {
      actorId: input.attacker.actor.id,
      characterId: input.attacker.actor.kind === 'CHARACTER' ? input.attacker.actor.sourceId : null
    }
  })
  if (!held || held.wardId === input.passedEffectId) {
    if (input.answer) throw new Error('The incoming gate is no longer owed.')
    // A ward an earlier request of this action passed still owes its success immunity at the commit.
    return { kind: 'NONE' as const, passed: held }
  }
  const owner = await input.owner(held.ownerActorId)
  if (!owner) throw new Error('The owner of the incoming gate is no longer in the encounter.')
  const offer = incomingGateOffer({
    gameSystemId: input.gameSystemId,
    held,
    holderActorId: input.holderActorId,
    owner,
    attacker: input.attacker
  })
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
  return evaluated.reachesDc
    ? { kind: 'PASSED' as const, effectId: offer.effectId, passed: held }
    : {
        kind: 'FAILED' as const,
        gate: {
          effectId: offer.effectId,
          holderActorId: offer.holderActorId,
          checkDefinitionId: offer.checkDefinitionId,
          dc: offer.dc,
          d20: evaluated.d20
        }
      }
}

/**
 * The action a ward stopped: the source spends its slot, resource, item and action and nothing the attack
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
