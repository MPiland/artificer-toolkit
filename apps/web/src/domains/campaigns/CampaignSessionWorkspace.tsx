import { Select, Tabs } from '@mantine/core'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { getCampaignSession, useCampaignDetail } from '#app/data/campaigns/queries'
import { getCampaignEncounters } from '#app/data/encounters/queries'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import { CampaignGmRoller } from './components/CampaignGmRoller'
import { CampaignSessionCloseoutView } from './components/session-workspace/CampaignSessionCloseoutView'
import { CampaignSessionHeader } from './components/session-workspace/CampaignSessionHeader'
import { CampaignSessionPrepareView } from './components/session-workspace/CampaignSessionPrepareView'
import { CampaignSessionRunView } from './components/session-workspace/CampaignSessionRunView'
import { getSessionWorkspaceViews, type SessionWorkspaceView } from './campaignAccess'
import * as styles from './campaigns.css'

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
  const campaign = useCampaignDetail(campaignId)
  const { data: session } = useSuspenseQuery(getCampaignSession(campaign.id, sessionNumber))
  const encounters = useQuery({
    ...getCampaignEncounters(campaign.id),
    enabled: campaign.role === 'OWNER'
  })
  const views = useMemo<SessionWorkspaceView[]>(
    () => getSessionWorkspaceViews(campaign.role, session.status),
    [campaign.role, session.status]
  )
  const [selectedView, setActiveView] = useState<SessionWorkspaceView>(views[0])
  const hasActiveEncounter =
    campaign.role === 'OWNER' &&
    session.status === 'OPEN' &&
    Boolean(encounters.data?.some((encounter) => encounter.status === 'ACTIVE'))
  const [sawActiveEncounter, setSawActiveEncounter] = useState(false)
  let activeView = selectedView
  if (!views.includes(activeView)) {
    activeView = views[0]
    setActiveView(activeView)
  }
  if (hasActiveEncounter !== sawActiveEncounter) {
    setSawActiveEncounter(hasActiveEncounter)
    if (hasActiveEncounter && activeView === 'PREPARE') {
      activeView = 'RUN'
      setActiveView(activeView)
    }
  }

  function updateSession(updated: CampaignSessionDto) {
    queryClient.setQueryData(getCampaignSession(campaign.id, sessionNumber).queryKey, updated)
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
      {campaign.capabilities.manageActiveCampaign ? (
        <CampaignGmRoller campaignId={campaign.id} rollModes={campaign.rollModes} />
      ) : null}
    </main>
  )
}
