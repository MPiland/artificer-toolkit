import type {
  CharacterSheetCommandInputDto,
  CharacterSheetResponseDto
} from '#app/lib/api'

export type CharacterSheet = CharacterSheetResponseDto
export type SubmitSheetCommand = (command: CharacterSheetCommandInputDto) => void

export type CharacterSheetSectionProps = {
  sheet: CharacterSheet
  pending: boolean
  submitCommand: SubmitSheetCommand
}
