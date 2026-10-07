import { Alert, Badge, Button, Group, Loader, Text, Title } from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useMutation as useConvexMutation } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { CampaignSummaryDto } from '@artificer-toolkit/schema/api/campaignCore'
import { useState } from 'react'
import { useGetCampaignList } from '#app/data/campaigns/queries'
import {
  buildCampaignRouteParams,
  buildCharacterRouteParams
} from '#app/routing/authoredRouteParams'
import { richHtmlToPlainText } from '#app/lib/richText'
import { CampaignCopy } from './components/CampaignCopy'
import * as sharedStyles from './campaigns.css'

export function CampaignListPage({ deletingCampaignId }: { deletingCampaignId?: string }) {
  const navigate = useNavigate()
  const [copySource, setCopySource] = useState<CampaignSummaryDto | null>(null)
  const { data, isLoading } = useGetCampaignList()
  const campaigns = [...(data ?? [])].sort((left, right) => {
    if (left.status !== right.status) return left.status === 'ACTIVE' ? -1 : 1
    return Date.parse(right.createdAt) - Date.parse(left.createdAt)
  })

  if (isLoading) {
    return (
      <main className={sharedStyles.page}>
        {deletingCampaignId ? <CampaignDeletionProgress campaignId={deletingCampaignId} /> : null}
        <Text role='status'>Loading Campaigns…</Text>
      </main>
    )
  }

  return (
    <main className={sharedStyles.page}>
      <header className={sharedStyles.pageHeader}>
        <div>
          <Title order={1}>Campaigns</Title>
          <Text c='dimmed'>Your active tables and archived Campaign history.</Text>
        </div>
        <Button component={Link} to='/campaigns/new'>
          Create Campaign
        </Button>
      </header>

      {deletingCampaignId ? <CampaignDeletionProgress campaignId={deletingCampaignId} /> : null}

      {campaigns.length === 0 ? (
        <section className={sharedStyles.panel} aria-label='No Campaigns'>
          <Title order={2}>Start your first table</Title>
          <Text c='dimmed'>Create a Campaign, then invite your players.</Text>
        </section>
      ) : (
        <section className={sharedStyles.cards} aria-label='Campaign list'>
          {campaigns.map((campaign) => (
            <article
              data-testid={`campaign-${campaign.publicId}`}
              className={clsx(
                sharedStyles.card,
                campaign.status === 'ARCHIVED' && sharedStyles.archivedCard
              )}
              key={campaign.id}
            >
              <Group justify='space-between' align='flex-start'>
                <Title order={2} size='h3'>
                  {campaign.name}
                </Title>
                <Badge color={campaign.status === 'ACTIVE' ? 'green' : 'gray'}>
                  {campaign.status === 'ACTIVE' ? 'Active' : 'Archived · read-only'}
                </Badge>
              </Group>
              <Text c='dimmed' lineClamp={2}>
                {campaign.description
                  ? richHtmlToPlainText(campaign.description)
                  : 'No description yet.'}
              </Text>
              <Group gap='xs' mt='auto'>
                <Badge variant='light'>{campaign.role === 'OWNER' ? 'GM' : 'Player'}</Badge>
                <Badge variant='light'>
                  {campaign.format === 'ONE_SHOT' ? 'One-shot' : 'Ongoing'}
                </Badge>
                <Badge variant='light'>
                  {campaign.contentMaturity === 'STANDARD' ? 'Standard' : 'Mature'}
                </Badge>
                <Text size='sm'>
                  {campaign.playerCount} {campaign.playerCount === 1 ? 'player' : 'players'}
                </Text>
              </Group>
              {campaign.role === 'PLAYER' &&
              campaign.status === 'ACTIVE' &&
              !campaign.assignedCharacter ? (
                <Text c='dimmed' size='sm'>
                  Add an eligible Character before play.
                </Text>
              ) : null}
              <Group gap='xs'>
                {campaign.status === 'ACTIVE' && campaign.assignedCharacter ? (
                  <Button
                    onClick={() =>
                      campaign.assignedCharacter
                        ? navigate({
                            to: '/characters/$characterPublicId/$characterSlug',
                            params: buildCharacterRouteParams(
                              campaign.assignedCharacter.publicId,
                              campaign.assignedCharacter.label
                            )
                          })
                        : undefined
                    }
                    size='sm'
                  >
                    Play Character
                  </Button>
                ) : null}
                {campaign.status === 'ACTIVE' &&
                campaign.role === 'PLAYER' &&
                !campaign.assignedCharacter ? (
                  <Button
                    onClick={() =>
                      (() => {
                        const params = buildCampaignRouteParams(campaign.publicId, campaign.name)
                        window.location.assign(
                          `/campaigns/${params.campaignPublicId}/${params.campaignSlug}?action=assign-character&tab=party`
                        )
                      })()
                    }
                    size='sm'
                  >
                    Add Character
                  </Button>
                ) : null}
                <Button
                  onClick={() =>
                    navigate({
                      to: '/campaigns/$campaignPublicId/$campaignSlug',
                      params: buildCampaignRouteParams(campaign.publicId, campaign.name)
                    })
                  }
                  size='sm'
                  variant='default'
                >
                  {campaign.status === 'ARCHIVED'
                    ? 'View archive'
                    : campaign.role === 'OWNER'
                      ? 'Manage'
                      : 'View Campaign'}
                </Button>
                {campaign.role === 'OWNER' ? (
                  <Button onClick={() => setCopySource(campaign)} size='sm' variant='subtle'>
                    Copy
                  </Button>
                ) : null}
              </Group>
              <Text c='dimmed' size='xs'>
                Created{' '}
                {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                  new Date(campaign.createdAt)
                )}
              </Text>
            </article>
          ))}
        </section>
      )}
      <CampaignCopy
        campaigns={campaigns}
        source={copySource}
        onClose={() => setCopySource(null)}
        onOpen={setCopySource}
      />
    </main>
  )
}

function CampaignDeletionProgress({ campaignId }: { campaignId: string }) {
  const status = useQuery({
    ...convexQuery(convexApi.campaigns.deletion.status, { campaignId }),
    retry: false
  })
  const remove = useConvexMutation(convexApi.campaigns.deletion.remove)
  const retry = useMutation({
    mutationFn: () => {
      if (!status.data) throw new Error('Campaign deletion status is unavailable.')
      return remove({
        campaignId,
        expectedVersion: status.data.expectedVersion,
        confirmation: 'DELETE'
      })
    }
  })

  return (
    <section className={sharedStyles.panel} aria-label='Campaign deletion progress'>
      <Group gap='xs'>
        <Title order={2} size='h3'>
          Campaign deletion
        </Title>
        {status.data ? (
          <Badge color={status.data.status === 'FAILED' ? 'red' : 'gray'}>
            {status.data.status === 'DELETING'
              ? 'Deleting'
              : status.data.status === 'FAILED'
                ? 'Failed'
                : 'Deleted'}
          </Badge>
        ) : null}
        {status.isPending || status.data?.status === 'DELETING' ? (
          <Loader aria-label='Deleting Campaign' size='sm' />
        ) : null}
      </Group>
      {status.data?.status === 'DELETING' ? (
        <Text c='dimmed'>The Campaign is inaccessible while its data is removed.</Text>
      ) : null}
      {status.data?.status === 'DELETED' ? <Text>Campaign deleted.</Text> : null}
      {status.data?.status === 'FAILED' ? (
        <>
          <Text c='red'>{status.data.error}</Text>
          <Button loading={retry.isPending} size='sm' onClick={() => retry.mutate()}>
            Retry deletion
          </Button>
        </>
      ) : null}
      {status.isError ? <Alert color='red'>Campaign deletion status is unavailable.</Alert> : null}
      {retry.error ? <Alert color='red'>{retry.error.message}</Alert> : null}
    </section>
  )
}
