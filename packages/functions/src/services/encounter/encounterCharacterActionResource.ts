import { randomUUID } from 'node:crypto'

import {
  createCampaignCharacterMechanicsProjectionRepository,
  createCharacterSheetPlayStateRepository,
  type DBLike
} from '@artificer-toolkit/db'
import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type {
  CharacterMechanicsProjection,
  CompiledActionEntryPoint
} from '@artificer-toolkit/schema/projections/characterMechanics'
import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey,
  type CharacterResourceOwnerKey
} from '@artificer-toolkit/shared/character'

import {
  evaluateCharacterActionStateChange,
  type CharacterActionEvaluationState
} from '../character/characterActionEvaluation.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'

type CurrentOverlay = Awaited<
  ReturnType<
    ReturnType<typeof createCampaignCharacterMechanicsProjectionRepository>['requireCurrent']
  >
>

type CompiledAction = Extract<CompiledActionEntryPoint, { compilation: { kind: 'COMPILED' } }>

type ActionSourceIdentity = Pick<
  CharacterActionCandidate,
  'actionId' | 'effectId' | 'source' | 'sourceId'
>

export interface EncounterCharacterActionResourceConsumption {
  afterRemaining: number
  afterUsed: number
  beforeRemaining: number
  beforeUsed: number
  chargeId: string
  cost: number
  nextBaseState: CharacterActionEvaluationState
  nextOverlayState: CharacterActionEvaluationState | null
  owner: CharacterResourceOwnerKey
  poolId: string
  usageId: string
}

export interface PreparedEncounterCharacterActionState {
  actionMechanic: CharacterMechanicsProjection['rulePolicyOutput']['actionDecisions'][number]['mechanic']
  resourceConsumption: EncounterCharacterActionResourceConsumption | null
}

function sameMechanicSource(
  left: CharacterActionCandidate['source'],
  right: CharacterActionCandidate['source']
): boolean {
  if (left.kind !== right.kind) return false
  switch (left.kind) {
    case 'AUTHORED':
      return (
        right.kind === 'AUTHORED' &&
        left.sourceKind === right.sourceKind &&
        left.definitionId === right.definitionId &&
        left.sourceInstanceId === right.sourceInstanceId
      )
    case 'EQUIPMENT_INSTANCE':
      return (
        right.kind === 'EQUIPMENT_INSTANCE' &&
        left.equipmentId === right.equipmentId &&
        left.itemInstanceId === right.itemInstanceId
      )
    case 'SYSTEM':
      return right.kind === 'SYSTEM' && left.systemId === right.systemId
    case 'COMPANION_INSTANCE':
      return (
        right.kind === 'COMPANION_INSTANCE' &&
        left.creatureId === right.creatureId &&
        left.companionInstanceId === right.companionInstanceId
      )
    case 'MANUAL_ADJUSTMENT':
      return right.kind === 'MANUAL_ADJUSTMENT' && left.adjustmentId === right.adjustmentId
  }
}

function sameActionSourceIdentity(
  left: ActionSourceIdentity,
  right: ActionSourceIdentity
): boolean {
  return (
    left.actionId === right.actionId &&
    left.effectId === right.effectId &&
    left.sourceId === right.sourceId &&
    sameMechanicSource(left.source, right.source)
  )
}

function resourceOwnerFromResolvedOutput(
  resource: CharacterMechanicsProjection['rulePolicyOutput']['resources'][number]
): CharacterResourceOwnerKey {
  switch (resource.ownerKind) {
    case 'AUTHORED_GRANT':
      return {
        kind: resource.ownerKind,
        resourceGrantId: resource.resourceGrantId
      }
    case 'AUTHORED_SOURCE':
      return toCharacterResourceOwnerKey({
        kind: resource.ownerKind,
        chargeId: resource.chargeId,
        source: resource.source
      })
    case 'ITEM_INSTANCE':
      return toCharacterResourceOwnerKey({
        kind: resource.ownerKind,
        chargeId: resource.chargeId,
        itemInstanceId: resource.itemInstanceId
      })
    case 'SPELL_SOURCE':
      throw new EncounterValidationError(
        'Spell-source resource actions are not supported by this Character action entry point.'
      )
    case 'COMPANION_FEATURE':
      return toCharacterResourceOwnerKey({
        kind: resource.ownerKind,
        chargeId: resource.chargeId,
        companionInstanceId: resource.companionInstanceId,
        featureId: resource.featureId
      })
  }
}

function asActionEvaluationState(
  mechanics: CharacterMechanicsProjection
): CharacterActionEvaluationState {
  return {
    binding: { revisionId: mechanics.ruleRevisionId },
    facts: mechanics.rulePolicyInput,
    output: mechanics.rulePolicyOutput
  }
}

/**
 * Validates the exact committed/current Character action resource state and
 * prepares its post-consumption policy projections without mutating anything.
 */
export async function prepareEncounterCharacterActionState(input: {
  db: DBLike
  actionId: string
  actorUserId: string
  automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
  characterId: string
  entry: CompiledAction
  mechanics: CharacterMechanicsProjection
  overlay: CurrentOverlay
  createUsageId?: () => string
}): Promise<PreparedEncounterCharacterActionState> {
  const policyInput =
    input.overlay.kind === 'MATERIALIZED'
      ? input.overlay.rulePolicyInput
      : input.mechanics.rulePolicyInput
  const policyOutput =
    input.overlay.kind === 'MATERIALIZED'
      ? input.overlay.rulePolicyOutput
      : input.mechanics.rulePolicyOutput
  const committedCandidate = input.mechanics.rulePolicyInput.actionCandidates.find(
    (value) => value.actionId === input.actionId
  )
  const candidate = policyInput.actionCandidates.find((value) => value.actionId === input.actionId)
  const decision = policyOutput.actionDecisions.find((value) => value.actionId === input.actionId)
  if (
    !committedCandidate ||
    committedCandidate.actionId !== input.entry.actionId ||
    committedCandidate.effectId !== input.entry.effectId ||
    !candidate ||
    !sameActionSourceIdentity(candidate, committedCandidate) ||
    !decision ||
    !sameActionSourceIdentity(decision, candidate) ||
    decision.status !== 'AVAILABLE'
  ) {
    throw new EncounterConflictError('The committed Character action is unavailable or stale.')
  }

  // v4 keeps the same sealed resource contract while moving the executable
  // graph under executionPlan.  Resource availability remains an action-level
  // preflight and must not disappear merely because the action has phases.
  const binding =
    input.entry.schemaVersion === 2 ||
    input.entry.schemaVersion === 3 ||
    input.entry.schemaVersion === 4
      ? input.entry.compilation.resourceBinding
      : null
  if (binding === null) {
    if (
      candidate.resourceUse !== null ||
      decision.resourcePoolId !== null ||
      decision.resourceCost !== null
    ) {
      throw new EncounterConflictError(
        'The committed Character action resource is unavailable or stale.'
      )
    }
    return { actionMechanic: decision.mechanic, resourceConsumption: null }
  }

  const resource = policyOutput.resources.find((value) => value.poolId === binding.poolId)
  if (
    !candidate.resourceUse ||
    candidate.resourceUse.poolId !== binding.poolId ||
    candidate.resourceUse.chargeId !== binding.chargeId ||
    candidate.resourceUse.cost !== binding.cost ||
    decision.resourcePoolId !== binding.poolId ||
    decision.resourceCost !== binding.cost ||
    !resource ||
    resource.state !== 'RESOLVED' ||
    resource.chargeId !== binding.chargeId ||
    resource.remaining === null ||
    resource.remaining < binding.cost
  ) {
    throw new EncounterConflictError(
      'The committed Character action resource is unavailable or stale.'
    )
  }
  const owner = resourceOwnerFromResolvedOutput(resource)
  const ownerKey = createCharacterResourceOwnerKey(owner)
  if (ownerKey !== binding.poolId) {
    throw new EncounterConflictError('The Character resource owner does not match its binding.')
  }
  const resourceUsage = await createCharacterSheetPlayStateRepository(input.db).listResourceUsage(
    input.characterId
  )
  const existingUsage = resourceUsage.find(
    (usage) => createCharacterResourceOwnerKey(usage.owner) === ownerKey
  )
  const beforeUsed = existingUsage?.used ?? 0
  if (!Number.isSafeInteger(beforeUsed) || resource.rawUsed !== beforeUsed) {
    throw new EncounterConflictError('The Character resource usage is unavailable or stale.')
  }
  if (input.automationMode === 'MANUAL') {
    return { actionMechanic: decision.mechanic, resourceConsumption: null }
  }

  const afterUsed = beforeUsed + binding.cost
  if (!Number.isSafeInteger(afterUsed)) {
    throw new EncounterConflictError('The Character resource usage is unavailable or stale.')
  }
  const usageId = existingUsage?.id ?? (input.createUsageId ?? randomUUID)()
  const now = new Date().toISOString()
  const nextResourceUsage = [
    ...resourceUsage.filter((usage) => createCharacterResourceOwnerKey(usage.owner) !== ownerKey),
    {
      id: usageId,
      characterId: input.characterId,
      owner,
      used: afterUsed,
      createdBy: existingUsage?.createdBy ?? input.actorUserId,
      updatedBy: input.actorUserId,
      createdAt: existingUsage?.createdAt ?? now,
      updatedAt: now
    }
  ]
  const nextBase = await evaluateCharacterActionStateChange({
    db: input.db,
    committed: asActionEvaluationState(input.mechanics),
    changedPoolId: binding.poolId,
    resourceUsage: nextResourceUsage,
    spellSlotUsage: input.mechanics.commandState.state.spellSlots ?? []
  })
  const nextOverlay =
    input.overlay.kind === 'MATERIALIZED'
      ? await evaluateCharacterActionStateChange({
          db: input.db,
          committed: {
            binding: { revisionId: input.mechanics.ruleRevisionId },
            facts: input.overlay.rulePolicyInput,
            output: input.overlay.rulePolicyOutput
          },
          changedPoolId: binding.poolId,
          resourceUsage: nextResourceUsage,
          spellSlotUsage: input.mechanics.commandState.state.spellSlots ?? []
        })
      : null
  return {
    actionMechanic: decision.mechanic,
    resourceConsumption: {
      poolId: binding.poolId,
      chargeId: binding.chargeId,
      cost: binding.cost,
      owner,
      usageId,
      beforeUsed,
      afterUsed,
      beforeRemaining: resource.remaining,
      afterRemaining: resource.remaining - binding.cost,
      nextBaseState: nextBase.ruleEvaluation,
      nextOverlayState: nextOverlay?.ruleEvaluation ?? null
    }
  }
}

export async function persistEncounterCharacterActionResourceConsumption(input: {
  db: DBLike
  actorUserId: string
  characterId: string
  consumption: EncounterCharacterActionResourceConsumption
}): Promise<void> {
  await createCharacterSheetPlayStateRepository(input.db).setResourceUsage({
    id: input.consumption.usageId,
    characterId: input.characterId,
    actorId: input.actorUserId,
    owner: input.consumption.owner,
    used: input.consumption.afterUsed
  })
}
