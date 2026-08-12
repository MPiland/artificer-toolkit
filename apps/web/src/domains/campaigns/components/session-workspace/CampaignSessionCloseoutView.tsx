import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CampaignDetailDto, CampaignSessionDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { CampaignSessionReferences } from '../CampaignSessionReferences'
import { CampaignFileList } from '../CampaignFiles/CampaignFileList'
import { CampaignSessionSectionGroup } from '../CampaignSessionSectionGroup'
import { CampaignSharedSessionNotes } from '../CampaignSessionNotes'
import { closeoutSessionSectionKinds } from '../campaignSessionSections.model'
import * as styles from '../../campaignSessions.css'

export function CampaignSessionCloseoutView({
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
  const queryClient = useQueryClient()
  const finish = useMutation({
    mutationFn: () =>
      api.campaigns.sessions.finish({
        campaignId: campaign.id,
        sessionId: session.id,
        commandId: crypto.randomUUID(),
        expectedVersion: session.version
      }),
    onSuccess: async (updated) => {
      onUpdated(updated)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.sessions(campaign.id)
      })
    }
  })

  if (campaign.role === 'PLAYER') {
    return (
      <Stack gap='lg'>
        <section className={styles.sessionUtilityPanel} aria-label='Shared Session history'>
          <CampaignSharedSessionNotes
            campaign={campaign}
            currentUserId={currentUserId}
            sessionId={session.id}
          />
        </section>
        <CampaignFileList
          campaign={campaign}
          currentUserId={currentUserId}
          sessionId={session.id}
        />
        <section className={styles.sessionUtilityPanel} aria-label='Pinned references'>
          <CampaignSessionReferences campaign={campaign} editable={false} sessionId={session.id} />
        </section>
      </Stack>
    )
  }

  return (
    <Stack gap='lg'>
      <section className={styles.sessionUtilityPanel} aria-labelledby='session-closeout-title'>
        <div>
          <Title id='session-closeout-title' order={2}>
            Closeout record
          </Title>
          <Text c='dimmed' size='sm'>
            Capture what changed and what should carry into the next Session.
          </Text>
        </div>
        <CampaignSessionSectionGroup
          campaign={campaign}
          kinds={closeoutSessionSectionKinds}
          sessionId={session.id}
        />
      </section>
      <CampaignFileList campaign={campaign} currentUserId={currentUserId} sessionId={session.id} />
      {session.status === 'OPEN' ? (
        <section className={styles.sessionCompletion} aria-label='Session status'>
          <Group align='center' justify='space-between' wrap='wrap'>
            <div>
              <Text fw={700}>Finish this Session</Text>
              <Text c='dimmed' size='sm'>
                Attendance, notes, references, and encounters remain as history.
              </Text>
            </div>
            <Button loading={finish.isPending} onClick={() => finish.mutate()}>
              Finish session
            </Button>
          </Group>
          {finish.error ? <Alert color='red'>The Session couldn’t be finished.</Alert> : null}
        </section>
      ) : (
        <Text c='dimmed'>This Session is finished. Shared notes remain editable.</Text>
      )}
    </Stack>
  )
}
