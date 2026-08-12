import { Select, Tabs } from '@mantine/core'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { getCampaignDetail, getCampaignSession } from '#app/data/campaigns/queries'
import { getCampaignEncounters } from '#app/data/encounters/queries'
import type { CampaignDetailDto, CampaignSessionDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { CampaignGmRoller } from './components/CampaignGmRoller'
import { CampaignSessionCloseoutView } from './components/session-workspace/CampaignSessionCloseoutView'
import { CampaignSessionHeader } from './components/session-workspace/CampaignSessionHeader'
import { CampaignSessionPrepareView } from './components/session-workspace/CampaignSessionPrepareView'
import { CampaignSessionRunView } from './components/session-workspace/CampaignSessionRunView'
import * as styles from './campaigns.css'

export type SessionWorkspaceView = 'PREPARE' | 'RUN' | 'CLOSEOUT'

const labels: Record<SessionWorkspaceView, string> = {
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
  const queryClient = useQueryClient()
  const { data: campaign } = useSuspenseQuery(getCampaignDetail(campaignId))
  const { data: session } = useSuspenseQuery(getCampaignSession(campaign.id, sessionNumber))
  const encounters = useQuery(getCampaignEncounters(campaign.id))
  const views = useMemo<SessionWorkspaceView[]>(
    () => getSessionWorkspaceViews(campaign.role, session.status),
    [campaign.role, session.status]
  )
  const [activeView, setActiveView] = useState<SessionWorkspaceView>(views[0])

  useEffect(() => {
    if (!views.includes(activeView)) setActiveView(views[0])
  }, [activeView, views])
  useEffect(() => {
    if (campaign.role !== 'OWNER') return
    const active = encounters.data?.some(
      (encounter) => encounter.sessionId === session.id && encounter.status === 'ACTIVE'
    )
    if (active) setActiveView((current) => (current === 'PREPARE' ? 'RUN' : current))
  }, [campaign.role, encounters.data, session.id])

  function updateSession(updated: CampaignSessionDto) {
    queryClient.setQueryData(queryKeys.campaigns.session(campaign.id, sessionNumber), updated)
    if (updated.status === 'FINISHED') setActiveView('CLOSEOUT')
  }

  return (
    <main className={styles.page}>
      <CampaignSessionHeader
        campaign={campaign}
        currentUserId={currentUserId}
        session={session}
        onUpdated={updateSession}
      />
      {views.length > 1 ? (
        <Select
          className={styles.campaignSectionSelect}
          classNames={{ input: styles.input }}
          data={views.map((value) => ({ label: labels[value], value }))}
          label='Session view'
          value={activeView}
          onChange={(value) => {
            const view = views.find((candidate) => candidate === value)
            if (view) setActiveView(view)
          }}
        />
      ) : null}
      <Tabs
        className={styles.detailWorkspace}
        keepMounted={false}
        value={activeView}
        onChange={(value) => {
          const view = views.find((candidate) => candidate === value)
          if (view) setActiveView(view)
        }}
      >
        {views.length > 1 ? (
          <Tabs.List className={styles.detailTabs} aria-label='Session workspace'>
            {views.map((value) => (
              <Tabs.Tab className={styles.detailTab} key={value} value={value}>
                {labels[value]}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        ) : null}
        {campaign.role === 'OWNER' ? (
          <Tabs.Panel value='PREPARE' pt='md'>
            <CampaignSessionPrepareView
              campaign={campaign}
              currentUserId={currentUserId}
              session={session}
              onUpdated={updateSession}
            />
          </Tabs.Panel>
        ) : null}
        <Tabs.Panel value='RUN' pt='md'>
          <CampaignSessionRunView
            campaign={campaign}
            currentUserId={currentUserId}
            session={session}
          />
        </Tabs.Panel>
        <Tabs.Panel value='CLOSEOUT' pt='md'>
          <CampaignSessionCloseoutView
            campaign={campaign}
            currentUserId={currentUserId}
            session={session}
            onUpdated={updateSession}
          />
        </Tabs.Panel>
      </Tabs>
      {campaign.role === 'OWNER' && campaign.status === 'ACTIVE' ? (
        <CampaignGmRoller campaignId={campaign.id} />
      ) : null}
    </main>
  )
}

export function getSessionWorkspaceViews(
  role: CampaignDetailDto['role'],
  status: CampaignSessionDto['status']
): SessionWorkspaceView[] {
  return role === 'OWNER'
    ? ['PREPARE', 'RUN', 'CLOSEOUT']
    : [status === 'OPEN' ? 'RUN' : 'CLOSEOUT']
}
