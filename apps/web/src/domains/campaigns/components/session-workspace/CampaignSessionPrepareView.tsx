import { Stack, Text, Title } from '@mantine/core'
import type { CampaignDetailDto, CampaignSessionDto } from '#app/lib/api'
import { CampaignSessionEncounters } from '../CampaignSessionEncounters'
import { CampaignFileList } from '../CampaignFiles/CampaignFileList'
import { CampaignSessionReferences } from '../CampaignSessionReferences'
import { CampaignSessionSchedulePanel } from '../CampaignSessionSchedulePanel'
import { CampaignSessionSectionGroup } from '../CampaignSessionSectionGroup'
import { prepareSessionSectionKinds } from '../campaignSessionSections.model'
import { CampaignScenePreparation } from '../../vtt/CampaignScenePreparation'
import * as styles from '../../campaignSessions.css'

export function CampaignSessionPrepareView({
  campaign,
  currentUserId,
  session,
  onUpdated
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  session: CampaignSessionDto
  onUpdated: (session: CampaignSessionDto) => void
}) {
  return (
    <Stack gap='lg'>
      <CampaignScenePreparation
        campaignId={campaign.id}
        currentUserId={currentUserId}
        memberships={campaign.memberships}
      />
      <section className={styles.sessionUtilityPanel} aria-label='Schedule and RSVP'>
        <CampaignSessionSchedulePanel
          campaign={campaign}
          currentUserId={currentUserId}
          session={session}
          onUpdated={onUpdated}
        />
      </section>
      <section className={styles.sessionUtilityPanel} aria-labelledby='session-plan-title'>
        <div>
          <Title id='session-plan-title' order={2}>
            Session plan
          </Title>
          <Text c='dimmed' size='sm'>
            Add only the preparation sections this Session needs.
          </Text>
        </div>
        <CampaignSessionSectionGroup
          campaign={campaign}
          kinds={prepareSessionSectionKinds}
          sessionId={session.id}
        />
      </section>
      <section className={styles.sessionUtilityPanel} aria-label='Pinned references'>
        <CampaignSessionReferences campaign={campaign} sessionId={session.id} />
      </section>
      <CampaignFileList campaign={campaign} currentUserId={currentUserId} sessionId={session.id} />
      <CampaignSessionEncounters
        campaign={campaign}
        currentUserId={currentUserId}
        mode='PREPARE'
        session={session}
      />
    </Stack>
  )
}
