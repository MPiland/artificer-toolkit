import {
  Alert,
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { IconChevronLeft } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { getCampaignDetail, getCampaignSession } from '#app/data/campaigns/queries'
import { getCampaignEncounters } from '#app/data/encounters/queries'
import { api, type CampaignSessionDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'
import { CampaignChatDrawer } from './components/CampaignChatDrawer'
import { CampaignGmRoller } from './components/CampaignGmRoller'
import { CampaignLiveControls } from './components/CampaignLiveControls'
import { CampaignSessionEncounters } from './components/CampaignSessionEncounters'
import { CampaignSessionAttendance } from './components/CampaignSessionAttendance'
import { CampaignSessionPartySummary } from './components/CampaignSessionPartySummary'
import { CampaignSessionReferences } from './components/CampaignSessionReferences'
import { CampaignSessionSchedulePanel } from './components/CampaignSessionSchedulePanel'
import { CampaignSessionSectionGroup } from './components/CampaignSessionSectionGroup'
import {
  closeoutSessionSectionKinds,
  prepareSessionSectionKinds,
  runSessionSectionKinds
} from './components/campaignSessionSections.model'
import * as sharedStyles from './campaigns.css'
import * as sessionsStyles from './campaignSessions.css'

type SessionWorkspaceView = 'PREPARE' | 'RUN' | 'CLOSEOUT'

const sessionViewLabels: Record<SessionWorkspaceView, string> = {
  PREPARE: 'Prepare',
  RUN: 'Run',
  CLOSEOUT: 'Closeout'
}

export function CampaignSessionWorkspace({
  campaignId,
  currentUserId,
  sessionNumber
}: {
  campaignId: string
  currentUserId: string
  sessionNumber: number
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: campaign } = useSuspenseQuery(getCampaignDetail(campaignId))
  const { data: session } = useSuspenseQuery(getCampaignSession(campaign.id, sessionNumber))
  const encounters = useQuery(getCampaignEncounters(campaign.id))
  const [sessionTitle, setSessionTitle] = useState(session.title ?? '')
  const [activeView, setActiveView] = useState<SessionWorkspaceView>(
    session.status === 'FINISHED' ? 'CLOSEOUT' : 'PREPARE'
  )
  const canManage = campaign.role === 'OWNER' && campaign.status === 'ACTIVE'
  useEffect(() => {
    setSessionTitle(session.title ?? '')
  }, [session.title])
  useEffect(() => {
    const hasActiveEncounter = encounters.data?.some(
      (encounter) => encounter.sessionId === session.id && encounter.status === 'ACTIVE'
    )
    if (hasActiveEncounter) setActiveView((current) => (current === 'PREPARE' ? 'RUN' : current))
  }, [encounters.data, session.id])
  const updateSession = useMutation({
    mutationFn: () =>
      api.campaigns.sessions.update({
        campaignId: campaign.id,
        sessionId: session.id,
        expectedVersion: session.version,
        title: sessionTitle.trim() || null
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.campaigns.session(campaign.id, sessionNumber), updated)
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.sessions(campaign.id) })
    }
  })
  const changeSessionStatus = useMutation({
    mutationFn: (action: 'FINISH' | 'REOPEN') =>
      action === 'FINISH'
        ? api.campaigns.sessions.finish({
            campaignId: campaign.id,
            sessionId: session.id,
            commandId: crypto.randomUUID(),
            expectedVersion: session.version
          })
        : api.campaigns.sessions.reopen({
            campaignId: campaign.id,
            sessionId: session.id,
            commandId: crypto.randomUUID(),
            expectedVersion: session.version
          }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.campaigns.session(campaign.id, sessionNumber), updated)
      setActiveView('CLOSEOUT')
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.sessions(campaign.id) })
    }
  })

  function updateSessionCache(updated: CampaignSessionDto) {
    queryClient.setQueryData(queryKeys.campaigns.session(campaign.id, sessionNumber), updated)
  }

  function commitTitle() {
    if (!canManage || updateSession.isPending) return
    if ((sessionTitle.trim() || null) === session.title) return
    updateSession.mutate()
  }

  return (
    <main className={sharedStyles.page}>
      <header className={sessionsStyles.sessionHeader}>
        <div className={sessionsStyles.sessionHeaderIdentity}>
          <Button
            className={sessionsStyles.sessionBack}
            leftSection={<IconChevronLeft aria-hidden size={15} />}
            size='compact-sm'
            variant='subtle'
            onClick={() =>
              navigate({
                to: '/campaigns/$campaignPublicId/$campaignSlug',
                params: buildCampaignRouteParams(campaign.publicId, campaign.name)
              })
            }
          >
            {campaign.name}
          </Button>
          <TextInput
            aria-label='Session name'
            className={sessionsStyles.sessionTitleField}
            classNames={{ input: sessionsStyles.sessionTitleInput }}
            disabled={!canManage || updateSession.isPending}
            placeholder={sessionLabel(session)}
            value={sessionTitle}
            onBlur={commitTitle}
            onChange={(event) => setSessionTitle(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
          <Group align='center' gap='xs' wrap='wrap'>
            <Badge color={session.status === 'OPEN' ? 'green' : 'gray'}>
              {session.status === 'OPEN' ? 'Open' : 'Finished'}
            </Badge>
            <Text c='dimmed' size='sm'>
              {formatSessionSchedule(session)}
            </Text>
          </Group>
        </div>
        <div className={sessionsStyles.sessionHeaderUtilities}>
          <CampaignLiveControls campaign={campaign} />
          {campaign.capabilities.readTableChat ? (
            <CampaignChatDrawer
              campaignId={campaign.id}
              currentUserId={currentUserId}
              trigger='icon'
            />
          ) : null}
        </div>
      </header>
      {updateSession.error ? (
        <Alert color='red'>Session name couldn’t be saved. Your edit is still here.</Alert>
      ) : null}
      <Select
        className={sharedStyles.campaignSectionSelect}
        classNames={{ input: sharedStyles.input }}
        data={(Object.keys(sessionViewLabels) as SessionWorkspaceView[]).map((value) => ({
          label: sessionViewLabels[value],
          value
        }))}
        label='Session view'
        value={activeView}
        onChange={(value) => {
          if (value === 'PREPARE' || value === 'RUN' || value === 'CLOSEOUT') setActiveView(value)
        }}
      />
      <Tabs
        className={sharedStyles.detailWorkspace}
        keepMounted={false}
        value={activeView}
        onChange={(value) => {
          if (value === 'PREPARE' || value === 'RUN' || value === 'CLOSEOUT') setActiveView(value)
        }}
      >
        <Tabs.List className={sharedStyles.detailTabs} aria-label='Session workspace'>
          {(Object.keys(sessionViewLabels) as SessionWorkspaceView[]).map((value) => (
            <Tabs.Tab className={sharedStyles.detailTab} key={value} value={value}>
              {sessionViewLabels[value]}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value='PREPARE' pt='md'>
          <Stack gap='lg'>
            <section className={sessionsStyles.sessionUtilityPanel} aria-label='Schedule and RSVP'>
              <CampaignSessionSchedulePanel
                campaign={campaign}
                currentUserId={currentUserId}
                session={session}
                onUpdated={updateSessionCache}
              />
            </section>
            <section
              className={sessionsStyles.sessionUtilityPanel}
              aria-labelledby='session-plan-title'
            >
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
            <section className={sessionsStyles.sessionUtilityPanel} aria-label='Pinned references'>
              <CampaignSessionReferences campaign={campaign} sessionId={session.id} />
            </section>
            <CampaignSessionEncounters
              campaign={campaign}
              currentUserId={currentUserId}
              mode='PREPARE'
              session={session}
            />
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value='RUN' pt='md'>
          <Stack gap='lg'>
            <CampaignSessionEncounters
              campaign={campaign}
              currentUserId={currentUserId}
              mode='RUN'
              session={session}
            />
            <section className={sessionsStyles.sessionUtilityPanel} aria-label='Session attendance'>
              <CampaignSessionAttendance campaign={campaign} session={session} />
            </section>
            <section className={sessionsStyles.sessionUtilityPanel} aria-label='Party at a glance'>
              <CampaignSessionPartySummary
                campaign={campaign}
                currentUserId={currentUserId}
                sessionId={session.id}
              />
            </section>
            <section
              className={sessionsStyles.sessionUtilityPanel}
              aria-labelledby='session-current-plan-title'
            >
              <div>
                <Title id='session-current-plan-title' order={2}>
                  Current plan & capture
                </Title>
                <Text c='dimmed' size='sm'>
                  Keep planned beats and live scratch notes within reach.
                </Text>
              </div>
              <CampaignSessionSectionGroup
                campaign={campaign}
                kinds={runSessionSectionKinds}
                sessionId={session.id}
              />
            </section>
            <section className={sessionsStyles.sessionUtilityPanel} aria-label='Pinned references'>
              <CampaignSessionReferences campaign={campaign} sessionId={session.id} />
            </section>
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value='CLOSEOUT' pt='md'>
          <Stack gap='lg'>
            <section
              className={sessionsStyles.sessionUtilityPanel}
              aria-labelledby='session-closeout-title'
            >
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
            <section className={sessionsStyles.sessionCompletion} aria-label='Session status'>
              <Group align='center' justify='space-between' wrap='wrap'>
                <div>
                  <Text fw={700}>
                    {session.status === 'OPEN' ? 'Finish this Session' : 'Session finished'}
                  </Text>
                  <Text c='dimmed' size='sm'>
                    {session.status === 'OPEN'
                      ? 'Closeout may be empty. Attendance, notes, references, and encounters remain as history.'
                      : 'Reopen if the table needs to continue or the historical state needs correction.'}
                  </Text>
                </div>
                <Button
                  loading={changeSessionStatus.isPending}
                  variant={session.status === 'OPEN' ? 'filled' : 'default'}
                  onClick={() =>
                    changeSessionStatus.mutate(session.status === 'OPEN' ? 'FINISH' : 'REOPEN')
                  }
                >
                  {session.status === 'OPEN' ? 'Finish session' : 'Reopen session'}
                </Button>
              </Group>
              {changeSessionStatus.error ? (
                <Alert color='red'>The Session status couldn’t be changed.</Alert>
              ) : null}
            </section>
          </Stack>
        </Tabs.Panel>
      </Tabs>
      {campaign.role === 'OWNER' && campaign.status === 'ACTIVE' ? (
        <CampaignGmRoller campaignId={campaign.id} />
      ) : null}
    </main>
  )
}

function sessionLabel(session: CampaignSessionDto) {
  if (session.title) return session.title
  if (session.scheduledStartAt)
    return `Session ${formatSessionDate(session.scheduledStartAt, session.timeZone)}`
  return `Session ${session.sessionNumber}`
}

function formatSessionSchedule(session: CampaignSessionDto) {
  if (!session.scheduledStartAt || !session.scheduledEndAt || !session.timeZone) {
    return 'Not scheduled'
  }
  const day = formatSessionDate(session.scheduledStartAt, session.timeZone)
  const start = formatSessionTime(session.scheduledStartAt, session.timeZone)
  const end = formatSessionTime(session.scheduledEndAt, session.timeZone)
  return `${day} · ${start}–${end} · ${session.timeZone}`
}

function formatSessionDate(value: string, timeZone: string | null) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {})
  }).format(new Date(value))
}

function formatSessionTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone
  }).format(new Date(value))
}
