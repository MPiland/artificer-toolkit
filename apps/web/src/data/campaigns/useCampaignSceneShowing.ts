import { useMutation, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvex } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'

/** The Campaign's current showing (D87), or null. Reactive, so a stop or a new Scene arrives live. */
export function useCampaignSceneShowing(campaignId: string) {
  const showing = useQuery(convexQuery(api.scenes.showings.current, { campaignId }))
  const presentation = useQuery(convexQuery(api.scenes.presentations.get, { campaignId }))
  return {
    showing: showing.error ? null : (showing.data ?? null),
    presentedSceneId: presentation.error ? null : (presentation.data?.sceneId ?? null)
  }
}

export function useCampaignSceneShowingActions(campaignId: string) {
  const client = useConvex()
  const show = useMutation({
    mutationFn: (sceneId: string) =>
      client.mutation(api.scenes.showings.show, { campaignId, sceneId })
  })
  const stop = useMutation({
    mutationFn: () => client.mutation(api.scenes.showings.stop, { campaignId })
  })
  return { show, stop, error: show.error ?? stop.error }
}
