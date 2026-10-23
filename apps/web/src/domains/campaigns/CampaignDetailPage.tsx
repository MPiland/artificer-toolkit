import { Alert, Badge, Group, Loader, Select, Stack, Tabs, Title } from '@mantine/core'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { findOption } from '../../forms/utils/valueGuards'
import { useCampaignDetailOrNull } from '#app/data/campaigns/queries'
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
import { CampaignAnnouncements } from './components/CampaignAnnouncements/CampaignAnnouncements'
import { CampaignTableSettings } from './components/CampaignTableSettings/CampaignTableSettings'
import { CampaignVehicles } from './components/CampaignVehicles/CampaignVehicles'
import * as sharedStyles from './campaigns.css'

function subscribeToNothing() {
  return () => undefined
}

function readLocationSearch() {
  return window.location.search
}

function readDeepLink(locationSearch: string) {
  const search = new URLSearchParams(locationSearch)

  return {
    announcementPublicId: search.get('announcementPublicId'),
    assignCharacter: search.get('action') === 'assign-character',
    requestedTab: search.get('tab')
  }
}

const tabLabels: Record<CampaignTab, string> = {
  sessions: 'Sessions',
  announcements: 'Announcements',
  party: 'Party',
  notes: 'Notes',
  inventory: 'Inventory',
  table: 'Table',
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
  const navigate = useNavigate()
  const campaign = useCampaignDetailOrNull(campaignId)
  const tabs = campaign ? getCampaignTabs(campaign) : []
  const [activeTab, setActiveTab] = useState<CampaignTab>(tabs[0] ?? 'sessions')
  const [openCharacterPicker, setOpenCharacterPicker] = useState(false)
  const [requestedAnnouncementId, setRequestedAnnouncementId] = useState<string | null>(null)
  const deleteConfirmed = useRef(false)

  useEffect(() => {
    if (!campaign)
      void navigate({
        to: '/campaigns',
        replace: true,
        search: deleteConfirmed.current ? { campaignId } : {}
      })
  }, [campaign, campaignId, navigate])

  const locationSearch = useSyncExternalStore(subscribeToNothing, readLocationSearch, () => '')
  const [appliedSearch, setAppliedSearch] = useState('')
  const deepLink = readDeepLink(locationSearch)
  if (appliedSearch !== locationSearch) {
    setAppliedSearch(locationSearch)
    const requestedTab = findOption(tabs, deepLink.requestedTab)
    if (requestedTab) setActiveTab(requestedTab)
    if (deepLink.announcementPublicId) {
      setRequestedAnnouncementId(deepLink.announcementPublicId)
      if (tabs.includes('announcements')) setActiveTab('announcements')
    }
    if (deepLink.assignCharacter) setOpenCharacterPicker(true)
  }
  const hasDeepLink = Boolean(
    deepLink.requestedTab || deepLink.announcementPublicId || deepLink.assignCharacter
  )

  useEffect(() => {
    if (hasDeepLink) window.history.replaceState({}, '', window.location.pathname)
  }, [hasDeepLink])

  if (!campaign) return <Loader aria-label='Returning to Campaigns' />

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
                trigger='icon'
              />
            ) : null}
          </Group>
        </div>
      </header>
      {campaign.status === 'ARCHIVED' ? (
        <Alert color='gray' title='Archived Campaign'>
          {campaign.role === 'OWNER'
            ? 'This Campaign is read-only. You can permanently delete it from Settings.'
            : 'This Campaign is read-only.'}
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
        <Tabs.Panel value='announcements' pt='md'>
          <CampaignAnnouncements
            announcementPublicId={requestedAnnouncementId}
            campaign={campaign}
          />
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
            <Stack gap='lg'>
              <CampaignVehicles campaign={campaign} />
              <CampaignInventory campaign={campaign} currentUserId={currentUserId} />
            </Stack>
          </Tabs.Panel>
        ) : null}
        <Tabs.Panel value='table' pt='md'>
          <CampaignTableSettings campaign={campaign} />
        </Tabs.Panel>
        {tabs.includes('content') ? (
          <Tabs.Panel value='content' pt='md'>
            <CampaignContent campaign={campaign} currentUserId={currentUserId} />
          </Tabs.Panel>
        ) : null}
        {tabs.includes('settings') ? (
          <Tabs.Panel value='settings' pt='md'>
            <CampaignSettings
              campaign={campaign}
              onDeleteConfirmed={() => {
                deleteConfirmed.current = true
              }}
              onDeleteFailed={() => {
                deleteConfirmed.current = false
              }}
            />
          </Tabs.Panel>
        ) : null}
      </Tabs>
      {campaign.role === 'OWNER' && campaign.status === 'ACTIVE' ? (
        <CampaignGmRoller campaignId={campaign.id} rollModes={campaign.rollModes} />
      ) : null}
    </main>
  )
}
