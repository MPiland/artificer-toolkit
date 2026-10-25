import { Alert, Badge, Button, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useEffect, useRef } from 'react'
import { usePaginatedQuery } from 'convex/react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { CampaignAnnouncementComposer } from './CampaignAnnouncementComposer'
import * as styles from './CampaignAnnouncements.css'

export function CampaignAnnouncements({
  campaign,
  announcementPublicId
}: {
  campaign: CampaignDetailDto
  announcementPublicId?: string | null
}) {
  const announcements = usePaginatedQuery(
    convexApi.campaigns.announcements.list,
    { campaignId: campaign.id },
    { initialNumItems: 48 }
  )
  const deepLinkedAnnouncement = useQuery(
    convexQuery(
      convexApi.campaigns.announcements.get,
      announcementPublicId ? { campaignId: campaign.id, announcementPublicId } : 'skip'
    )
  )
  const selectedAnnouncement =
    deepLinkedAnnouncement.data ??
    announcements.results.find(
      (announcement) => announcement.announcementPublicId === announcementPublicId
    )
  const displayedAnnouncements =
    deepLinkedAnnouncement.data &&
    !announcements.results.some(
      (announcement) =>
        announcement.announcementPublicId === deepLinkedAnnouncement.data?.announcementPublicId
    )
      ? [deepLinkedAnnouncement.data, ...announcements.results]
      : announcements.results
  const focusedAnnouncementPublicId = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedAnnouncement) return
    if (focusedAnnouncementPublicId.current === selectedAnnouncement.announcementPublicId) return
    const element = document.getElementById(
      `announcement-${selectedAnnouncement.announcementPublicId}`
    )
    if (!element) return
    focusedAnnouncementPublicId.current = selectedAnnouncement.announcementPublicId
    element.focus({ preventScroll: true })
    element.scrollIntoView({ block: 'center' })
  }, [selectedAnnouncement])

  return (
    <div className={styles.layout}>
      {campaign.capabilities.manageActiveCampaign ? (
        <CampaignAnnouncementComposer campaignId={campaign.id} />
      ) : null}
      <section className={styles.panel} aria-labelledby='campaign-announcements-title'>
        <div>
          <Title id='campaign-announcements-title' order={2}>
            Announcements
          </Title>
          <Text c='dimmed' size='sm'>
            Updates published for current Campaign members.
          </Text>
        </div>
        {announcements.status === 'LoadingFirstPage' ? (
          <Loader aria-label='Loading announcements' size='sm' />
        ) : null}
        {deepLinkedAnnouncement.isError ? (
          <Alert color='red'>That announcement is unavailable.</Alert>
        ) : null}
        <Stack gap={0}>
          {displayedAnnouncements.map((announcement) => (
            <article
              className={styles.announcement}
              id={`announcement-${announcement.announcementPublicId}`}
              key={announcement.announcementPublicId}
              aria-current={
                announcement.announcementPublicId === selectedAnnouncement?.announcementPublicId
                  ? 'true'
                  : undefined
              }
              tabIndex={
                announcement.announcementPublicId === selectedAnnouncement?.announcementPublicId
                  ? -1
                  : undefined
              }
            >
              <Group justify='space-between' wrap='wrap'>
                <Title order={3}>{announcement.title}</Title>
                <Badge variant='light'>{announcement.scope === 'TABLE' ? 'Table' : 'Party'}</Badge>
              </Group>
              <Text className={styles.body}>{announcement.body}</Text>
              <Text c='dimmed' size='xs'>
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                }).format(new Date(announcement.createdAt))}
              </Text>
            </article>
          ))}
        </Stack>
        {announcements.status === 'Exhausted' && displayedAnnouncements.length === 0 ? (
          <Text c='dimmed'>No announcements yet.</Text>
        ) : null}
        {announcements.status === 'CanLoadMore' ? (
          <Button variant='subtle' onClick={() => announcements.loadMore(48)}>
            Load more announcements
          </Button>
        ) : null}
        {announcements.status === 'LoadingMore' ? (
          <Loader aria-label='Loading more announcements' size='sm' />
        ) : null}
      </section>
    </div>
  )
}
