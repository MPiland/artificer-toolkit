import { Accordion, Badge, Button, Text } from '@mantine/core'
import clsx from 'clsx'

import type { CharacterSheetPanelDto, CharacterSheetPanelTargetDto } from '#app/lib/api'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import * as inspectorEditorStyles from './inspectorEditor.css'
import * as inspectorShellStyles from './inspectorShell.css'

type SpellsPanel = Extract<CharacterSheetPanelDto, { kind: 'SPELLS' }>

export function CharacterSheetSpellsPanelContent({
  expectedVersion,
  panel,
  pending,
  submitCommand,
  onTargetChange
}: {
  expectedVersion: number
  panel: SpellsPanel
  pending: boolean
  submitCommand: SubmitSheetCommand
  onTargetChange: (target: CharacterSheetPanelTargetDto) => void
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

  async function setKnown(
    source: SpellsPanel['groups'][number]['sources'][number],
    known: boolean
  ) {
    if (!source.knownClassId) return false
    const knownSpellIds = [
      ...new Set(
        sources
          .filter((candidate) => candidate.knownClassId === source.knownClassId)
          .filter((candidate) => {
            const sameSource =
              candidate.spellId === source.spellId &&
              candidate.source.sourceKind === source.source.sourceKind &&
              candidate.source.sourceInstanceId === source.source.sourceInstanceId
            return sameSource ? known : candidate.known
          })
          .map((candidate) => candidate.spellId)
          .concat(known ? [source.spellId] : [])
      )
    ]

    return await submitCommand({
      type: 'SET_KNOWN_SPELLS',
      expectedVersion,
      classId: source.knownClassId,
      spellIds: knownSpellIds
    })
  }

  return (
    <div className={inspectorShellStyles.inspector}>
      <section className={inspectorShellStyles.disclosureSection}>
        <Accordion
          multiple
          classNames={{
            content: inspectorShellStyles.disclosureContent,
            control: inspectorShellStyles.disclosureControl,
            root: inspectorShellStyles.disclosureRoot
          }}
          defaultValue={['slots', ...panel.groups.map((group) => `spells:${group.level}`)]}
          order={3}
          variant='default'
        >
          <Accordion.Item className={inspectorShellStyles.disclosureItem} value='slots'>
            <Accordion.Control>
              <Text fw={700}>Spell slots</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <div className={inspectorEditorStyles.entries}>
                {panel.slots.map((slot) => (
                  <div className={inspectorEditorStyles.slotRow} key={slot.slotKey}>
                    <div>
                      <Text fw={700}>{slot.label}</Text>
                      <Text className={inspectorShellStyles.muted}>
                        {slot.remaining} of {slot.maximum} available
                      </Text>
                    </div>
                    <div className={inspectorEditorStyles.slotPips}>
                      {Array.from({ length: slot.maximum }, (_, index) => {
                        const used = index < slot.used
                        return (
                          <button
                            aria-label={
                              used
                                ? `Restore one ${slot.label} spell slot`
                                : `Use one ${slot.label} spell slot`
                            }
                            className={clsx(
                              inspectorEditorStyles.slotPip,
                              used && inspectorEditorStyles.slotPipUsed
                            )}
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
              className={inspectorShellStyles.disclosureItem}
              key={group.level}
              value={`spells:${group.level}`}
            >
              <Accordion.Control>
                <Text fw={700}>{group.label}</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <div className={inspectorEditorStyles.entries}>
                  {group.sources.map((source) => (
                    <div
                      className={inspectorEditorStyles.entry}
                      key={`${source.source.sourceKind}:${source.source.sourceInstanceId}:${source.spellId}`}
                    >
                      <button
                        className={inspectorEditorStyles.entryLink}
                        type='button'
                        onClick={() => onTargetChange(source.target)}
                      >
                        <Text fw={700}>{source.label}</Text>
                        <Text className={inspectorShellStyles.muted}>{source.sourceLabel}</Text>
                      </button>
                      <div className={inspectorEditorStyles.actions}>
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
                        {source.canManageKnown && source.knownClassId ? (
                          <Button
                            disabled={
                              pending ||
                              !panel.editable ||
                              !panel.allowedCommands.includes('SET_KNOWN_SPELLS')
                            }
                            size='xs'
                            variant={source.known ? 'default' : 'filled'}
                            onClick={() => void setKnown(source, !source.known)}
                          >
                            {source.known ? 'Forget' : 'Learn'}
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
            <Accordion.Item className={inspectorShellStyles.disclosureItem} value='spells:empty'>
              <Accordion.Control>
                <Text fw={700}>Spells</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Text className={inspectorShellStyles.muted}>
                  There are no spells you can learn or forget here.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
          ) : null}
        </Accordion>
      </section>
    </div>
  )
}
