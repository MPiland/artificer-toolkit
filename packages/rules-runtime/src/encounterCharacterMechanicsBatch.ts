import { v5 as uuidv5 } from 'uuid'

import { hitPointMaximumReductionRecoveryTagsSchema } from '@artificer-toolkit/schema/effects/hitPointMaximumReduction'
import type { EncounterActorAbsenceDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import {
  deathSavesAfterDamage,
  deathSavesAfterDeath,
  deathSavesAfterHealing,
  deathSavesAfterRevive,
  deathSavesAfterRoll,
  deathSavesAfterStabilize,
  isCharacterDead,
  isCharacterDying,
  isTargetDead,
  reviveRestoredHitPoints,
  type CharacterDeathSaves
} from '@artificer-toolkit/schema/shared/characterDeathSaves'
import { resolveIncomingDamage } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import {
  temporaryHitPointsAfterGrant,
  temporaryHitPointsAfterLoss,
  temporaryHitPointsAfterRelease,
  type TemporaryHitPointsPool
} from '@artificer-toolkit/schema/shared/temporaryHitPoints'
import { z } from 'zod'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import {
  applyDamageInterceptions,
  hitPointsAfterDamage,
  interceptionChargeMatches,
  interceptionSavesMatch,
  interceptionChargeReceipt,
  killInterception,
  type HeldDamageInterception
} from './encounterDamageInterception.js'
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
  | 'MELEE_RETALIATION'
  | 'MOVEMENT_REACTION_OUTCOME'
  | 'MOVEMENT_REACTION_RESOURCE'
  | 'MOVEMENT_PASSAGE_EFFECT'
  | 'SPATIAL_EFFECT'
  | 'TURN_ZONE_EFFECT'
  | 'TURN_DEATH_SAVE'
  | 'INITIATIVE_RESTORE'
  | 'TURN_EFFECT'
  | 'DAMAGE_MIRROR'

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

export type TargetState<
  TDeathSaves extends CharacterDeathSaves | null = CharacterDeathSaves | null
> = {
  deathSaves: TDeathSaves
  currentHitPoints: number
  temporaryHitPoints: number
  /** The active effect whose temporary hit points these are; absent when none (D156). */
  temporaryHitPointsSourceEffectId?: string
  maximumHitPoints: number
  conditionIds: string[]
  scalarValues: Record<string, number>
}

/** The checksum binds the interpreted target facts, which exclude death saves (D96) and the temporary hit point source (D156). */
export function targetTransitionChecksum(actorId: string, before: TargetState): string {
  const {
    deathSaves: _deathSaves,
    temporaryHitPointsSourceEffectId: _temporaryHitPointsSourceEffectId,
    ...interpretedFacts
  } = before
  return checksumRuleDocument({ targetActorId: actorId, ...interpretedFacts })
}

/** The source joins the target facts only when an effect holds the pool, so sourceless facts stay as they were. */
function temporarySourceFact(sourceEffectId: string | null) {
  return sourceEffectId === null ? {} : { temporaryHitPointsSourceEffectId: sourceEffectId }
}

export function targetTemporaryHitPoints(
  state: Pick<TargetState, 'temporaryHitPoints' | 'temporaryHitPointsSourceEffectId'>
): TemporaryHitPointsPool {
  return {
    amount: state.temporaryHitPoints,
    sourceEffectId: state.temporaryHitPointsSourceEffectId ?? null
  }
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
export function foldCharacterMechanicsApplications<
  TDeathSaves extends CharacterDeathSaves | null
>(input: {
  targetActorId: string
  currentHitPoints: number
  temporaryHitPoints: number
  /** The active effect whose temporary hit points these are, null or absent when none (D156). */
  temporaryHitPointsSourceEffectId?: string | null
  maximumHitPoints: number
  /** A Character's death saves; null for an actor that is simply defeated at 0 (D63). */
  deathSaves: TDeathSaves
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
  /**
   * The holder's unspent damage interceptions, in spend order. The planner already applied them
   * (`applyDamageInterceptions`); the fold validates that each lethal damage or kill was settled by
   * the first interception it fits and names it (`interceptedBy`, `negatedBy`).
   */
  damageInterceptions?: readonly HeldDamageInterception[]
  /**
   * The target takes no damage (an INVULNERABLE body, `encounterActorBody`). This fold is where that
   * is decided for every flow: each damage settles as IMMUNE at 0, and the batch's later hit point
   * changes are rebased onto the pools it left.
   */
  invulnerable?: boolean
  /**
   * A dying Character's turn-start death save (D96), applied after the applications: its kept d20
   * and the signed total of its added dice (D156).
   */
  deathSaveRoll?: { rawDie: number; addedTotal: number }
  /** The actor's absence from the Run's play (D128); only a Run actor can depart, so others omit it. */
  absence?: EncounterActorAbsenceDto | null
}): {
  before: TargetState<TDeathSaves>
  after: TargetState<TDeathSaves>
  applications: ReceiptApplications
  /** The target's own conditions after the batch (the Sheet's, for a Character). */
  afterOwnConditionIds: string[]
  /** The actor's absence after the batch; null when the batch ran without a Run actor. */
  afterAbsence: EncounterActorAbsenceDto | null
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

  const before: TargetState<TDeathSaves> = {
    deathSaves: input.deathSaves,
    currentHitPoints: input.currentHitPoints,
    temporaryHitPoints: input.temporaryHitPoints,
    ...temporarySourceFact(input.temporaryHitPointsSourceEffectId ?? null),
    maximumHitPoints: input.maximumHitPoints,
    conditionIds: [...input.conditionIds],
    scalarValues: { ...(input.scalarValues ?? {}) }
  }
  let current = before.currentHitPoints
  let temporary = before.temporaryHitPoints
  let temporarySource = before.temporaryHitPointsSourceEffectId ?? null
  let maximum = before.maximumHitPoints
  let deathSaves: CharacterDeathSaves | null = before.deathSaves
  const conditions = new Set(before.conditionIds)
  const ownConditions = new Set(input.layers?.ownConditionIds ?? before.conditionIds)
  const campaignConditions = new Set(input.layers?.campaignConditionIds ?? [])
  const scalarValues = { ...before.scalarValues }
  const retainedConditions = new Set(input.retainedConditionIds ?? [])
  let absence = input.absence ?? null
  const receipt: ReceiptApplications = []
  const unspentInterceptions = [...(input.damageInterceptions ?? [])]
  const applications = input.invulnerable
    ? applyDamageInterceptions({
        applications: input.applications,
        currentHitPoints: input.currentHitPoints,
        temporaryHitPoints: input.temporaryHitPoints,
        temporaryHitPointsSourceEffectId: input.temporaryHitPointsSourceEffectId,
        interceptions: [],
        invulnerable: true
      })
    : input.applications
  for (const [ordinal, application] of applications.entries()) {
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
      const retained =
        application.kind === 'CONDITION_REMOVE' && retainedConditions.has(conditionId)
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
    if (application.kind === 'TEMPORARY_HIT_POINTS_RELEASE') {
      const beforeTemporaryHitPoints = temporary
      const applied = temporarySource === application.sourceActiveEffectId
      ;({ amount: temporary, sourceEffectId: temporarySource } = temporaryHitPointsAfterRelease(
        { amount: temporary, sourceEffectId: temporarySource },
        application.sourceActiveEffectId
      ))
      receipt.push({
        ordinal,
        kind: 'TEMPORARY_HIT_POINTS_RELEASE',
        sourceActiveEffectId: application.sourceActiveEffectId,
        beforeTemporaryHitPoints,
        afterTemporaryHitPoints: temporary,
        applied,
        sourceNodeId: application.sourceNodeId,
        sourceOperationKey: application.sourceOperationKey,
        authoredPath: application.authoredPath,
        resolvedPath: application.resolvedPath
      })
      continue
    }
    if (application.kind === 'STABILIZE') {
      // Only a dying Character stabilizes; any other target changes nothing (D96).
      const applied = deathSaves !== null && isCharacterDying(deathSaves, current)
      if (deathSaves !== null)
        deathSaves = deathSavesAfterStabilize({ deathSaves, currentHitPoints: current })
      receipt.push({
        ordinal,
        kind: 'STABILIZE',
        applied,
        sourceNodeId: application.sourceNodeId,
        sourceOperationKey: application.sourceOperationKey,
        authoredPath: application.authoredPath,
        resolvedPath: application.resolvedPath
      })
      continue
    }
    if (application.kind === 'KILL_NEGATED') {
      const spent = killInterception(unspentInterceptions)
      if (spent === undefined || spent.effectId !== application.negatedBy)
        throw new EncounterValidationError('The Character kill negation is invalid.')
      if (!interceptionChargeMatches(application.interceptionCharge, spent))
        throw new EncounterValidationError('The Character kill negation charge is invalid.')
      unspentInterceptions.splice(unspentInterceptions.indexOf(spent), 1)
      const interceptionCharge = interceptionChargeReceipt(spent)
      receipt.push({
        ordinal,
        kind: 'KILL_NEGATED',
        negatedBy: application.negatedBy,
        ...(interceptionCharge && { interceptionCharge }),
        sourceNodeId: application.sourceNodeId,
        sourceOperationKey: application.sourceOperationKey,
        authoredPath: application.authoredPath,
        resolvedPath: application.resolvedPath
      })
      continue
    }
    if (application.kind === 'KILL') {
      if (killInterception(unspentInterceptions) !== undefined)
        throw new EncounterValidationError('The Character kill skipped a damage interception.')
      receipt.push({
        ordinal,
        kind: 'KILL',
        beforeCurrentHitPoints: current,
        afterCurrentHitPoints: 0,
        beforeTemporaryHitPoints: temporary,
        afterTemporaryHitPoints: 0,
        sourceNodeId: application.sourceNodeId,
        sourceOperationKey: application.sourceOperationKey,
        authoredPath: application.authoredPath,
        resolvedPath: application.resolvedPath
      })
      current = 0
      temporary = 0
      temporarySource = null
      if (deathSaves !== null) deathSaves = deathSavesAfterDeath()
      continue
    }
    // Not damage: no interception, no instant death and no death save failure. At 0 a Creature is
    // defeated and a Character is dying, as when damage reaches 0.
    if (application.kind === 'HIT_POINTS_TO_ZERO') {
      receipt.push({
        ordinal,
        kind: 'HIT_POINTS_TO_ZERO',
        beforeCurrentHitPoints: current,
        afterCurrentHitPoints: 0,
        beforeTemporaryHitPoints: temporary,
        afterTemporaryHitPoints: 0,
        sourceNodeId: application.sourceNodeId,
        sourceOperationKey: application.sourceOperationKey,
        authoredPath: application.authoredPath,
        resolvedPath: application.resolvedPath
      })
      current = 0
      temporary = 0
      temporarySource = null
      continue
    }
    if (application.kind === 'REVIVE') {
      // Only a dead target returns to life; any other target changes nothing.
      const applied = isTargetDead({ currentHitPoints: current, deathSaves })
      const beforeCurrentHitPoints = current
      if (applied) {
        current = reviveRestoredHitPoints(application.hitPoints, maximum)
        if (deathSaves !== null) deathSaves = deathSavesAfterRevive()
      }
      receipt.push({
        ordinal,
        kind: 'REVIVE',
        hitPoints: application.hitPoints,
        applied,
        beforeCurrentHitPoints,
        afterCurrentHitPoints: current,
        sourceNodeId: application.sourceNodeId,
        sourceOperationKey: application.sourceOperationKey,
        authoredPath: application.authoredPath,
        resolvedPath: application.resolvedPath
      })
      continue
    }
    if (application.kind === 'DEPART') {
      if (input.absence === undefined)
        throw new EncounterValidationError('Only a Run actor can depart.')
      const applied = absence === null
      absence ??= 'DEPARTED'
      receipt.push({
        ordinal,
        kind: 'DEPART',
        applied,
        sourceNodeId: application.sourceNodeId,
        sourceOperationKey: application.sourceOperationKey,
        authoredPath: application.authoredPath,
        resolvedPath: application.resolvedPath
      })
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
        !hitPointMaximumReductionRecoveryTagsSchema.safeParse(application.recoveryTags).success
      )
        throw new EncounterValidationError('The hit point maximum reduction is invalid.')
      const beforeMaximumHitPoints = maximum
      maximum = Math.max(0, maximum - application.reductionAmount)
      const beforeCurrentHitPoints = current
      current = Math.min(current, maximum)
      // A Character whose maximum falls to 0 dies.
      if (maximum === 0 && deathSaves !== null) deathSaves = deathSavesAfterDeath()
      receipt.push({
        ordinal,
        kind: 'HIT_POINT_MAXIMUM_REDUCTION',
        reductionAmount: application.reductionAmount,
        sourceDamageOutcomeId: application.sourceDamageOutcomeId,
        sourceDamageNodeId: application.sourceDamageNodeId,
        sourceDamageOperationKey: application.sourceDamageOperationKey,
        recoveryTags: [...application.recoveryTags],
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
      if (targetDied) {
        current = 0
        if (deathSaves !== null) deathSaves = deathSavesAfterDeath()
      }
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
    // The encounter plan converts this into a heal on the source before any batch is built.
    if (application.kind === 'DAMAGE_DERIVED_HEAL')
      throw new EncounterValidationError('A damage-derived heal settles on the action source.')
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
      const granted = temporaryHitPointsAfterGrant(
        { amount: temporary, sourceEffectId: temporarySource },
        {
          amount: application.resolvedAmount,
          sourceEffectId: application.sourceActiveEffectId ?? null
        }
      )
      const afterTemporaryHitPoints = granted.amount
      temporarySource = granted.sourceEffectId
      if (
        application.resolvedAmount !== application.requestedAmount ||
        application.appliedAmount !== afterTemporaryHitPoints - temporary ||
        application.afterCurrentHitPoints !== current ||
        application.afterTemporaryHitPoints !== afterTemporaryHitPoints
      )
        throw new EncounterValidationError(
          'The Character temporary hit-point application is invalid.'
        )
    } else if (application.kind === 'HIT_POINT_LOSS') {
      // Not damage: no defense, interception or death save failure; temporary hit points go first.
      const temporaryLost = Math.min(temporary, application.requestedAmount)
      temporarySource = temporaryHitPointsAfterLoss(
        { amount: temporary, sourceEffectId: temporarySource },
        temporaryLost
      ).sourceEffectId
      const currentLost = Math.min(current, application.requestedAmount - temporaryLost)
      if (
        application.resolvedAmount !== application.requestedAmount ||
        application.appliedAmount !== temporaryLost + currentLost ||
        application.afterCurrentHitPoints !== current - currentLost ||
        application.afterTemporaryHitPoints !== temporary - temporaryLost
      )
        throw new EncounterValidationError('The Character hit-point loss application is invalid.')
    } else if (application.kind === 'DAMAGE') {
      const resolvedAmount = resolveIncomingDamage(application)
      const temporaryLost = Math.min(temporary, resolvedAmount)
      temporarySource = temporaryHitPointsAfterLoss(
        { amount: temporary, sourceEffectId: temporarySource },
        temporaryLost
      ).sourceEffectId
      const currentLost = Math.min(current, resolvedAmount - temporaryLost)
      const {
        after: afterCurrent,
        interception,
        saves,
        attempted
      } = hitPointsAfterDamage({
        current,
        currentLost,
        maximum,
        damageTaken: resolvedAmount,
        damageTypeId: application.damageTypeId,
        critical: application.critical,
        interceptions: unspentInterceptions
      })
      const intercepted = interception !== undefined
      if (
        intercepted !== (application.interceptedBy !== undefined) ||
        !interceptionChargeMatches(application.interceptionCharge, interception) ||
        !interceptionSavesMatch(application.interceptionSaves ?? [], saves)
      )
        throw new EncounterValidationError('The Character damage interception is invalid.')
      for (const spent of attempted)
        unspentInterceptions.splice(unspentInterceptions.indexOf(spent), 1)
      if (
        application.resolvedAmount !== resolvedAmount ||
        application.appliedAmount !== temporaryLost + current - afterCurrent ||
        application.afterCurrentHitPoints !== afterCurrent ||
        (intercepted && application.interceptedBy !== interception?.effectId) ||
        application.afterTemporaryHitPoints !== temporary - temporaryLost
      )
        throw new EncounterValidationError('The Character damage application is invalid.')
      if (deathSaves !== null && !intercepted)
        deathSaves = deathSavesAfterDamage({
          deathSaves,
          currentHitPoints: current,
          maximumHitPoints: maximum,
          dealt: resolvedAmount - temporaryLost,
          critical: application.critical
        })
    }
    // A dead Character ignores healing: the application is valid, and changes nothing.
    const ignoredHeal =
      application.kind === 'HEAL' && deathSaves !== null && isCharacterDead(deathSaves)
    const effective = ignoredHeal
      ? { ...application, appliedAmount: 0, afterCurrentHitPoints: current }
      : application
    if (application.kind === 'HEAL' && deathSaves !== null)
      deathSaves = deathSavesAfterHealing({ deathSaves, appliedAmount: effective.appliedAmount })
    current = effective.afterCurrentHitPoints
    temporary = effective.afterTemporaryHitPoints
    const { targetActorId: _targetActorId, ...receiptApplication } = effective
    receipt.push({ ...receiptApplication, ordinal })
  }
  if (input.deathSaveRoll) {
    if (deathSaves === null || !isCharacterDying(deathSaves, current))
      throw new EncounterValidationError('Only a dying Character makes a death save.')
    const roll = deathSavesAfterRoll(
      deathSaves,
      input.deathSaveRoll.rawDie,
      input.deathSaveRoll.addedTotal
    )
    deathSaves = roll.deathSaves
    if (roll.regainsHitPoint) current = Math.min(1, maximum)
  }
  const after: TargetState<TDeathSaves> = {
    // The rules never turn a Character's death saves into none, or an actor's into some.
    deathSaves: deathSaves as TDeathSaves,
    currentHitPoints: current,
    temporaryHitPoints: temporary,
    ...temporarySourceFact(temporarySource),
    maximumHitPoints: maximum,
    conditionIds: [...conditions],
    scalarValues
  }
  return {
    before,
    after,
    applications: receipt,
    afterOwnConditionIds: [...ownConditions],
    afterAbsence: absence,
    stateChanged:
      before.currentHitPoints !== after.currentHitPoints ||
      before.temporaryHitPoints !== after.temporaryHitPoints ||
      before.temporaryHitPointsSourceEffectId !== after.temporaryHitPointsSourceEffectId ||
      before.maximumHitPoints !== after.maximumHitPoints ||
      JSON.stringify(before.deathSaves) !== JSON.stringify(after.deathSaves) ||
      before.conditionIds.length !== after.conditionIds.length ||
      before.conditionIds.some((conditionId) => !conditions.has(conditionId)) ||
      JSON.stringify(before.scalarValues) !== JSON.stringify(after.scalarValues)
  }
}
