import { Alert, Tabs } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useCharacterSheetCommandMutation } from '#app/data/characters/mutations'
import type { CharacterSheetPanelTargetDto } from '#app/lib/api'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import { CharacterSheetHero } from './CharacterSheetHero'
import { CharacterSheetMobilePager } from './CharacterSheetMobilePager'
import { CharacterSheetMobileStatusBar } from './CharacterSheetMobileStatusBar'
import { CharacterSheetOverview, CharacterSheetOverviewFacts } from './CharacterSheetOverview'
import { CharacterSheetOverviewAbilities } from './CharacterSheetOverviewAbilities'
import { CharacterSheetSkillsPanel } from './CharacterSheetOverviewProficiencies'
import { CharacterSheetOverviewStatusStrip } from './CharacterSheetOverviewStatusStrip'
import { CharacterSheetOverviewVitals } from './CharacterSheetOverviewVitals'
import { CharacterSheetPanelContent } from './CharacterSheetPanelContent'
import { CharacterSheetInspector } from './panels/CharacterSheetInspector'
import * as styles from './characterSheet.css'
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

  const sectionProps = {
    openPanel: openInspector,
    pending,
    sheet,
    submitCommand: async (command: CharacterSheetCommandDraft) => {
      try {
        await commandMutation.mutateAsync({ ...command, commandId: crypto.randomUUID() })
        return true
      } catch {
        return false
      }
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
      className={isTabletLandscape ? styles.desktopWorkspaceTabs : undefined}
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
      <Tabs.List className={styles.tabList}>
        {CHARACTER_SHEET_TABLET_TABS.map((tab) => (
          <Tabs.Tab className={styles.tab} key={tab.id} value={tab.id}>
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {CHARACTER_SHEET_TABLET_TABS.map((tab) => (
        <Tabs.Panel
          className={isTabletLandscape ? styles.desktopWorkspacePanel : undefined}
          key={tab.id}
          value={tab.id}
          pt='md'
        >
          {isTabletLandscape && tab.id === 'overview' ? (
            <CharacterSheetOverviewFacts {...sectionProps} />
          ) : (
            <CharacterSheetPanelContent sectionProps={sectionProps} tab={tab.id} />
          )}
        </Tabs.Panel>
      ))}
    </Tabs>
  )

  return (
    <>
      <div
        className={clsx(
          styles.shell,
          isMobileSheet
            ? styles.sheetMobile
            : isDesktopSheet
              ? styles.sheetDesktop
              : styles.sheetTablet
        )}
      >
        <div className={styles.sheetTopGrid}>
          <CharacterSheetHero
            characterPublicId={characterPublicId}
            hasDraft={hasDraft}
            sheet={sheet}
          />
          <CharacterSheetOverviewVitals {...sectionProps} showDefenses={isDesktopSheet} />
          {isMobileSheet ? <CharacterSheetMobileStatusBar {...sectionProps} /> : null}
        </div>
        {!isMobileSheet ? (
          <div className={styles.sheetAbilityStatusGrid}>
            <CharacterSheetOverviewAbilities
              abilities={sheet.overview.abilities}
              openPanel={openInspector}
            />
            <CharacterSheetOverviewStatusStrip {...sectionProps} />
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
            <CharacterSheetPanelContent mobile sectionProps={sectionProps} tab={activeMobilePage} />
          </CharacterSheetMobilePager>
        ) : isDesktopSheet ? (
          <div className={styles.desktopSheetCanvas}>
            <CharacterSheetOverview {...sectionProps} showDefenses={false} />
            <section className={styles.desktopWorkspace} aria-label='Character workspace'>
              <Tabs
                className={styles.desktopWorkspaceTabs}
                keepMounted={false}
                styles={{ tab: { borderWidth: 0 } }}
                value={activeTab === 'overview' ? 'actions' : activeTab}
                onChange={(value) => {
                  if (isCharacterSheetTabId(value) && value !== 'overview') setActiveTab(value)
                }}
              >
                <Tabs.List className={styles.tabList}>
                  {CHARACTER_SHEET_DESKTOP_TABS.filter((tab) => tab.id !== 'overview').map(
                    (tab) => (
                      <Tabs.Tab className={styles.tab} key={tab.id} value={tab.id}>
                        {tab.label}
                      </Tabs.Tab>
                    )
                  )}
                </Tabs.List>
                {CHARACTER_SHEET_DESKTOP_TABS.filter((tab) => tab.id !== 'overview').map((tab) => (
                  <Tabs.Panel
                    className={styles.desktopWorkspacePanel}
                    key={tab.id}
                    value={tab.id}
                    pt='md'
                  >
                    <CharacterSheetPanelContent sectionProps={sectionProps} tab={tab.id} />
                  </Tabs.Panel>
                ))}
              </Tabs>
            </section>
          </div>
        ) : isTabletLandscape ? (
          <div className={styles.tabletLandscapeCanvas}>
            <CharacterSheetSkillsPanel
              abilities={sheet.overview.abilities}
              openPanel={openInspector}
              skills={sheet.overview.skills}
            />
            <section className={styles.desktopWorkspace} aria-label='Character workspace'>
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
          submitCommand={sectionProps.submitCommand}
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
