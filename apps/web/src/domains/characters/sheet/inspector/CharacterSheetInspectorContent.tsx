import type { ReactNode } from 'react'
import { MediaImageView } from '#app/components/MediaImage'
import type {
  CharacterPreparationOptionsResponseDto,
  CharacterSheetPanelDto,
  CharacterSheetPanelTargetDto
} from '#app/lib/api'
import type { CharacterSheet, SubmitSheetCommand } from '../core/CharacterSheet.types'
import { CharacterSheetExtraPanel } from './CharacterSheetExtraPanel'
import { CharacterSheetItemPanelContent } from './CharacterSheetItemPanel'
import { CharacterSheetRulesPanel } from './CharacterSheetRulesPanel'
import { CharacterSheetSpellPanelContent } from './CharacterSheetSpellPanelContent'
import { CharacterSheetSpellsPanelContent } from './CharacterSheetSpellsPanelContent'
import { getCharacterSheetPanelImageTarget } from './inspector.model'

export function CharacterSheetInspectorContent({
  expectedVersion,
  equipmentItems,
  panel,
  pending,
  preparationOptions,
  preparationOptionsError,
  preparationOptionsPending,
  submitCommand,
  onClose,
  onTargetChange
}: {
  expectedVersion: number
  equipmentItems: CharacterSheet['inventory']['items']
  panel: CharacterSheetPanelDto
  pending: boolean
  preparationOptions?: CharacterPreparationOptionsResponseDto
  preparationOptionsError?: string
  preparationOptionsPending?: boolean
  submitCommand: SubmitSheetCommand
  onClose: () => void
  onTargetChange: (target: CharacterSheetPanelTargetDto) => void
}) {
  let content: ReactNode

  switch (panel.kind) {
    case 'COMPANION':
    case 'VEHICLE':
      content = (
        <CharacterSheetExtraPanel
          expectedVersion={expectedVersion}
          equipmentItems={equipmentItems}
          panel={panel}
          pending={pending}
          submitCommand={submitCommand}
          onClose={onClose}
        />
      )
      break
    case 'SPELL':
      content = (
        <CharacterSheetSpellPanelContent
          expectedVersion={expectedVersion}
          panel={panel}
          pending={pending}
          submitCommand={submitCommand}
        />
      )
      break
    case 'SPELLS':
      content = (
        <CharacterSheetSpellsPanelContent
          expectedVersion={expectedVersion}
          panel={panel}
          pending={pending}
          preparationOptions={preparationOptions}
          preparationOptionsError={preparationOptionsError}
          preparationOptionsPending={preparationOptionsPending}
          submitCommand={submitCommand}
          onTargetChange={onTargetChange}
        />
      )
      break
    case 'ITEM':
      content = (
        <CharacterSheetItemPanelContent
          expectedVersion={expectedVersion}
          panel={panel}
          pending={pending}
          submitCommand={submitCommand}
          onClose={onClose}
        />
      )
      break
    case 'ABILITY':
    case 'SAVING_THROW':
    case 'SKILL':
    case 'SKILLS':
    case 'SENSES':
    case 'MOVEMENT':
    case 'DEFENSES':
    case 'PROFICIENCIES':
    case 'FEATURE':
    case 'BACKGROUND':
    case 'RESOURCE':
    case 'EXTRAS':
      content = (
        <CharacterSheetRulesPanel
          expectedVersion={expectedVersion}
          panel={panel}
          pending={pending}
          submitCommand={submitCommand}
          onTargetChange={onTargetChange}
        />
      )
      break
    default:
      return panel satisfies never
  }

  const imageTarget = getCharacterSheetPanelImageTarget(panel)
  return (
    <>
      {imageTarget ? <MediaImageView target={imageTarget} variant='inspector' /> : null}
      {content}
    </>
  )
}
