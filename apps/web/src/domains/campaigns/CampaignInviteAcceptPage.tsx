import { Alert, Button, Text, Title } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'
import * as sharedStyles from './campaigns.css'

export function CampaignInviteAcceptPage({ token }: { token: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const acceptInvite = useMutation({
    mutationFn: () => api.campaigns.invites.accept(token),
    onSuccess: async (campaign) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.list() })
      await navigate({
        to: '/campaigns/$campaignPublicId/$campaignSlug',
        params: buildCampaignRouteParams(campaign.publicId, campaign.name)
      })
    }
  })

  return (
    <main className={`${sharedStyles.page} ${sharedStyles.createPage}`}>
      <header className={sharedStyles.createHeader}>
        <Title order={1}>Join Campaign</Title>
        <Text c='dimmed'>Accept this invitation to join the table.</Text>
      </header>
      <section className={sharedStyles.createForm} aria-label='Campaign invitation'>
        {acceptInvite.error ? (
          <Alert color='red' title='Invitation not accepted'>
            {acceptInvite.error.message}
          </Alert>
        ) : null}
        <Button loading={acceptInvite.isPending} onClick={() => acceptInvite.mutate()}>
          Join Campaign
        </Button>
        <Button component={Link} to='/campaigns' variant='default'>
          Back to Campaigns
        </Button>
      </section>
    </main>
  )
}
