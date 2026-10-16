import { useQuery } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import type { GetEncounterActionTargetModifiersInputDto } from '@artificer-toolkit/schema/api/encounterActionTargetModifiers'
import { loadCampaignEncounterActionTargetModifiers } from '#app/data/campaigns/encounterActions'
import { readFromRoomOrFallback } from './useRoomEncounterRead'
import type { useCampaignLiveSession } from './useCampaignLiveSession'

/**
 * What the acting Character believes about attacking each creature (ATTACK-17.1), read once when
 * targeting starts: the room answers while it holds the Encounter, Convex otherwise. Hovering a
 * token never reads again; only a new Encounter version or Scene does.
 */
export function useActionTargetModifiers({
  input,
  readEncounter,
  roomVersion
}: {
  input: GetEncounterActionTargetModifiersInputDto | null
  readEncounter: ReturnType<typeof useCampaignLiveSession>['readEncounter']
  roomVersion: number | null
}) {
  const convex = useConvex()
  const read = useQuery({
    enabled: input !== null,
    gcTime: 0,
    queryFn: () => {
      if (!input) throw new Error('Target modifiers need an action to read for.')
      const { expectedVersion, ...roomInput } = input
      return readFromRoomOrFallback({
        fallback: () => loadCampaignEncounterActionTargetModifiers(convex, input),
        read: { kind: 'ACTION_TARGET_MODIFIERS', input: roomInput },
        readEncounter,
        roomVersion,
        select: (result) => (result.kind === 'ACTION_TARGET_MODIFIERS' ? result.result : undefined)
      })
    },
    queryKey: ['encounters', 'actionTargetModifiers', input]
  })
  return input ? (read.data ?? null) : null
}
