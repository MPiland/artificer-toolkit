import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { Collapse, Text } from '@mantine/core'
import { CirclePlus } from 'lucide-react'
import { useState } from 'react'
import IInspiration from '#assets/icons/IInspiration'
import { ActiveGrantList } from '../../../../components/activeGrants/ActiveGrantList'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import { ConditionsEditor } from './ConditionsEditor'
import { ExhaustionEditor } from './ExhaustionEditor'
import * as statusEditorStyles from './statusEditor.css'
import * as statusSummaryStyles from './statusSummary.css'

export function CharacterSheetOverviewStatusStrip({
  conditionsOnly = false,
  pending,
  sheet,
  submitCommand
}: {
  conditionsOnly?: boolean
  pending: boolean
  sheet: Omit<CharacterSheetCommonDto, 'hasSpellcasting'>
  submitCommand: SubmitSheetCommand
}) {
  const [conditionsOpen, setConditionsOpen] = useState(false)
  const conditions = sheet.overview.conditions.length
    ? sheet.overview.conditions.map((condition) => condition.label).join(', ')
    : 'Add Condition'

  return (
    <section
      className={statusSummaryStyles.statusStripPanel}
      aria-label={conditionsOnly ? 'Conditions and exhaustion' : 'Status summary'}
    >
      <div
        className={`${statusSummaryStyles.statusStrip} ${
          conditionsOnly ? statusSummaryStyles.conditionsOnlyStrip : ''
        }`}
      >
        <div className={statusSummaryStyles.statusStripItem}>
          <Text className={statusSummaryStyles.statusStripLabel}>
            {sheet.overview.exhaustion.label}
          </Text>
          <div
            className={`${statusSummaryStyles.statusStripContent} ${statusSummaryStyles.statusStripContentCenter}`}
          >
            <div
              className={`${statusSummaryStyles.statusStripStack} ${statusSummaryStyles.statusStripCenteredStack}`}
            >
              {conditionsOnly ? (
                <Text className={statusSummaryStyles.statusStripValue}>
                  Level {sheet.overview.exhaustion.level}
                </Text>
              ) : (
                <button
                  aria-expanded={conditionsOpen}
                  aria-label={`Manage exhaustion, currently level ${sheet.overview.exhaustion.level}`}
                  className={statusSummaryStyles.statusValueButton}
                  disabled={pending}
                  type='button'
                  onClick={() => setConditionsOpen((current) => !current)}
                >
                  Level {sheet.overview.exhaustion.level}
                </button>
              )}
            </div>
          </div>
        </div>
        {conditionsOnly ? null : (
          <div className={statusSummaryStyles.statusStripItem}>
            <Text className={statusSummaryStyles.statusStripLabel}>Inspiration</Text>
            <div
              className={`${statusSummaryStyles.statusStripContent} ${statusSummaryStyles.statusStripContentCenter}`}
            >
              <button
                aria-label={sheet.overview.inspiration ? 'Use inspiration' : 'Gain inspiration'}
                aria-pressed={sheet.overview.inspiration ?? false}
                className={statusSummaryStyles.inspirationPip}
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
                <IInspiration />
              </button>
            </div>
          </div>
        )}
        <div className={statusSummaryStyles.conditionSummary}>
          <Text className={statusSummaryStyles.statusStripLabel}>Conditions</Text>
          <div
            className={`${statusSummaryStyles.statusStripContent} ${statusSummaryStyles.statusStripContentStart}`}
          >
            {conditionsOnly ? (
              <Text className={statusSummaryStyles.statusStripValue}>{conditions}</Text>
            ) : (
              <button
                aria-expanded={conditionsOpen}
                className={statusSummaryStyles.conditionAddShell}
                disabled={pending}
                type='button'
                onClick={() => setConditionsOpen((current) => !current)}
              >
                <Text className={statusSummaryStyles.conditionAddText} truncate>
                  {conditions}
                </Text>
                <CirclePlus aria-hidden='true' size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
      <ActiveGrantList
        disabled={pending}
        grants={sheet.overview.activeGrants}
        label='Active grants'
        onEnd={
          sheet.meta.capabilities.endActiveEffects
            ? (effectId) =>
                submitCommand({
                  type: 'END_ACTIVE_EFFECT',
                  effectId,
                  expectedVersion: sheet.meta.streamVersion
                })
            : undefined
        }
      />

      <Collapse
        className={conditionsOnly ? undefined : statusEditorStyles.statusControlOverlay}
        expanded={conditionsOnly || conditionsOpen}
      >
        <div
          className={`${statusEditorStyles.statusControlPanel} ${
            conditionsOnly ? '' : statusEditorStyles.statusControlPanelFloating
          }`}
        >
          <ConditionsEditor pending={pending} sheet={sheet} submitCommand={submitCommand} />
          <ExhaustionEditor pending={pending} sheet={sheet} submitCommand={submitCommand} />
        </div>
      </Collapse>
    </section>
  )
}
