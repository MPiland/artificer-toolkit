import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characters'
import {
  type CharacterSheetAdjustment,
  type CharacterSheetAdjustmentWrite
} from '@artificer-toolkit/shared/character'
import { sameCharacterSheetAdjustmentSlot } from './sheetAdjustmentIdentity.js'
import {
  getSpellCustomizationField,
  getSpellCustomizationFields,
  sameSpellSource
} from './sheetCommandValidation.js'
import {
  characterSheetAdjustmentMatchesPanelTarget,
  getCharacterSheetPanelAdjustmentIds
} from './sheetPanelTarget.js'

function toProspectiveSheetAdjustment(
  write: CharacterSheetAdjustmentWrite,
  existing?: CharacterSheetAdjustment,
  now?: string
): CharacterSheetAdjustment {
  const timestamp = now ?? existing?.updatedAt ?? new Date(0).toISOString()
  const { actorId, ...value } = write
  return {
    ...value,
    createdBy: existing?.createdBy ?? actorId,
    updatedBy: actorId,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp
  }
}

/** Drops the rest-reset maximum HP modifier and Item adjustments for a removed Item. */
export function pruneSheetAdjustments(params: {
  adjustments: readonly CharacterSheetAdjustment[]
  resetMaximumModifierId?: string
  removedItemId?: string
}): readonly CharacterSheetAdjustment[] {
  return params.adjustments.filter(
    (adjustment) =>
      adjustment.id !== params.resetMaximumModifierId &&
      (adjustment.family !== 'ITEM' || adjustment.itemInstanceId !== params.removedItemId)
  )
}

export function getProspectiveSheetAdjustments(params: {
  adjustments: readonly CharacterSheetAdjustment[]
  characterId: string
  command: CharacterSheetCommandInputDto
  userId: string
  now?: string
}): readonly CharacterSheetAdjustment[] {
  const { adjustments, command } = params
  if (command.type === 'UPSERT_SHEET_ADJUSTMENT') {
    const existing = adjustments.find((adjustment) =>
      sameCharacterSheetAdjustmentSlot(adjustment, command.adjustment)
    )
    const next = toProspectiveSheetAdjustment(
      {
        ...command.adjustment,
        id: existing?.id ?? command.adjustment.id ?? crypto.randomUUID(),
        characterId: params.characterId,
        actorId: params.userId
      },
      existing,
      params.now
    )
    return [
      ...adjustments.filter(
        (adjustment) => !sameCharacterSheetAdjustmentSlot(adjustment, command.adjustment)
      ),
      next
    ]
  }
  if (command.type === 'REMOVE_SHEET_ADJUSTMENT') {
    return adjustments.filter((adjustment) => adjustment.id !== command.adjustmentId)
  }
  if (command.type === 'RESET_SHEET_PANEL_ADJUSTMENTS') {
    const removedIds = new Set(
      getCharacterSheetPanelAdjustmentIds(adjustments, command.target).map(
        (adjustment) => adjustment.id
      )
    )
    return adjustments.filter((adjustment) => !removedIds.has(adjustment.id))
  }
  if (command.type === 'SET_HIT_POINTS' && command.maxOverride !== undefined) {
    const existing = adjustments.find(
      (adjustment) => adjustment.family === 'HIT_POINTS' && adjustment.field === 'MAXIMUM_OVERRIDE'
    )
    const withoutOverride = adjustments.filter(
      (adjustment) => adjustment.family !== 'HIT_POINTS' || adjustment.field !== 'MAXIMUM_OVERRIDE'
    )
    if (command.maxOverride === null) return withoutOverride
    return [
      ...withoutOverride,
      toProspectiveSheetAdjustment(
        {
          id: existing?.id ?? crypto.randomUUID(),
          characterId: params.characterId,
          actorId: params.userId,
          family: 'HIT_POINTS',
          field: 'MAXIMUM_OVERRIDE',
          value: command.maxOverride,
          ...(existing?.sourceNote ? { sourceNote: existing.sourceNote } : {})
        },
        existing,
        params.now
      )
    ]
  }
  if (command.type === 'SET_SPELL_MECHANIC_CUSTOMIZATION') {
    const fields = getSpellCustomizationFields(command.category)
    return [
      ...adjustments.filter(
        (adjustment) =>
          !(
            adjustment.family === 'SPELL' &&
            sameSpellSource(adjustment.source, command.source) &&
            fields.includes(adjustment.field)
          )
      ),
      toProspectiveSheetAdjustment(
        {
          id: crypto.randomUUID(),
          characterId: params.characterId,
          actorId: params.userId,
          family: 'SPELL',
          source: command.source,
          field: getSpellCustomizationField(command),
          value: command.value,
          ...(command.sourceNote ? { sourceNote: command.sourceNote } : {})
        },
        undefined,
        params.now
      )
    ]
  }
  if (command.type === 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION') {
    const fields = getSpellCustomizationFields(command.category)
    return adjustments.filter(
      (adjustment) =>
        !(
          adjustment.family === 'SPELL' &&
          sameSpellSource(adjustment.source, command.source) &&
          fields.includes(adjustment.field)
        )
    )
  }
  if (
    command.type === 'REMOVE_SHEET_EXTRA' &&
    command.extra.kind !== 'VEHICLE' &&
    command.extra.kind !== 'SPELL_SUMMON'
  ) {
    return adjustments.filter(
      (adjustment) =>
        !characterSheetAdjustmentMatchesPanelTarget(adjustment, {
          kind: 'COMPANION',
          companionInstanceId: command.extra.extraId
        })
    )
  }
  return adjustments
}
