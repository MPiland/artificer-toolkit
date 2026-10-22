import {
  rollModeKeptFace,
  type RollModeKeep
} from '@artificer-toolkit/schema/shared/systemVocabularyCode'
import type { ReceiptD20ContributorDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import type { EncounterActionHeldD20Dto } from '@artificer-toolkit/schema/shared/encounterActionPending'
import type {
  ContestDefenderCheckDto,
  ContestDefenderDto
} from '@artificer-toolkit/schema/shared/ruleExecutionOptionalCombatPending'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'

import { contestCheckCapabilityRegistry } from './platformEncounterPolicy.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import type { EncounterAutoRollByActorId } from './encounterEvidenceMode.js'
import { settleEncounterD20Answer } from './encounterD20Settlement.js'
import type { EncounterEvidenceAnswer } from './encounterEvidenceAnswer.js'
import {
  heldStageD20,
  settleSightGovernedD20,
  type SightGovernedD20
} from './encounterSightGovernedD20.js'

type OptionalContestD20Policy = {
  actorId: string
  requestNodeId: 'initiator_d20' | 'target_d20'
  rollMode: string
  keep: RollModeKeep
  contributors: readonly ReceiptD20ContributorDto[]
  contributorChecksum: string
  modifier: number
}

/**
 * The defender's roll for one of its sealed checks (D152): the named check, or with null the check
 * an auto-rolling defender takes, the highest modifier with ties going in sealed order.
 */
export function contestDefenderPolicy(
  defender: ContestDefenderDto,
  checkDefinitionId: string | null
): ContestDefenderCheckDto & { actorId: string; requestNodeId: string } {
  const check =
    checkDefinitionId === null
      ? defender.checks.reduce((best, entry) => (entry.modifier > best.modifier ? entry : best))
      : defender.checks.find((entry) => entry.checkDefinitionId === checkDefinitionId)
  if (!check)
    throw new EncounterValidationError('The contest defender can roll only a check it was offered.')
  return { ...check, actorId: defender.actorId, requestNodeId: defender.requestNodeId }
}

/**
 * Whether the defender answers by picking one of its sealed checks (`CONTEST_CHECK`): a basic
 * action or escape contest offers its listed checks, while an optional combat contest seals one
 * (D152).
 */
export function contestDefenderPicksCheck(contest: { origin: { kind: string } }) {
  return contest.origin.kind !== 'OPTIONAL_COMBAT'
}

/** Entered dice, the roller's app roll, or an auto-roll for a contest participant's d20. */
export type OptionalContestResolution = Exclude<EncounterEvidenceAnswer, { kind: 'ENTER_INTEGER' }>

type EncounterOptionalContestActionExecution =
  | {
      kind: 'PENDING'
      continuation: ServerRuleExecutionContinuationDto
      participant: 'INITIATOR' | 'DEFENDER'
      /** Faces settled so far, including an auto-rolled initiator before a prompted defender. */
      rolls: ReadonlyMap<'INITIATOR' | 'DEFENDER', readonly number[]>
      /** The initiator's entered die, held while one more settles the true mode (ATTACK-10.1). */
      held: EncounterActionHeldD20Dto | null
    }
  | {
      kind: 'COMPLETE'
      execution: ServerCompletedRuleExecutionDto
      initiator: OptionalContestD20Policy & {
        rawFaces: readonly number[]
        selectedNatural: number
        total: number
      }
      defender: OptionalContestD20Policy & {
        rawFaces: readonly number[]
        selectedNatural: number
        total: number
      }
    }

function requireRequest(
  continuation: ServerRuleExecutionContinuationDto
): 'INITIATOR' | 'DEFENDER' {
  if (
    continuation.request.kind !== 'INTEGER_RANGE' ||
    continuation.request.min !== 1 ||
    continuation.request.max !== 20
  ) {
    throw new EncounterValidationError('Optional combat contest requested unsupported evidence.')
  }
  if (continuation.request.nodeId === 'initiator_d20') return 'INITIATOR'
  if (continuation.request.nodeId === 'target_d20') return 'DEFENDER'
  throw new EncounterValidationError('Optional combat contest requested an unknown participant.')
}

function resolveFaces(input: {
  gameSystemId: string
  policy: OptionalContestD20Policy
  resolution: OptionalContestResolution
  requestId: string
  rollD20: () => number
}): readonly number[] {
  if (input.resolution.requestId !== input.requestId)
    throw new EncounterConflictError('Optional combat contest evidence request is stale.')
  const {
    rawFaces: faces,
    rollMode,
    keep
  } = settleEncounterD20Answer({
    gameSystemId: input.gameSystemId,
    d20: { rollMode: input.policy.rollMode, keep: input.policy.keep },
    answer: input.resolution,
    rollD20: input.rollD20,
    random: () => {
      throw new EncounterValidationError('A contest roll has no added dice.')
    }
  })
  // Contest evidence records only faces, so a contest d20 keeps its rules-derived mode.
  if (rollMode !== input.policy.rollMode || keep !== input.policy.keep)
    throw new EncounterValidationError('A contest roll keeps its rules-derived roll mode.')
  return faces
}

/** One participant's answer: its faces, or the held die when sight needs one more from the roller. */
function settleFaces(input: {
  gameSystemId: string
  policy: OptionalContestD20Policy
  /** Set for the initiator's attack d20 when sight decides its mode. */
  sight: SightGovernedD20 | null
  resolution: OptionalContestResolution
  requestId: string
  rollD20: () => number
}): { kind: 'SETTLED'; faces: readonly number[] } | { kind: 'NEEDS_EXTRA_D20'; heldFace: number } {
  if (!input.sight) return { kind: 'SETTLED', faces: resolveFaces(input) }
  if (input.resolution.requestId !== input.requestId)
    throw new EncounterConflictError('Optional combat contest evidence request is stale.')
  const settled = settleSightGovernedD20({
    gameSystemId: input.gameSystemId,
    appliedMode: input.policy.rollMode,
    sightGoverned: input.sight,
    resolution: input.resolution,
    rollD20: input.rollD20
  })
  return settled.kind === 'SETTLED' ? { kind: 'SETTLED', faces: settled.faces } : settled
}

function completeEncounterOptionalContestActionExecution(input: {
  execution: ServerCompletedRuleExecutionDto
  initiator: OptionalContestD20Policy
  defender: OptionalContestD20Policy
  rolls: ReadonlyMap<'INITIATOR' | 'DEFENDER', readonly number[]>
}): Extract<EncounterOptionalContestActionExecution, { kind: 'COMPLETE' }> {
  const initiatorFaces = input.rolls.get('INITIATOR')
  const defenderFaces = input.rolls.get('DEFENDER')
  if (!initiatorFaces || !defenderFaces) {
    throw new EncounterValidationError('Optional combat contest evidence is incomplete.')
  }
  const initiatorNatural = rollModeKeptFace(input.initiator.keep, initiatorFaces)
  const defenderNatural = rollModeKeptFace(input.defender.keep, defenderFaces)
  if (
    input.execution.outputs.initiatorNaturalD20 !== initiatorNatural ||
    input.execution.outputs.targetNaturalD20 !== defenderNatural ||
    input.execution.outputs.initiatorTotal !== initiatorNatural + input.initiator.modifier ||
    input.execution.outputs.targetTotal !== defenderNatural + input.defender.modifier
  ) {
    throw new EncounterConflictError('Optional combat contest result does not match its evidence.')
  }
  return {
    kind: 'COMPLETE',
    execution: input.execution,
    initiator: {
      ...input.initiator,
      rawFaces: initiatorFaces,
      selectedNatural: initiatorNatural,
      total: initiatorNatural + input.initiator.modifier
    },
    defender: {
      ...input.defender,
      rawFaces: defenderFaces,
      selectedNatural: defenderNatural,
      total: defenderNatural + input.defender.modifier
    }
  }
}

/** Executes the bounded two-d20 contest graph. Persistence and application stay with the Encounter coordinator. */
export async function executeEncounterOptionalContestAction(input: {
  autoRoll: EncounterAutoRollByActorId
  continuation?: ServerRuleExecutionContinuationDto
  /** The two-d20 contest graph: the optional combat contest or a basic action's contest. */
  published: ServerPublishedRuleDefinitionDto
  initiator: OptionalContestD20Policy
  defender: OptionalContestD20Policy
  /** How sight governs the initiator's attack d20, or null when it does not. */
  initiatorSight?: SightGovernedD20 | null
  occurrenceId: string
  resolution?: OptionalContestResolution
  rollD20: () => number
  runtime: RulesRuntimeService
  priorRolls?: ReadonlyMap<'INITIATOR' | 'DEFENDER', readonly number[]>
}): Promise<EncounterOptionalContestActionExecution> {
  const rolls = new Map(input.priorRolls)
  if (input.continuation) {
    if (!input.resolution)
      throw new EncounterValidationError('Optional combat contest evidence is required.')
    const participant = requireRequest(input.continuation)
    const policy = participant === 'INITIATOR' ? input.initiator : input.defender
    const sight = participant === 'INITIATOR' ? (input.initiatorSight ?? null) : null
    const settled = settleFaces({
      gameSystemId: input.published.gameSystemId,
      policy,
      sight,
      resolution: input.resolution,
      requestId: input.continuation.request.requestId,
      rollD20: input.rollD20
    })
    if (settled.kind === 'NEEDS_EXTRA_D20')
      return {
        kind: 'PENDING',
        continuation: input.continuation,
        participant,
        rolls,
        held: heldStageD20(settled.heldFace, sight)
      }
    rolls.set(participant, settled.faces)
  }
  // The graph replays from its start with every settled d20: request ids are deterministic, and the
  // defender's modifier binds to the sealed check it answers with (D152 amendment).
  const contest = contestCheckCapabilityRegistry.require(input.published.gameSystemId)
  let execution = await input.runtime.executeResolved({
    command: {
      definitionId: input.published.id,
      occurrenceId: input.occurrenceId,
      facts: {
        [contest.initiatorModifierFactKey]: input.initiator.modifier,
        [contest.targetModifierFactKey]: input.defender.modifier
      }
    },
    published: input.published
  })
  while (execution.status === 'PAUSED') {
    const participant = requireRequest(execution.continuation)
    const policy = participant === 'INITIATOR' ? input.initiator : input.defender
    const requestId = execution.continuation.request.requestId
    // Each contest d20 belongs to its participant; only an auto-rolling roller skips the prompt.
    const faces =
      rolls.get(participant) ??
      (input.autoRoll[policy.actorId] === true
        ? resolveFaces({
            gameSystemId: input.published.gameSystemId,
            policy,
            resolution: { kind: 'AUTO_ROLL', requestId },
            requestId,
            rollD20: input.rollD20
          })
        : null)
    if (!faces) break
    rolls.set(participant, faces)
    execution = await input.runtime.resume({
      continuation: execution.continuation,
      response: { requestId, value: rollModeKeptFace(policy.keep, faces) }
    })
  }
  if (execution.status === 'PAUSED') {
    return {
      kind: 'PENDING',
      continuation: execution.continuation,
      participant: requireRequest(execution.continuation),
      rolls,
      held: null
    }
  }
  return completeEncounterOptionalContestActionExecution({
    execution,
    initiator: input.initiator,
    defender: input.defender,
    rolls
  })
}
