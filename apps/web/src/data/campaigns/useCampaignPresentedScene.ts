import { useMutation, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvex } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { sceneRecipientHeaderSchema } from '@artificer-toolkit/schema/api/sceneRecipient'
import { setCampaignLiveScenePresentationResultDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { queryKeys } from '#app/lib/queryKeys'
import { loadCampaignLiveScene } from './liveScenes'

export function useCampaignPresentedScene(
  campaignId: string,
  sessionId: string,
  hydrateScene = true
) {
  const client = useConvex()
  const presentation = useQuery(
    convexQuery(api.scenes.presentations.get, { campaignId, sessionId })
  )
  const sceneId = presentation.error ? null : presentation.data?.sceneId
  const header = useQuery(
    convexQuery(
      api.scenes.recipientReads.header,
      sceneId ? (hydrateScene ? { sceneId } : { sceneId, includeSnapshot: false }) : 'skip'
    )
  )
  const captured =
    header.data && !header.error ? sceneRecipientHeaderSchema.parse(header.data) : null
  const headerIdentityError =
    captured && (captured.id !== sceneId || captured.campaignId !== campaignId)
      ? new Error('Presented Scene identity is inconsistent.')
      : null
  const compactScene = captured?.snapshot ?? null
  const hydrated = useQuery({
    queryKey: [
      ...queryKeys.campaigns.liveScenes(campaignId),
      sessionId,
      sceneId,
      captured?.recipientRevision
    ],
    enabled: Boolean(hydrateScene && sceneId && captured && !headerIdentityError && !compactScene),
    queryFn: ({ signal }) => {
      if (!captured || captured.id !== sceneId || captured.campaignId !== campaignId)
        throw new Error('Presented Scene identity is inconsistent.')
      return loadCampaignLiveScene(client, captured, signal)
    },
    retry: (failureCount, error) =>
      failureCount < 2 && error.message.includes('Connection lost while action was in flight'),
    gcTime: 0
  })
  const present = useMutation({
    mutationFn: async (nextSceneId: string | null) =>
      setCampaignLiveScenePresentationResultDtoSchema.parse(
        await client.action(api.scenes.presentations.setLive, {
          commandId: crypto.randomUUID(),
          expectedPresentationVersion: presentation.data?.version ?? null,
          sceneId: nextSceneId,
          sessionId,
          type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
        })
      )
  })
  return {
    scene:
      hydrateScene && sceneId && captured && !headerIdentityError && !hydrated.error
        ? (compactScene ?? hydrated.data)
        : undefined,
    error:
      presentation.error ??
      header.error ??
      headerIdentityError ??
      (hydrateScene ? hydrated.error : null),
    presentationError: present.error,
    presentationVersion: presentation.data?.version ?? null,
    recipientHeader: headerIdentityError ? null : captured,
    isLoading:
      presentation.isPending ||
      Boolean(
        sceneId && (header.isPending || (hydrateScene && !compactScene && hydrated.isPending))
      ),
    canPresent: presentation.isSuccess && !present.isPending,
    present: present.mutate
  }
}
