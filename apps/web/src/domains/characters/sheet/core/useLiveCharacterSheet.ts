import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CharacterSheetLivePlayCommand } from '@artificer-toolkit/schema/api/characterSheetLiveCommands'
import { projectCharacterSheetSlice } from '@artificer-toolkit/rules-runtime/character/sheetSlices'
import { getCharacterSheetLiveAuthority } from '#app/data/characters/queries'
import { projectOptimisticCharacterSheet } from '#app/data/characters/optimisticSheet'
import { useCampaignLiveSession } from '#app/domains/campaigns/vtt/useCampaignLiveSession'

/**
 * The room's pushed Sheet for a Character a live Run holds (D73), or null for every other reader.
 * While it is non-null, play commands go to the room and never to Convex: until the room's first
 * push `pending` is true, the committed Sheet shows, and the caller holds the play controls.
 *
 * A play edit shows at once on the pushed Sheet (ADR 0035 Amendment 20) and stays until a push at
 * or after its committed version replaces it. A refusal drops it and rethrows the room's reason.
 * Every push replaces the Sheet, including one at an unchanged version, which is a refresh after
 * an outside edit.
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
  const [edit, setEdit] = useState<{
    command: CharacterSheetLivePlayCommand
    committedVersion: number | null
  } | null>(null)
  const pushed = encounterId ? (live.characterSheet?.sheet ?? null) : null
  const sheet = useMemo(
    () => (pushed && edit ? projectOptimisticCharacterSheet(pushed, edit.command) : pushed),
    [edit, pushed]
  )
  const common = useMemo(
    () => (sheet ? projectCharacterSheetSlice(sheet, 'COMMON').data : null),
    [sheet]
  )
  const committedVersion = edit?.committedVersion ?? null
  const pushedVersion = pushed?.meta.streamVersion
  useEffect(() => {
    if (
      committedVersion !== null &&
      pushedVersion !== undefined &&
      pushedVersion >= committedVersion
    )
      setEdit(null)
  }, [committedVersion, pushedVersion])
  const sendPlayCommand = useCallback(
    async (command: CharacterSheetLivePlayCommand) => {
      if (!encounterId) throw new Error('Live play does not hold this Character.')
      if (!pushed) throw new Error('Live play is still connecting.')
      setEdit({ command, committedVersion: null })
      try {
        const response = await sendCharacterSheetCommand({
          characterId,
          encounterId,
          command
        })
        setEdit((current) =>
          current?.command === command
            ? { command, committedVersion: response.streamVersion }
            : current
        )
        return response
      } catch (error) {
        setEdit((current) => (current?.command === command ? null : current))
        throw error
      }
    },
    [characterId, encounterId, pushed, sendCharacterSheetCommand]
  )
  return useMemo(
    () => (encounterId ? { common, pending: !sheet, sendPlayCommand, sheet } : null),
    [common, encounterId, sendPlayCommand, sheet]
  )
}
