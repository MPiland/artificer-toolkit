import { Accordion, Badge, Button, Switch, Text } from '@mantine/core'
import clsx from 'clsx'

import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import type { CharacterSheetPanelDto, CharacterSheetPanelTargetDto } from '#app/lib/api'
import type { SubmitSheetCommand } from '../CharacterSheet.types'
import { CharacterSheetCalculationBreakdown } from './CharacterSheetCalculationBreakdown'
import { CharacterSheetSpellCustomizationEditor } from './CharacterSheetSpellCustomizationEditor'
import { CharacterSheetTextEditor } from './CharacterSheetTextEditor'
import * as styles from './characterSheetInspector.css'

type SpellPanel = Extract<CharacterSheetPanelDto, { kind: 'SPELL' }>
type SpellsPanel = Extract<CharacterSheetPanelDto, { kind: 'SPELLS' }>

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

  return (
    <div className={styles.inspector}>
      <section className={styles.section}>
        <div className={styles.summary}>
          <div>
            <Text className={styles.summaryLabel}>Spell source</Text>
            <Text className={styles.summaryValue}>{panel.sourceLabel}</Text>
          </div>
          <div className={styles.badges}>
            {panel.displayAsAttack ? (
              <Badge color='cyan' variant='light'>
                Action
              </Badge>
            ) : null}
          </div>
        </div>
        <Text className={styles.muted}>{panel.authoredName}</Text>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Cast</h3>
        <div className={styles.entries}>
          {panel.legalCastModes.map((mode) => (
            <div
              className={styles.entry}
              key={`${mode.kind}:${mode.slotKey ?? mode.castLevel ?? mode.label}`}
            >
              <div>
                <Text fw={700}>{mode.label}</Text>
                {mode.unavailableReason ? (
                  <Text className={styles.muted}>{mode.unavailableReason}</Text>
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
                    ...(mode.slotKey ? { slotKey: mode.slotKey } : {})
                  })
                }
              >
                Cast
              </Button>
            </div>
          ))}
          {!panel.legalCastModes.length ? (
            <Text className={styles.muted}>No legal cast modes are currently available.</Text>
          ) : null}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Info</h3>
        <div className={styles.disclosureBody}>
          <div className={styles.infoGroup}>
            <h4 className={styles.sectionTitle}>Spell facts</h4>
            <div className={styles.entries}>
              {panel.facts.map((fact) => (
                <div className={styles.entry} key={fact.label}>
                  <Text className={styles.muted}>{fact.label}</Text>
                  <Text fw={700}>{fact.value}</Text>
                </div>
              ))}
            </div>
          </div>
          {panel.calculations.attackBonus ? (
            <div className={styles.infoGroup}>
              <h4 className={styles.sectionTitle}>Spell attack</h4>
              <CharacterSheetCalculationBreakdown calculation={panel.calculations.attackBonus} />
            </div>
          ) : null}
          {panel.calculations.saveDC ? (
            <div className={styles.infoGroup}>
              <h4 className={styles.sectionTitle}>Save DC</h4>
              <CharacterSheetCalculationBreakdown calculation={panel.calculations.saveDC} />
            </div>
          ) : null}
          {panel.calculations.damageBonus ? (
            <div className={styles.infoGroup}>
              <h4 className={styles.sectionTitle}>Damage bonus</h4>
              <CharacterSheetCalculationBreakdown calculation={panel.calculations.damageBonus} />
            </div>
          ) : null}
          {panel.effects.length ? (
            <div className={styles.infoGroup}>
              <h4 className={styles.sectionTitle}>Effects</h4>
              <div className={styles.entries}>
                {panel.effects.map((effect, index) => (
                  <div className={styles.entry} key={`${effect.label}:${index}`}>
                    <Text className={styles.muted}>{effect.label}</Text>
                    <Text fw={700}>{effect.value}</Text>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {panel.description || canCustomize || panel.references.length ? (
        <section className={styles.disclosureSection}>
          <Accordion
            multiple
            classNames={{
              content: styles.disclosureContent,
              control: styles.disclosureControl,
              root: styles.disclosureRoot
            }}
            order={3}
            variant='default'
          >
            {panel.description ? (
              <Accordion.Item className={styles.disclosureItem} value='description'>
                <Accordion.Control>
                  <Text fw={700}>Description</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <AuthoredDetailProse html={panel.description} fallback='' />
                </Accordion.Panel>
              </Accordion.Item>
            ) : null}

            {canCustomize ? (
              <Accordion.Item className={styles.disclosureItem} value='customize'>
                <Accordion.Control>
                  <div>
                    <Text fw={700}>Customize</Text>
                    <Text className={styles.muted}>Name, notes, display, and mechanics</Text>
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
                      key={editor.field}
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
              <Accordion.Item className={styles.disclosureItem} value='references'>
                <Accordion.Control>
                  <Text fw={700}>References</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <div className={styles.entries}>
                    {panel.references.map((reference) => (
                      <div className={styles.entry} key={reference.label}>
                        <Text className={styles.muted}>{reference.label}</Text>
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
        <section className={styles.section}>
          <div className={styles.actions}>
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

export function CharacterSheetSpellsPanelContent({
  expectedVersion,
  panel,
  pending,
  submitCommand,
  onTargetChange,
  onOpenBuilder
}: {
  expectedVersion: number
  panel: SpellsPanel
  pending: boolean
  submitCommand: SubmitSheetCommand
  onTargetChange: (target: CharacterSheetPanelTargetDto) => void
  onOpenBuilder: () => void
}) {
  const canUseSlot = panel.editable && panel.allowedCommands.includes('USE_SPELL_SLOT')
  const canRestoreSlot = panel.editable && panel.allowedCommands.includes('RESTORE_SPELL_SLOT')
  const sources = panel.groups.flatMap((group) => group.sources)

  async function setPrepared(
    source: SpellsPanel['groups'][number]['sources'][number],
    prepared: boolean
  ) {
    if (!source.preparationClassId) return false
    const spellIds = sources
      .filter(
        (candidate) =>
          candidate.preparationClassId === source.preparationClassId &&
          (candidate.spellId !== source.spellId ? candidate.prepared : prepared)
      )
      .map((candidate) => candidate.spellId)

    return await submitCommand({
      type: 'SET_PREPARED_SPELLS',
      expectedVersion,
      classId: source.preparationClassId,
      spellIds
    })
  }

  return (
    <div className={styles.inspector}>
      <section className={styles.disclosureSection}>
        <Accordion
          multiple
          classNames={{
            content: styles.disclosureContent,
            control: styles.disclosureControl,
            root: styles.disclosureRoot
          }}
          defaultValue={['slots', ...panel.groups.map((group) => `spells:${group.level}`)]}
          order={3}
          variant='default'
        >
          <Accordion.Item className={styles.disclosureItem} value='slots'>
            <Accordion.Control>
              <Text fw={700}>Spell slots</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <div className={styles.entries}>
                {panel.slots.map((slot) => (
                  <div className={styles.slotRow} key={slot.slotKey}>
                    <div>
                      <Text fw={700}>{slot.label}</Text>
                      <Text className={styles.muted}>
                        {slot.remaining} of {slot.maximum} available
                      </Text>
                    </div>
                    <div className={styles.slotPips}>
                      {Array.from({ length: slot.maximum }, (_, index) => {
                        const used = index < slot.used
                        return (
                          <button
                            aria-label={
                              used
                                ? `Restore one ${slot.label} spell slot`
                                : `Use one ${slot.label} spell slot`
                            }
                            className={clsx(styles.slotPip, used && styles.slotPipUsed)}
                            disabled={pending || (used ? !canRestoreSlot : !canUseSlot)}
                            key={`${slot.slotKey}:${index}`}
                            title={
                              used
                                ? `Restore one ${slot.label} spell slot`
                                : `Use one ${slot.label} spell slot`
                            }
                            type='button'
                            onClick={() =>
                              void submitCommand(
                                used
                                  ? {
                                      type: 'RESTORE_SPELL_SLOT',
                                      expectedVersion,
                                      slotKey: slot.slotKey
                                    }
                                  : {
                                      type: 'USE_SPELL_SLOT',
                                      expectedVersion,
                                      slotKey: slot.slotKey
                                    }
                              )
                            }
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Accordion.Panel>
          </Accordion.Item>

          {panel.groups.map((group) => (
            <Accordion.Item
              className={styles.disclosureItem}
              key={group.level}
              value={`spells:${group.level}`}
            >
              <Accordion.Control>
                <Text fw={700}>{group.label}</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <div className={styles.entries}>
                  {group.sources.map((source) => (
                    <div
                      className={styles.entry}
                      key={`${source.source.sourceKind}:${source.source.sourceInstanceId}:${source.spellId}`}
                    >
                      <button
                        className={styles.entryLink}
                        type='button'
                        onClick={() => onTargetChange(source.target)}
                      >
                        <Text fw={700}>{source.label}</Text>
                        <Text className={styles.muted}>{source.sourceLabel}</Text>
                      </button>
                      <div className={styles.actions}>
                        {source.state !== 'DEFAULT' ? (
                          <Badge color='cyan' variant='light'>
                            Modified
                          </Badge>
                        ) : null}
                        {source.canPrepare && source.preparationClassId ? (
                          <Button
                            disabled={
                              pending ||
                              !panel.editable ||
                              !panel.allowedCommands.includes('SET_PREPARED_SPELLS')
                            }
                            size='xs'
                            variant={source.prepared ? 'default' : 'filled'}
                            onClick={() => void setPrepared(source, !source.prepared)}
                          >
                            {source.prepared ? 'Unprepare' : 'Prepare'}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
          {!panel.groups.length ? (
            <Accordion.Item className={styles.disclosureItem} value='spells:empty'>
              <Accordion.Control>
                <Text fw={700}>Spells</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Text className={styles.muted}>No Sheet-manageable spells are available.</Text>
              </Accordion.Panel>
            </Accordion.Item>
          ) : null}

          <Accordion.Item className={styles.disclosureItem} value='add-spells'>
            <Accordion.Control>
              <div>
                <Text fw={700}>Add known spells</Text>
                <Text className={styles.muted}>Change spell acquisition in the Builder</Text>
              </div>
            </Accordion.Control>
            <Accordion.Panel>
              <div className={styles.builderHandoff}>
                <Text>
                  Open the Character Builder to add or remove known spells. Prepared spells remain
                  immediately manageable here on the Sheet.
                </Text>
                <Button disabled={pending} size='xs' onClick={onOpenBuilder}>
                  Open Builder
                </Button>
              </div>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </section>
    </div>
  )
}
