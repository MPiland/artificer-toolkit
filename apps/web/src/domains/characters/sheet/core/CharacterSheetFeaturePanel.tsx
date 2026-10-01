import { Alert, Loader } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import { projectCharacterSheetSlice } from '@artificer-toolkit/rules-runtime/character/sheetSlices'
import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { getCharacterSheetSlice } from '#app/data/characters/queries'
import { CharacterSheetActions } from '../actions/CharacterSheetActions'
import { CharacterSheetExtras } from '../extras/CharacterSheetExtras'
import { CharacterSheetInventory } from '../inventory/CharacterSheetInventory'
import { CharacterSheetNotes } from '../notes/CharacterSheetNotes'
import { CharacterSheetReference } from '../reference/CharacterSheetReference'
import { CharacterSheetSpells } from '../spells/CharacterSheetSpells'
import type {
  CharacterSheetPageId,
  OpenSheetPanel,
  SubmitSheetCommand
} from './CharacterSheet.types'

export function CharacterSheetFeaturePanel({
  campaignInventory,
  liveSheet,
  openPanel,
  pending,
  meta,
  submitCommand,
  tab
}: {
  campaignInventory?: ReactNode
  /** The room's pushed Sheet while a live Run holds the Character; it replaces every non-notes slice. */
  liveSheet?: CharacterSheetResponseDto
  openPanel?: OpenSheetPanel
  pending: boolean
  meta: CharacterSheetCommonDto['meta']
  submitCommand: SubmitSheetCommand
  tab: CharacterSheetPageId
}) {
  const slice =
    tab === 'actions'
      ? 'ACTIONS'
      : tab === 'spells'
        ? 'SPELLS'
        : tab === 'extras'
          ? 'EXTRAS'
          : tab === 'inventory' || tab === 'equipment'
            ? 'INVENTORY'
            : tab === 'notes'
              ? 'NOTES'
              : 'FEATURES'
  const query = useQuery({
    ...getCharacterSheetSlice(meta.characterId, slice, meta.campaignId),
    select: undefined,
    enabled: !liveSheet || slice === 'NOTES'
  })
  const data =
    liveSheet && slice !== 'NOTES' ? projectCharacterSheetSlice(liveSheet, slice) : query.data
  if (query.error) return <Alert color='red'>{query.error.message}</Alert>
  if (!data && query.isPending) return <Loader aria-label='Loading character collection' />
  if (!data) return <Alert color='yellow'>Character collection unavailable.</Alert>
  // Notes stay on Convex, whose version the room's push does not track.
  const current = liveSheet !== undefined || data.data.meta.streamVersion === meta.streamVersion
  const props = { hideTitle: true, openPanel, pending: pending || !current, submitCommand }
  switch (data.slice) {
    case 'ACTIONS':
      return <CharacterSheetActions {...props} sheet={data.data} />
    case 'SPELLS':
      return <CharacterSheetSpells {...props} sheet={data.data} />
    case 'EXTRAS':
      return <CharacterSheetExtras {...props} sheet={data.data} />
    case 'INVENTORY':
      return (
        <CharacterSheetInventory
          {...props}
          editable={meta.capabilities.manageInventory}
          partyInventory={campaignInventory}
          sheet={data.data}
        />
      )
    case 'NOTES':
      return <CharacterSheetNotes {...props} sheet={data.data} />
    case 'FEATURES':
      return <CharacterSheetReference {...props} mode='features' sheet={data.data} />
    case 'COMMON':
      return null
  }
}
