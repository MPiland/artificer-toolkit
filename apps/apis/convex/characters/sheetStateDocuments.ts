import {
  createCharacterResourceOwnerKey,
  createCharacterSpellSourceKey
} from '@artificer-toolkit/shared/character'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import { readCharacterSheetState as readJoinedSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import { getCharacterSheetAdjustmentSlotKey } from '@artificer-toolkit/rules-runtime/character/sheetAdjustmentIdentity'
import type { CharacterRecordRow } from './stateDocuments'

/**
 * The Character's Sheet state: the Sheet structure its row stores, joined with the play fields
 * (resource usage, party visibility) its play record holds, and checked for ownership and uniqueness.
 */
export function readCharacterSheetState(
  record: Pick<CharacterRecordRow, 'id' | 'sheetState' | 'play'>
): CharacterSheetState {
  const state = readJoinedSheetState(record)
  if (state.adjustments.some((adjustment) => adjustment.characterId !== record.id))
    throw new Error('Stored Character Sheet adjustment ownership mismatch.')
  if (
    new Set(state.adjustments.map((adjustment) => adjustment.id)).size !==
      state.adjustments.length ||
    new Set(state.adjustments.map(getCharacterSheetAdjustmentSlotKey)).size !==
      state.adjustments.length
  )
    throw new Error('Stored Character Sheet adjustments must have unique identities and slots.')
  if (state.resourceUsage.some((usage) => usage.characterId !== record.id))
    throw new Error('Stored Character Sheet resource usage ownership mismatch.')
  if (
    new Set(state.resourceUsage.map((usage) => usage.id)).size !== state.resourceUsage.length ||
    new Set(state.resourceUsage.map((usage) => createCharacterResourceOwnerKey(usage.owner)))
      .size !== state.resourceUsage.length
  )
    throw new Error('Stored Character Sheet resource usage must have unique identities and owners.')
  if (state.spellCustomizations.some((customization) => customization.characterId !== record.id))
    throw new Error('Stored Character Sheet spell customization ownership mismatch.')
  if (
    new Set(state.spellCustomizations.map((customization) => customization.id)).size !==
      state.spellCustomizations.length ||
    new Set(
      state.spellCustomizations.map((customization) =>
        createCharacterSpellSourceKey(customization.source)
      )
    ).size !== state.spellCustomizations.length
  )
    throw new Error(
      'Stored Character Sheet spell customizations must have unique identities and sources.'
    )
  return state
}
