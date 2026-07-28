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
  if (panel.kind === 'COMPANION' || panel.kind === 'VEHICLE') {
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
  }

  if (panel.kind === 'SPELL') {
    return (
      <CharacterSheetSpellPanelContent
        expectedVersion={expectedVersion}
        panel={panel}
        pending={pending}
        submitCommand={submitCommand}
      />
    )
  }
  if (panel.kind === 'SPELLS') {
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
  }
  if (panel.kind === 'ITEM') {
    return (
      <CharacterSheetItemPanelContent
        expectedVersion={expectedVersion}
        panel={panel}
        pending={pending}
        submitCommand={submitCommand}
        onClose={onClose}
      />
    )
  }

  return (
    <CharacterSheetRulesPanel
      expectedVersion={expectedVersion}
      panel={panel}
      pending={pending}
      submitCommand={submitCommand}
      onTargetChange={onTargetChange}
    />
  )
}
