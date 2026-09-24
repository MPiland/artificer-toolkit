import { characterSheetConditionDtoSchema } from '@artificer-toolkit/schema/api/characterSheetData'
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
import * as zMini from 'zod/mini'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import type { NativeCharacterActionResourceConsumption } from './character/characterNativeActionResources.js'
import { requireSnapshotIdentity } from './encounterActorState.js'

type EncounterActor = EncounterRunActorState
type LoadedCharacterSheetFacts = {
  active: { id: string; streamVersion: number }
  character: CharacterAuthored
  sheetState: CharacterSheetState
  campaignContext: { conditions: readonly { conditionTypeId: string }[] }
  prepared: {
    context: {
      registry: {
        system?: Pick<SystemAuthoredDto, 'conditionTypes'> | null
      }
    }
  }
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
  effectiveMaximumHitPoints: number
  forceVersionAdvance: boolean
  retainedConditionIds?: readonly string[]
  effectiveScalarValues?: Readonly<Record<string, number>>
  spellSlotUsage?: NonNullable<CharacterAuthored['state']['spellSlots']>
  characterResourceConsumption?: NativeCharacterActionResourceConsumption
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
    if (batch.spellSlotUsage !== undefined)
      throw new Error('Encounter non-Character actors cannot use spell slots.')
    if (batch.characterResourceConsumption !== undefined)
      throw new Error('Encounter non-Character actors cannot use Character resources.')
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
        conditions: nextConditions
      }),
      receiptApplications: folded.applications,
      targetTransition: transition(actor.id, folded.before, folded.after),
      characterStreamVersion: null,
      stateChanged: folded.stateChanged,
      shouldAdvance: false,
      characterUpdate: null
    }
  }

  if (!actor.sourceId) throw new Error('Encounter Character actor is stale.')
  const loaded = input.characterFacts
  if (
    !loaded ||
    loaded.active.id !== actor.sourceId ||
    loaded.character.systemId !== actor.systemId
  )
    throw new Error('Encounter Character source is unavailable.')
  const rawConditions = loaded.character.state.conditions ?? []
  const hasConditionApplication = batch.applications.some(
    (application) =>
      application.kind === 'CONDITION_APPLY' || application.kind === 'CONDITION_REMOVE'
  )
  const mirroredConditions = hasConditionApplication
    ? zMini.array(characterSheetConditionDtoSchema).safeParse(actor.conditions ?? [])
    : null
  if (
    actor.sourceRevision !== loaded.active.streamVersion ||
    actor.currentHitPoints !== loaded.character.state.hitpoints.current ||
    actor.tempHitPoints !== (loaded.character.state.hitpoints.temp ?? 0) ||
    (mirroredConditions !== null && !mirroredConditions.success)
  )
    throw new Error('Encounter Character state mirror is stale.')

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

  const campaignConditionIds = loaded.campaignContext.conditions.map(
    (condition) => condition.conditionTypeId
  )
  const folded = foldCharacterMechanicsApplications({
    targetActorId: actor.id,
    currentHitPoints: loaded.character.state.hitpoints.current,
    temporaryHitPoints: loaded.character.state.hitpoints.temp ?? 0,
    maximumHitPoints: batch.effectiveMaximumHitPoints,
    conditionIds: [
      ...new Set([
        ...rawConditions.map((condition) => condition.conditionTypeId),
        ...campaignConditionIds
      ])
    ],
    scalarValues: batch.effectiveScalarValues,
    retainedConditionIds: [
      ...new Set([...(batch.retainedConditionIds ?? []), ...campaignConditionIds])
    ],
    applications: batch.applications
  })
  const existingConditionIds = new Set(rawConditions.map((condition) => condition.conditionTypeId))
  const nextConditionIds = new Set(existingConditionIds)
  for (const application of batch.applications) {
    if (application.kind === 'CONDITION_APPLY') nextConditionIds.add(application.conditionId)
    else if (
      application.kind === 'CONDITION_REMOVE' &&
      !batch.retainedConditionIds?.includes(application.conditionId)
    )
      nextConditionIds.delete(application.conditionId)
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
  const conditionTypes = loaded.prepared.context.registry.system?.conditionTypes ?? []
  const nextActorConditions =
    mirroredConditions === null
      ? actor.conditions
      : nextConditions.map((condition) => {
          const { conditionTypeId } = condition
          const definition = conditionTypes.find((condition) => condition.id === conditionTypeId)
          if (!definition) throw new Error('The Character condition definition is unavailable.')
          return {
            ...condition,
            label: definition.label,
            ...(definition.description ? { description: definition.description } : {})
          }
        })
  const spellSlotsChanged =
    batch.spellSlotUsage !== undefined &&
    JSON.stringify(batch.spellSlotUsage) !== JSON.stringify(loaded.character.state.spellSlots ?? [])
  const resourceUsageChanged = resourceConsumption !== undefined
  const shouldAdvance =
    folded.stateChanged ||
    conditionStateChanged ||
    spellSlotsChanged ||
    resourceUsageChanged ||
    batch.forceVersionAdvance
  const updatedActor = encounterRunActorStateSchema.parse({
    ...actor,
    sourceRevision: shouldAdvance ? loaded.active.streamVersion + 1 : loaded.active.streamVersion,
    snapshot: {
      ...requireSnapshotIdentity(actor),
      sourceRevision: shouldAdvance ? loaded.active.streamVersion + 1 : loaded.active.streamVersion
    },
    currentHitPoints: folded.after.currentHitPoints,
    tempHitPoints: folded.after.temporaryHitPoints,
    maxHitPoints: folded.after.maximumHitPoints,
    conditions: nextActorConditions
  })
  const character = {
    ...loaded.character,
    state: {
      ...loaded.character.state,
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
    updatedActor,
    receiptApplications: folded.applications,
    targetTransition: transition(actor.id, folded.before, folded.after),
    characterStreamVersion: shouldAdvance ? loaded.active.streamVersion + 1 : null,
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
