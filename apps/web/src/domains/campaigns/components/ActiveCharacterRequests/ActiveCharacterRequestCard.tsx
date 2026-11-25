import { Button, Group, Paper, Stack, Text } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import type { CampaignActiveCharacterRequestDto } from '@artificer-toolkit/schema/api/campaignCore'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'

/** GM-only: a player asked to swap their Active Character while it fights (D236). */
export function ActiveCharacterRequestCard({
  request
}: {
  request: CampaignActiveCharacterRequestDto
}) {
  const approveRequest = useConvexMutation(convexApi.campaigns.activeCharacterRequests.approve)
  const declineRequest = useConvexMutation(convexApi.campaigns.activeCharacterRequests.decline)
  const input = { campaignId: request.campaignId, requestId: request.id }
  const approve = useMutation({ retry: false, mutationFn: () => approveRequest(input) })
  const decline = useMutation({ retry: false, mutationFn: () => declineRequest(input) })
  const error = approve.error ?? decline.error

  return (
    <Paper withBorder p='sm'>
      <Stack gap='xs'>
        <Text fw={700} size='sm'>
          Swap {request.fromCharacterName} for {request.toCharacterName}?
        </Text>
        <Text c='dimmed' size='xs'>
          {request.toCharacterName} takes {request.fromCharacterName}&apos;s place in the fight.
        </Text>
        {error ? (
          <Text c='red' role='alert' size='xs'>
            {error.message}
          </Text>
        ) : null}
        <Group justify='flex-end' gap='xs'>
          <Button
            disabled={approve.isPending}
            loading={decline.isPending}
            size='xs'
            variant='default'
            onClick={() => decline.mutate()}
          >
            Decline
          </Button>
          <Button
            disabled={decline.isPending}
            loading={approve.isPending}
            size='xs'
            onClick={() => approve.mutate()}
          >
            Approve
          </Button>
        </Group>
      </Stack>
    </Paper>
  )
}
