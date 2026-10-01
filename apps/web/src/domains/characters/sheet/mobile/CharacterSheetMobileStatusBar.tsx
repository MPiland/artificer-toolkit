import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { Drawer, Text } from '@mantine/core'
import { useState } from 'react'
import IInspiration from '#assets/icons/IInspiration'
import type { OpenSheetPanel, SubmitSheetCommand } from '../core/CharacterSheet.types'
import * as coreStyles from '../core/sheetShell.css'
import * as overviewStyles from '../overview/overview.css'
import * as sheetOverlayStyles from '../shared/sheetOverlay.css'
import * as statusEditorStyles from '../status/statusEditor.css'
import * as statusSummaryStyles from '../status/statusSummary.css'
import { CharacterSheetOverviewStatusStrip } from '../status/CharacterSheetOverviewStatusStrip'

export function CharacterSheetMobileStatusBar({
  openPanel,
  pending,
  sheet,
  submitCommand
}: {
  openPanel?: OpenSheetPanel
  pending: boolean
  sheet: Omit<CharacterSheetCommonDto, 'hasSpellcasting'>
  submitCommand: SubmitSheetCommand
}) {
  const [conditionsOpen, setConditionsOpen] = useState(false)
  const conditions = sheet.overview.conditions
  const activeConditionSummary = conditions.length
    ? conditions.map((condition) => condition.label).join(', ')
    : 'None'
  const conditionSummary =
    sheet.overview.exhaustion.level > 0
      ? `${activeConditionSummary} · Exhaustion ${sheet.overview.exhaustion.level}`
      : activeConditionSummary
  const defenseSummary = sheet.reference.defenses.length
    ? `${sheet.reference.defenses.length} active`
    : 'None'

  return (
    <>
      <section
        className={statusSummaryStyles.mobileStatusBar}
        aria-label='Current character status'
      >
        <button
          aria-label='Manage defenses'
          className={statusSummaryStyles.mobileStatusAction}
          disabled={!openPanel}
          type='button'
          onClick={() => openPanel?.({ kind: 'DEFENSES' })}
        >
          <Text className={overviewStyles.metricLabel}>Defenses</Text>
          <Text className={statusSummaryStyles.mobileStatusValue}>{defenseSummary}</Text>
        </button>
        <button
          aria-label='Manage conditions and exhaustion'
          className={statusSummaryStyles.mobileStatusAction}
          type='button'
          onClick={() => setConditionsOpen(true)}
        >
          <Text className={overviewStyles.metricLabel}>Conditions</Text>
          <Text className={statusSummaryStyles.mobileStatusValue} truncate>
            {conditionSummary}
          </Text>
        </button>
        <div className={statusSummaryStyles.mobileStatusItem}>
          <Text className={overviewStyles.metricLabel}>Inspiration</Text>
          <button
            aria-label={sheet.overview.inspiration ? 'Use inspiration' : 'Gain inspiration'}
            aria-pressed={sheet.overview.inspiration ?? false}
            className={statusSummaryStyles.mobileInspirationButton}
            data-active={sheet.overview.inspiration ?? false}
            disabled={pending}
            type='button'
            onClick={() =>
              submitCommand({
                type: 'SET_INSPIRATION',
                inspired: !(sheet.overview.inspiration ?? false),
                expectedVersion: sheet.meta.streamVersion
              })
            }
          >
            <IInspiration aria-hidden='true' />
            <span>{sheet.overview.inspiration ? 'Ready' : 'Empty'}</span>
          </button>
        </div>
      </section>

      <Drawer
        classNames={{
          body: `${sheetOverlayStyles.drawerBody} ${statusEditorStyles.statusDrawerBody}`,
          content: sheetOverlayStyles.drawerContent,
          header: sheetOverlayStyles.drawerHeader,
          title: sheetOverlayStyles.drawerTitle
        }}
        closeButtonProps={{
          'aria-label': 'Close conditions and exhaustion',
          className: coreStyles.sheetOverlayCloseButton
        }}
        opened={conditionsOpen}
        overlayProps={{ backgroundOpacity: 0.55, blur: 0 }}
        position='bottom'
        size='min(48rem, calc(100dvh - 3.5rem))'
        title='Conditions & Exhaustion'
        onClose={() => setConditionsOpen(false)}
      >
        <CharacterSheetOverviewStatusStrip
          conditionsOnly
          pending={pending}
          sheet={sheet}
          submitCommand={submitCommand}
        />
      </Drawer>
    </>
  )
}
