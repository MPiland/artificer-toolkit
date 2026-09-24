import { Badge, Group, Text } from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Gamepad2 } from 'lucide-react'
import { useEffect } from 'react'
import { getCampaignSession, useCampaignDetail } from '#app/data/campaigns/queries'
import { CampaignGmRoller } from '../components/CampaignGmRoller'
import { CampaignVttStage } from './CampaignVttStage'
import * as styles from './CampaignTabletopWindow.css'

export function CampaignTabletopWindow({
  campaignId,
  currentUserId,
  sessionNumber
}: {
  campaignId: string
  currentUserId: string
  sessionNumber: number
}) {
  const campaign = useCampaignDetail(campaignId)
  const { data: session } = useSuspenseQuery(getCampaignSession(campaignId, sessionNumber))

  useEffect(() => {
    const previousTitle = document.title
    document.title = `${session.title ?? `Session ${session.sessionNumber}`} tabletop · ${campaign.name}`
    return () => {
      document.title = previousTitle
    }
  }, [campaign.name, session.sessionNumber, session.title])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Group gap='sm' wrap='nowrap'>
          <Gamepad2 aria-hidden size={21} />
          <div className={styles.identity}>
            <Text fw={650} lineClamp={1}>
              {campaign.name}
            </Text>
            <Text c='dimmed' lineClamp={1} size='xs'>
              {session.title ?? `Session ${session.sessionNumber}`}
            </Text>
          </div>
          <Badge size='sm' variant='light'>
            {campaign.role === 'OWNER' ? 'GM' : 'Player'}
          </Badge>
        </Group>
        <Text c='dimmed' size='xs'>
          {campaign.role === 'OWNER' ? 'Live editing available' : 'Play view'}
        </Text>
      </header>
      <div className={styles.stage}>
        <CampaignVttStage campaign={campaign} currentUserId={currentUserId} session={session} />
      </div>
      {campaign.role === 'OWNER' ? <CampaignGmRoller campaignId={campaign.id} /> : null}
    </main>
  )
}
