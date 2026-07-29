import type { CharacterSheetPanelDto, CharacterSheetPanelTargetDto } from '#app/lib/api'
import type { CharacterSheet, SubmitSheetCommand } from '../core/CharacterSheet.types'
import { CharacterSheetExtraPanel } from './CharacterSheetExtraPanel'
import { CharacterSheetItemPanelContent } from './CharacterSheetItemPanel'
import { CharacterSheetRulesPanel } from './CharacterSheetRulesPanel'
import {
  CharacterSheetSpellPanelContent,
  CharacterSheetSpellsPanelContent
} from './CharacterSheetSpellPanels'

export function CharacterSheetInspectorContent({
  expectedVersion,
  equipmentItems,
  panel,
  pending,
  submitCommand,
  onClose,
  onTargetChange,
  onOpenBuilder
}: {
  expectedVersion: number
  equipmentItems: CharacterSheet['inventory']['items']
  panel: CharacterSheetPanelDto
  pending: boolean
  submitCommand: SubmitSheetCommand
  onClose: () => void
  onTargetChange: (target: CharacterSheetPanelTargetDto) => void
  onOpenBuilder: () => void
}) {
  switch (panel.kind) {
    case 'COMPANION':
    case 'VEHICLE':
      return (
        <CharacterSheetExtraPanel
          expectedVersion={expectedVersion}
          equipmentItems={equipmentItems}
          panel={panel}
          pending={pending}
          submitCommand={submitCommand}
          onClose={onClose}
        />
      )
    case 'SPELL':
      return (
        <CharacterSheetSpellPanelContent
          expectedVersion={expectedVersion}
          panel={panel}
          pending={pending}
          submitCommand={submitCommand}
        />
      )
    case 'SPELLS':
      return (
        <CharacterSheetSpellsPanelContent
          expectedVersion={expectedVersion}
          panel={panel}
          pending={pending}
          submitCommand={submitCommand}
          onTargetChange={onTargetChange}
          onOpenBuilder={onOpenBuilder}
        />
      )
    case 'ITEM':
      return (
        <CharacterSheetItemPanelContent
          expectedVersion={expectedVersion}
          panel={panel}
          pending={pending}
          submitCommand={submitCommand}
          onClose={onClose}
        />
      )
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
      return (
        <CharacterSheetRulesPanel
          expectedVersion={expectedVersion}
          panel={panel}
          pending={pending}
          submitCommand={submitCommand}
          onTargetChange={onTargetChange}
        />
      )
    default:
      return panel satisfies never
  }
}
