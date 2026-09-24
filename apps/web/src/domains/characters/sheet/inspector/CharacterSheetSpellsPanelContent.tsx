import { Accordion, Badge, Button, Text } from '@mantine/core'
import clsx from 'clsx'

import type { CharacterPreparationOptionsResponseDto } from '@artificer-toolkit/schema/api/characterPreparationOptions'
import type {
  CharacterSheetPanelDto,
  CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import * as inspectorEditorStyles from './inspectorEditor.css'
import * as inspectorShellStyles from './inspectorShell.css'

type SpellsPanel = Extract<CharacterSheetPanelDto, { kind: 'SPELLS' }>

export function CharacterSheetSpellsPanelContent({
  expectedVersion,
  panel,
  pending,
  preparationOptions,
  preparationOptionsError,
  preparationOptionsPending,
  submitCommand,
  onTargetChange
}: {
  expectedVersion: number
  panel: SpellsPanel
  pending: boolean
  preparationOptions?: CharacterPreparationOptionsResponseDto
  preparationOptionsError?: string
  preparationOptionsPending?: boolean
  submitCommand: SubmitSheetCommand
  onTargetChange: (target: CharacterSheetPanelTargetDto) => void
}) {
  const canUseSlot = panel.editable && panel.allowedCommands.includes('USE_SPELL_SLOT')
  const canRestoreSlot = panel.editable && panel.allowedCommands.includes('RESTORE_SPELL_SLOT')
  const preparationOptionsCurrent =
    !preparationOptions || preparationOptions.streamVersion === expectedVersion
  const sources = panel.groups.flatMap((group) => group.sources)
  const preparationOptionsByLevel = new Map<
    number,
    Array<
      CharacterPreparationOptionsResponseDto['classes'][number]['options'][number] & {
        classId: string
        sourceLabel: string
      }
    >
  >()
  for (const source of preparationOptions?.classes ?? []) {
    for (const option of source.options) {
      const existingPreparationSource = sources.some(
        (candidate) =>
          candidate.spellId === option.spellId &&
          candidate.preparationClassId === source.classId &&
          candidate.canPrepare
      )
      if (existingPreparationSource) continue
      const options = preparationOptionsByLevel.get(option.level) ?? []
      options.push({ ...option, classId: source.classId, sourceLabel: source.label })
      preparationOptionsByLevel.set(option.level, options)
    }
  }
  const spellLevels = [
    ...new Set([...panel.groups.map((group) => group.level), ...preparationOptionsByLevel.keys()])
  ].sort((left, right) => left - right)

  async function setPrepared(classId: string, spellId: string, prepared: boolean) {
    if (!preparationOptionsCurrent) return false
    const options = preparationOptions?.classes.find(
      (source) => source.classId === classId
    )?.options
    const spellIds = options
      ? options
          .filter((candidate) => (candidate.spellId === spellId ? prepared : candidate.prepared))
          .map((candidate) => candidate.spellId)
      : sources
          .filter(
            (candidate) =>
              candidate.preparationClassId === classId &&
              (candidate.spellId !== spellId ? candidate.prepared : prepared)
          )
          .map((candidate) => candidate.spellId)

    return await submitCommand({
      type: 'SET_PREPARED_SPELLS',
      expectedVersion,
      classId,
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
          defaultValue={['slots', ...spellLevels.map((level) => `spells:${level}`)]}
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

          {spellLevels.map((level) => {
            const group = panel.groups.find((candidate) => candidate.level === level)
            const options = preparationOptionsByLevel.get(level) ?? []
            return (
              <Accordion.Item
                className={inspectorShellStyles.disclosureItem}
                key={level}
                value={`spells:${level}`}
              >
                <Accordion.Control>
                  <Text fw={700}>
                    {group?.label ?? (level === 0 ? 'Cantrips' : `Level ${level}`)}
                  </Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <div className={inspectorEditorStyles.entries}>
                    {(group?.sources ?? []).map((source) => (
                      <div
                        aria-label={source.label}
                        className={inspectorEditorStyles.entry}
                        key={`${source.source.sourceKind}:${source.source.sourceInstanceId}:${source.spellId}`}
                        role='group'
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
                                !preparationOptionsCurrent ||
                                (source.canManageKnown && !source.known) ||
                                !panel.editable ||
                                !panel.allowedCommands.includes('SET_PREPARED_SPELLS')
                              }
                              size='xs'
                              variant={source.prepared ? 'default' : 'filled'}
                              onClick={() =>
                                void setPrepared(
                                  source.preparationClassId!,
                                  source.spellId,
                                  !source.prepared
                                )
                              }
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
                    {options.map((option) => (
                      <div
                        aria-label={option.label}
                        className={inspectorEditorStyles.entry}
                        key={`preparation:${option.classId}:${option.spellId}`}
                        role='group'
                      >
                        <div>
                          <Text fw={700}>{option.label}</Text>
                          <Text className={inspectorShellStyles.muted}>{option.sourceLabel}</Text>
                        </div>
                        <div className={inspectorEditorStyles.actions}>
                          <Button
                            disabled={
                              pending ||
                              !preparationOptionsCurrent ||
                              !panel.editable ||
                              !panel.allowedCommands.includes('SET_PREPARED_SPELLS')
                            }
                            size='xs'
                            variant={option.prepared ? 'default' : 'filled'}
                            onClick={() =>
                              void setPrepared(option.classId, option.spellId, !option.prepared)
                            }
                          >
                            {option.prepared ? 'Unprepare' : 'Prepare'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Accordion.Panel>
              </Accordion.Item>
            )
          })}
          {preparationOptionsPending ? (
            <Text className={inspectorShellStyles.muted} role='status'>
              Loading preparation options…
            </Text>
          ) : null}
          {preparationOptionsError ? (
            <Text c='red' role='alert'>
              Preparation options are unavailable. {preparationOptionsError}
            </Text>
          ) : null}
          {!spellLevels.length && !preparationOptionsPending ? (
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
