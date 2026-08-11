import { Alert, Badge, Group, Select, Tabs, Title } from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import { useCampaignRealtime } from '#app/data/campaigns/useCampaignRealtime'
import { getCampaignTabs, type CampaignTab } from './campaignAccess'
import { CampaignSettings } from './components/CampaignSettings'
import { CampaignChatDrawer } from './components/CampaignChatDrawer'
import { CampaignNotes } from './components/CampaignNotes'
import { CampaignInventory } from './components/CampaignInventory'
import { CampaignContent } from './components/CampaignContent'
import { CampaignParty } from './components/CampaignParty'
import { CampaignLiveControls } from './components/CampaignLiveControls'
import { CampaignSessions } from './components/CampaignSessions'
import { CampaignGmRoller } from './components/CampaignGmRoller'
import * as sharedStyles from './campaigns.css'

const tabLabels: Record<CampaignTab, string> = {
  sessions: 'Sessions',
  party: 'Party',
  notes: 'Notes',
  inventory: 'Inventory',
  content: 'Content',
  settings: 'Settings'
}

export function CampaignDetailPage({
  campaignId,
  currentUserId
}: {
  campaignId: string
  currentUserId: string
}) {
  const { data: campaign } = useSuspenseQuery(getCampaignDetail(campaignId))
  const tabs = getCampaignTabs(campaign)
  const [activeTab, setActiveTab] = useState<CampaignTab>(tabs[0])
  const [openCharacterPicker, setOpenCharacterPicker] = useState(false)
  useCampaignRealtime(campaign, currentUserId)

  useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    const requestedTab = search.get('tab')
    if (requestedTab && tabs.includes(requestedTab as CampaignTab))
      setActiveTab(requestedTab as CampaignTab)
    if (search.get('action') === 'assign-character') setOpenCharacterPicker(true)
    if (!requestedTab && search.get('action') !== 'assign-character') return
    window.history.replaceState({}, '', window.location.pathname)
  }, [tabs])

  return (
    <main className={sharedStyles.page}>
      <header className={sharedStyles.pageHeader}>
        <div>
          <Group gap='xs'>
            <Title className={sharedStyles.campaignTitle} order={1}>
              {campaign.name}
            </Title>
            <Badge variant='light'>{campaign.role === 'OWNER' ? 'GM' : 'Player'}</Badge>
            <Badge color={campaign.status === 'ACTIVE' ? 'green' : 'gray'}>
              {campaign.status === 'ACTIVE' ? 'Active' : 'Archived'}
            </Badge>
          </Group>
        </div>
        <div className={sharedStyles.headerActions}>
          <Group gap='xs'>
            <CampaignLiveControls campaign={campaign} />
            {campaign.capabilities.readTableChat ? (
              <CampaignChatDrawer
                campaignId={campaign.id}
                currentUserId={currentUserId}
                realtime={false}
                trigger='icon'
              />
            ) : null}
          </Group>
        </div>
      </header>
      {campaign.status === 'ARCHIVED' ? (
        <Alert color='gray' title='Archived Campaign'>
          This Campaign is read-only.
        </Alert>
      ) : null}
      <Select
        className={sharedStyles.campaignSectionSelect}
        classNames={{ input: sharedStyles.input }}
        data={tabs.map((tab) => ({ label: tabLabels[tab], value: tab }))}
        label='Campaign section'
        value={activeTab}
        onChange={(value) => {
          const tab = tabs.find((candidate) => candidate === value)
          if (tab) setActiveTab(tab)
        }}
      />
      <Tabs
        className={sharedStyles.detailWorkspace}
        keepMounted={false}
        value={activeTab}
        onChange={(value) => {
          const tab = tabs.find((candidate) => candidate === value)
          if (tab) setActiveTab(tab)
        }}
      >
        <Tabs.List className={sharedStyles.detailTabs} aria-label='Campaign workspace'>
          {tabs.map((tab) => (
            <Tabs.Tab className={sharedStyles.detailTab} key={tab} value={tab}>
              {tabLabels[tab]}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value='sessions' pt='md'>
          <CampaignSessions campaign={campaign} currentUserId={currentUserId} />
        </Tabs.Panel>
        <Tabs.Panel value='party' pt='md'>
          <CampaignParty
            campaign={campaign}
            currentUserId={currentUserId}
            openCharacterPicker={openCharacterPicker}
          />
        </Tabs.Panel>
        {tabs.includes('notes') ? (
          <Tabs.Panel value='notes' pt='md'>
            <CampaignNotes campaign={campaign} currentUserId={currentUserId} />
          </Tabs.Panel>
        ) : null}
        {tabs.includes('inventory') ? (
          <Tabs.Panel value='inventory' pt='md'>
            <CampaignInventory campaign={campaign} currentUserId={currentUserId} />
          </Tabs.Panel>
        ) : null}
        {tabs.includes('content') ? (
          <Tabs.Panel value='content' pt='md'>
            <CampaignContent campaign={campaign} />
          </Tabs.Panel>
        ) : null}
        {tabs.includes('settings') ? (
          <Tabs.Panel value='settings' pt='md'>
            <CampaignSettings campaign={campaign} />
          </Tabs.Panel>
        ) : null}
      </Tabs>
      {campaign.role === 'OWNER' && campaign.status === 'ACTIVE' ? (
        <CampaignGmRoller campaignId={campaign.id} />
      ) : null}
    </main>
  )
}
