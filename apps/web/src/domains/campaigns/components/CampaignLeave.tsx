import { Loader } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useMutation as useConvexMutation } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { z } from 'zod'
import type { leaveCampaignInputSchema } from '@artificer-toolkit/schema/api/campaignCore'
import { removeCampaignQueries } from '#app/data/campaigns/queries'

/**
 * Leaves the Campaign from a page that holds no Campaign subscriptions: the rest of the Campaign
 * subtree is unmounted and its cached queries dropped before the mutation commits, so the
 * departure does not rerun each of them (D216).
 */
export function CampaignLeave({
  input,
  onFailed
}: {
  input: z.infer<typeof leaveCampaignInputSchema>
  onFailed: (message: string) => void
}) {
  const queryClient = useQueryClient()
  const leave = useConvexMutation(convexApi.campaigns.membershipDeparture.leave)
  const { mutate } = useMutation({
    retry: 1,
    mutationFn: () => leave(input),
    onSuccess: () => window.location.assign('/campaigns'),
    onError: (error) => onFailed(error.message)
  })

  useEffect(() => {
    removeCampaignQueries(queryClient, input.campaignId)
    mutate()
  }, [input.campaignId, mutate, queryClient])

  return <Loader aria-label='Leaving Campaign' />
}
