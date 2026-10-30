import { Accordion, Badge, Button, Switch, Text } from '@mantine/core'
import { useState } from 'react'

import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import { SummonPicks } from '#app/components/summonPicks/SummonPicks'
import { summonPicks } from '#app/components/summonPicks/summonPicks.model'
import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import { CharacterSheetCalculationBreakdown } from './CharacterSheetCalculationBreakdown'
import { CharacterSheetSpellCustomizationEditor } from './CharacterSheetSpellCustomizationEditor'
import { CharacterSheetTextEditor } from './CharacterSheetTextEditor'
import * as inspectorEditorStyles from './inspectorEditor.css'
import * as inspectorShellStyles from './inspectorShell.css'

type SpellPanel = Extract<CharacterSheetPanelDto, { kind: 'SPELL' }>

export function CharacterSheetSpellPanelContent({
  expectedVersion,
  panel,
  pending,
  submitCommand
}: {
  expectedVersion: number
  panel: SpellPanel
  pending: boolean
  submitCommand: SubmitSheetCommand
}) {
  const canAdjust =
    panel.editable &&
    panel.allowedCommands.includes('SET_SPELL_MECHANIC_CUSTOMIZATION') &&
    panel.allowedCommands.includes('REMOVE_SPELL_MECHANIC_CUSTOMIZATION')
  const canCast = panel.editable && panel.allowedCommands.includes('CAST_SPELL')
  const canCustomize =
    panel.editable && panel.allowedCommands.includes('UPDATE_SPELL_SOURCE_CUSTOMIZATION')
  const canReset = panel.editable && panel.allowedCommands.includes('RESET_ADJUSTMENTS')
  const [pickedFormId, setPickedFormId] = useState<string | null>(null)
  const [pickedCreatureTypeId, setPickedCreatureTypeId] = useState<string | null>(null)
  const summonOptions = panel.legalCastModes.find((mode) => mode.summonForms ?? mode.creatureTypes)

  return (
    <div className={inspectorShellStyles.inspector}>
      <section className={inspectorShellStyles.section}>
        <div className={inspectorShellStyles.summary}>
          <div>
            <Text className={inspectorShellStyles.summaryLabel}>Spell source</Text>
            <Text className={inspectorShellStyles.summaryValue}>{panel.sourceLabel}</Text>
          </div>
          <div className={inspectorEditorStyles.badges}>
            {panel.displayAsAttack ? (
              <Badge color='cyan' variant='light'>
                Action
              </Badge>
            ) : null}
          </div>
        </div>
        <Text className={inspectorShellStyles.muted}>{panel.authoredName}</Text>
      </section>

      <section className={inspectorShellStyles.section}>
        <h3 className={inspectorShellStyles.sectionTitle}>Cast</h3>
        <div className={inspectorEditorStyles.entries}>
          {summonOptions ? (
            <SummonPicks
              options={summonOptions}
              {...summonPicks(summonOptions, pickedFormId, pickedCreatureTypeId)}
              disabled={pending || !canCast}
              onFormChange={setPickedFormId}
              onCreatureTypeChange={setPickedCreatureTypeId}
            />
          ) : null}
          {panel.legalCastModes.map((mode) => (
            <div
              className={inspectorEditorStyles.entry}
              key={`${mode.kind}:${mode.slotKey ?? mode.castLevel ?? mode.label}`}
            >
              <div>
                <Text fw={700}>{mode.label}</Text>
                {mode.unavailableReason ? (
                  <Text className={inspectorShellStyles.muted}>{mode.unavailableReason}</Text>
                ) : null}
              </div>
              <Button
                disabled={pending || !canCast || !mode.available}
                size='xs'
                onClick={() =>
                  void submitCommand({
                    type: 'CAST_SPELL',
                    expectedVersion,
                    spellId: panel.spellId,
                    sourceId: panel.source.sourceInstanceId,
                    ...(mode.slotKey ? { slotKey: mode.slotKey } : {}),
                    ...summonPicks(mode, pickedFormId, pickedCreatureTypeId)
                  })
                }
              >
                Cast
              </Button>
            </div>
          ))}
          {!panel.legalCastModes.length ? (
            <Text className={inspectorShellStyles.muted}>
              You cannot cast this spell right now.
            </Text>
          ) : null}
        </div>
      </section>

      <section className={inspectorShellStyles.section}>
        <h3 className={inspectorShellStyles.sectionTitle}>Info</h3>
        <div className={inspectorShellStyles.disclosureBody}>
          <div className={inspectorShellStyles.infoGroup}>
            <h4 className={inspectorShellStyles.sectionTitle}>Spell facts</h4>
            <div className={inspectorEditorStyles.entries}>
              {panel.facts.map((fact) => (
                <div className={inspectorEditorStyles.entry} key={fact.label}>
                  <Text className={inspectorShellStyles.muted}>{fact.label}</Text>
                  <Text fw={700}>{fact.value}</Text>
                </div>
              ))}
            </div>
          </div>
          {panel.calculations.attackBonus ? (
            <div className={inspectorShellStyles.infoGroup}>
              <h4 className={inspectorShellStyles.sectionTitle}>Spell attack</h4>
              <CharacterSheetCalculationBreakdown calculation={panel.calculations.attackBonus} />
            </div>
          ) : null}
          {panel.calculations.saveDC ? (
            <div className={inspectorShellStyles.infoGroup}>
              <h4 className={inspectorShellStyles.sectionTitle}>Save DC</h4>
              <CharacterSheetCalculationBreakdown calculation={panel.calculations.saveDC} />
            </div>
          ) : null}
          {panel.calculations.damageBonus ? (
            <div className={inspectorShellStyles.infoGroup}>
              <h4 className={inspectorShellStyles.sectionTitle}>Damage bonus</h4>
              <CharacterSheetCalculationBreakdown calculation={panel.calculations.damageBonus} />
            </div>
          ) : null}
          {panel.effects.length ? (
            <div className={inspectorShellStyles.infoGroup}>
              <h4 className={inspectorShellStyles.sectionTitle}>Effects</h4>
              <div className={inspectorEditorStyles.entries}>
                {panel.effects.map((effect, index) => (
                  <div className={inspectorEditorStyles.entry} key={`${effect.label}:${index}`}>
                    <Text className={inspectorShellStyles.muted}>{effect.label}</Text>
                    <Text fw={700}>{effect.value}</Text>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {panel.description || canCustomize || panel.references.length ? (
        <section className={inspectorShellStyles.disclosureSection}>
          <Accordion
            multiple
            classNames={{
              content: inspectorShellStyles.disclosureContent,
              control: inspectorShellStyles.disclosureControl,
              root: inspectorShellStyles.disclosureRoot
            }}
            order={3}
            variant='default'
          >
            {panel.description ? (
              <Accordion.Item className={inspectorShellStyles.disclosureItem} value='description'>
                <Accordion.Control>
                  <Text fw={700}>Description</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <AuthoredDetailProse html={panel.description} fallback='' />
                </Accordion.Panel>
              </Accordion.Item>
            ) : null}

            {canCustomize ? (
              <Accordion.Item className={inspectorShellStyles.disclosureItem} value='customize'>
                <Accordion.Control>
                  <div>
                    <Text fw={700}>Customize</Text>
                    <Text className={inspectorShellStyles.muted}>
                      Name, notes, display, and mechanics
                    </Text>
                  </div>
                </Accordion.Control>
                <Accordion.Panel>
                  <Switch
                    checked={panel.displayAsAttack}
                    disabled={pending}
                    label='Display in Actions'
                    mb='md'
                    onChange={(event) =>
                      void submitCommand({
                        type: 'UPDATE_SPELL_SOURCE_CUSTOMIZATION',
                        expectedVersion,
                        source: panel.source,
                        displayAsAttack: event.currentTarget.checked
                      })
                    }
                  />
                  {panel.textEditors.map((editor) => (
                    <CharacterSheetTextEditor
                      editor={editor}
                      key={`${panel.source.spellId}:${panel.source.sourceKind}:${panel.source.sourceInstanceId}:${editor.field}`}
                      pending={pending}
                      onCommit={async (value) =>
                        await submitCommand({
                          type: 'UPDATE_SPELL_SOURCE_CUSTOMIZATION',
                          expectedVersion,
                          source: panel.source,
                          ...(editor.field === 'CUSTOM_NAME'
                            ? { customName: value }
                            : { notes: value })
                        })
                      }
                    />
                  ))}
                  {canAdjust ? (
                    <CharacterSheetSpellCustomizationEditor
                      options={panel.customizationOptions}
                      pending={pending}
                      onRemove={async (category) =>
                        await submitCommand({
                          type: 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION',
                          expectedVersion,
                          source: panel.source,
                          category
                        })
                      }
                      onSet={async (customization) =>
                        await submitCommand({
                          type: 'SET_SPELL_MECHANIC_CUSTOMIZATION',
                          expectedVersion,
                          source: panel.source,
                          ...customization
                        })
                      }
                    />
                  ) : null}
                </Accordion.Panel>
              </Accordion.Item>
            ) : null}
            {panel.references.length ? (
              <Accordion.Item className={inspectorShellStyles.disclosureItem} value='references'>
                <Accordion.Control>
                  <Text fw={700}>References</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <div className={inspectorEditorStyles.entries}>
                    {panel.references.map((reference) => (
                      <div className={inspectorEditorStyles.entry} key={reference.label}>
                        <Text className={inspectorShellStyles.muted}>{reference.label}</Text>
                        <Text fw={700}>{reference.value}</Text>
                      </div>
                    ))}
                  </div>
                </Accordion.Panel>
              </Accordion.Item>
            ) : null}
          </Accordion>
        </section>
      ) : null}

      {panel.state !== 'DEFAULT' && canReset ? (
        <section className={inspectorShellStyles.section}>
          <div className={inspectorEditorStyles.actions}>
            <Button
              color='red'
              disabled={pending}
              variant='subtle'
              onClick={() =>
                void submitCommand({
                  type: 'RESET_SHEET_PANEL_ADJUSTMENTS',
                  expectedVersion,
                  target: panel.target
                })
              }
            >
              Reset customizations
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
