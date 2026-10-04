import { Stack, Text, Title } from '@mantine/core'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import { CampaignSessionAttendance } from '../CampaignSessionAttendance'
import { CampaignEncounters } from '../CampaignEncounters'
import { CampaignSessionPartySummary } from '../CampaignSessionPartySummary'
import { CampaignSessionReferences } from '../CampaignSessionReferences'
import { CampaignSessionSectionGroup } from '../CampaignSessionSectionGroup'
import { CampaignSharedSessionNotes } from '../CampaignSessionNotes'
import { runSessionSectionKinds } from '../campaignSessionSections.model'
import { CampaignPlayerEncounterDecisions } from './CampaignPlayerEncounterDecisions'
import { CampaignTabletopLauncher } from '../../vtt/CampaignTabletopLauncher'
import { useCampaignLiveSummary } from '../../vtt/useCampaignLiveSummary'
import * as styles from '../../campaignSessions.css'

export function CampaignSessionRunView({
  campaign,
  currentUserId,
  session
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  session: CampaignSessionDto
}) {
  // Players' Encounter list follows the summary on its own connection.
  const liveSummary = useCampaignLiveSummary(campaign.role === 'OWNER' ? campaign.id : undefined)
  if (campaign.role === 'PLAYER') {
    return (
      <Stack gap='lg'>
        <CampaignTabletopLauncher campaign={campaign} />
        <CampaignPlayerEncounterDecisions campaign={campaign} />
        <section className={styles.sessionUtilityPanel} aria-label='Shared Session notes'>
          <CampaignSharedSessionNotes
            campaign={campaign}
            currentUserId={currentUserId}
            sessionId={session.id}
          />
        </section>
        <section className={styles.sessionUtilityPanel} aria-label='Pinned references'>
          <CampaignSessionReferences campaign={campaign} editable={false} sessionId={session.id} />
        </section>
      </Stack>
    )
  }

  return (
    <Stack gap='lg'>
      <CampaignTabletopLauncher campaign={campaign} />
      <CampaignEncounters
        campaign={campaign}
        currentUserId={currentUserId}
        liveSummary={liveSummary}
        mode='RUN'
      />
      <section className={styles.sessionUtilityPanel} aria-label='Session attendance'>
        <CampaignSessionAttendance campaign={campaign} session={session} />
      </section>
      <section className={styles.sessionUtilityPanel} aria-label='Party at a glance'>
        <CampaignSessionPartySummary
          campaign={campaign}
          currentUserId={currentUserId}
          liveSummary={liveSummary}
          sessionId={session.id}
        />
      </section>
      <section className={styles.sessionUtilityPanel} aria-labelledby='session-current-plan-title'>
        <div>
          <Title id='session-current-plan-title' order={2}>
            Session notes
          </Title>
          <Text c='dimmed' size='sm'>
            Review your plan and write notes during play.
          </Text>
        </div>
        <CampaignSessionSectionGroup
          campaign={campaign}
          kinds={runSessionSectionKinds}
          sessionId={session.id}
        />
      </section>
      <section className={styles.sessionUtilityPanel} aria-label='Pinned references'>
        <CampaignSessionReferences campaign={campaign} sessionId={session.id} />
      </section>
    </Stack>
  )
}
