import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { Button, Collapse, Group, Stack, Text } from '@mantine/core'
import { CirclePlus } from 'lucide-react'
import { useState } from 'react'
import IInspiration from '#assets/icons/IInspiration'
import { ActiveGrantList } from '../../../../components/activeGrants/ActiveGrantList'
import * as activeGrantStyles from '../../../../components/activeGrants/ActiveGrantList.css'
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
  // A held standing effect lists with the active grants; an ended one waits for its rest (SPELLS-31.2).
  const endedStandingEffects = sheet.overview.standingEffects.filter(({ held }) => !held)
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
      {endedStandingEffects.length > 0 ? (
        <ul aria-label='Ended standing effects' className={activeGrantStyles.list}>
          {endedStandingEffects.map((standing) => (
            <li key={standing.effectId} className={activeGrantStyles.item}>
              <Text size='xs'>
                {standing.label}
                <Text c='dimmed' component='span' size='xs'>
                  {' · Ended until '}
                  {standing.returnsOn === 'LONG_REST' ? 'long rest' : 'short rest'}
                </Text>
              </Text>
            </li>
          ))}
        </ul>
      ) : null}
      {sheet.overview.consequences.length > 0 ? (
        // Effects and recovery are the GM's rulings (D187a): the table's healing shows as guidance.
        <ul aria-label='Lingering consequences' className={activeGrantStyles.list}>
          {sheet.overview.consequences.map((consequence) => (
            <li key={consequence.id} className={activeGrantStyles.item}>
              <Stack gap={0}>
                <Text size='xs'>
                  {consequence.label}
                  <Text c='dimmed' component='span' size='xs'>
                    {' · '}
                    {consequence.tableLabel}
                  </Text>
                </Text>
                <Text size='xs'>{consequence.effect}</Text>
                <Text c='dimmed' size='xs'>
                  Healing: {consequence.healing}
                </Text>
              </Stack>
              {sheet.meta.capabilities.removeConsequences ? (
                <Button
                  aria-label={`Remove ${consequence.label}`}
                  disabled={pending}
                  size='compact-xs'
                  variant='default'
                  onClick={() =>
                    submitCommand({
                      type: 'REMOVE_CONSEQUENCE',
                      consequenceId: consequence.id,
                      expectedVersion: sheet.meta.streamVersion
                    })
                  }
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {sheet.overview.concentration && sheet.meta.capabilities.managePlayState ? (
        <Group gap='xs'>
          <Text size='xs'>
            {sheet.overview.concentration.label
              ? `Concentrating on ${sheet.overview.concentration.label}`
              : 'Concentrating'}
          </Text>
          <Button
            disabled={pending}
            size='compact-xs'
            variant='default'
            onClick={() =>
              submitCommand({
                type: 'END_CONCENTRATION',
                expectedVersion: sheet.meta.streamVersion
              })
            }
          >
            End Concentration
          </Button>
        </Group>
      ) : null}

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
