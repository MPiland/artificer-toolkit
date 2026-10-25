import { Modal } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvex } from 'convex/react'
import { useState } from 'react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { sceneRecipientHeaderSchema } from '@artificer-toolkit/schema/api/sceneRecipient'
import { loadCampaignShownScene } from '#app/data/campaigns/liveScenes'
import { useCampaignSceneShowing } from '#app/data/campaigns/useCampaignSceneShowing'
import { queryKeys } from '#app/lib/queryKeys'
import { CampaignShownSceneCanvas } from './CampaignShownSceneCanvas'

/**
 * D87: while the GM shows a Scene, players see its map and fog as a view-only image. Dismissal is
 * local and keyed to this showing, so a new Scene or a new showing reopens it. It stays closed for
 * the presented Scene, which the stage already renders.
 */
export function CampaignShownSceneViewer({
  campaignId,
  currentUserId,
  gameSystemId
}: {
  campaignId: string
  currentUserId: string
  gameSystemId: string
}) {
  const client = useConvex()
  const { showing, presentedSceneId } = useCampaignSceneShowing(campaignId)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const showingKey = showing ? `${showing.sceneId}:${showing.shownAt}` : null
  const open = Boolean(showing && showing.sceneId !== presentedSceneId && dismissed !== showingKey)
  const sceneId = open && showing ? showing.sceneId : null
  const header = useQuery(
    convexQuery(
      api.scenes.recipientReads.header,
      sceneId ? { sceneId, includeSnapshot: false } : 'skip'
    )
  )
  const parsed = header.data && !header.error ? sceneRecipientHeaderSchema.parse(header.data) : null
  const hydrated = useQuery({
    queryKey: [
      ...queryKeys.campaigns.liveScenes(campaignId),
      'shown',
      sceneId,
      parsed?.recipientRevision
    ],
    enabled: Boolean(parsed && parsed.id === sceneId),
    queryFn: ({ signal }) => loadCampaignShownScene(client, parsed!, signal),
    gcTime: 0
  })

  return (
    <Modal
      centered
      opened={open}
      size='min(96vw, 72rem)'
      title={showing?.sceneName}
      onClose={() => setDismissed(showingKey)}
    >
      {hydrated.data ? (
        <CampaignShownSceneCanvas
          currentUserId={currentUserId}
          gameSystemId={gameSystemId}
          scene={hydrated.data}
        />
      ) : null}
    </Modal>
  )
}
