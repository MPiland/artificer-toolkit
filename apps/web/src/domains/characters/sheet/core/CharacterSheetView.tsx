import { Alert, Tabs } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useCharacterSheetCommandMutation } from '#app/data/characters/mutations'
import type { CharacterSheetPanelTargetDto } from '#app/lib/api'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import { CharacterSheetHero } from '../hero/CharacterSheetHero'
import { CharacterSheetInspector } from '../inspector/CharacterSheetInspector'
import { CharacterSheetMobilePager } from '../mobile/CharacterSheetMobilePager'
import { CharacterSheetMobileStatusBar } from '../mobile/CharacterSheetMobileStatusBar'
import {
  CharacterSheetOverview,
  CharacterSheetOverviewFacts
} from '../overview/CharacterSheetOverview'
import { CharacterSheetOverviewAbilities } from '../overview/CharacterSheetOverviewAbilities'
import { CharacterSheetSkillsPanel } from '../overview/CharacterSheetOverviewProficiencies'
import { CharacterSheetOverviewStatusStrip } from '../status/CharacterSheetOverviewStatusStrip'
import { CharacterSheetOverviewVitals } from '../vitals/CharacterSheetOverviewVitals'
import * as coreStyles from './sheetShell.css'
import { CharacterSheetPanelContent } from './CharacterSheetPanelContent'
import {
  CHARACTER_SHEET_DESKTOP_TABS,
  CHARACTER_SHEET_TABLET_TABS,
  getMobilePageForTab,
  getTabForMobilePage
} from './characterSheetTabs'
import { isCharacterSheetMobilePageId, isCharacterSheetTabId } from './characterSheet.utils'
import type {
  CharacterSheet,
  CharacterSheetCommandDraft,
  CharacterSheetMobilePageId,
  CharacterSheetTabId
} from './CharacterSheet.types'

export function CharacterSheetView({
  characterPublicId,
  hasDraft,
  initialTab = 'overview',
  sheet
}: {
  characterPublicId: string
  hasDraft: boolean
  initialTab?: CharacterSheetTabId
  sheet: CharacterSheet
}) {
  const [activeTab, setActiveTab] = useState<CharacterSheetTabId>(initialTab)
  const [activeMobilePage, setActiveMobilePage] = useState<CharacterSheetMobilePageId>(
    getMobilePageForTab(initialTab)
  )
  const [inspectorTarget, setInspectorTarget] = useState<CharacterSheetPanelTargetDto>()
  const [overlayEpoch, setOverlayEpoch] = useState(0)
  const inspectorTriggerRef = useRef<HTMLElement | null>(null)
  const isMobileSheet = useMediaQuery('(max-width: 760px)', false)
  const isDesktopSheet = useMediaQuery('(min-width: 1200px)', false)
  const isTabletLandscape = useMediaQuery(
    '(min-width: 960px) and (max-width: 1199px) and (orientation: landscape)',
    false
  )
  const navigate = useNavigate()
  const commandMutation = useCharacterSheetCommandMutation(sheet.meta.characterId)
  const pending = commandMutation.isPending
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
    setActiveTab(initialTab)
    setActiveMobilePage(getMobilePageForTab(initialTab))
  }, [initialTab])

  function setMobilePage(page: CharacterSheetMobilePageId) {
    setActiveMobilePage(page)
    setActiveTab(getTabForMobilePage(page))
  }

  const activeTabletPage =
    activeMobilePage === 'skills' || activeMobilePage === 'proficiencies'
      ? 'overview'
      : activeMobilePage
  const tabletTabs = (
    <Tabs
      className={isTabletLandscape ? coreStyles.desktopWorkspaceTabs : undefined}
      keepMounted={false}
      styles={{ tab: { borderWidth: 0 } }}
      value={activeTabletPage}
      onChange={(value) => {
        if (isCharacterSheetMobilePageId(value)) {
          setActiveTab(getTabForMobilePage(value))
          setActiveMobilePage(value)
        }
      }}
    >
      <Tabs.List className={coreStyles.tabList}>
        {CHARACTER_SHEET_TABLET_TABS.map((tab) => (
          <Tabs.Tab className={coreStyles.tab} key={tab.id} value={tab.id}>
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {CHARACTER_SHEET_TABLET_TABS.map((tab) => (
        <Tabs.Panel
          className={isTabletLandscape ? coreStyles.desktopWorkspacePanel : undefined}
          key={tab.id}
          value={tab.id}
          pt='md'
        >
          {isTabletLandscape && tab.id === 'overview' ? (
            <CharacterSheetOverviewFacts openPanel={openInspector} sheet={sheet} />
          ) : (
            <CharacterSheetPanelContent
              openPanel={openInspector}
              pending={pending}
              sheet={sheet}
              submitCommand={submitCommand}
              tab={tab.id}
            />
          )}
        </Tabs.Panel>
      ))}
    </Tabs>
  )

  return (
    <>
      <div
        className={clsx(
          coreStyles.shell,
          isMobileSheet
            ? coreStyles.sheetMobile
            : isDesktopSheet
              ? coreStyles.sheetDesktop
              : coreStyles.sheetTablet
        )}
      >
        <div className={coreStyles.sheetTopGrid}>
          <CharacterSheetHero
            characterPublicId={characterPublicId}
            hasDraft={hasDraft}
            sheet={sheet}
          />
          <CharacterSheetOverviewVitals
            closePanel={closeActivePanel}
            openPanel={openInspector}
            overlayEpoch={overlayEpoch}
            pending={pending}
            sheet={sheet}
            showDefenses={isDesktopSheet}
            submitCommand={submitCommand}
          />
          {isMobileSheet ? (
            <CharacterSheetMobileStatusBar
              openPanel={openInspector}
              pending={pending}
              sheet={sheet}
              submitCommand={submitCommand}
            />
          ) : null}
        </div>
        {!isMobileSheet ? (
          <div className={coreStyles.sheetAbilityStatusGrid}>
            <CharacterSheetOverviewAbilities
              abilities={sheet.overview.abilities}
              openPanel={openInspector}
            />
            <CharacterSheetOverviewStatusStrip
              pending={pending}
              sheet={sheet}
              submitCommand={submitCommand}
            />
          </div>
        ) : null}
        {hasDraft ? (
          <Alert color='yellow'>
            This character has builder draft work. The sheet is showing the last finalized active
            character until that builder draft is saved.
          </Alert>
        ) : null}
        {commandMutation.error ? <Alert color='red'>{commandMutation.error.message}</Alert> : null}

        {isMobileSheet ? (
          <CharacterSheetMobilePager activePage={activeMobilePage} onPageChange={setMobilePage}>
            <CharacterSheetPanelContent
              mobile
              openPanel={openInspector}
              pending={pending}
              sheet={sheet}
              submitCommand={submitCommand}
              tab={activeMobilePage}
            />
          </CharacterSheetMobilePager>
        ) : isDesktopSheet ? (
          <div className={coreStyles.desktopSheetCanvas}>
            <CharacterSheetOverview openPanel={openInspector} sheet={sheet} showDefenses={false} />
            <section className={coreStyles.desktopWorkspace} aria-label='Character workspace'>
              <Tabs
                className={coreStyles.desktopWorkspaceTabs}
                keepMounted={false}
                styles={{ tab: { borderWidth: 0 } }}
                value={activeTab === 'overview' ? 'actions' : activeTab}
                onChange={(value) => {
                  if (isCharacterSheetTabId(value) && value !== 'overview') setActiveTab(value)
                }}
              >
                <Tabs.List className={coreStyles.tabList}>
                  {CHARACTER_SHEET_DESKTOP_TABS.filter((tab) => tab.id !== 'overview').map(
                    (tab) => (
                      <Tabs.Tab className={coreStyles.tab} key={tab.id} value={tab.id}>
                        {tab.label}
                      </Tabs.Tab>
                    )
                  )}
                </Tabs.List>
                {CHARACTER_SHEET_DESKTOP_TABS.filter((tab) => tab.id !== 'overview').map((tab) => (
                  <Tabs.Panel
                    className={coreStyles.desktopWorkspacePanel}
                    key={tab.id}
                    value={tab.id}
                    pt='md'
                  >
                    <CharacterSheetPanelContent
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
          </div>
        ) : isTabletLandscape ? (
          <div className={coreStyles.tabletLandscapeCanvas}>
            <CharacterSheetSkillsPanel
              abilities={sheet.overview.abilities}
              openPanel={openInspector}
              skills={sheet.overview.skills}
            />
            <section className={coreStyles.desktopWorkspace} aria-label='Character workspace'>
              {tabletTabs}
            </section>
          </div>
        ) : (
          tabletTabs
        )}
      </div>
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
          onOpenBuilder={() =>
            navigate({
              to: '/characters/$characterPublicId/$characterSlug/edit',
              params: buildCharacterRouteParams(characterPublicId, sheet.identity.label)
            })
          }
          onTargetChange={setInspectorTarget}
        />
      ) : null}
    </>
  )
}
