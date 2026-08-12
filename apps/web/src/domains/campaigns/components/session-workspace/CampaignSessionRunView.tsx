import { Stack, Text, Title } from '@mantine/core'
import type { CampaignDetailDto, CampaignSessionDto } from '#app/lib/api'
import { CampaignSessionAttendance } from '../CampaignSessionAttendance'
import { CampaignFileList } from '../CampaignFiles/CampaignFileList'
import { CampaignSessionEncounters } from '../CampaignSessionEncounters'
import { CampaignSessionPartySummary } from '../CampaignSessionPartySummary'
import { CampaignSessionReferences } from '../CampaignSessionReferences'
import { CampaignSessionSectionGroup } from '../CampaignSessionSectionGroup'
import { CampaignSharedSessionNotes } from '../CampaignSessionNotes'
import { runSessionSectionKinds } from '../campaignSessionSections.model'
import { CampaignSessionPlayerEncounters } from './CampaignSessionPlayerEncounters'
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
  if (campaign.role === 'PLAYER') {
    return (
      <Stack gap='lg'>
        <CampaignSessionPlayerEncounters campaign={campaign} sessionId={session.id} />
        <CampaignFileList
          campaign={campaign}
          currentUserId={currentUserId}
          sessionId={session.id}
        />
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
      <CampaignSessionEncounters
        campaign={campaign}
        currentUserId={currentUserId}
        mode='RUN'
        session={session}
      />
      <CampaignFileList campaign={campaign} currentUserId={currentUserId} sessionId={session.id} />
      <section className={styles.sessionUtilityPanel} aria-label='Session attendance'>
        <CampaignSessionAttendance campaign={campaign} session={session} />
      </section>
      <section className={styles.sessionUtilityPanel} aria-label='Party at a glance'>
        <CampaignSessionPartySummary
          campaign={campaign}
          currentUserId={currentUserId}
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
