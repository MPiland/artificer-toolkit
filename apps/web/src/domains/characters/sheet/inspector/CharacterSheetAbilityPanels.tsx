import { Accordion, Text } from '@mantine/core'
import { characterProficiencyLevelDtoSchema } from '@artificer-toolkit/schema/api/characterSheet'
import { abilityCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import type {
  CharacterSheetPanelDto,
  CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import { formatSigned } from '../core/characterSheet.utils'
import { CharacterSheetAdjustmentEditor } from './CharacterSheetAdjustmentEditor'
import { CharacterSheetCalculationBreakdown } from './CharacterSheetCalculationBreakdown'
import {
  getPanelStateLabel,
  getSheetAdjustmentMetadata,
  getSheetEditorKey
} from './inspector.model'
import * as inspectorEditorStyles from './inspectorEditor.css'
import * as inspectorShellStyles from './inspectorShell.css'

type AbilityPanel = Extract<
  CharacterSheetPanelDto,
  { kind: 'ABILITY' | 'SAVING_THROW' | 'SKILL' | 'SKILLS' }
>

type RemoveAdjustment = (
  adjustmentId: string | undefined,
  family: 'ABILITY' | 'SAVING_THROW' | 'SKILL'
) => Promise<boolean>

export function CharacterSheetAbilityPanels({
  canCustomize,
  expectedVersion,
  panel,
  pending,
  submitCommand,
  onRemoveAdjustment,
  onTargetChange
}: {
  canCustomize: boolean
  expectedVersion: number
  panel: AbilityPanel
  pending: boolean
  submitCommand: SubmitSheetCommand
  onRemoveAdjustment: RemoveAdjustment
  onTargetChange: (target: CharacterSheetPanelTargetDto) => void
}) {
  if (panel.kind === 'SKILLS') {
    return (
      <section className={inspectorShellStyles.section}>
        <div className={inspectorEditorStyles.entries}>
          {panel.skills.map((skill) => (
            <button
              className={inspectorEditorStyles.entryButton}
              key={skill.skillId}
              type='button'
              onClick={() => onTargetChange(skill.target)}
            >
              <span>
                <Text fw={720}>{skill.label}</Text>
                <Text className={inspectorShellStyles.muted}>
                  {skill.ability} · {getPanelStateLabel(skill.state)}
                </Text>
              </span>
              <Text fw={800}>{formatSigned(skill.total)}</Text>
            </button>
          ))}
        </div>
      </section>
    )
  }

  return (
    <>
      {panel.kind === 'ABILITY' && canCustomize ? (
        <section className={inspectorShellStyles.section}>
          <h3 className={inspectorShellStyles.sectionTitle}>Calculation</h3>
          <CharacterSheetCalculationBreakdown calculation={panel.scoreCalculation} />
        </section>
      ) : panel.kind === 'SAVING_THROW' || panel.kind === 'SKILL' ? (
        <section className={inspectorShellStyles.section}>
          <h3 className={inspectorShellStyles.sectionTitle}>Calculation</h3>
          <CharacterSheetCalculationBreakdown calculation={panel.calculation} />
        </section>
      ) : null}

      {panel.kind === 'ABILITY' ? (
        <section className={inspectorShellStyles.section}>
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
                    key={getSheetEditorKey(editor)}
                    pending={pending}
                    onClear={() => onRemoveAdjustment(editor.adjustmentId, 'ABILITY')}
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
        <section className={inspectorShellStyles.section}>
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
                    key={getSheetEditorKey(editor)}
                    pending={pending}
                    onClear={() => onRemoveAdjustment(editor.adjustmentId, 'SAVING_THROW')}
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
                  key={getSheetEditorKey(panel.proficiencyEditor)}
                  pending={pending}
                  onClear={() =>
                    onRemoveAdjustment(panel.proficiencyEditor.adjustmentId, 'SAVING_THROW')
                  }
                  onCommit={async (commit) => {
                    const level = characterProficiencyLevelDtoSchema.safeParse(commit.value)
                    if (!level.success) return false
                    return submitCommand({
                      type: 'UPSERT_SHEET_ADJUSTMENT',
                      expectedVersion,
                      adjustment: {
                        ...getSheetAdjustmentMetadata(panel.proficiencyEditor.adjustmentId, commit),
                        family: 'SAVING_THROW',
                        ability: panel.ability,
                        field: 'PROFICIENCY_OVERRIDE',
                        value: level.data
                      }
                    })
                  }}
                />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </section>
      ) : null}

      {panel.kind === 'SKILL' && canCustomize ? (
        <section className={inspectorShellStyles.section}>
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
                    key={getSheetEditorKey(editor)}
                    pending={pending}
                    onClear={() => onRemoveAdjustment(editor.adjustmentId, 'SKILL')}
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
                  key={getSheetEditorKey(panel.proficiencyEditor)}
                  pending={pending}
                  onClear={() => onRemoveAdjustment(panel.proficiencyEditor.adjustmentId, 'SKILL')}
                  onCommit={async (commit) => {
                    const level = characterProficiencyLevelDtoSchema.safeParse(commit.value)
                    if (!level.success) return false
                    return submitCommand({
                      type: 'UPSERT_SHEET_ADJUSTMENT',
                      expectedVersion,
                      adjustment: {
                        ...getSheetAdjustmentMetadata(panel.proficiencyEditor.adjustmentId, commit),
                        family: 'SKILL',
                        skillId: panel.skillId,
                        field: 'PROFICIENCY_OVERRIDE',
                        value: level.data
                      }
                    })
                  }}
                />
                <CharacterSheetAdjustmentEditor
                  editor={panel.abilityEditor}
                  key={getSheetEditorKey(panel.abilityEditor)}
                  pending={pending}
                  onClear={() => onRemoveAdjustment(panel.abilityEditor.adjustmentId, 'SKILL')}
                  onCommit={async (commit) => {
                    const ability = abilityCodeSchema.safeParse(commit.value)
                    if (!ability.success) return false
                    return submitCommand({
                      type: 'UPSERT_SHEET_ADJUSTMENT',
                      expectedVersion,
                      adjustment: {
                        ...getSheetAdjustmentMetadata(panel.abilityEditor.adjustmentId, commit),
                        family: 'SKILL',
                        skillId: panel.skillId,
                        field: 'GOVERNING_ABILITY_OVERRIDE',
                        value: ability.data
                      }
                    })
                  }}
                />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </section>
      ) : null}
    </>
  )
}
