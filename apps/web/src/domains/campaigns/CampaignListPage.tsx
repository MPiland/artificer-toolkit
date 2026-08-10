import { Badge, Button, Group, Text, Title } from '@mantine/core'
import { Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { getCampaignList } from '#app/data/campaigns/queries'
import {
  buildCampaignRouteParams,
  buildCharacterRouteParams
} from '#app/routing/authoredRouteParams'
import { richHtmlToPlainText } from '#app/lib/richText'
import * as sharedStyles from './campaigns.css'

export function CampaignListPage() {
  const navigate = useNavigate()
  const { data } = useSuspenseQuery(getCampaignList())
  const campaigns = [...data].sort((left, right) => {
    if (left.status !== right.status) return left.status === 'ACTIVE' ? -1 : 1
    return left.name.localeCompare(right.name)
  })

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

      {campaigns.length === 0 ? (
        <section className={sharedStyles.panel} aria-label='No Campaigns'>
          <Title order={2}>Start your first table</Title>
          <Text c='dimmed'>Create a Campaign, then invite your players.</Text>
        </section>
      ) : (
        <section className={sharedStyles.cards} aria-label='Campaign list'>
          {campaigns.map((campaign) => (
            <article
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
                <Text size='sm'>
                  {campaign.playerCount} {campaign.playerCount === 1 ? 'player' : 'players'}
                </Text>
                <Text size='sm' c='dimmed'>
                  {campaign.visibility === 'PUBLIC' ? 'Public' : 'Private'}
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
                {campaign.status === 'ACTIVE' &&
                campaign.role === 'PLAYER' &&
                campaign.assignedCharacter ? (
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
              </Group>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
