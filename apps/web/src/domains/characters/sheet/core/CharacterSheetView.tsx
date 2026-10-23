import { Alert, Tabs } from '@mantine/core'
import { useMediaQuery, useMounted } from '@mantine/hooks'
import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { useCallback, useRef, useState, type MouseEvent } from 'react'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import { useCharacterSheetCommandMutation } from '#app/data/characters/mutations'
import type { CharacterSheetPanelTargetDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import { CampaignChatDrawer } from '#domains/campaigns/components/CampaignChatDrawer'
import { CampaignNotesDrawer } from '#domains/campaigns/components/CampaignNotesDrawer'
import { CharacterSheetPartyVisibility } from './CharacterSheetPartyVisibility'
import { CharacterSheetPartyInventory } from '#domains/campaigns/components/CharacterSheetPartyInventory'
import { CampaignTabletopButton } from '#domains/campaigns/vtt/CampaignTabletopButton'
import { CharacterSheetHero } from '../hero/CharacterSheetHero'
import { CharacterSheetInspector } from '../inspector/CharacterSheetInspector'
import { CharacterSheetManualRoll } from '../dice/CharacterSheetManualRoll'
import { CharacterSheetRollHistory } from '../dice/CharacterSheetRollHistory'
import { DiceRollPresentation } from '#app/components/dice/DiceRollPresentation'
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
import { useConcentrationRoomRoute } from './useConcentrationRoomRoute'
import { useLiveCharacterSheet } from './useLiveCharacterSheet'
import {
  CHARACTER_SHEET_DESKTOP_TABS,
  CHARACTER_SHEET_MOBILE_PAGES,
  getMobilePageForTab,
  getTabForMobilePage
} from './characterSheetTabs'
import { isCharacterSheetTabId } from './characterSheet.utils'
import type {
  CharacterSheetCommandDraft,
  CharacterSheetMobilePageId,
  CharacterSheetTabId
} from './CharacterSheet.types'

export function CharacterSheetView({
  characterPublicId,
  commandPending,
  currentUserId,
  executeCommand,
  hasDraft,
  initialTab = 'overview',
  rollerName = 'You',
  sheet: committedSheet
}: {
  characterPublicId: string
  commandPending?: boolean
  currentUserId?: string
  executeCommand?: (command: CharacterSheetCommandInputDto) => Promise<void>
  hasDraft: boolean
  initialTab?: CharacterSheetTabId
  rollerName?: string
  sheet: CharacterSheetCommonDto
}) {
  const live = useLiveCharacterSheet(
    committedSheet.meta.characterId,
    committedSheet.meta.campaignId
  )
  const endConcentrationInRoom = useConcentrationRoomRoute(
    committedSheet.meta.characterId,
    committedSheet.meta.campaignId
  )
  const sheet = live?.common ?? committedSheet
  const isMobile = useMediaQuery('(max-width: 760px)')
  const mounted = useMounted()
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
  const commandMutation = useCharacterSheetCommandMutation(
    sheet.meta.characterId,
    sheet.meta.campaignId,
    live && {
      checkpointVersion: committedSheet.meta.streamVersion,
      sendPlayCommand: live.sendPlayCommand
    },
    endConcentrationInRoom
  )
  const rollController = useCharacterSheetRollController(
    sheet.meta.characterId,
    sheet.meta.campaignId
      ? { id: sheet.meta.campaignId, isGm: sheet.meta.viewer === 'CAMPAIGN_OWNER' }
      : undefined
  )
  const pending = (commandPending ?? commandMutation.isPending) || Boolean(live?.pending)
  const campaignInventory =
    sheet.meta.campaignId && currentUserId ? (
      <CharacterSheetPartyInventory
        campaignId={sheet.meta.campaignId}
        currentUserId={currentUserId}
      />
    ) : undefined

  const revealRoll = useCallback((roll: RollRecordDto) => setRevealedRollId(roll.id), [])
  const hasSpellcasting = sheet.hasSpellcasting
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
      const commandId = crypto.randomUUID()
      const input: CharacterSheetCommandInputDto =
        command.type === 'UPSERT_SHEET_ADJUSTMENT'
          ? {
              ...command,
              commandId,
              adjustment: {
                ...command.adjustment,
                id: command.adjustment.id ?? crypto.randomUUID()
              }
            }
          : { ...command, commandId }
      if (executeCommand) await executeCommand(input)
      else await commandMutation.mutateAsync(input)
      return true
    } catch {
      return false
    }
  }

  const [seenInitialTab, setSeenInitialTab] = useState(initialTab)
  if (seenInitialTab !== initialTab) {
    setSeenInitialTab(initialTab)
    setActiveTab(initialTab === 'overview' ? 'actions' : initialTab)
    setActiveMobilePage(getMobilePageForTab(initialTab))
  }

  function setMobilePage(page: CharacterSheetMobilePageId) {
    setActiveMobilePage(page)
    setActiveTab(getTabForMobilePage(page))
  }

  function dismissPresentedRoll(event: MouseEvent<HTMLDivElement>) {
    if (!rollController.presentedRoll && !rollController.presentationPending) return
    const discard =
      rollController.presentationPending ||
      (rollController.presentedRoll !== undefined &&
        rollController.presentedRoll.id !== revealedRollId)
    rollController.dismissRoll(discard)
    if (event.target instanceof Element && event.target.closest('[data-roll-target]')) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  return (
    <CharacterSheetRollContext.Provider value={rollController}>
      <div className={coreStyles.shell} onClickCapture={dismissPresentedRoll}>
        <DiceRollPresentation
          onRollRevealed={(rollId) => {
            if (rollController.presentedRoll?.id !== rollId) return
            rollController.revealRoll(rollId)
            if (rollController.presentedRollPrivate) revealRoll(rollController.presentedRoll)
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
                  {sheet.meta.partyVisibility ? (
                    <CharacterSheetPartyVisibility
                      expectedVersion={sheet.meta.streamVersion}
                      pending={pending}
                      submitCommand={submitCommand}
                      visibility={sheet.meta.partyVisibility}
                    />
                  ) : null}
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

        <CharacterSheetMobilePager
          activePage={visibleActiveMobilePage}
          manualRollAction={
            <CharacterSheetManualRoll
              className={mobileStyles.mobileFloatingButton}
              rollModes={sheet.overview.rollModes}
            />
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
                      {mounted &&
                      (!isMobile ||
                        (visibleActiveMobilePage !== 'overview' && !isMobileAuxiliaryPage)) &&
                      tab.id === visibleActiveTab ? (
                        <CharacterSheetPanelContent
                          campaignInventory={campaignInventory}
                          liveSheet={live?.sheet ?? undefined}
                          openPanel={openInspector}
                          pending={pending}
                          sheet={sheet}
                          submitCommand={submitCommand}
                          tab={tab.id}
                        />
                      ) : null}
                    </Tabs.Panel>
                  ))}
                </Tabs>
              </section>

              {isMobile && isMobileAuxiliaryPage ? (
                <div className={coreStyles.mobileAuxiliaryPanel} data-mobile-visible='true'>
                  <CharacterSheetPanelContent
                    campaignInventory={campaignInventory}
                    liveSheet={live?.sheet ?? undefined}
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
        onRevealRoll={rollController.revealPrivateRoll}
      />
      {inspectorTarget ? (
        <CharacterSheetInspector
          campaignId={sheet.meta.campaignId}
          characterId={sheet.meta.characterId}
          commandError={commandMutation.error?.message}
          expectedVersion={sheet.meta.streamVersion}
          liveSheet={live?.sheet ?? undefined}
          pending={pending}
          submitCommand={submitCommand}
          target={inspectorTarget}
          onClose={closeInspector}
          onTargetChange={setInspectorTarget}
        />
      ) : null}
    </CharacterSheetRollContext.Provider>
  )
}
