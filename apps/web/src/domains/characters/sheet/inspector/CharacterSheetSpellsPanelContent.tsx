import { Accordion, Text } from '@mantine/core'
import { useState, type ComponentProps } from 'react'
import clsx from 'clsx'
import { useCharacterPreparationCatalogue } from '#app/data/contentSnapshots/useCharacterPreparationCatalogue'
import { CharacterSheetPreparationPicker } from './CharacterSheetPreparationPicker'
import { CharacterSheetManageSpellRow } from './CharacterSheetManageSpellRow'

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
  // Tracking collapsed items keeps the user's choices while a new level opens by default.
  const [collapsedItems, setCollapsedItems] = useState<ReadonlySet<string>>(
    new Set(['spells:empty'])
  )
  const canUseSlot = panel.editable && panel.allowedCommands.includes('USE_SPELL_SLOT')
  const canRestoreSlot = panel.editable && panel.allowedCommands.includes('RESTORE_SPELL_SLOT')
  const catalogue = useCharacterPreparationCatalogue(preparationOptions)
  const sources = panel.groups.flatMap((group) => group.sources)
  const metadata = new Map(catalogue.spells?.map((spell) => [spell.spellId, spell]))
  const catalogueSpellIds = new Set(metadata.keys())
  const heldPreparationKeys = new Set<string>()
  for (const group of panel.groups) {
    for (const source of group.sources) {
      if (!source.prepared && !source.known && (source.canPrepare || source.canManageKnown))
        continue
      if (source.preparationClassId)
        heldPreparationKeys.add(`${source.preparationClassId}:${source.spellId}`)
      metadata.set(source.spellId, {
        spellId: source.spellId,
        label: source.label,
        level: group.level
      })
    }
  }
  const metadataComplete =
    preparationOptions?.classes.every((source) =>
      source.eligibleSpellIds.every(
        (spellId) =>
          catalogueSpellIds.has(spellId) || heldPreparationKeys.has(`${source.classId}:${spellId}`)
      )
    ) ?? false
  const preparationOptionsCurrent = Boolean(
    preparationOptions &&
    preparationOptions.characterId === panel.characterId &&
    preparationOptions.streamVersion === expectedVersion &&
    !preparationOptionsPending &&
    !preparationOptionsError &&
    !catalogue.isPending &&
    !catalogue.isError &&
    !catalogue.updating &&
    metadataComplete
  )
  const sourceRows = new Map(
    panel.groups.flatMap((group) =>
      group.sources.map(
        (source) =>
          [
            source,
            {
              spellId: source.spellId,
              label: source.label,
              level: group.level,
              rowId: `${source.source.sourceKind}:${source.source.sourceInstanceId}:${source.spellId}`,
              classId: source.preparationClassId,
              sourceLabel: source.sourceLabel,
              prepared: source.prepared,
              eligibleForPreparation:
                preparationOptions?.classes.some(
                  (candidate) =>
                    candidate.classId === source.preparationClassId &&
                    candidate.eligibleSpellIds.includes(source.spellId)
                ) ?? false,
              source
            }
          ] as const
      )
    )
  )
  const heldGroups = panel.groups
    .map((group) => ({
      ...group,
      sources: group.sources.filter(
        (source) =>
          source.prepared || source.known || (!source.canPrepare && !source.canManageKnown)
      )
    }))
    .filter((group) => group.sources.length)
  const preparationRows: Array<ComponentProps<typeof CharacterSheetManageSpellRow>['spell']> = [
    ...[...sourceRows.values()].filter(
      (row) =>
        !row.source.prepared &&
        !row.source.known &&
        (row.source.canPrepare || row.source.canManageKnown)
    ),
    ...(preparationOptions?.classes ?? []).flatMap((source) =>
      source.eligibleSpellIds.flatMap((spellId) => {
        const option = metadata.get(spellId)
        const existingSource = sources.some(
          (candidate) =>
            candidate.spellId === spellId &&
            candidate.preparationClassId === source.classId &&
            candidate.canPrepare
        )
        return option && !existingSource
          ? [
              {
                ...option,
                rowId: `preparation:${source.classId}:${spellId}`,
                classId: source.classId,
                sourceLabel: source.label,
                prepared: source.preparedSpellIds.includes(spellId),
                eligibleForPreparation: true
              }
            ]
          : []
      })
    )
  ]
  preparationRows.sort(
    (left, right) =>
      left.level - right.level ||
      left.label.localeCompare(right.label) ||
      left.spellId.localeCompare(right.spellId) ||
      left.rowId.localeCompare(right.rowId)
  )
  const spellLevels = heldGroups.map((group) => group.level).sort((left, right) => left - right)
  const accordionItems = ['slots', ...spellLevels.map((level) => `spells:${level}`), 'spells:empty']
  const pickerRevision = `${panel.characterId}:${catalogue.revision}:${JSON.stringify(preparationOptions?.classes.map((source) => [source.classId, source.eligibleSpellIds]))}`
  async function setPrepared(classId: string, spellId: string, prepared: boolean) {
    if (
      !preparationOptionsCurrent ||
      pending ||
      !panel.editable ||
      !panel.allowedCommands.includes('SET_PREPARED_SPELLS')
    )
      return false
    const source = preparationOptions?.classes.find((candidate) => candidate.classId === classId)
    if (!source || !source.eligibleSpellIds.includes(spellId)) return false
    const spellIds = [
      ...new Set([
        ...source.preparedSpellIds.filter((candidate) => candidate !== spellId),
        ...(prepared ? [spellId] : [])
      ])
    ]
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
      {preparationRows.length ? (
        <CharacterSheetPreparationPicker
          key={pickerRevision}
          rows={preparationRows}
          disabled={pending || !panel.editable}
          preparationDisabled={
            !preparationOptionsCurrent || !panel.allowedCommands.includes('SET_PREPARED_SPELLS')
          }
          canManageKnown={panel.allowedCommands.includes('SET_KNOWN_SPELLS')}
          onPreparedChange={setPrepared}
          onKnownChange={setKnown}
          onTargetChange={onTargetChange}
        />
      ) : null}
      <section className={inspectorShellStyles.disclosureSection}>
        <Accordion
          multiple
          classNames={{
            content: inspectorShellStyles.disclosureContent,
            control: inspectorShellStyles.disclosureControl,
            root: inspectorShellStyles.disclosureRoot
          }}
          value={accordionItems.filter((item) => !collapsedItems.has(item))}
          onChange={(open) =>
            setCollapsedItems(new Set(accordionItems.filter((item) => !open.includes(item))))
          }
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
            const group = heldGroups.find((candidate) => candidate.level === level)
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
                        <CharacterSheetManageSpellRow
                          spell={sourceRows.get(source)!}
                          disabled={pending || !panel.editable}
                          preparationDisabled={
                            !preparationOptionsCurrent ||
                            !panel.allowedCommands.includes('SET_PREPARED_SPELLS')
                          }
                          canManageKnown={panel.allowedCommands.includes('SET_KNOWN_SPELLS')}
                          onPreparedChange={setPrepared}
                          onKnownChange={setKnown}
                          onTargetChange={onTargetChange}
                        />
                      </div>
                    ))}
                  </div>
                </Accordion.Panel>
              </Accordion.Item>
            )
          })}
          {preparationOptionsPending || catalogue.isPending ? (
            <Text className={inspectorShellStyles.muted} role='status'>
              Loading preparation options…
            </Text>
          ) : null}
          {preparationOptionsError || catalogue.isError ? (
            <Text c='red' role='alert'>
              Preparation options are unavailable. {preparationOptionsError}
            </Text>
          ) : null}
          {catalogue.updating ? (
            <Text className={inspectorShellStyles.muted} role='status'>
              Spell content is updating. Preparation will be available when it finishes.
            </Text>
          ) : null}
          {preparationOptions && !catalogue.isPending && !catalogue.isError && !metadataComplete ? (
            <Text c='red' role='alert'>
              Preparation options are incomplete. Please reload spell content.
            </Text>
          ) : null}
          {!spellLevels.length &&
          !preparationRows.length &&
          !preparationOptionsPending &&
          !catalogue.isPending ? (
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
