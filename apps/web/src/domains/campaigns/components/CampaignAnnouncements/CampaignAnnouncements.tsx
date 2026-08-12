import { Alert, Badge, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { CampaignDetailDto } from '#app/lib/api'
import { getCampaignAnnouncement, getCampaignAnnouncements } from '#app/data/campaigns/queries'
import { CampaignAnnouncementComposer } from './CampaignAnnouncementComposer'
import * as styles from './CampaignAnnouncements.css'

export function CampaignAnnouncements({ campaign }: { campaign: CampaignDetailDto }) {
  const announcements = useQuery(getCampaignAnnouncements(campaign.id))
  const [requestedAnnouncementId] = useState(() =>
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('announcementPublicId')
  )
  const requested = useQuery({
    ...getCampaignAnnouncement(campaign.id, requestedAnnouncementId ?? ''),
    enabled: Boolean(requestedAnnouncementId)
  })
  useEffect(() => {
    if (!requested.data) return
    document
      .getElementById(`announcement-${requested.data.announcementPublicId}`)
      ?.scrollIntoView({ block: 'center' })
  }, [requested.data])
  return (
    <div className={styles.layout}>
      {campaign.role === 'OWNER' && campaign.status === 'ACTIVE' ? (
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
        {announcements.isPending ? <Loader aria-label='Loading announcements' size='sm' /> : null}
        {announcements.error ? <Alert color='red'>Announcements couldn’t be loaded.</Alert> : null}
        <Stack gap={0}>
          {announcements.data?.map((announcement) => (
            <article
              className={styles.announcement}
              id={`announcement-${announcement.announcementPublicId}`}
              key={announcement.announcementPublicId}
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
        {!announcements.isPending && !announcements.error && announcements.data?.length === 0 ? (
          <Text c='dimmed'>No announcements yet.</Text>
        ) : null}
      </section>
    </div>
  )
}
