import { Alert, Tabs } from '@mantine/core'
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { getCampaignSessionAttendance, getCampaignSessions } from '#app/data/campaigns/queries'
import { useCharacterSheetCommandMutation } from '#app/data/characters/mutations'
import type { CharacterSheetPanelTargetDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { CampaignChatDrawer } from '#domains/campaigns/components/CampaignChatDrawer'
import { CampaignNotesDrawer } from '#domains/campaigns/components/CampaignNotesDrawer'
import { CharacterSheetPartyInventory } from '#domains/campaigns/components/CharacterSheetPartyInventory'
import { CampaignTabletopButton } from '#domains/campaigns/vtt/CampaignTabletopButton'
import { findCurrentTabletopSession } from '#domains/campaigns/vtt/CampaignTabletopWindow.model'
import { useCampaignLiveSession } from '#domains/campaigns/vtt/useCampaignLiveSession'
import { CharacterSheetHero } from '../hero/CharacterSheetHero'
import { CharacterSheetInspector } from '../inspector/CharacterSheetInspector'
import { CharacterSheetManualRoll } from '../dice/CharacterSheetManualRoll'
import { CharacterSheetRollHistory } from '../dice/CharacterSheetRollHistory'
import { CharacterSheetRollPresentation } from '../dice/CharacterSheetRollPresentation'
import { CharacterSheetRollContext } from '../dice/rollContext'
import { useCharacterSheetRollController } from '../dice/useCharacterSheetRollController'
import { CharacterSheetMobilePager } from '../mobile/CharacterSheetMobilePager'
import { CharacterSheetMobileStatusBar } from '../mobile/CharacterSheetMobileStatusBar'
import * as mobileStyles from '../mobile/mobile.css'
import { CharacterSheetOverview } from '../overview/CharacterSheetOverview'
import { CharacterSheetOverviewAbilities } from '../overview/CharacterSheetOverviewAbilities'
import { CharacterSheetOverviewStatusStrip } from '../status/CharacterSheetOverviewStatusStrip'
import { CharacterSheetOverviewVitals } from '../vitals/CharacterSheetOverviewVitals'
import * as coreStyles from './sheetShell.css'
import { CharacterSheetPanelContent } from './CharacterSheetPanelContent'
import {
  CHARACTER_SHEET_DESKTOP_TABS,
  CHARACTER_SHEET_MOBILE_PAGES,
  getMobilePageForTab,
  getTabForMobilePage
} from './characterSheetTabs'
import { isCharacterSheetTabId } from './characterSheet.utils'
import type {
  CharacterSheet,
  CharacterSheetCommandDraft,
  CharacterSheetMobilePageId,
  CharacterSheetTabId
} from './CharacterSheet.types'

export function CharacterSheetView({
  characterPublicId,
  currentUserId,
  hasDraft,
  initialTab = 'overview',
  rollerName = 'You',
  sheet
}: {
  characterPublicId: string
  currentUserId?: string
  hasDraft: boolean
  initialTab?: CharacterSheetTabId
  rollerName?: string
  sheet: CharacterSheet
}) {
  const [activeTab, setActiveTab] = useState<CharacterSheetTabId>(
    initialTab === 'overview' ? 'actions' : initialTab
  )
  const [activeMobilePage, setActiveMobilePage] = useState<CharacterSheetMobilePageId>(
    getMobilePageForTab(initialTab)
  )
  const [inspectorTarget, setInspectorTarget] = useState<CharacterSheetPanelTargetDto>()
  const [rollHistoryOpened, setRollHistoryOpened] = useState(false)
  const [revealedRollId, setRevealedRollId] = useState<string>()
  const [overlayEpoch, setOverlayEpoch] = useState(0)
  const inspectorTriggerRef = useRef<HTMLElement | null>(null)
  const queryClient = useQueryClient()
  const campaignId = sheet.meta.campaignId ?? null
  const sessions = useQuery({
    ...getCampaignSessions(campaignId ?? sheet.meta.characterId),
    enabled: campaignId !== null
  })
  const currentSession = sessions.data ? findCurrentTabletopSession(sessions.data) : undefined
  const attendance = useQuery({
    ...getCampaignSessionAttendance(
      campaignId ?? sheet.meta.characterId,
      currentSession?.id ?? sheet.meta.characterId
    ),
    enabled: campaignId !== null && currentSession !== undefined
  })
  const attendsLiveSession =
    currentSession !== undefined &&
    attendance.data?.some(
      (entry) => entry.characterId === sheet.meta.characterId && entry.present
    ) === true
  const live = useCampaignLiveSession({
    campaignId: campaignId ?? sheet.meta.characterId,
    enabled: attendsLiveSession,
    onTransient: () => undefined,
    sessionId: currentSession?.id ?? sheet.meta.characterId
  })
  const commandMutation = useCharacterSheetCommandMutation(sheet.meta.characterId, {
    ...(attendsLiveSession
      ? {
          executeLiveCommand: live.executeCommand,
          getLiveAggregateVersion: () =>
            live.getAggregateVersion('CHARACTER', sheet.meta.characterId)
        }
      : {})
  })
  const rollController = useCharacterSheetRollController(
    sheet.meta.characterId,
    sheet.meta.campaignId ?? undefined
  )
  const liveContextPending =
    campaignId !== null &&
    (sessions.isPending || (currentSession !== undefined && attendance.isPending))
  const pending =
    commandMutation.isPending ||
    liveContextPending ||
    (attendsLiveSession && live.status !== 'CONNECTED')
  const liveContextError =
    sessions.error instanceof Error
      ? sessions.error.message
      : attendance.error instanceof Error
        ? attendance.error.message
        : live.error
  const campaignInventory =
    sheet.meta.campaignId && currentUserId ? (
      <CharacterSheetPartyInventory
        campaignId={sheet.meta.campaignId}
        currentUserId={currentUserId}
      />
    ) : undefined

  const revealRoll = useCallback(
    (roll: RollRecordDto) => {
      setRevealedRollId(roll.id)
      queryClient.setQueryData<RollRecordDto[]>(queryKeys.rolls.history(), (current) =>
        [roll, ...(current ?? []).filter((existing) => existing.id !== roll.id)].slice(0, 20)
      )
    },
    [queryClient]
  )
  const hasSpellcasting =
    sheet.spells.attackBonus != null ||
    sheet.spells.saveDc != null ||
    sheet.spells.slots.length > 0 ||
    sheet.spells.activeGroups.length > 0 ||
    sheet.spells.spells.length > 0 ||
    Boolean(sheet.spells.preparationSources?.length)
  const visibleTabs = CHARACTER_SHEET_DESKTOP_TABS.filter(
    (tab) =>
      (hasSpellcasting || tab.id !== 'spells') &&
      (sheet.meta.capabilities.managePrivateNotes || tab.id !== 'notes')
  )
  const visibleMobilePages = CHARACTER_SHEET_MOBILE_PAGES.filter(
    (page) =>
      (hasSpellcasting || page.id !== 'spells') &&
      (sheet.meta.capabilities.managePrivateNotes || page.id !== 'notes')
  )
  const visibleActiveTab = !hasSpellcasting && activeTab === 'spells' ? 'actions' : activeTab
  const visibleActiveMobilePage =
    !hasSpellcasting && activeMobilePage === 'spells' ? 'actions' : activeMobilePage
  const isMobileAuxiliaryPage =
    visibleActiveMobilePage === 'skills' || visibleActiveMobilePage === 'proficiencies'
  function openInspector(target: CharacterSheetPanelTargetDto) {
    setOverlayEpoch((current) => current + 1)
    inspectorTriggerRef.current =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null
    setInspectorTarget(target)
  }

  function closeInspector() {
    const trigger = inspectorTriggerRef.current
    setInspectorTarget(undefined)
    requestAnimationFrame(() => trigger?.focus())
  }

  function closeActivePanel() {
    if (inspectorTarget) closeInspector()
  }

  async function submitCommand(command: CharacterSheetCommandDraft) {
    try {
      await commandMutation.mutateAsync({ ...command, commandId: crypto.randomUUID() })
      return true
    } catch {
      return false
    }
  }

  useEffect(() => {
    setActiveTab(initialTab === 'overview' ? 'actions' : initialTab)
    setActiveMobilePage(getMobilePageForTab(initialTab))
  }, [initialTab])

  function setMobilePage(page: CharacterSheetMobilePageId) {
    setActiveMobilePage(page)
    setActiveTab(getTabForMobilePage(page))
  }

  function dismissPresentedRoll(event: MouseEvent<HTMLDivElement>) {
    if (!rollController.presentedRoll) return
    rollController.dismissRoll(rollController.presentedRoll.id !== revealedRollId)
    if (event.target instanceof Element && event.target.closest('[data-roll-target]')) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  return (
    <CharacterSheetRollContext.Provider value={rollController}>
      <div className={coreStyles.shell} onClickCapture={dismissPresentedRoll}>
        <CharacterSheetRollPresentation
          onRollRevealed={(rollId) => {
            if (rollController.presentedRoll?.id === rollId && rollController.presentedRollPrivate)
              revealRoll(rollController.presentedRoll)
          }}
          pending={rollController.pending}
          roll={rollController.presentedRoll}
        />
        <div className={coreStyles.sheetTopGrid}>
          <CharacterSheetHero
            campaignActions={
              sheet.meta.campaignId && currentUserId ? (
                <>
                  <CampaignTabletopButton campaignId={sheet.meta.campaignId} />
                  <CampaignChatDrawer
                    campaignId={sheet.meta.campaignId}
                    currentUserId={currentUserId}
                    trigger='icon'
                  />
                  <CampaignNotesDrawer
                    campaignId={sheet.meta.campaignId}
                    currentUserId={currentUserId}
                  />
                </>
              ) : null
            }
            characterPublicId={characterPublicId}
            editable={sheet.meta.capabilities.openBuilder}
            hasDraft={hasDraft}
            sheet={sheet}
            onOpenRollHistory={() => setRollHistoryOpened(true)}
          />
          <CharacterSheetOverviewVitals
            closePanel={closeActivePanel}
            openPanel={openInspector}
            overlayEpoch={overlayEpoch}
            pending={pending}
            sheet={sheet}
            showDefenses
            submitCommand={submitCommand}
          />
          <div className={coreStyles.mobileOnly}>
            <CharacterSheetMobileStatusBar
              openPanel={openInspector}
              pending={pending}
              sheet={sheet}
              submitCommand={submitCommand}
            />
          </div>
        </div>

        {hasDraft ? (
          <Alert color='yellow'>
            This character has builder draft work. The sheet is showing the last finalized active
            character until that builder draft is saved.
          </Alert>
        ) : null}
        {commandMutation.error ? <Alert color='red'>{commandMutation.error.message}</Alert> : null}
        {!commandMutation.error && liveContextError ? (
          <Alert color='red'>{liveContextError}</Alert>
        ) : null}
        {attendsLiveSession && live.status !== 'CONNECTED' && !liveContextError ? (
          <Alert color='blue'>Connecting this sheet to the live Session…</Alert>
        ) : null}

        <CharacterSheetMobilePager
          activePage={visibleActiveMobilePage}
          manualRollAction={
            <CharacterSheetManualRoll className={mobileStyles.mobileFloatingButton} />
          }
          pages={visibleMobilePages}
          onPageChange={setMobilePage}
        >
          <div className={coreStyles.responsiveContent}>
            <div
              className={coreStyles.sheetAbilityStatusGrid}
              data-mobile-visible={visibleActiveMobilePage === 'overview' ? 'true' : undefined}
            >
              <div className={coreStyles.abilityRegion}>
                <CharacterSheetOverviewAbilities
                  abilities={sheet.overview.abilities}
                  openPanel={openInspector}
                />
              </div>
              <div className={coreStyles.statusRegion}>
                <CharacterSheetOverviewStatusStrip
                  pending={pending}
                  sheet={sheet}
                  submitCommand={submitCommand}
                />
              </div>
            </div>

            <div
              className={`${coreStyles.sheetCanvas} ${
                visibleActiveTab === 'overview' ? '' : coreStyles.tabletFocusedCanvas
              }`}
            >
              <div
                className={`${coreStyles.overviewRegion} ${
                  visibleActiveTab === 'overview' ? '' : coreStyles.tabletOverviewHidden
                }`}
                data-mobile-visible={visibleActiveMobilePage === 'overview' ? 'true' : undefined}
              >
                <CharacterSheetOverview
                  openPanel={openInspector}
                  sheet={sheet}
                  showDefenses={false}
                  tabletSkillsOnly
                />
              </div>

              <section
                className={coreStyles.desktopWorkspace}
                data-mobile-visible={
                  visibleActiveMobilePage !== 'overview' && !isMobileAuxiliaryPage
                    ? 'true'
                    : undefined
                }
                aria-label='Character workspace'
              >
                <Tabs
                  className={coreStyles.desktopWorkspaceTabs}
                  keepMounted={false}
                  value={visibleActiveTab}
                  onChange={(value) => {
                    if (isCharacterSheetTabId(value)) {
                      setActiveTab(value)
                      setActiveMobilePage(getMobilePageForTab(value))
                    }
                  }}
                >
                  <Tabs.List className={coreStyles.tabList}>
                    {visibleTabs.map((tab) => (
                      <Tabs.Tab
                        className={
                          tab.id === 'overview' ? coreStyles.tabletOnlyTab : coreStyles.tab
                        }
                        key={tab.id}
                        value={tab.id}
                      >
                        {tab.label}
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                  {visibleTabs.map((tab) => (
                    <Tabs.Panel
                      className={coreStyles.desktopWorkspacePanel}
                      key={tab.id}
                      value={tab.id}
                    >
                      <CharacterSheetPanelContent
                        campaignInventory={campaignInventory}
                        openPanel={openInspector}
                        pending={pending}
                        sheet={sheet}
                        submitCommand={submitCommand}
                        tab={tab.id}
                      />
                    </Tabs.Panel>
                  ))}
                </Tabs>
              </section>

              {isMobileAuxiliaryPage ? (
                <div className={coreStyles.mobileAuxiliaryPanel} data-mobile-visible='true'>
                  <CharacterSheetPanelContent
                    campaignInventory={campaignInventory}
                    mobile
                    openPanel={openInspector}
                    pending={pending}
                    sheet={sheet}
                    submitCommand={submitCommand}
                    tab={visibleActiveMobilePage}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </CharacterSheetMobilePager>
      </div>
      <CharacterSheetRollHistory
        opened={rollHistoryOpened}
        pendingRollId={
          !rollController.presentedRollPrivate ||
          rollController.presentedRoll?.id === revealedRollId
            ? undefined
            : rollController.presentedRoll?.id
        }
        rollerName={rollerName}
        onClose={() => setRollHistoryOpened(false)}
      />
      {inspectorTarget ? (
        <CharacterSheetInspector
          characterId={sheet.meta.characterId}
          commandError={commandMutation.error?.message}
          expectedVersion={sheet.meta.streamVersion}
          pending={pending}
          submitCommand={submitCommand}
          target={inspectorTarget}
          equipmentItems={sheet.inventory.items}
          onClose={closeInspector}
          onTargetChange={setInspectorTarget}
        />
      ) : null}
    </CharacterSheetRollContext.Provider>
  )
}
