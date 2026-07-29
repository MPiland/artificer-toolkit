import { Collapse, Text } from '@mantine/core'
import { CirclePlus } from 'lucide-react'
import { useState } from 'react'
import IInspiration from '#assets/icons/IInspiration'
import type { CharacterSheet, SubmitSheetCommand } from '../core/CharacterSheet.types'
import * as rowStyles from '../shared/rows.css'
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
  sheet: CharacterSheet
  submitCommand: SubmitSheetCommand
}) {
  const [conditionsOpen, setConditionsOpen] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const conditions = sheet.overview.conditions.length
    ? sheet.overview.conditions.map((condition) => condition.label).join(', ')
    : 'Add Condition'

  async function setExhaustionLevel(level: number) {
    setSummaryError(null)
    const succeeded = await submitCommand({
      type: 'SET_EXHAUSTION',
      level,
      notes: sheet.overview.exhaustion.notes,
      expectedVersion: sheet.meta.streamVersion
    })

    if (!succeeded) {
      setSummaryError('Exhaustion could not be updated. The Sheet was refreshed; try again.')
    }
  }

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
            className={`${statusSummaryStyles.statusStripContent} ${statusSummaryStyles.statusStripContentStart}`}
          >
            <div className={statusSummaryStyles.statusStripStack}>
              <Text className={statusSummaryStyles.statusStripValue}>
                Level {sheet.overview.exhaustion.level}
              </Text>
              <div className={statusSummaryStyles.exhaustionPips}>
                {Array.from(
                  {
                    length:
                      sheet.overview.exhaustion.maximumLevel -
                      sheet.overview.exhaustion.minimumLevel
                  },
                  (_, index) => {
                    const level = sheet.overview.exhaustion.minimumLevel + index + 1
                    const active = level <= sheet.overview.exhaustion.level
                    const nextLevel =
                      active && level === sheet.overview.exhaustion.level
                        ? sheet.overview.exhaustion.minimumLevel
                        : level

                    return (
                      <button
                        aria-label={
                          nextLevel === sheet.overview.exhaustion.minimumLevel
                            ? 'Clear exhaustion'
                            : `Set exhaustion level ${level}`
                        }
                        aria-pressed={active}
                        className={statusSummaryStyles.exhaustionPip}
                        data-active={active}
                        disabled={pending}
                        key={level}
                        type='button'
                        onClick={() => void setExhaustionLevel(nextLevel)}
                      >
                        <span
                          aria-hidden='true'
                          className={statusSummaryStyles.exhaustionPipVisual}
                          data-active={active}
                        />
                      </button>
                    )
                  }
                )}
              </div>
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
                <Text truncate>{conditions}</Text>
                <CirclePlus aria-hidden='true' size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

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
          {summaryError ? (
            <Text className={rowStyles.commandInlineError} role='alert'>
              {summaryError}
            </Text>
          ) : null}
        </div>
      </Collapse>
    </section>
  )
}
