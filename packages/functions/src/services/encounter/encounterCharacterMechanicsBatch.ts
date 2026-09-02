import { randomUUID } from 'node:crypto'
import { v5 as uuidv5 } from 'uuid'

import {
  createCampaignCharacterMechanicsProjectionRepository,
  createCharacterEventRepository,
  createCharacterMechanicsProjectionRepository,
  createCharacterRepository,
  createEncounterRepository,
  type DBLike,
  type EncounterActorRecord
} from '@artificer-toolkit/db'
import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'
import { characterSheetConditionDtoSchema } from '@artificer-toolkit/schema/api/characterSheetData'
import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { CharacterEvent } from '@artificer-toolkit/shared'
import { z } from 'zod'

import {
  advanceCharacterMechanicsProjectionActionState,
  advanceCharacterMechanicsProjectionCommandState
} from '../character/characterMechanicsCompiler.js'
import {
  compileCampaignCharacterMechanicsProjection,
  CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION
} from '../campaign/campaignCharacterMechanicsProjection.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CharacterRuleActionApplication } from '../rules/characterRuleActionSystemAdapter.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'

type ReceiptApplications = Extract<
  ServerRuleExecutionApplicationOutputsDto,
  { kind: 'CHARACTER_MECHANICS_BATCH' }
>['applications']

export type EvaluatedEncounterMechanicsBatch = {
  applications: ReceiptApplications
  targetTransition: {
    checksum: string
    before: TargetState
    after: TargetState
  }
}

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

type TargetState = {
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

export interface CharacterConditionDefinition {
  id: string
  label: string
  description?: string | null
}

export function foldCharacterMechanicsApplications(input: {
  targetActorId: string
  currentHitPoints: number
  temporaryHitPoints: number
  maximumHitPoints: number
  conditionIds: readonly string[]
  scalarValues?: Readonly<Record<string, number>>
  /** Conditions retained by another locked active-effect contribution. */
  retainedConditionIds?: readonly string[]
  applications: readonly CharacterRuleActionApplication[]
}): {
  before: TargetState
  after: TargetState
  applications: ReceiptApplications
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
      const beforePresent = conditions.has(application.conditionId)
      if (application.kind === 'CONDITION_APPLY') conditions.add(application.conditionId)
      else if (!retainedConditions.has(application.conditionId))
        conditions.delete(application.conditionId)
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
          afterPresent: retainedConditions.has(application.conditionId) ? beforePresent : false,
          applied: retainedConditions.has(application.conditionId) ? false : beforePresent,
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
      const resolvedAmount =
        application.damageDisposition === 'IMMUNE'
          ? 0
          : application.damageDisposition === 'RESISTANT'
            ? Math.floor(application.requestedAmount / 2)
            : application.damageDisposition === 'VULNERABLE'
              ? application.requestedAmount * 2
              : application.requestedAmount
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
    receipt.push({ ordinal, ...receiptApplication })
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
    stateChanged:
      before.currentHitPoints !== after.currentHitPoints ||
      before.temporaryHitPoints !== after.temporaryHitPoints ||
      before.maximumHitPoints !== after.maximumHitPoints ||
      before.conditionIds.length !== after.conditionIds.length ||
      JSON.stringify(before.scalarValues) !== JSON.stringify(after.scalarValues)
  }
}

/**
 * Applies already-evaluated outcomes to an already-current non-Character
 * Encounter actor. Lock ownership, active-effect lifecycle, and receipt
 * orchestration deliberately remain with the caller.
 */
export async function applyLockedEncounterActorMechanicsBatch(input: {
  trx: DBLike
  targetActor: EncounterActorRecord
  initialConditionRows: unknown
  retainedConditionIds?: readonly string[]
  effectiveScalarValues?: Readonly<Record<string, number>>
  applications: readonly CharacterRuleActionApplication[]
  evaluated?: EvaluatedEncounterMechanicsBatch
}): Promise<{
  updatedActor: EncounterActorRecord
  receiptApplications: ReceiptApplications
  targetTransition: {
    checksum: string
    before: TargetState
    after: TargetState
  }
  stateChanged: boolean
}> {
  if (input.targetActor.kind === 'CHARACTER')
    throw new EncounterConflictError('The Encounter actor target is stale.')

  const actorConditions = readEncounterActorConditionState(input.targetActor.conditions ?? [])
  const initialConditions = readEncounterActorConditionState(input.initialConditionRows)
  if (JSON.stringify(actorConditions.values) !== JSON.stringify(initialConditions.values))
    throw new EncounterConflictError('Encounter actor conditions are stale.')

  const currentState = {
    currentHitPoints: input.targetActor.currentHitPoints,
    temporaryHitPoints: input.targetActor.tempHitPoints,
    maximumHitPoints: input.targetActor.maxHitPoints,
    conditionIds: initialConditions.ids,
    scalarValues: { ...(input.effectiveScalarValues ?? {}) }
  }
  if (
    input.evaluated &&
    (JSON.stringify(input.evaluated.targetTransition.before) !== JSON.stringify(currentState) ||
      input.evaluated.targetTransition.checksum !==
        checksumRuleDocument({
          targetActorId: input.targetActor.id,
          ...currentState
        }))
  ) {
    throw new EncounterConflictError('Encounter actor evaluated mechanics are stale.')
  }
  const folded = input.evaluated
    ? {
        before: input.evaluated.targetTransition.before,
        after: input.evaluated.targetTransition.after,
        applications: input.evaluated.applications,
        stateChanged:
          JSON.stringify(input.evaluated.targetTransition.before) !==
          JSON.stringify(input.evaluated.targetTransition.after)
      }
    : foldCharacterMechanicsApplications({
        targetActorId: input.targetActor.id,
        currentHitPoints: input.targetActor.currentHitPoints,
        temporaryHitPoints: input.targetActor.tempHitPoints,
        maximumHitPoints: input.targetActor.maxHitPoints,
        conditionIds: initialConditions.ids,
        scalarValues: input.effectiveScalarValues,
        retainedConditionIds: input.retainedConditionIds,
        applications: input.applications
      })
  const nextConditions = [
    ...initialConditions.values.filter((value) => {
      const conditionId =
        typeof value === 'string'
          ? value
          : typeof value === 'object' && value !== null && !Array.isArray(value)
            ? (value as Record<string, unknown>).conditionTypeId
            : null
      return typeof conditionId === 'string' && folded.after.conditionIds.includes(conditionId)
    }),
    ...folded.after.conditionIds
      .filter((conditionId) => !initialConditions.ids.includes(conditionId))
      .map((conditionTypeId) => ({ conditionTypeId }))
  ]
  const updatedActor: EncounterActorRecord = {
    ...input.targetActor,
    currentHitPoints: folded.after.currentHitPoints,
    tempHitPoints: folded.after.temporaryHitPoints,
    maxHitPoints: folded.after.maximumHitPoints,
    conditions: z.array(z.json()).parse(nextConditions)
  }
  if (folded.stateChanged) await createEncounterRepository(input.trx).updateActor(updatedActor)

  return {
    updatedActor,
    receiptApplications: folded.applications,
    targetTransition: {
      checksum: checksumRuleDocument({
        targetActorId: input.targetActor.id,
        ...folded.before
      }),
      before: folded.before,
      after: folded.after
    },
    stateChanged: folded.stateChanged
  }
}

type CurrentOverlay = Awaited<
  ReturnType<
    ReturnType<typeof createCampaignCharacterMechanicsProjectionRepository>['requireCurrent']
  >
>

export async function applyLockedEncounterCharacterMechanicsBatch(input: {
  trx: DBLike
  actorUserId: string
  encounterId: string
  occurrenceId: string
  commandId: string
  sourceCommandId: string
  targetActor: EncounterActorRecord
  targetCharacterId: string
  mechanics: CharacterMechanicsProjection
  overlay: CurrentOverlay
  effectiveMaximumHitPoints: number
  conditionDefinitions: readonly CharacterConditionDefinition[]
  retainedConditionIds?: readonly string[]
  effectiveScalarValues?: Readonly<Record<string, number>>
  applications: readonly CharacterRuleActionApplication[]
  evaluated?: EvaluatedEncounterMechanicsBatch
  /** Exact sealed CAST_SPELL state, applied only by a terminal Encounter settlement. */
  spellSlotUsage?: CharacterMechanicsProjection['commandState']['state']['spellSlots']
  forceVersionAdvance: boolean
  policyOverride?: {
    base: {
      input: CharacterMechanicsProjection['rulePolicyInput']
      output: CharacterMechanicsProjection['rulePolicyOutput']
    }
    overlay: {
      input: CharacterMechanicsProjection['rulePolicyInput']
      output: CharacterMechanicsProjection['rulePolicyOutput']
    } | null
  }
  afterPersist?: (input: { db: DBLike; streamVersion: number }) => Promise<void>
}): Promise<{
  updatedActor: EncounterActorRecord
  streamVersion: number | null
  finalState: TargetState
  receiptApplications: ReceiptApplications
  targetTransition: {
    checksum: string
    before: TargetState
    after: TargetState
  }
  stateChanged: boolean
}> {
  if (
    input.targetActor.kind !== 'CHARACTER' ||
    input.targetActor.sourceId !== input.targetCharacterId
  )
    throw new EncounterConflictError('The Encounter Character actor is stale.')
  if (
    input.targetActor.sourceRevision !== input.mechanics.characterStreamVersion ||
    input.targetActor.currentHitPoints !== input.mechanics.commandState.state.hitpoints.current ||
    input.targetActor.tempHitPoints !== (input.mechanics.commandState.state.hitpoints.temp ?? 0) ||
    input.targetActor.maxHitPoints !== input.effectiveMaximumHitPoints
  )
    throw new EncounterConflictError('The Encounter Character state mirror is stale.')
  if (
    input.overlay.characterId !== input.targetCharacterId ||
    input.overlay.characterStreamVersion !== input.mechanics.characterStreamVersion ||
    input.overlay.baseMechanicsProjectionChecksum !== input.mechanics.projectionChecksum ||
    input.overlay.projectionSchemaVersion !== CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION
  )
    throw new EncounterConflictError('The Campaign Character mechanics projection is stale.')
  const hasConditionApplication = input.applications.some(
    (application) =>
      application.kind === 'CONDITION_APPLY' || application.kind === 'CONDITION_REMOVE'
  )
  const parsedActorConditions = hasConditionApplication
    ? characterSheetConditionDtoSchema.array().safeParse(input.targetActor.conditions ?? [])
    : null
  if (parsedActorConditions && !parsedActorConditions.success)
    throw new EncounterConflictError('The Encounter Character condition mirror is stale.')
  if (parsedActorConditions) {
    const mechanicsConditionIds = input.mechanics.commandState.state.conditions ?? []
    const mechanicsIds = new Set(
      mechanicsConditionIds.map((condition) => condition.conditionTypeId)
    )
    const actorIds = new Set(
      parsedActorConditions.data.map((condition) => condition.conditionTypeId)
    )
    if (
      mechanicsIds.size !== mechanicsConditionIds.length ||
      actorIds.size !== parsedActorConditions.data.length ||
      mechanicsIds.size !== actorIds.size ||
      [...mechanicsIds].some((conditionId) => !actorIds.has(conditionId))
    )
      throw new EncounterConflictError('The Encounter Character condition mirror is stale.')
  }
  const currentState = {
    currentHitPoints: input.mechanics.commandState.state.hitpoints.current,
    temporaryHitPoints: input.mechanics.commandState.state.hitpoints.temp ?? 0,
    maximumHitPoints: input.effectiveMaximumHitPoints,
    conditionIds: (input.mechanics.commandState.state.conditions ?? []).map(
      (condition) => condition.conditionTypeId
    ),
    scalarValues: { ...(input.effectiveScalarValues ?? {}) }
  }
  if (
    input.evaluated &&
    (JSON.stringify(input.evaluated.targetTransition.before) !== JSON.stringify(currentState) ||
      input.evaluated.targetTransition.checksum !==
        checksumRuleDocument({
          targetActorId: input.targetActor.id,
          ...currentState
        }))
  ) {
    throw new EncounterConflictError('Character evaluated mechanics are stale.')
  }
  const folded = input.evaluated
    ? {
        before: input.evaluated.targetTransition.before,
        after: input.evaluated.targetTransition.after,
        applications: input.evaluated.applications,
        stateChanged:
          JSON.stringify(input.evaluated.targetTransition.before) !==
          JSON.stringify(input.evaluated.targetTransition.after)
      }
    : foldCharacterMechanicsApplications({
        targetActorId: input.targetActor.id,
        currentHitPoints: input.mechanics.commandState.state.hitpoints.current,
        temporaryHitPoints: input.mechanics.commandState.state.hitpoints.temp ?? 0,
        maximumHitPoints: input.effectiveMaximumHitPoints,
        conditionIds: (input.mechanics.commandState.state.conditions ?? []).map(
          (condition) => condition.conditionTypeId
        ),
        scalarValues: input.effectiveScalarValues,
        retainedConditionIds: input.retainedConditionIds,
        applications: input.applications
      })
  const existingConditions = input.mechanics.commandState.state.conditions ?? []
  const existingConditionIds = new Set(
    existingConditions.map((condition) => condition.conditionTypeId)
  )
  const nextConditions = [
    ...existingConditions.filter((condition) =>
      folded.after.conditionIds.includes(condition.conditionTypeId)
    ),
    ...folded.after.conditionIds
      .filter((conditionId) => !existingConditionIds.has(conditionId))
      .map((conditionTypeId) => ({ conditionTypeId }))
  ]
  const requiredConditionIds: string[] = []
  for (const application of folded.applications) {
    if (application.kind === 'CONDITION_APPLY' && application.applied)
      requiredConditionIds.push(application.conditionId)
  }
  if (
    requiredConditionIds.some(
      (conditionId) =>
        !input.conditionDefinitions.some((definition) => definition.id === conditionId)
    )
  )
    throw new EncounterConflictError('The Character condition definition is unavailable.')

  const nextSpellSlotUsage = input.spellSlotUsage ?? input.mechanics.commandState.state.spellSlots
  const spellSlotsChanged =
    input.spellSlotUsage !== undefined &&
    JSON.stringify(nextSpellSlotUsage ?? []) !==
      JSON.stringify(input.mechanics.commandState.state.spellSlots ?? [])
  const shouldAdvance = folded.stateChanged || spellSlotsChanged || input.forceVersionAdvance
  let streamVersion: number | null = null
  let updatedMechanics = input.mechanics
  if (shouldAdvance) {
    streamVersion = await createCharacterRepository(input.trx).patchSheetState(
      input.targetCharacterId,
      [
        {
          kind: 'HITPOINTS',
          value: {
            ...input.mechanics.commandState.state.hitpoints,
            current: folded.after.currentHitPoints,
            temp: folded.after.temporaryHitPoints
          }
        },
        {
          kind: 'CONDITIONS',
          value: nextConditions
        },
        ...(spellSlotsChanged ? [{ kind: 'SPELL_SLOTS' as const, value: nextSpellSlotUsage }] : [])
      ],
      {
        expectedStreamVersion: input.mechanics.characterStreamVersion,
        afterPersist: async (db, nextStreamVersion) => {
          await input.afterPersist?.({ db, streamVersion: nextStreamVersion })
          const commandState = {
            ...input.mechanics.commandState,
            state: {
              ...input.mechanics.commandState.state,
              hitpoints: {
                ...input.mechanics.commandState.state.hitpoints,
                current: folded.after.currentHitPoints,
                temp: folded.after.temporaryHitPoints
              },
              conditions: nextConditions,
              ...(spellSlotsChanged ? { spellSlots: nextSpellSlotUsage } : {})
            }
          }
          updatedMechanics = input.policyOverride
            ? advanceCharacterMechanicsProjectionActionState({
                characterStreamVersion: nextStreamVersion,
                current: { ...input.mechanics, commandState },
                rulePolicyInput: input.policyOverride.base.input,
                rulePolicyOutput: input.policyOverride.base.output
              })
            : advanceCharacterMechanicsProjectionCommandState({
                characterCommandState: commandState,
                characterStreamVersion: nextStreamVersion,
                current: input.mechanics
              })
          await createCharacterMechanicsProjectionRepository(db).advanceLiveCommandState({
            expectedPriorProjectionChecksum: input.mechanics.projectionChecksum,
            expectedPriorStreamVersion: input.mechanics.characterStreamVersion,
            projection: updatedMechanics
          })
          const nextOverlay = compileCampaignCharacterMechanicsProjection({
            campaignId: input.overlay.campaignId,
            characterId: input.targetCharacterId,
            characterStreamVersion: nextStreamVersion,
            baseMechanicsProjectionChecksum: updatedMechanics.projectionChecksum,
            mechanicalContextChecksum: input.overlay.mechanicalContextChecksum,
            manualMaximumModifierOwner: input.overlay.manualMaximumModifierOwner,
            ...(input.overlay.kind === 'MATERIALIZED'
              ? {
                  rulePolicyInput:
                    input.policyOverride?.overlay?.input ?? input.overlay.rulePolicyInput,
                  rulePolicyOutput:
                    input.policyOverride?.overlay?.output ?? input.overlay.rulePolicyOutput
                }
              : {})
          })
          await createCampaignCharacterMechanicsProjectionRepository(db).publish({
            expectedPriorOverlayChecksum: input.overlay.projectionChecksum,
            projection: nextOverlay
          })
        }
      }
    )
  }
  if (streamVersion !== null && folded.stateChanged) {
    const event: CharacterEvent = {
      type: 'CHARACTER_RULE_OUTCOME_APPLIED',
      eventId: randomUUID(),
      characterId: input.targetCharacterId,
      occurredAt: new Date().toISOString(),
      actorId: input.actorUserId,
      commandId: input.commandId,
      sourceCommandId: input.sourceCommandId,
      schemaVersion: 1,
      encounterId: input.encounterId,
      occurrenceId: input.occurrenceId,
      committedStreamVersion: streamVersion,
      targetActorId: input.targetActor.id,
      applications: folded.applications
        .filter(
          (application) =>
            application.kind !== 'HIT_POINT_MAXIMUM_REDUCTION' &&
            application.kind !== 'SCALAR_REDUCTION'
        )
        .map((application) =>
          application.kind === 'CONDITION_APPLY'
            ? {
                ordinal: application.ordinal,
                outcome: 'CONDITION_APPLY' as const,
                conditionId: application.conditionId,
                beforePresent: application.beforePresent,
                afterPresent: true as const,
                applied: application.applied
              }
            : application.kind === 'CONDITION_REMOVE'
              ? {
                  ordinal: application.ordinal,
                  outcome: 'CONDITION_REMOVE' as const,
                  conditionId: application.conditionId,
                  beforePresent: application.beforePresent,
                  afterPresent: application.afterPresent,
                  applied: application.applied
                }
              : application.kind === 'DAMAGE'
                ? {
                    ordinal: application.ordinal,
                    outcome: application.kind,
                    appliedAmount: application.appliedAmount,
                    damageTypeId: application.damageTypeId
                  }
                : {
                    ordinal: application.ordinal,
                    outcome: application.kind,
                    appliedAmount: application.appliedAmount
                  }
        )
    }
    await createCharacterEventRepository(input.trx).append(event)
  }
  const actorConditions = hasConditionApplication
    ? (() => {
        const next = parsedActorConditions!.data.filter((condition) =>
          folded.after.conditionIds.includes(condition.conditionTypeId)
        )
        for (const conditionId of requiredConditionIds) {
          if (next.some((condition) => condition.conditionTypeId === conditionId)) continue
          const definition = input.conditionDefinitions.find(
            (candidate) => candidate.id === conditionId
          )
          if (!definition)
            throw new EncounterConflictError('The Character condition definition is unavailable.')
          next.push({
            conditionTypeId: definition.id,
            label: definition.label,
            ...(definition.description ? { description: definition.description } : {})
          })
        }
        return next
      })()
    : null
  return {
    updatedActor: {
      ...input.targetActor,
      sourceRevision: streamVersion ?? input.targetActor.sourceRevision,
      currentHitPoints: folded.after.currentHitPoints,
      tempHitPoints: folded.after.temporaryHitPoints,
      maxHitPoints: folded.after.maximumHitPoints,
      ...(actorConditions ? { conditions: actorConditions } : {})
    },
    streamVersion,
    finalState: folded.after,
    receiptApplications: folded.applications,
    targetTransition: {
      checksum: checksumRuleDocument({
        targetActorId: input.targetActor.id,
        ...folded.before
      }),
      before: folded.before,
      after: folded.after
    },
    stateChanged: folded.stateChanged
  }
}
