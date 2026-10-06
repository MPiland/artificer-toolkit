import { useMutation, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvex } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { setCampaignLiveScenePresentationResultDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'

/**
 * Which Scene the Campaign presents, and the presentation version a present asks Convex to match.
 * While the room holds authority (`roomState`), the room's own Scene and version are the answer and
 * Convex's pointer is not read (ADR 0035 A28, D79): it trails the room between save points. Without
 * the room the small pointer subscription is the only source; the Scene itself always comes from
 * the room.
 */
export function useCampaignPresentedScene(
  campaignId: string,
  roomState: { presentationVersion: number | null; scene: { id: string } | null } | null
) {
  const client = useConvex()
  const pointer = useQuery(
    convexQuery(api.scenes.presentations.get, roomState ? 'skip' : { campaignId })
  )
  const presentationVersion = roomState
    ? roomState.presentationVersion
    : (pointer.data?.version ?? null)
  const present = useMutation({
    mutationFn: async (nextSceneId: string | null) =>
      setCampaignLiveScenePresentationResultDtoSchema.parse(
        await client.action(api.scenes.presentations.setLive, {
          commandId: crypto.randomUUID(),
          expectedPresentationVersion: presentationVersion,
          campaignId,
          sceneId: nextSceneId,
          type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
        })
      )
  })
  return {
    sceneId: roomState
      ? (roomState.scene?.id ?? null)
      : pointer.error
        ? null
        : (pointer.data?.sceneId ?? null),
    error: roomState ? null : pointer.error,
    presentationError: present.error,
    isLoading: !roomState && pointer.isPending,
    canPresent: (roomState !== null || pointer.isSuccess) && !present.isPending,
    present: present.mutate
  }
}
