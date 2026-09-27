import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import {
  foldCharacterMechanicsApplications,
  readEncounterActorConditionState,
  type ReceiptApplications,
  type TargetState
} from './encounterCharacterMechanicsBatch.js'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import type { CharacterItemUseStateTransitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import type { NativeCharacterActionResourceConsumption } from './character/characterNativeActionResources.js'
import { unequipCharacterItem } from './character/sheetCommandReducer.js'
import { nextEncounterActorDefeated } from './encounterActorDefeat.js'
import { characterZeroHitPointsConditionId } from './characterZeroHitPoints.js'

type EncounterActor = EncounterRunActorState
type LoadedCharacterSheetFacts = {
  active: { id: string; streamVersion: number }
  character: CharacterAuthored
  sheetState: CharacterSheetState
  campaignContext: { conditions: readonly { conditionTypeId: string }[] }
}

export type EncounterMechanicsBatchInput = {
  encounterId: string
  targetActorId: string
  expectedEncounterVersion: number
  occurrenceId: string
  sourceCommandId: string
  commandId: string
  occurredAt: string
  applications: readonly CharacterRuleActionApplication[]
  /** The Character stream version the applications were planned against; null for other actors. */
  expectedCharacterStreamVersion: number | null
  effectiveMaximumHitPoints: number
  forceVersionAdvance: boolean
  retainedConditionIds?: readonly string[]
  effectiveScalarValues?: Readonly<Record<string, number>>
  spellSlotUsage?: NonNullable<CharacterAuthored['state']['spellSlots']>
  characterResourceConsumption?: NativeCharacterActionResourceConsumption
  /** An accepted wield conflict: unequip this item in the same Character version. */
  stowEquippedItemInstanceId?: string
}

export type EncounterMechanicsBatchPlan = {
  updatedActor: EncounterActor
  receiptApplications: ReceiptApplications
  targetTransition: {
    checksum: string
    before: TargetState
    after: TargetState
  }
  characterStreamVersion: number | null
  itemUseStateTransition: CharacterItemUseStateTransitionDto | null
  stateChanged: boolean
  shouldAdvance: boolean
  characterUpdate: {
    character: CharacterAuthored
    sheetState: LoadedCharacterSheetFacts['sheetState'] | null
  } | null
}

/** Plans a normalized mechanics batch without reading or writing persistence. */
export function planEncounterMechanicsBatch(input: {
  batch: EncounterMechanicsBatchInput
  actor: EncounterActor
  userId: string
  characterFacts?: LoadedCharacterSheetFacts
}): EncounterMechanicsBatchPlan {
  const { batch, actor, userId } = input
  if (actor.kind !== 'CHARACTER') {
    if (batch.expectedCharacterStreamVersion !== null)
      throw new Error('Encounter non-Character actors have no Character stream version.')
    if (batch.spellSlotUsage !== undefined)
      throw new Error('Encounter non-Character actors cannot use spell slots.')
    if (batch.characterResourceConsumption !== undefined)
      throw new Error('Encounter non-Character actors cannot use Character resources.')
    if (batch.stowEquippedItemInstanceId !== undefined)
      throw new Error('Encounter non-Character actors cannot stow Character equipment.')
    const conditions = readEncounterActorConditionState(actor.conditions ?? [])
    const folded = foldCharacterMechanicsApplications({
      targetActorId: actor.id,
      currentHitPoints: actor.currentHitPoints,
      temporaryHitPoints: actor.tempHitPoints,
      maximumHitPoints: batch.effectiveMaximumHitPoints,
      conditionIds: conditions.ids,
      scalarValues: batch.effectiveScalarValues,
      retainedConditionIds: batch.retainedConditionIds,
      applications: batch.applications
    })
    const nextConditions = [
      ...conditions.values.filter((value) => {
        const id =
          typeof value === 'string'
            ? value
            : typeof value === 'object' && value !== null && !Array.isArray(value)
              ? (value as { conditionTypeId?: unknown }).conditionTypeId
              : null
        return typeof id === 'string' && folded.after.conditionIds.includes(id)
      }),
      ...folded.after.conditionIds
        .filter((id) => !conditions.ids.includes(id))
        .map((conditionTypeId) => ({ conditionTypeId }))
    ]
    return {
      updatedActor: encounterRunActorStateSchema.parse({
        ...actor,
        currentHitPoints: folded.after.currentHitPoints,
        tempHitPoints: folded.after.temporaryHitPoints,
        maxHitPoints: folded.after.maximumHitPoints,
        conditions: nextConditions,
        defeated: nextEncounterActorDefeated(actor, folded.after.currentHitPoints)
      }),
      receiptApplications: folded.applications,
      targetTransition: transition(actor.id, folded.before, folded.after),
      characterStreamVersion: null,
      itemUseStateTransition: null,
      stateChanged: folded.stateChanged,
      shouldAdvance: false,
      characterUpdate: null
    }
  }

  const loaded = input.characterFacts
  if (
    !loaded ||
    loaded.active.id !== actor.sourceId ||
    loaded.character.systemId !== actor.systemId
  )
    throw new Error('Encounter Character source is unavailable.')
  if (loaded.active.streamVersion !== batch.expectedCharacterStreamVersion)
    throw new Error('Encounter Character changed after the outcome was planned.')
  const rawConditions = loaded.character.state.conditions ?? []

  const resourceConsumption = batch.characterResourceConsumption
  let nextResourceUsage = loaded.sheetState.resourceUsage
  if (resourceConsumption !== undefined) {
    if (
      resourceConsumption.characterId !== loaded.active.id ||
      resourceConsumption.expectedStreamVersion !== loaded.active.streamVersion ||
      !Number.isSafeInteger(resourceConsumption.cost) ||
      resourceConsumption.cost < 1 ||
      !Number.isSafeInteger(resourceConsumption.beforeUsed) ||
      resourceConsumption.beforeUsed < 0 ||
      !Number.isSafeInteger(resourceConsumption.afterUsed) ||
      resourceConsumption.afterUsed !== resourceConsumption.beforeUsed + resourceConsumption.cost ||
      !Number.isSafeInteger(resourceConsumption.beforeRemaining) ||
      resourceConsumption.beforeRemaining < resourceConsumption.cost ||
      !Number.isSafeInteger(resourceConsumption.afterRemaining) ||
      resourceConsumption.afterRemaining !==
        resourceConsumption.beforeRemaining - resourceConsumption.cost ||
      createCharacterResourceOwnerKey(resourceConsumption.owner) !== resourceConsumption.poolId
    )
      throw new Error('Encounter Character resource consumption is stale.')
    const matchingUsage = loaded.sheetState.resourceUsage.filter(
      (usage) =>
        createCharacterResourceOwnerKey(usage.owner) ===
        createCharacterResourceOwnerKey(resourceConsumption.owner)
    )
    if (matchingUsage.length > 1) throw new Error('Encounter Character resource usage is stale.')
    const existingUsage = matchingUsage[0]
    if (
      (existingUsage?.used ?? 0) !== resourceConsumption.beforeUsed ||
      (existingUsage?.id ?? resourceConsumption.usageId) !== resourceConsumption.usageId
    )
      throw new Error('Encounter Character resource usage is stale.')
    const metadata = existingUsage ?? {
      id: resourceConsumption.usageId,
      characterId: loaded.active.id,
      owner: resourceConsumption.owner,
      createdBy: userId,
      createdAt: batch.occurredAt
    }
    nextResourceUsage = [
      ...loaded.sheetState.resourceUsage.filter(
        (usage) =>
          createCharacterResourceOwnerKey(usage.owner) !==
          createCharacterResourceOwnerKey(resourceConsumption.owner)
      ),
      {
        ...metadata,
        used: resourceConsumption.afterUsed,
        updatedBy: userId,
        updatedAt: batch.occurredAt
      }
    ]
  }

  const stowItemId = batch.stowEquippedItemInstanceId
  if (stowItemId !== undefined && !loaded.character.state.equipment.equipped.includes(stowItemId))
    throw new Error('Encounter Character item to stow is no longer equipped.')
  const equippedCharacter =
    stowItemId === undefined ? loaded.character : unequipCharacterItem(loaded.character, stowItemId)

  const campaignConditionIds = loaded.campaignContext.conditions.map(
    (condition) => condition.conditionTypeId
  )
  const ownConditionIds = rawConditions.map((condition) => condition.conditionTypeId)
  const folded = foldCharacterMechanicsApplications({
    targetActorId: actor.id,
    currentHitPoints: loaded.character.state.hitpoints.current,
    temporaryHitPoints: loaded.character.state.hitpoints.temp ?? 0,
    maximumHitPoints: batch.effectiveMaximumHitPoints,
    conditionIds: [...new Set([...ownConditionIds, ...campaignConditionIds])],
    scalarValues: batch.effectiveScalarValues,
    retainedConditionIds: batch.retainedConditionIds,
    layers: { ownConditionIds, campaignConditionIds },
    applications: batch.applications
  })
  const existingConditionIds = new Set(ownConditionIds)
  const nextConditionIds = new Set(folded.afterOwnConditionIds)
  // D63: dropping to 0 adds the System's 0 hit point condition and regaining any removes it. It
  // follows from the hit point transition, which the receipt records, so the applications don't list it.
  const zeroHitPointsConditionId = characterZeroHitPointsConditionId(loaded.character.systemId)
  if (zeroHitPointsConditionId !== undefined) {
    if (folded.before.currentHitPoints > 0 && folded.after.currentHitPoints === 0)
      nextConditionIds.add(zeroHitPointsConditionId)
    else if (
      folded.before.currentHitPoints === 0 &&
      folded.after.currentHitPoints > 0 &&
      !batch.retainedConditionIds?.includes(zeroHitPointsConditionId)
    )
      nextConditionIds.delete(zeroHitPointsConditionId)
  }
  const conditionStateChanged =
    existingConditionIds.size !== nextConditionIds.size ||
    [...existingConditionIds].some((id) => !nextConditionIds.has(id))
  const nextConditions = [
    ...rawConditions.filter((condition) => nextConditionIds.has(condition.conditionTypeId)),
    ...[...nextConditionIds]
      .filter((id) => !existingConditionIds.has(id))
      .map((conditionTypeId) => ({ conditionTypeId }))
  ]
  const spellSlotsChanged =
    batch.spellSlotUsage !== undefined &&
    JSON.stringify(batch.spellSlotUsage) !== JSON.stringify(loaded.character.state.spellSlots ?? [])
  const resourceUsageChanged = resourceConsumption !== undefined
  const shouldAdvance =
    folded.stateChanged ||
    conditionStateChanged ||
    spellSlotsChanged ||
    resourceUsageChanged ||
    stowItemId !== undefined ||
    batch.forceVersionAdvance
  const character = {
    ...equippedCharacter,
    state: {
      ...equippedCharacter.state,
      hitpoints: {
        ...loaded.character.state.hitpoints,
        current: folded.after.currentHitPoints,
        temp: folded.after.temporaryHitPoints
      },
      conditions: nextConditions,
      ...(spellSlotsChanged ? { spellSlots: batch.spellSlotUsage } : {})
    }
  }
  const nextSheetState = resourceUsageChanged
    ? characterSheetStateSchema.parse({ ...loaded.sheetState, resourceUsage: nextResourceUsage })
    : null
  return {
    // A Character actor holds no Character state, so the batch leaves it unchanged.
    updatedActor: actor,
    receiptApplications: folded.applications,
    targetTransition: transition(actor.id, folded.before, folded.after),
    characterStreamVersion: shouldAdvance ? loaded.active.streamVersion + 1 : null,
    itemUseStateTransition:
      stowItemId === undefined
        ? null
        : {
            kind: 'CHARACTER_ITEM_USE_STATE',
            characterId: loaded.active.id,
            itemInstanceId: stowItemId,
            fromState: 'EQUIPPED',
            toState: 'CARRIED',
            beforeStreamVersion: loaded.active.streamVersion,
            afterStreamVersion: loaded.active.streamVersion + 1,
            beforeStateChecksum: checksumRuleDocument(loaded.character.state.equipment),
            afterStateChecksum: checksumRuleDocument(equippedCharacter.state.equipment)
          },
    stateChanged: folded.stateChanged || conditionStateChanged,
    shouldAdvance,
    characterUpdate: shouldAdvance
      ? { character: characterAuthoredDtoSchema.parse(character), sheetState: nextSheetState }
      : null
  }
}

function transition(actorId: string, before: TargetState, after: TargetState) {
  return {
    checksum: checksumRuleDocument({ targetActorId: actorId, ...before }),
    before,
    after
  }
}
