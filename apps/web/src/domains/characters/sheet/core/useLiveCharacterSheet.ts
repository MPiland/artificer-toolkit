import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { CharacterSheetLivePlayCommand } from '@artificer-toolkit/schema/api/characterSheetLiveCommands'
import { projectCharacterSheetSlice } from '@artificer-toolkit/rules-runtime/character/sheetSlices'
import { getCharacterSheetLiveAuthority } from '#app/data/characters/queries'
import { useCampaignLiveSession } from '#app/domains/campaigns/vtt/useCampaignLiveSession'

/**
 * The room's pushed Sheet for a Character a live Run holds (D73), or null for every other reader.
 * While it is non-null, play commands go to the room and never to Convex: until the room's first
 * push `pending` is true, the committed Sheet shows, and the caller holds the play controls.
 */
export function useLiveCharacterSheet(characterId: string, campaignId: string | null | undefined) {
  const authority = useQuery(getCharacterSheetLiveAuthority(characterId, campaignId))
  const encounterId = authority.data?.encounterIds[0]
  const live = useCampaignLiveSession({
    campaignId: campaignId ?? '',
    characterSheetId: characterId,
    enabled: Boolean(campaignId && encounterId)
  })
  const { sendCharacterSheetCommand } = live
  const sheet = encounterId ? (live.characterSheet?.sheet ?? null) : null
  const common = useMemo(
    () => (sheet ? projectCharacterSheetSlice(sheet, 'COMMON').data : null),
    [sheet]
  )
  const sendPlayCommand = useCallback(
    async (command: CharacterSheetLivePlayCommand) => {
      if (!encounterId) throw new Error('Live play does not hold this Character.')
      if (!sheet) throw new Error('Live play is still connecting.')
      await sendCharacterSheetCommand({ characterId, encounterId, command })
    },
    [characterId, encounterId, sendCharacterSheetCommand, sheet]
  )
  return useMemo(
    () => (encounterId ? { common, pending: !sheet, sendPlayCommand, sheet } : null),
    [common, encounterId, sendPlayCommand, sheet]
  )
}
