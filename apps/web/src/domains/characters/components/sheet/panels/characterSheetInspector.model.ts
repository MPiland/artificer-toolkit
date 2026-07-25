import type { CharacterSheetPanelDto } from '#app/lib/api'

type AbilityPanel = Extract<CharacterSheetPanelDto, { kind: 'ABILITY' }>
type SavingThrowPanel = Extract<CharacterSheetPanelDto, { kind: 'SAVING_THROW' }>
type SkillPanel = Extract<CharacterSheetPanelDto, { kind: 'SKILL' }>
type SensesPanel = Extract<CharacterSheetPanelDto, { kind: 'SENSES' }>
type MovementPanel = Extract<CharacterSheetPanelDto, { kind: 'MOVEMENT' }>

export type CharacterSheetNumberEditorDto =
  | AbilityPanel['editors'][number]
  | SavingThrowPanel['numericEditors'][number]
  | SkillPanel['numericEditors'][number]
  | SensesPanel['passiveChecks'][number]['editor']
  | SensesPanel['senses'][number]['editor']
  | MovementPanel['speeds'][number]['editor']

export type CharacterSheetSelectEditorDto =
  | SavingThrowPanel['proficiencyEditor']
  | SkillPanel['proficiencyEditor']
  | SkillPanel['abilityEditor']

export interface CharacterSheetEditorCommit {
  value: number | string
  sourceCategory: CharacterSheetNumberEditorDto['sourceCategory']
  sourceLabel?: string
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
    sourceCategory: commit.sourceCategory,
    ...(commit.sourceLabel ? { sourceLabel: commit.sourceLabel } : {}),
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
