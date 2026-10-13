import { Alert, Badge, Button, Select, Text } from '@mantine/core'
import type {
  CharacterSheetPanelDto,
  CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import { formatSigned } from '../core/characterSheet.utils'
import { CharacterSheetAbilityPanels } from './CharacterSheetAbilityPanels'
import { CharacterSheetAdjustmentEditor } from './CharacterSheetAdjustmentEditor'
import { CharacterSheetCalculationBreakdown } from './CharacterSheetCalculationBreakdown'
import { CharacterSheetLengthEditor } from './CharacterSheetLengthEditor'
import { CharacterSheetProficiencyPanels } from './CharacterSheetProficiencyPanels'
import {
  getPanelStateLabel,
  getSheetAdjustmentMetadata,
  getSheetEditorKey
} from './inspector.model'
import * as inspectorEditorStyles from './inspectorEditor.css'
import * as inspectorShellStyles from './inspectorShell.css'

type CharacterSheetRulesPanelDto = Exclude<
  CharacterSheetPanelDto,
  { kind: 'COMPANION' | 'VEHICLE' | 'SPELL' | 'SPELLS' | 'ITEM' }
>

export function CharacterSheetRulesPanel({
  expectedVersion,
  panel,
  pending,
  submitCommand,
  onTargetChange
}: {
  expectedVersion: number
  panel: CharacterSheetRulesPanelDto
  pending: boolean
  submitCommand: SubmitSheetCommand
  onTargetChange: (target: CharacterSheetPanelTargetDto) => void
}) {
  const stateLabel = getPanelStateLabel(panel.state)
  const stateColor =
    panel.state === 'OVERRIDDEN' ? 'orange' : panel.state === 'ADJUSTED' ? 'cyan' : 'gray'
  const canUpsert = panel.editable && panel.allowedCommands.includes('UPSERT_ADJUSTMENT')
  const canRemove = panel.editable && panel.allowedCommands.includes('REMOVE_ADJUSTMENT')
  const canCustomize = canUpsert && canRemove
  const canReset = panel.editable && panel.allowedCommands.includes('RESET_ADJUSTMENTS')
  const canSetMovementPreference =
    panel.editable && panel.allowedCommands.includes('SET_MOVEMENT_DISPLAY_PREFERENCE')

  async function removeAdjustment(
    adjustmentId: string | undefined,
    family:
      | 'ABILITY'
      | 'SAVING_THROW'
      | 'SKILL'
      | 'PASSIVE'
      | 'SENSE'
      | 'MOVEMENT'
      | 'DEFENSE'
      | 'PROFICIENCY',
    target = panel.target
  ) {
    if (!adjustmentId) return true
    return await submitCommand({
      type: 'REMOVE_SHEET_ADJUSTMENT',
      adjustmentId,
      family,
      target,
      expectedVersion
    })
  }

  async function resetPanel() {
    return await submitCommand({
      type: 'RESET_SHEET_PANEL_ADJUSTMENTS',
      target: panel.target,
      expectedVersion
    })
  }

  function renderSummary() {
    switch (panel.kind) {
      case 'ABILITY':
        return {
          label: 'Effective score',
          value: `${panel.score} (${formatSigned(panel.modifier)})`
        }
      case 'SAVING_THROW':
      case 'SKILL':
        return { label: 'Effective total', value: formatSigned(panel.total) }
      case 'SKILLS':
        return { label: 'Available skills', value: String(panel.skills.length) }
      case 'SENSES':
        if (panel.target.entry?.kind === 'PASSIVE' && panel.passiveChecks[0]) {
          return { label: 'Effective total', value: String(panel.passiveChecks[0].total) }
        }
        if (panel.target.entry?.kind === 'SENSE' && panel.senses[0]) {
          const [sense] = panel.senses
          switch (sense.rangeKind) {
            case 'NOT_HELD':
              return { label: 'Effective range', value: 'Not held' }
            case 'UNLIMITED':
              return { label: 'Effective range', value: 'Unlimited' }
            case 'DISTANCE':
              return { label: 'Effective range', value: `${sense.range} ${sense.unitLabel}` }
          }
        }
        return {
          label: 'Available senses',
          value: String(
            panel.passiveChecks.length +
              panel.senses.filter((sense) => sense.rangeKind !== 'NOT_HELD').length
          )
        }
      case 'MOVEMENT': {
        const primary = panel.speeds.find((speed) => speed.speedId === panel.primarySpeedId)
        return {
          label: 'Primary movement',
          value: primary ? `${primary.amount} ${primary.unitLabel}` : 'Not available'
        }
      }
      case 'DEFENSES':
        return { label: 'Active defenses', value: String(panel.defenses.length) }
      case 'PROFICIENCIES':
        return { label: 'Training entries', value: String(panel.proficiencies.length) }
      case 'FEATURE':
        return { label: 'Feature source', value: panel.sourceLabel }
      case 'BACKGROUND':
        return { label: 'Background features', value: String(panel.features.length) }
      case 'RESOURCE':
        return { label: 'Remaining uses', value: `${panel.remaining} / ${panel.maximum}` }
      case 'EXTRAS':
        return {
          label: 'Total extras',
          value: String(
            panel.companionCount + panel.mountCount + panel.ownedCreatureCount + panel.vehicleCount
          )
        }
      default:
        return panel satisfies never
    }
  }

  const summary = renderSummary()

  return (
    <div className={inspectorShellStyles.inspector}>
      <section className={inspectorShellStyles.section}>
        <div className={inspectorShellStyles.summary}>
          <div>
            <Text className={inspectorShellStyles.summaryLabel}>{summary.label}</Text>
            <Text className={inspectorShellStyles.summaryValue}>{summary.value}</Text>
          </div>
          <Badge className={inspectorShellStyles.stateBadge} color={stateColor} variant='light'>
            {stateLabel}
          </Badge>
        </div>
        {panel.state === 'OVERRIDDEN' ? (
          <Alert color='orange' title='Absolute override active'>
            Target-specific contributions remain stored for inspection, but the override sets the
            final value.
          </Alert>
        ) : null}
      </section>

      {panel.kind === 'ABILITY' ||
      panel.kind === 'SAVING_THROW' ||
      panel.kind === 'SKILL' ||
      panel.kind === 'SKILLS' ? (
        <CharacterSheetAbilityPanels
          canCustomize={canCustomize}
          expectedVersion={expectedVersion}
          panel={panel}
          pending={pending}
          submitCommand={submitCommand}
          onRemoveAdjustment={removeAdjustment}
          onTargetChange={onTargetChange}
        />
      ) : null}

      {panel.kind === 'SENSES' ? (
        <>
          {panel.passiveChecks.length || !panel.target.entry ? (
            <section className={inspectorShellStyles.section}>
              <h3 className={inspectorShellStyles.sectionTitle}>
                {panel.target.entry ? 'Calculation' : 'Passive checks'}
              </h3>
              {panel.passiveChecks.length ? (
                panel.passiveChecks.map((passive) => (
                  <div key={passive.skillId}>
                    <CharacterSheetCalculationBreakdown calculation={passive.calculation} />
                    {canCustomize ? (
                      <CharacterSheetAdjustmentEditor
                        editor={passive.editor}
                        key={getSheetEditorKey(passive.editor)}
                        pending={pending}
                        onClear={() => removeAdjustment(passive.editor.adjustmentId, 'PASSIVE')}
                        onCommit={(commit) =>
                          submitCommand({
                            type: 'UPSERT_SHEET_ADJUSTMENT',
                            expectedVersion,
                            adjustment: {
                              ...getSheetAdjustmentMetadata(passive.editor.adjustmentId, commit),
                              family: 'PASSIVE',
                              skillId: passive.skillId,
                              field: 'TOTAL_OVERRIDE',
                              value: Number(commit.value)
                            }
                          })
                        }
                      />
                    ) : null}
                  </div>
                ))
              ) : (
                <Text className={inspectorShellStyles.muted}>No passive checks are defined.</Text>
              )}
            </section>
          ) : null}
          {panel.senses.length || !panel.target.entry ? (
            <section className={inspectorShellStyles.section}>
              <h3 className={inspectorShellStyles.sectionTitle}>
                {panel.target.entry ? 'Calculation' : 'Special senses'}
              </h3>
              {panel.senses.map((sense) => (
                <div key={sense.senseId}>
                  {sense.rangeKind === 'DISTANCE' ? (
                    <CharacterSheetCalculationBreakdown calculation={sense.calculation} />
                  ) : null}
                  {sense.rangeKind === 'NOT_HELD' ? (
                    <Text className={inspectorShellStyles.muted}>
                      {sense.label}: not held. Set a range to add it.
                    </Text>
                  ) : null}
                  {canCustomize ? (
                    <CharacterSheetLengthEditor
                      editor={sense.editor}
                      key={getSheetEditorKey(sense.editor)}
                      pending={pending}
                      onClear={() => removeAdjustment(sense.editor.adjustmentId, 'SENSE')}
                      onCommit={(commit) =>
                        submitCommand({
                          type: 'UPSERT_SHEET_ADJUSTMENT',
                          expectedVersion,
                          adjustment: {
                            ...getSheetAdjustmentMetadata(sense.editor.adjustmentId, commit),
                            family: 'SENSE',
                            senseId: sense.senseId,
                            field: 'RANGE_OVERRIDE',
                            value: commit.value
                          }
                        })
                      }
                    />
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}
        </>
      ) : null}

      {panel.kind === 'MOVEMENT' ? (
        <>
          <section className={inspectorShellStyles.section}>
            <h3 className={inspectorShellStyles.sectionTitle}>Movement speeds</h3>
            {panel.speeds.map((speed) => (
              <div key={speed.speedId}>
                <Text fw={720}>
                  {speed.label}: {speed.amount} {speed.unitLabel}
                </Text>
                {canCustomize ? (
                  <CharacterSheetAdjustmentEditor
                    editor={speed.editor}
                    key={getSheetEditorKey(speed.editor)}
                    pending={pending}
                    onClear={() => removeAdjustment(speed.editor.adjustmentId, 'MOVEMENT')}
                    onCommit={(commit) =>
                      submitCommand({
                        type: 'UPSERT_SHEET_ADJUSTMENT',
                        expectedVersion,
                        adjustment: {
                          ...getSheetAdjustmentMetadata(speed.editor.adjustmentId, commit),
                          family: 'MOVEMENT',
                          speedId: speed.speedId,
                          field: 'SPEED_OVERRIDE',
                          value: Number(commit.value)
                        }
                      })
                    }
                  />
                ) : null}
              </div>
            ))}
          </section>
          <section className={inspectorShellStyles.section}>
            <h3 className={inspectorShellStyles.sectionTitle}>Primary display</h3>
            <Select
              data={panel.preferenceOptions}
              disabled={pending || !canSetMovementPreference}
              label='Movement shown on the sheet'
              value={panel.preference.mode === 'AUTO' ? 'AUTO' : panel.preference.speedId}
              onChange={(value) => {
                if (!value) return
                void submitCommand({
                  type: 'SET_MOVEMENT_DISPLAY_PREFERENCE',
                  expectedVersion,
                  preference:
                    value === 'AUTO' ? { mode: 'AUTO' } : { mode: 'EXPLICIT', speedId: value }
                })
              }}
            />
          </section>
        </>
      ) : null}

      {panel.kind === 'DEFENSES' || panel.kind === 'PROFICIENCIES' ? (
        <CharacterSheetProficiencyPanels
          canRemove={canRemove}
          canUpsert={canUpsert}
          expectedVersion={expectedVersion}
          panel={panel}
          pending={pending}
          submitCommand={submitCommand}
          onRemoveAdjustment={removeAdjustment}
        />
      ) : null}

      {panel.description ? (
        <section className={inspectorShellStyles.section}>
          <h3 className={inspectorShellStyles.sectionTitle}>Reference</h3>
          <Text>{panel.description}</Text>
        </section>
      ) : null}

      {panel.state !== 'DEFAULT' && canReset ? (
        <section className={inspectorShellStyles.section}>
          <div className={inspectorEditorStyles.actions}>
            <Button
              color='red'
              disabled={pending}
              variant='subtle'
              onClick={() => void resetPanel()}
            >
              Reset customizations
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
