import { Stack, Text, Title } from '@mantine/core'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import { CampaignEncounters } from '../CampaignEncounters'
import { CampaignSessionReferences } from '../CampaignSessionReferences'
import { CampaignSessionSchedulePanel } from '../CampaignSessionSchedulePanel'
import { CampaignSessionSectionGroup } from '../CampaignSessionSectionGroup'
import { prepareSessionSectionKinds } from '../campaignSessionSections.model'
import { CampaignScenePreparation } from '../../vtt/CampaignScenePreparation'
import { useCampaignLiveSummary } from '../../vtt/useCampaignLiveSummary'
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
  const liveSummary = useCampaignLiveSummary(campaign.id)
  return (
    <Stack gap='lg'>
      <CampaignScenePreparation
        campaignId={campaign.id}
        currentUserId={currentUserId}
        gameSystemId={campaign.gameSystemId}
        memberships={campaign.memberships}
      />
      <section className={styles.sessionUtilityPanel} aria-label='Schedule and RSVP'>
        <CampaignSessionSchedulePanel
          key={session.id}
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
      <CampaignEncounters
        campaign={campaign}
        currentUserId={currentUserId}
        liveSummary={liveSummary}
        mode='PREPARE'
      />
    </Stack>
  )
}
