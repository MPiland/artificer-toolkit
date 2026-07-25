import type {
  CharacterSheetCommandInputDto,
  CharacterSheetPanelTargetDto,
  CharacterSheetResponseDto
} from '#app/lib/api'

export type CharacterSheet = CharacterSheetResponseDto
export type CharacterSheetCommandDraft = CharacterSheetCommandInputDto extends infer Command
  ? Command extends CharacterSheetCommandInputDto
    ? Omit<Command, 'commandId'>
    : never
  : never
export type SubmitSheetCommand = (command: CharacterSheetCommandDraft) => Promise<boolean>
export type CharacterSheetTabId
  = | 'overview'
    | 'actions'
    | 'resources'
    | 'spells'
    | 'inventory'
    | 'reference'
    | 'notes'

export type CharacterSheetMobilePageId
  = | 'overview'
    | 'actions'
    | 'spells'
    | 'equipment'
    | 'features'
    | 'notes'
    | 'skills'
    | 'proficiencies'

export type CharacterSheetPageId = CharacterSheetTabId | CharacterSheetMobilePageId

export type CharacterSheetSectionProps = {
  sheet: CharacterSheet
  pending: boolean
  submitCommand: SubmitSheetCommand
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
}
