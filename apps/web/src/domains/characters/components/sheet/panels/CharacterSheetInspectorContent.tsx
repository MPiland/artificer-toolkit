import { Accordion, Alert, Badge, Button, Select, Text } from '@mantine/core'

import type { CharacterSheetPanelDto, CharacterSheetPanelTargetDto } from '#app/lib/api'
import { formatSigned } from '../characterSheet.utils'
import type { SubmitSheetCommand } from '../CharacterSheet.types'
import type { CharacterSheet } from '../CharacterSheet.types'
import { CharacterSheetAdjustmentEditor } from './CharacterSheetAdjustmentEditor'
import { CharacterSheetCalculationBreakdown } from './CharacterSheetCalculationBreakdown'
import { CharacterSheetExtraPanel } from './CharacterSheetExtraPanel'
import { CharacterSheetItemPanelContent } from './CharacterSheetItemPanel'
import {
  CharacterSheetSpellPanelContent,
  CharacterSheetSpellsPanelContent
} from './CharacterSheetSpellPanels'
import { getPanelStateLabel, getSheetAdjustmentMetadata } from './characterSheetInspector.model'
import * as styles from './characterSheetInspector.css'

export function CharacterSheetInspectorContent({
  expectedVersion,
  equipmentItems,
  panel,
  pending,
  submitCommand,
  onClose,
  onTargetChange,
  onOpenBuilder
}: {
  expectedVersion: number
  equipmentItems: CharacterSheet['inventory']['items']
  panel: CharacterSheetPanelDto
  pending: boolean
  submitCommand: SubmitSheetCommand
  onClose: () => void
  onTargetChange: (target: CharacterSheetPanelTargetDto) => void
  onOpenBuilder: () => void
}) {
  if (panel.kind === 'COMPANION' || panel.kind === 'VEHICLE') {
    return (
      <CharacterSheetExtraPanel
        expectedVersion={expectedVersion}
        equipmentItems={equipmentItems}
        panel={panel}
        pending={pending}
        submitCommand={submitCommand}
        onClose={onClose}
      />
    )
  }

  if (panel.kind === 'SPELL') {
    return (
      <CharacterSheetSpellPanelContent
        expectedVersion={expectedVersion}
        panel={panel}
        pending={pending}
        submitCommand={submitCommand}
      />
    )
  }
  if (panel.kind === 'SPELLS') {
    return (
      <CharacterSheetSpellsPanelContent
        expectedVersion={expectedVersion}
        panel={panel}
        pending={pending}
        submitCommand={submitCommand}
        onTargetChange={onTargetChange}
        onOpenBuilder={onOpenBuilder}
      />
    )
  }
  if (panel.kind === 'ITEM') {
    return (
      <CharacterSheetItemPanelContent
        expectedVersion={expectedVersion}
        panel={panel}
        pending={pending}
        submitCommand={submitCommand}
        onClose={onClose}
      />
    )
  }

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
        return {
          label: 'Available senses',
          value: String(
            panel.passiveChecks.length + panel.senses.filter((sense) => sense.range > 0).length
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
      case 'SPELL':
        return { label: 'Spell source', value: panel.sourceLabel }
      case 'SPELLS':
        return {
          label: 'Manageable spells',
          value: String(panel.groups.reduce((count, group) => count + group.sources.length, 0))
        }
      case 'FEATURE':
        return { label: 'Feature source', value: panel.sourceLabel }
      case 'ITEM':
        return { label: 'Owned item', value: panel.displayName }
      case 'BACKGROUND':
        return { label: 'Background features', value: String(panel.features.length) }
      case 'RESOURCE':
        return { label: 'Remaining uses', value: `${panel.remaining} / ${panel.maximum}` }
      default:
        return { label: 'Details', value: 'â€”' }
    }
  }

  const summary = renderSummary()

  return (
    <div className={styles.inspector}>
      <section className={styles.section}>
        <div className={styles.summary}>
          <div>
            <Text className={styles.summaryLabel}>{summary.label}</Text>
            <Text className={styles.summaryValue}>{summary.value}</Text>
          </div>
          <Badge className={styles.stateBadge} color={stateColor} variant='light'>
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

      {panel.kind === 'ABILITY' && canCustomize ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Calculation</h3>
          <CharacterSheetCalculationBreakdown calculation={panel.scoreCalculation} />
        </section>
      ) : panel.kind === 'SAVING_THROW' || panel.kind === 'SKILL' ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Calculation</h3>
          <CharacterSheetCalculationBreakdown calculation={panel.calculation} />
        </section>
      ) : null}

      {panel.kind === 'ABILITY' ? (
        <section className={styles.section}>
          <Accordion
            defaultValue={panel.state === 'DEFAULT' ? null : 'customize'}
            key={`${panel.panelId}:${panel.state}`}
          >
            <Accordion.Item value='customize'>
              <Accordion.Control>Customize</Accordion.Control>
              <Accordion.Panel>
                {panel.editors.map((editor) => (
                  <CharacterSheetAdjustmentEditor
                    editor={editor}
                    key={editor.field}
                    pending={pending}
                    onClear={() => removeAdjustment(editor.adjustmentId, 'ABILITY')}
                    onCommit={(commit) =>
                      submitCommand({
                        type: 'UPSERT_SHEET_ADJUSTMENT',
                        expectedVersion,
                        adjustment: {
                          ...getSheetAdjustmentMetadata(editor.adjustmentId, commit),
                          family: 'ABILITY',
                          ability: panel.ability,
                          field: editor.field,
                          value: Number(commit.value)
                        }
                      })
                    }
                  />
                ))}
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </section>
      ) : null}

      {panel.kind === 'SAVING_THROW' && canCustomize ? (
        <section className={styles.section}>
          <Accordion
            defaultValue={panel.state === 'DEFAULT' ? null : 'customize'}
            key={`${panel.panelId}:${panel.state}`}
          >
            <Accordion.Item value='customize'>
              <Accordion.Control>Customize</Accordion.Control>
              <Accordion.Panel>
                {panel.numericEditors.map((editor) => (
                  <CharacterSheetAdjustmentEditor
                    editor={editor}
                    key={editor.field}
                    pending={pending}
                    onClear={() => removeAdjustment(editor.adjustmentId, 'SAVING_THROW')}
                    onCommit={(commit) =>
                      submitCommand({
                        type: 'UPSERT_SHEET_ADJUSTMENT',
                        expectedVersion,
                        adjustment: {
                          ...getSheetAdjustmentMetadata(editor.adjustmentId, commit),
                          family: 'SAVING_THROW',
                          ability: panel.ability,
                          field: editor.field,
                          value: Number(commit.value)
                        }
                      })
                    }
                  />
                ))}
                <CharacterSheetAdjustmentEditor
                  editor={panel.proficiencyEditor}
                  pending={pending}
                  onClear={() =>
                    removeAdjustment(panel.proficiencyEditor.adjustmentId, 'SAVING_THROW')
                  }
                  onCommit={(commit) =>
                    submitCommand({
                      type: 'UPSERT_SHEET_ADJUSTMENT',
                      expectedVersion,
                      adjustment: {
                        ...getSheetAdjustmentMetadata(panel.proficiencyEditor.adjustmentId, commit),
                        family: 'SAVING_THROW',
                        ability: panel.ability,
                        field: 'PROFICIENCY_OVERRIDE',
                        value: String(commit.value) as 'NONE' | 'HALF' | 'FULL' | 'DOUBLE'
                      }
                    })
                  }
                />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </section>
      ) : null}

      {panel.kind === 'SKILL' && canCustomize ? (
        <section className={styles.section}>
          <Accordion
            defaultValue={panel.state === 'DEFAULT' ? null : 'customize'}
            key={`${panel.panelId}:${panel.state}`}
          >
            <Accordion.Item value='customize'>
              <Accordion.Control>Customize</Accordion.Control>
              <Accordion.Panel>
                {panel.numericEditors.map((editor) => (
                  <CharacterSheetAdjustmentEditor
                    editor={editor}
                    key={editor.field}
                    pending={pending}
                    onClear={() => removeAdjustment(editor.adjustmentId, 'SKILL')}
                    onCommit={(commit) =>
                      submitCommand({
                        type: 'UPSERT_SHEET_ADJUSTMENT',
                        expectedVersion,
                        adjustment: {
                          ...getSheetAdjustmentMetadata(editor.adjustmentId, commit),
                          family: 'SKILL',
                          skillId: panel.skillId,
                          field: editor.field,
                          value: Number(commit.value)
                        }
                      })
                    }
                  />
                ))}
                <CharacterSheetAdjustmentEditor
                  editor={panel.proficiencyEditor}
                  pending={pending}
                  onClear={() => removeAdjustment(panel.proficiencyEditor.adjustmentId, 'SKILL')}
                  onCommit={(commit) =>
                    submitCommand({
                      type: 'UPSERT_SHEET_ADJUSTMENT',
                      expectedVersion,
                      adjustment: {
                        ...getSheetAdjustmentMetadata(panel.proficiencyEditor.adjustmentId, commit),
                        family: 'SKILL',
                        skillId: panel.skillId,
                        field: 'PROFICIENCY_OVERRIDE',
                        value: String(commit.value) as 'NONE' | 'HALF' | 'FULL' | 'DOUBLE'
                      }
                    })
                  }
                />
                <CharacterSheetAdjustmentEditor
                  editor={panel.abilityEditor}
                  pending={pending}
                  onClear={() => removeAdjustment(panel.abilityEditor.adjustmentId, 'SKILL')}
                  onCommit={(commit) =>
                    submitCommand({
                      type: 'UPSERT_SHEET_ADJUSTMENT',
                      expectedVersion,
                      adjustment: {
                        ...getSheetAdjustmentMetadata(panel.abilityEditor.adjustmentId, commit),
                        family: 'SKILL',
                        skillId: panel.skillId,
                        field: 'GOVERNING_ABILITY_OVERRIDE',
                        value: String(commit.value) as
                          | 'CHARISMA'
                          | 'CONSTITUTION'
                          | 'DEXTERITY'
                          | 'INTELLIGENCE'
                          | 'STRENGTH'
                          | 'WISDOM'
                      }
                    })
                  }
                />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </section>
      ) : null}

      {panel.kind === 'SKILLS' ? (
        <section className={styles.section}>
          <div className={styles.entries}>
            {panel.skills.map((skill) => (
              <button
                className={styles.entryButton}
                key={skill.skillId}
                type='button'
                onClick={() => onTargetChange(skill.target)}
              >
                <span>
                  <Text fw={720}>{skill.label}</Text>
                  <Text className={styles.muted}>
                    {skill.ability} · {getPanelStateLabel(skill.state)}
                  </Text>
                </span>
                <Text fw={800}>{formatSigned(skill.total)}</Text>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {panel.kind === 'SENSES' ? (
        <>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Passive checks</h3>
            {panel.passiveChecks.length ? (
              panel.passiveChecks.map((passive) => (
                <div key={passive.skillId}>
                  <CharacterSheetCalculationBreakdown calculation={passive.calculation} />
                  {canCustomize ? (
                    <CharacterSheetAdjustmentEditor
                      editor={passive.editor}
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
              <Text className={styles.muted}>No passive checks are defined.</Text>
            )}
          </section>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Special senses</h3>
            {panel.senses.map((sense) => (
              <div key={sense.senseId}>
                <Text fw={720}>
                  {sense.label}: {sense.range} {sense.unitLabel}
                </Text>
                {canCustomize ? (
                  <CharacterSheetAdjustmentEditor
                    editor={sense.editor}
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
                          value: Number(commit.value)
                        }
                      })
                    }
                  />
                ) : null}
              </div>
            ))}
          </section>
        </>
      ) : null}

      {panel.kind === 'MOVEMENT' ? (
        <>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Movement speeds</h3>
            {panel.speeds.map((speed) => (
              <div key={speed.speedId}>
                <Text fw={720}>
                  {speed.label}: {speed.amount} {speed.unitLabel}
                </Text>
                {canCustomize ? (
                  <CharacterSheetAdjustmentEditor
                    editor={speed.editor}
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
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Primary display</h3>
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

      {panel.kind === 'DEFENSES' ? (
        <>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Current defenses</h3>
            <div className={styles.entries}>
              {panel.defenses.map((defense) => (
                <div className={styles.entry} key={`${defense.kind}:${defense.damageTypeId}`}>
                  <div>
                    <Text fw={720}>{defense.label}</Text>
                    <Text className={styles.muted}>{defense.sourceLabel}</Text>
                  </div>
                  {defense.adjustmentId && canRemove ? (
                    <Button
                      color='red'
                      disabled={pending}
                      size='xs'
                      variant='subtle'
                      onClick={() => void removeAdjustment(defense.adjustmentId, 'DEFENSE')}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
              {!panel.defenses.length ? (
                <Text className={styles.muted}>No active defenses.</Text>
              ) : null}
            </div>
          </section>
          {canUpsert ? (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Add defense</h3>
              <Select
                clearable
                data={panel.additionOptions.map((option) => ({
                  value: `${option.defenseKind}:${option.damageTypeId}`,
                  label: option.label
                }))}
                disabled={pending}
                placeholder='Choose a defense'
                searchable
                value={null}
                onChange={(value) => {
                  const option = panel.additionOptions.find(
                    (candidate) => `${candidate.defenseKind}:${candidate.damageTypeId}` === value
                  )
                  if (!option) return
                  void submitCommand({
                    type: 'UPSERT_SHEET_ADJUSTMENT',
                    expectedVersion,
                    adjustment: {
                      family: 'DEFENSE',
                      defenseKind: option.defenseKind,
                      damageTypeId: option.damageTypeId,
                      field: 'ADDITION',
                      value: true
                    }
                  })
                }}
              />
            </section>
          ) : null}
        </>
      ) : null}

      {panel.kind === 'PROFICIENCIES' ? (
        <>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Current training</h3>
            <div className={styles.entries}>
              {panel.proficiencies.map((proficiency) => (
                <div className={styles.entry} key={`${proficiency.kind}:${proficiency.targetId}`}>
                  <div>
                    <Text fw={720}>{proficiency.label}</Text>
                    <Text className={styles.muted}>
                      {proficiency.kind} · {proficiency.sourceLabel}
                    </Text>
                  </div>
                  {proficiency.adjustmentId && canRemove ? (
                    <Button
                      color='red'
                      disabled={pending}
                      size='xs'
                      variant='subtle'
                      onClick={() => void removeAdjustment(proficiency.adjustmentId, 'PROFICIENCY')}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
              {!panel.proficiencies.length ? (
                <Text className={styles.muted}>No training entries.</Text>
              ) : null}
            </div>
          </section>
          {canUpsert ? (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Add proficiency</h3>
              <Select
                clearable
                data={panel.additionOptions.map((option) => ({
                  value: `${option.kind}:${option.targetId}`,
                  label: `${option.label} · ${option.kind}`
                }))}
                disabled={pending}
                placeholder='Choose training'
                searchable
                value={null}
                onChange={(value) => {
                  const option = panel.additionOptions.find(
                    (candidate) => `${candidate.kind}:${candidate.targetId}` === value
                  )
                  if (!option) return
                  void submitCommand({
                    type: 'UPSERT_SHEET_ADJUSTMENT',
                    expectedVersion,
                    adjustment: {
                      family: 'PROFICIENCY',
                      proficiencyKind: option.kind,
                      targetId: option.targetId,
                      field: 'ADDITION',
                      value: true
                    }
                  })
                }}
              />
            </section>
          ) : null}
        </>
      ) : null}

      {panel.description ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Reference</h3>
          <Text>{panel.description}</Text>
        </section>
      ) : null}

      {panel.state !== 'DEFAULT' && canReset ? (
        <section className={styles.section}>
          <div className={styles.actions}>
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
