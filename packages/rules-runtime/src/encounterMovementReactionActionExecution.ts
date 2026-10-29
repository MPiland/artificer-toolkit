import {
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionNestedD20EvidenceDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema,
  type ServerCompletedRuleExecutionDto,
  type ServerPublishedRuleDefinitionDto,
  type ServerRuleExecutionContinuationDto,
  type ServerRuleExecutionD20EvidenceDto,
  type ServerRuleExecutionNestedD20EvidenceDto,
  type ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  d20AddedDiceTotal,
  type D20AddedDieDto,
  type D20RolledAddedDieDto
} from '@artificer-toolkit/schema/shared/d20AddedDice'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { D20FoldedBonusDto } from '@artificer-toolkit/schema/shared/d20FoldedBonuses'
import {
  rollModeKeptFace,
  type RollModeKeep
} from '@artificer-toolkit/schema/shared/systemCoreCode'

import type { CharacterRuleActionSystemAdapter } from './characterRuleActionSystemAdapter.js'
import { EncounterValidationError } from './encounterErrors.js'
import {
  autoFailConditions,
  savingThrowAbility,
  type EncounterD20RollMode
} from './encounterEvidenceAnswer.js'

export interface PreparedEncounterMovementReactionAction {
  adapter: CharacterRuleActionSystemAdapter
  published: ServerPublishedRuleDefinitionDto
  actionMechanic: Readonly<Record<string, unknown>>
  movementInterruption?: null | { kind: 'STOP'; whenResultPath: string }
  sourceDerivedFacts: Readonly<Record<string, unknown>>
  sourceHitPoints?: { current: number; maximum: number } | null
  target: {
    actorId: string
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    scalarValues: Readonly<Record<string, number>>
    conditionIds: readonly string[]
    derivedFacts: Readonly<Record<string, unknown>>
    defenses: readonly {
      kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
      damageTypeId: string
    }[]
    conditionImmunityIds: readonly string[]
  }
}

export function bindMovementInterruption(input: {
  execution: ServerCompletedRuleExecutionDto
  binding: PreparedEncounterMovementReactionAction['movementInterruption']
}): ServerCompletedRuleExecutionDto {
  if (input.binding === null || input.binding === undefined)
    return { ...input.execution, movementInterruption: null }
  if (typeof input.execution.outputs.movementInterruption !== 'boolean') {
    throw new EncounterValidationError('The movement interruption output is invalid.')
  }
  return {
    ...input.execution,
    movementInterruption: input.execution.outputs.movementInterruption ? { kind: 'STOP' } : null
  }
}

function requireD20Request(continuation: ServerRuleExecutionContinuationDto): void {
  if (
    continuation.request.kind !== 'INTEGER_RANGE' ||
    continuation.request.min !== 1 ||
    continuation.request.max !== 20
  ) {
    throw new EncounterValidationError(
      'The selected reaction action requested unsupported evidence.'
    )
  }
}

/** Shared single-stage d20 policy derivation for an exact prepared Encounter action. */
export function deriveEncounterActionD20Policy(input: {
  continuation: ServerRuleExecutionContinuationDto
  bound: ReturnType<CharacterRuleActionSystemAdapter['bindFacts']>
}): ServerRuleExecutionD20PolicyDto {
  requireD20Request(input.continuation)
  if (!input.bound.d20RollMode || !input.bound.d20Keep || !input.bound.d20Audit) {
    throw new EncounterValidationError('The selected reaction action has no exact d20 policy.')
  }
  return serverRuleExecutionD20PolicyDtoSchema.parse({
    requestNodeId: input.continuation.request.nodeId,
    rollMode: input.bound.d20RollMode,
    keep: input.bound.d20Keep,
    contributors: input.bound.d20Audit.contributors,
    contributorChecksum: input.bound.d20Audit.contributorChecksum,
    modifier: input.bound.d20Audit.modifier,
    dc: input.bound.d20Audit.defenseOrDc,
    ...savingThrowAbility(input.bound.d20Audit),
    ...policyAuditDice(input.bound.d20Audit)
  })
}

/** A policy names its added dice (D156) and folded bonuses (cover) only when the test has some. */
export function policyAuditDice(audit: {
  addedDice: readonly D20AddedDieDto[]
  foldedBonuses?: readonly D20FoldedBonusDto[]
  autoFailConditionIds?: readonly string[]
}) {
  return {
    ...autoFailConditions(audit),
    ...(audit.addedDice.length > 0 ? { addedDice: [...audit.addedDice] } : {}),
    ...policyFoldedBonuses(audit.foldedBonuses)
  }
}

function policyFoldedBonuses(foldedBonuses: readonly D20FoldedBonusDto[] | undefined) {
  return foldedBonuses && foldedBonuses.length > 0 ? { foldedBonuses: [...foldedBonuses] } : {}
}

export function nestedOutcomeD20Policy(input: {
  published: ServerPublishedRuleDefinitionDto
  bound: Pick<
    ReturnType<CharacterRuleActionSystemAdapter['bindFacts']>,
    'd20RollMode' | 'd20Keep' | 'd20Audit'
  >
}): ServerRuleExecutionD20PolicyDto | null {
  const requestNode = input.published.definition.nodes?.find(
    (node) => node.id === 'nested-save-d20'
  )
  if (!requestNode) return null
  const minimum = requestNode.inputs.min
  const maximum = requestNode.inputs.max
  if (
    requestNode.operation.key !== 'evidence.integer-range' ||
    requestNode.operation.contractVersion !== 1 ||
    minimum?.kind !== 'LITERAL' ||
    minimum.value !== 1 ||
    maximum?.kind !== 'LITERAL' ||
    maximum.value !== 20
  ) {
    throw new EncounterValidationError('The nested save request is invalid.')
  }
  const { d20RollMode: rollMode, d20Keep: keep, d20Audit: audit } = input.bound
  if (!rollMode || !keep || !audit)
    throw new EncounterValidationError('The nested save policy is unavailable.')
  return serverRuleExecutionD20PolicyDtoSchema.parse({
    requestNodeId: requestNode.id,
    rollMode,
    keep,
    contributors: [...audit.contributors],
    contributorChecksum: audit.contributorChecksum,
    modifier: audit.modifier,
    dc: audit.defenseOrDc,
    ...savingThrowAbility(audit),
    ...policyAuditDice(audit)
  })
}

/**
 * Binds raw d20 faces to the completed kernel trace without exposing client arithmetic. `rollMode`
 * is the mode the faces were settled with (the applied mode when `modeAdjustment` is set); the
 * policy keeps the rules-derived one.
 */
export function buildEncounterActionD20Evidence(input: {
  execution: ServerCompletedRuleExecutionDto
  policy: ServerRuleExecutionD20PolicyDto
  requestId: string
  faces: readonly number[]
  rollMode: EncounterD20RollMode
  keep: RollModeKeep
  modeAdjustment?: ServerRuleExecutionD20EvidenceDto['modeAdjustment']
  /** The policy's added dice with the faces they rolled, in the policy's order. */
  addedDice: readonly D20RolledAddedDieDto[]
}): ServerRuleExecutionD20EvidenceDto {
  const natural = rollModeKeptFace(input.keep, input.faces)
  const trace = input.execution.evidence.trace.find(
    (entry) => entry.evidence?.requestId === input.requestId && entry.evidence.value === natural
  )
  const resultPath = input.execution.outputs.resultPath
  if (!trace || typeof resultPath !== 'string') {
    throw new EncounterValidationError('The selected reaction action d20 trace is invalid.')
  }
  return serverRuleExecutionD20EvidenceDtoSchema.parse({
    requestId: input.requestId,
    rollMode: input.rollMode,
    keep: input.keep,
    derivedRollMode: input.policy.rollMode,
    rawFaces: input.faces,
    selectedNatural: natural,
    contributors: input.policy.contributors,
    contributorChecksum: input.policy.contributorChecksum,
    modifier: input.policy.modifier,
    total: natural + input.policy.modifier + d20AddedDiceTotal(input.addedDice),
    defenseOrDc: input.policy.dc,
    resultPath,
    ...savingThrowAbility(input.policy),
    ...autoFailConditions(input.policy),
    ...(input.modeAdjustment ? { modeAdjustment: input.modeAdjustment } : {}),
    ...(input.addedDice.length > 0 ? { addedDice: [...input.addedDice] } : {}),
    ...policyFoldedBonuses(input.policy.foldedBonuses)
  })
}

/** Seals one nested saving-throw roll before later OUTCOME evidence is collected. */
export function buildEncounterSaveD20Evidence(input: {
  policy: ServerRuleExecutionD20PolicyDto
  requestId: string
  faces: readonly number[]
  rollMode: EncounterD20RollMode
  keep: RollModeKeep
  addedDice: readonly D20RolledAddedDieDto[]
}): ServerRuleExecutionNestedD20EvidenceDto {
  const natural = rollModeKeptFace(input.keep, input.faces)
  const total = natural + input.policy.modifier + d20AddedDiceTotal(input.addedDice)
  return serverRuleExecutionNestedD20EvidenceDtoSchema.parse({
    requestNodeId: input.policy.requestNodeId,
    requestId: input.requestId,
    rollMode: input.rollMode,
    keep: input.keep,
    derivedRollMode: input.policy.rollMode,
    rawFaces: input.faces,
    selectedNatural: natural,
    contributors: input.policy.contributors,
    contributorChecksum: input.policy.contributorChecksum,
    modifier: input.policy.modifier,
    total,
    defenseOrDc: input.policy.dc,
    resultPath:
      !input.policy.autoFailConditionIds?.length && total >= input.policy.dc
        ? 'ON_SAVE_SUCCESS'
        : 'ON_SAVE_FAIL',
    ...savingThrowAbility(input.policy),
    ...autoFailConditions(input.policy),
    ...(input.addedDice.length > 0 ? { addedDice: [...input.addedDice] } : {})
  })
}

/** Rejects terminal receipts whose nested save evidence is detached from the OUTCOME trace. */
export function requireEncounterSaveD20EvidenceTrace(input: {
  execution: ServerCompletedRuleExecutionDto
  policy: ServerRuleExecutionD20PolicyDto
  evidence: ServerRuleExecutionNestedD20EvidenceDto
}): void {
  if (
    input.evidence.requestNodeId !== input.policy.requestNodeId ||
    input.evidence.derivedRollMode !== input.policy.rollMode ||
    input.evidence.contributorChecksum !== input.policy.contributorChecksum ||
    checksumRuleDocument(input.evidence.contributors) !== input.policy.contributorChecksum ||
    input.evidence.modifier !== input.policy.modifier ||
    input.evidence.defenseOrDc !== input.policy.dc ||
    checksumRuleDocument(autoFailConditions(input.evidence)) !==
      checksumRuleDocument(autoFailConditions(input.policy)) ||
    checksumRuleDocument(
      (input.evidence.addedDice ?? []).map(({ rolledFaces: _rolledFaces, ...die }) => die)
    ) !== checksumRuleDocument(input.policy.addedDice ?? [])
  )
    throw new EncounterValidationError('The nested save d20 policy is invalid.')
  const rollTrace = input.execution.evidence.trace.find(
    (entry) =>
      entry.nodeId === input.evidence.requestNodeId &&
      entry.evidence?.requestId === input.evidence.requestId &&
      entry.evidence.value === input.evidence.selectedNatural
  )
  const saveTrace = input.execution.evidence.trace.find(
    (entry) =>
      entry.inputs.naturalD20 === input.evidence.selectedNatural &&
      entry.inputs.modifier === input.evidence.modifier &&
      entry.inputs.addedTotal === d20AddedDiceTotal(input.evidence.addedDice) &&
      entry.inputs.threshold === input.evidence.defenseOrDc &&
      entry.outputs.resultPath === input.evidence.resultPath
  )
  if (!rollTrace || !saveTrace)
    throw new EncounterValidationError('The nested save d20 trace is invalid.')
}
