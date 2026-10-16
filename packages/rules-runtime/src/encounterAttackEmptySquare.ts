import {
  ATTACK_EMPTY_SQUARE_RESULT_PATH,
  attackEmptySquareApplicationOutputDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import {
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { EncounterAttackActionTransitionDto } from '@artificer-toolkit/schema/projections/encounterAttackAction'
import { resolveD20Contributors } from '@artificer-toolkit/shared/rolls'
import { attackKindSchema } from '@artificer-toolkit/schema/shared/enums'
import {
  checksumRuleDocument,
  compareCanonicalD20Contributors
} from '@artificer-toolkit/shared/rules'
import type { EncounterActionEconomyConsumption } from './encounterActionEconomyConsumption.js'
import {
  attackRollContributorEvidence,
  type prepareEncounterActionMechanics
} from './encounterActionMechanicsPreparation.js'
import {
  actionEconomyReceipt,
  type buildEncounterAreaStoredExecution
} from './encounterActionReceipt.js'
import {
  encounterActionLongRangeContributor,
  type EncounterActionSceneContext
} from './encounterActionTargetPolicy.js'
import {
  encounterAttackSightContributors,
  ENCOUNTER_SQUARE_STRANGER_ACTOR_ID,
  type EncounterAttackPerception
} from './encounterAttackPerception.js'
import { rollEncounterCheck, storedCheckResult } from './encounterBasicActionCheck.js'
import { encounterConditionAttackContributors } from './encounterConditionMechanics.js'
import { EncounterValidationError } from './encounterErrors.js'
import type { EncounterEvidenceAnswer } from './encounterEvidenceAnswer.js'
import { mergeCanonicalD20Contributors } from './encounterRelationshipActionFacts.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { dnd5eAttackModifierDomain, isDnd5eMeleeAttackKind } from './systems/dnd5e/attackKind.js'

/** An empty square has no defense for the roll to meet: the record carries this in its place. */
const ATTACK_EMPTY_SQUARE_DEFENSE_OR_DC = 0

type EmptySquareAttackPrepared = Pick<
  Awaited<ReturnType<typeof prepareEncounterActionMechanics>>,
  'actor' | 'source' | 'sourceFacts' | 'binding' | 'targetPolicy'
>

/**
 * The d20 policy of an attack aimed at a square the GM ruled empty: the attacker's own modifier and
 * roll-mode contributors, plus what the attack's circumstances add without a target (the attacker's
 * conditions, range, and sight against a stranger no one is allied with). It is the policy the
 * attacker's roller already believes for an attack on a creature they cannot know the truth of, so
 * the prompt equals the one a hidden occupant would show.
 */
export function emptySquareAttackD20Policy(input: {
  prepared: EmptySquareAttackPrepared
  /** The believed sight against the stranger (`resolveEncounterBelievedSquareAttackPerception`). */
  perception: EncounterAttackPerception
  sceneContext: EncounterActionSceneContext
  requestNodeId: string
}) {
  const { prepared, sceneContext } = input
  const { actor, source, sourceFacts, targetPolicy } = prepared
  const { attackBonus, attackKind } = prepared.binding.actionMechanic
  if (typeof attackBonus !== 'number')
    throw new EncounterValidationError('Only an attack can be aimed at a square.')
  const longRange = encounterActionLongRangeContributor({ targetPolicy, sceneContext })
  const circumstances = mergeCanonicalD20Contributors(
    encounterAttackSightContributors({ perception: input.perception, attacksAgainst: [] }),
    longRange ? [longRange] : [],
    encounterConditionAttackContributors({
      attackerActorId: actor.id,
      attacker: sourceFacts.conditionMechanics,
      targetActorId: ENCOUNTER_SQUARE_STRANGER_ACTOR_ID,
      target: [],
      attack: { melee: isDnd5eMeleeAttackKind(attackKind), sceneContext }
    })
  )
  const parsedKind = attackKindSchema.safeParse(attackKind)
  const contributors = (
    attackRollContributorEvidence({
      source,
      actorId: actor.id,
      activeEffects: sourceFacts.activeEffects,
      contributors: circumstances
    })[parsedKind.success ? dnd5eAttackModifierDomain(parsedKind.data) : 'MELEE'] ?? []
  )
    .map(({ sourceId, grantId, domainKey, influence }) => ({
      sourceId,
      grantId,
      domainKey,
      influence
    }))
    .sort(compareCanonicalD20Contributors)
  return serverRuleExecutionD20PolicyDtoSchema.parse({
    requestNodeId: input.requestNodeId,
    rollMode: resolveD20Contributors(contributors).rollMode,
    contributors,
    contributorChecksum: checksumRuleDocument(contributors),
    modifier: attackBonus,
    dc: ATTACK_EMPTY_SQUARE_DEFENSE_OR_DC
  })
}

/**
 * Settles the attacker's d20 on a square the GM ruled empty. The attack misses whatever the roll,
 * and the stored root holds the d20 and the attacker's one spend.
 */
export async function settleEmptySquareAttack(input: {
  runtime: RulesRuntimeService
  continuation: ServerRuleExecutionContinuationDto
  d20Policy: ReturnType<typeof emptySquareAttackD20Policy>
  answer: EncounterEvidenceAnswer
  rollD20: () => number
  occurrenceVersion: number
  actorId: string
  sourceCharacterId: string | null
  spend: Parameters<typeof buildEncounterAreaStoredExecution>[0]['spend']
  actionEconomy: EncounterActionEconomyConsumption | null
  attackAction: EncounterAttackActionTransitionDto | null
}) {
  const { continuation, d20Policy, spend } = input
  const evaluated = await rollEncounterCheck({
    runtime: input.runtime,
    context: { d20: d20Policy },
    continuation,
    answer: input.answer,
    rollD20: input.rollD20,
    expectedOccurrenceId: continuation.occurrenceId
  })
  const d20 = serverRuleExecutionD20EvidenceDtoSchema.parse({
    ...evaluated.d20,
    defenseOrDc: d20Policy.dc,
    resultPath: ATTACK_EMPTY_SQUARE_RESULT_PATH
  })
  const applicationOutputs = attackEmptySquareApplicationOutputDtoSchema.parse({
    kind: 'ATTACK_EMPTY_SQUARE',
    schemaVersion: 1,
    occurrenceId: continuation.occurrenceId,
    sourceActorId: input.actorId,
    sourceCharacterId: input.sourceCharacterId,
    d20,
    sourceCharacterStreamVersion: spend.sourceCharacterStreamVersion,
    resourceConsumption: spend.resourceReceipt,
    featureResourceConsumption: spend.featureResourceReceipt,
    sourceItemUseStateTransition: spend.sourceItemUseStateTransition,
    sourceItemConsumption: spend.itemConsumptionReceipt,
    spellCastConsumption: spend.spellConsumptionReceipt,
    actionEconomyTransition: actionEconomyReceipt(input.actionEconomy),
    ...(input.attackAction ? { attackActionTransition: input.attackAction } : {})
  })
  return {
    d20,
    result: storedCheckResult({
      evaluated,
      continuation,
      occurrenceVersion: input.occurrenceVersion,
      initialFactsChecksum: checksumRuleDocument(continuation.facts),
      applicationOutputs
    })
  }
}
