import { v5 as uuidv5 } from 'uuid'

import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import { resolveDispositionDamage } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import { z } from 'zod'

import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import { EncounterValidationError } from './encounterErrors.js'

export type ReceiptApplications = Extract<
  ServerRuleExecutionApplicationOutputsDto,
  { kind: 'CHARACTER_MECHANICS_BATCH' }
>['applications']
const CHARACTER_MECHANICS_EVENT_NAMESPACE = '1724d9a4-39b9-5c6a-80b9-b5cc1fb8616f'

export type EncounterCharacterMechanicsEventPhase =
  | 'DIRECT_ACTION_OUTCOME'
  | 'DIRECT_ACTION_RESOURCE'
  | 'LEGENDARY_ACTION_OUTCOME'
  | 'LEGENDARY_ACTION_RESOURCE'
  | 'MOVEMENT_REACTION_OUTCOME'
  | 'MOVEMENT_REACTION_RESOURCE'
  | 'SPATIAL_EFFECT'
  | 'TURN_EFFECT'

export function deriveEncounterCharacterMechanicsEventCommandId(input: {
  occurrenceId: string
  sourceCommandId: string
  phase: EncounterCharacterMechanicsEventPhase
  ordinal: number
  targetCharacterId: string
}): string {
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 0)
    throw new EncounterValidationError('The Character mechanics event ordinal is invalid.')
  return uuidv5(
    `${input.occurrenceId}:${input.sourceCommandId}:${input.phase}:${input.ordinal}:${input.targetCharacterId}`,
    CHARACTER_MECHANICS_EVENT_NAMESPACE
  )
}

export type TargetState = {
  currentHitPoints: number
  temporaryHitPoints: number
  maximumHitPoints: number
  conditionIds: string[]
  scalarValues: Record<string, number>
}

export function readEncounterActorConditionState(input: unknown): {
  ids: string[]
  values: unknown[]
} {
  const parsedRows = z.array(z.json()).safeParse(input)
  if (!parsedRows.success)
    throw new EncounterValidationError('Encounter actor conditions are not normalized.')
  const ids: string[] = []
  for (const condition of parsedRows.data) {
    const conditionId =
      typeof condition === 'string'
        ? condition
        : typeof condition === 'object' && condition !== null && !Array.isArray(condition)
          ? (condition as Record<string, unknown>).conditionTypeId
          : null
    const parsed = serverUuidIdentityDtoSchema.safeParse(conditionId)
    if (!parsed.success || parsed.data !== conditionId || ids.includes(parsed.data))
      throw new EncounterValidationError('Encounter actor conditions are not canonical.')
    ids.push(parsed.data)
  }
  return { ids, values: [...parsedRows.data] }
}
export function foldCharacterMechanicsApplications(input: {
  targetActorId: string
  currentHitPoints: number
  temporaryHitPoints: number
  maximumHitPoints: number
  /** Every present condition: the target's own and any the Campaign holds. */
  conditionIds: readonly string[]
  scalarValues?: Readonly<Record<string, number>>
  /** Conditions retained by another locked active-effect contribution. */
  retainedConditionIds?: readonly string[]
  /**
   * A Character's Sheet conditions and the Campaign's. A removal clears only the Sheet copy, so a
   * condition the Campaign also holds stays present. Without them every condition is the target's own.
   */
  layers?: { ownConditionIds: readonly string[]; campaignConditionIds: readonly string[] }
  applications: readonly CharacterRuleActionApplication[]
}): {
  before: TargetState
  after: TargetState
  applications: ReceiptApplications
  /** The target's own conditions after the batch (the Sheet's, for a Character). */
  afterOwnConditionIds: string[]
  stateChanged: boolean
} {
  if (!Number.isSafeInteger(input.maximumHitPoints) || input.maximumHitPoints < 0)
    throw new EncounterValidationError('The Character maximum hit points are invalid.')
  if (
    !Number.isSafeInteger(input.currentHitPoints) ||
    !Number.isSafeInteger(input.temporaryHitPoints) ||
    input.currentHitPoints < 0 ||
    input.temporaryHitPoints < 0 ||
    input.currentHitPoints > input.maximumHitPoints
  )
    throw new EncounterValidationError('The Character hit-point state is invalid.')
  if (new Set(input.conditionIds).size !== input.conditionIds.length)
    throw new EncounterValidationError('The Character condition state is invalid.')
  if (
    input.conditionIds.some(
      (conditionId) =>
        !serverUuidIdentityDtoSchema.safeParse(conditionId).success ||
        serverUuidIdentityDtoSchema.parse(conditionId) !== conditionId
    )
  )
    throw new EncounterValidationError('The Character condition state is invalid.')
  if (
    Object.entries(input.scalarValues ?? {}).some(
      ([valueDefinitionId, value]) =>
        !serverUuidIdentityDtoSchema.safeParse(valueDefinitionId).success ||
        serverUuidIdentityDtoSchema.parse(valueDefinitionId) !== valueDefinitionId ||
        !Number.isSafeInteger(value) ||
        value < 0
    )
  )
    throw new EncounterValidationError('The Character scalar state is invalid.')

  const before: TargetState = {
    currentHitPoints: input.currentHitPoints,
    temporaryHitPoints: input.temporaryHitPoints,
    maximumHitPoints: input.maximumHitPoints,
    conditionIds: [...input.conditionIds],
    scalarValues: { ...(input.scalarValues ?? {}) }
  }
  let current = before.currentHitPoints
  let temporary = before.temporaryHitPoints
  let maximum = before.maximumHitPoints
  const conditions = new Set(before.conditionIds)
  const ownConditions = new Set(input.layers?.ownConditionIds ?? before.conditionIds)
  const campaignConditions = new Set(input.layers?.campaignConditionIds ?? [])
  const scalarValues = { ...before.scalarValues }
  const retainedConditions = new Set(input.retainedConditionIds ?? [])
  const receipt: ReceiptApplications = []
  for (const [ordinal, application] of input.applications.entries()) {
    if (application.targetActorId !== input.targetActorId)
      throw new EncounterValidationError('The Character rule action target is invalid.')
    if (application.kind === 'CONDITION_APPLY' || application.kind === 'CONDITION_REMOVE') {
      if (
        !serverUuidIdentityDtoSchema.safeParse(application.conditionId).success ||
        serverUuidIdentityDtoSchema.parse(application.conditionId) !== application.conditionId
      )
        throw new EncounterValidationError('The Character condition state is invalid.')
      const { conditionId } = application
      const beforePresent = conditions.has(conditionId)
      const ownBefore = ownConditions.has(conditionId)
      const retained = application.kind === 'CONDITION_REMOVE' && retainedConditions.has(conditionId)
      if (application.kind === 'CONDITION_APPLY') {
        conditions.add(conditionId)
        ownConditions.add(conditionId)
      } else if (!retained) {
        ownConditions.delete(conditionId)
        if (!campaignConditions.has(conditionId)) conditions.delete(conditionId)
      }
      if (application.kind === 'CONDITION_APPLY') {
        receipt.push({
          ordinal,
          kind: 'CONDITION_APPLY',
          conditionId: application.conditionId,
          beforePresent,
          afterPresent: true,
          applied: !beforePresent,
          sourceNodeId: application.sourceNodeId,
          sourceOperationKey: application.sourceOperationKey,
          authoredPath: application.authoredPath,
          resolvedPath: application.resolvedPath
        })
      } else {
        receipt.push({
          ordinal,
          kind: 'CONDITION_REMOVE',
          conditionId: application.conditionId,
          sourceActiveEffectId: application.sourceActiveEffectId,
          beforePresent,
          afterPresent: conditions.has(conditionId),
          // Applied when it cleared the target's own copy, even if the Campaign still holds one.
          applied: !retained && ownBefore,
          sourceNodeId: application.sourceNodeId,
          sourceOperationKey: application.sourceOperationKey,
          authoredPath: application.authoredPath,
          resolvedPath: application.resolvedPath
        })
      }
      continue
    }
    if (application.kind === 'HIT_POINT_MAXIMUM_REDUCTION') {
      if (
        !Number.isSafeInteger(application.reductionAmount) ||
        application.reductionAmount < 1 ||
        !serverUuidIdentityDtoSchema.safeParse(application.sourceDamageOutcomeId).success ||
        serverUuidIdentityDtoSchema.parse(application.sourceDamageOutcomeId) !==
          application.sourceDamageOutcomeId ||
        application.sourceDamageNodeId.trim().length === 0 ||
        application.sourceDamageOperationKey.trim().length === 0 ||
        application.recoveryTags.length !== 1 ||
        application.recoveryTags[0] !== 'RESTORE_HIT_POINT_MAXIMUM'
      )
        throw new EncounterValidationError('The hit point maximum reduction is invalid.')
      const beforeMaximumHitPoints = maximum
      maximum = Math.max(0, maximum - application.reductionAmount)
      const beforeCurrentHitPoints = current
      current = Math.min(current, maximum)
      receipt.push({
        ordinal,
        kind: 'HIT_POINT_MAXIMUM_REDUCTION',
        reductionAmount: application.reductionAmount,
        sourceDamageOutcomeId: application.sourceDamageOutcomeId,
        sourceDamageNodeId: application.sourceDamageNodeId,
        sourceDamageOperationKey: application.sourceDamageOperationKey,
        recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM'],
        requestedAmount: application.reductionAmount,
        resolvedAmount: application.reductionAmount,
        appliedAmount: beforeMaximumHitPoints - maximum,
        beforeMaximumHitPoints,
        afterMaximumHitPoints: maximum,
        beforeCurrentHitPoints,
        afterCurrentHitPoints: current,
        beforeTemporaryHitPoints: temporary,
        afterTemporaryHitPoints: temporary,
        maximumHitPoints: beforeMaximumHitPoints,
        sourceNodeId: application.sourceNodeId,
        sourceOperationKey: application.sourceOperationKey,
        authoredPath: application.authoredPath,
        resolvedPath: application.resolvedPath
      })
      continue
    }
    if (application.kind === 'SCALAR_REDUCTION') {
      const beforeValue = scalarValues[application.valueDefinitionId]
      if (
        !serverUuidIdentityDtoSchema.safeParse(application.valueDefinitionId).success ||
        serverUuidIdentityDtoSchema.parse(application.valueDefinitionId) !==
          application.valueDefinitionId ||
        !Number.isSafeInteger(beforeValue) ||
        beforeValue < 0 ||
        !Number.isSafeInteger(application.reductionAmount) ||
        application.reductionAmount < 1 ||
        application.stacking !== 'ADDITIVE' ||
        application.floor !== 0 ||
        application.recoveryTriggers.length < 1 ||
        application.recoveryTriggers.length > 2 ||
        new Set(application.recoveryTriggers).size !== application.recoveryTriggers.length ||
        application.recoveryTriggers.some(
          (trigger) => trigger !== 'SHORT_REST' && trigger !== 'LONG_REST'
        ) ||
        application.terminalConsequence !== 'TARGET_DIED' ||
        !serverUuidIdentityDtoSchema.safeParse(application.sourceOutcomeId).success ||
        serverUuidIdentityDtoSchema.parse(application.sourceOutcomeId) !==
          application.sourceOutcomeId
      )
        throw new EncounterValidationError('The scalar reduction application is invalid.')
      const afterValue = Math.max(application.floor, beforeValue - application.reductionAmount)
      const targetDied = afterValue === application.floor
      scalarValues[application.valueDefinitionId] = afterValue
      const beforeCurrentHitPoints = current
      if (targetDied) current = 0
      receipt.push({
        ordinal,
        kind: 'SCALAR_REDUCTION',
        valueDefinitionId: application.valueDefinitionId,
        reductionAmount: application.reductionAmount,
        stacking: application.stacking,
        floor: application.floor,
        recoveryTriggers: [...application.recoveryTriggers],
        terminalConsequence: application.terminalConsequence,
        sourceOutcomeId: application.sourceOutcomeId,
        beforeValue,
        afterValue,
        targetDied,
        sourceNodeId: application.sourceNodeId,
        sourceOperationKey: application.sourceOperationKey,
        authoredPath: application.authoredPath,
        resolvedPath: application.resolvedPath
      })
      if (beforeCurrentHitPoints !== current && current !== 0)
        throw new EncounterValidationError('The scalar reduction terminal transition is invalid.')
      continue
    }
    if (
      application.beforeCurrentHitPoints !== current ||
      application.beforeTemporaryHitPoints !== temporary ||
      application.maximumHitPoints !== maximum
    )
      throw new EncounterValidationError('The Character rule action application order is stale.')
    if (
      !Number.isSafeInteger(application.requestedAmount) ||
      !Number.isSafeInteger(application.resolvedAmount) ||
      !Number.isSafeInteger(application.appliedAmount) ||
      application.requestedAmount < 1 ||
      application.resolvedAmount < 0 ||
      application.appliedAmount < 0 ||
      application.afterCurrentHitPoints < 0 ||
      application.afterCurrentHitPoints > maximum ||
      application.afterTemporaryHitPoints < 0
    )
      throw new EncounterValidationError('The Character rule action application is invalid.')
    if (application.kind === 'HEAL') {
      const appliedAmount = Math.min(application.resolvedAmount, maximum - current)
      if (
        application.resolvedAmount !== application.requestedAmount ||
        application.appliedAmount !== appliedAmount ||
        application.afterCurrentHitPoints !== current + appliedAmount ||
        application.afterTemporaryHitPoints !== temporary
      )
        throw new EncounterValidationError('The Character heal application is invalid.')
    } else if (application.kind === 'TEMPORARY_HIT_POINTS') {
      const afterTemporaryHitPoints = Math.max(temporary, application.resolvedAmount)
      if (
        application.resolvedAmount !== application.requestedAmount ||
        application.appliedAmount !== afterTemporaryHitPoints - temporary ||
        application.afterCurrentHitPoints !== current ||
        application.afterTemporaryHitPoints !== afterTemporaryHitPoints
      )
        throw new EncounterValidationError(
          'The Character temporary hit-point application is invalid.'
        )
    } else if (application.kind === 'DAMAGE') {
      const resolvedAmount = resolveDispositionDamage(
        application.damageDisposition,
        application.requestedAmount
      )
      const temporaryLost = Math.min(temporary, resolvedAmount)
      const currentLost = Math.min(current, resolvedAmount - temporaryLost)
      if (
        application.resolvedAmount !== resolvedAmount ||
        application.appliedAmount !== temporaryLost + currentLost ||
        application.afterCurrentHitPoints !== current - currentLost ||
        application.afterTemporaryHitPoints !== temporary - temporaryLost
      )
        throw new EncounterValidationError('The Character damage application is invalid.')
    }
    current = application.afterCurrentHitPoints
    temporary = application.afterTemporaryHitPoints
    const { targetActorId: _targetActorId, ...receiptApplication } = application
    receipt.push({ ...receiptApplication, ordinal })
  }
  const after: TargetState = {
    currentHitPoints: current,
    temporaryHitPoints: temporary,
    maximumHitPoints: maximum,
    conditionIds: [...conditions],
    scalarValues
  }
  return {
    before,
    after,
    applications: receipt,
    afterOwnConditionIds: [...ownConditions],
    stateChanged:
      before.currentHitPoints !== after.currentHitPoints ||
      before.temporaryHitPoints !== after.temporaryHitPoints ||
      before.maximumHitPoints !== after.maximumHitPoints ||
      before.conditionIds.length !== after.conditionIds.length ||
      before.conditionIds.some((conditionId) => !conditions.has(conditionId)) ||
      JSON.stringify(before.scalarValues) !== JSON.stringify(after.scalarValues)
  }
}
