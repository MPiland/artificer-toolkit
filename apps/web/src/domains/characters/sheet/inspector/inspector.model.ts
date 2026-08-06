import type { CharacterSheetPanelDto } from '#app/lib/api'
import type { MediaImageTarget } from '#app/components/MediaImage'

type AbilityPanel = Extract<CharacterSheetPanelDto, { kind: 'ABILITY' }>
type SavingThrowPanel = Extract<CharacterSheetPanelDto, { kind: 'SAVING_THROW' }>
type SkillPanel = Extract<CharacterSheetPanelDto, { kind: 'SKILL' }>
type SensesPanel = Extract<CharacterSheetPanelDto, { kind: 'SENSES' }>
type MovementPanel = Extract<CharacterSheetPanelDto, { kind: 'MOVEMENT' }>
type ItemPanel = Extract<CharacterSheetPanelDto, { kind: 'ITEM' }>
type CompanionPanel = Extract<CharacterSheetPanelDto, { kind: 'COMPANION' }>

export type CharacterSheetNumberEditorDto =
  | AbilityPanel['editors'][number]
  | SavingThrowPanel['numericEditors'][number]
  | SkillPanel['numericEditors'][number]
  | SensesPanel['passiveChecks'][number]['editor']
  | SensesPanel['senses'][number]['editor']
  | MovementPanel['speeds'][number]['editor']
  | ItemPanel['numericEditors'][number]
  | CompanionPanel['numericEditors'][number]

export type CharacterSheetSelectEditorDto =
  | SavingThrowPanel['proficiencyEditor']
  | SkillPanel['proficiencyEditor']
  | SkillPanel['abilityEditor']
  | CompanionPanel['selectEditors'][number]

export interface CharacterSheetEditorCommit {
  value: number | string
  sourceNote?: string
}

export function cleanSheetEditorText(value: string): string | undefined {
  const cleaned = value.trim()
  return cleaned.length ? cleaned : undefined
}

export function getSheetAdjustmentMetadata(
  adjustmentId: string | undefined,
  commit: CharacterSheetEditorCommit
) {
  return {
    ...(adjustmentId ? { id: adjustmentId } : {}),
    ...(commit.sourceNote ? { sourceNote: commit.sourceNote } : {})
  }
}

export function getPanelStateLabel(
  state: CharacterSheetPanelDto['state']
): 'Default' | 'Adjusted' | 'Overridden' {
  switch (state) {
    case 'DEFAULT':
      return 'Default'
    case 'ADJUSTED':
      return 'Adjusted'
    case 'OVERRIDDEN':
      return 'Overridden'
  }
}

export function getCharacterSheetPanelImageTarget(
  panel: CharacterSheetPanelDto
): MediaImageTarget | null {
  const subject = (() => {
    switch (panel.kind) {
      case 'SPELL':
        return { subjectKind: 'SPELL' as const, subjectId: panel.spellId }
      case 'ITEM':
        return { subjectKind: 'EQUIPMENT' as const, subjectId: panel.equipmentId }
      case 'BACKGROUND':
        return { subjectKind: 'BACKGROUND' as const, subjectId: panel.backgroundId }
      case 'COMPANION':
        return { subjectKind: 'CREATURE' as const, subjectId: panel.creatureId }
      case 'VEHICLE':
        return { subjectKind: 'VEHICLE' as const, subjectId: panel.vehicleId }
      default:
        return null
    }
  })()

  if (!subject) return null
  return {
    lookup: { type: 'AUTHORED_IMAGE', ...subject, scope: 'ACTIVE' },
    attach: { type: 'AUTHORED_IMAGE', ...subject }
  }
}
