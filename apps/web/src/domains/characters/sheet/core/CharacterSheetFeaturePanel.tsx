import { Alert, Loader } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
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
  openPanel,
  pending,
  meta,
  submitCommand,
  tab
}: {
  campaignInventory?: ReactNode
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
    select: undefined
  })
  if (query.error) return <Alert color='red'>{query.error.message}</Alert>
  if (query.isPending) return <Loader aria-label='Loading character collection' />
  if (!query.data) return <Alert color='yellow'>Character collection unavailable.</Alert>
  const current = query.data.data.meta.streamVersion === meta.streamVersion
  const props = { hideTitle: true, openPanel, pending: pending || !current, submitCommand }
  switch (query.data.slice) {
    case 'ACTIONS':
      return <CharacterSheetActions {...props} sheet={query.data.data} />
    case 'SPELLS':
      return <CharacterSheetSpells {...props} sheet={query.data.data} />
    case 'EXTRAS':
      return <CharacterSheetExtras {...props} sheet={query.data.data} />
    case 'INVENTORY':
      return (
        <CharacterSheetInventory
          {...props}
          editable={meta.capabilities.manageInventory}
          partyInventory={campaignInventory}
          sheet={query.data.data}
        />
      )
    case 'NOTES':
      return <CharacterSheetNotes {...props} sheet={query.data.data} />
    case 'FEATURES':
      return <CharacterSheetReference {...props} mode='features' sheet={query.data.data} />
    case 'COMMON':
      return null
  }
}
