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
export type OpenSheetPanel = (target: CharacterSheetPanelTargetDto) => void
export type CharacterSheetTabId =
  | 'overview'
  | 'actions'
  | 'spells'
  | 'extras'
  | 'inventory'
  | 'reference'
  | 'notes'

export type CharacterSheetMobilePageId =
  | 'overview'
  | 'actions'
  | 'spells'
  | 'extras'
  | 'equipment'
  | 'features'
  | 'notes'
  | 'skills'
  | 'proficiencies'

export type CharacterSheetPageId = CharacterSheetTabId | CharacterSheetMobilePageId
