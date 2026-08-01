import { Button, Text, TextInput } from '@mantine/core'
import { IconAdjustments, IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import type {
  CharacterSheet,
  OpenSheetPanel,
  SubmitSheetCommand
} from '../core/CharacterSheet.types'
import { formatSigned } from '../core/characterSheet.utils'
import { CharacterSheetDetailPanel } from '../shared/CharacterSheetDetailPanel'
import * as actionSummaryStyles from '../actions/actionSummary.css'
import * as panelStyles from '../shared/panel.css'
import * as rowStyles from '../shared/rows.css'
import * as spellListStyles from './spellList.css'
import * as spellSummaryStyles from './spellSummary.css'
import {
  CHARACTER_SHEET_SPELL_ACTION_FILTERS,
  type CharacterSheetSpellActionFilter
} from './characterSheetSpells.utils'
import { CharacterSheetRollText, CharacterSheetRollValue } from '../dice/CharacterSheetRollValue'
import { getMechanicRollTargets, withRollModifier } from '../dice/dice.utils'

export function CharacterSheetSpells({
  hideTitle,
  openPanel,
  pending,
  sheet,
  submitCommand
}: {
  hideTitle?: boolean
  openPanel?: OpenSheetPanel
  pending: boolean
  sheet: CharacterSheet
  submitCommand: SubmitSheetCommand
}) {
  const version = sheet.meta.streamVersion
  const [query, setQuery] = useState('')
  const [activeActionType, setActiveActionType] = useState<CharacterSheetSpellActionFilter>('ALL')
  const [failedSpellRowId, setFailedSpellRowId] = useState<string>()
  const manageSpellsButton = (
    <Button
      className={rowStyles.compactActionControl}
      leftSection={<IconAdjustments size={16} />}
      size='xs'
      variant='default'
      onClick={() => openPanel?.({ kind: 'SPELLS' })}
    >
      Manage Spells
    </Button>
  )

  const availableActionFilters = useMemo(
    () =>
      CHARACTER_SHEET_SPELL_ACTION_FILTERS.filter(
        (filter) =>
          filter.id === 'ALL' ||
          sheet.spells.activeGroups.some((group) =>
            group.entries.some((entry) => entry.activationType === filter.id)
          )
      ),
    [sheet.spells.activeGroups]
  )

  useEffect(() => {
    if (
      activeActionType !== 'ALL' &&
      !availableActionFilters.some((filter) => filter.id === activeActionType)
    )
      setActiveActionType('ALL')
  }, [activeActionType, availableActionFilters])

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return sheet.spells.activeGroups.flatMap((group) => {
      const entries = group.entries.filter(
        (entry) =>
          (activeActionType === 'ALL' || entry.activationType === activeActionType) &&
          (normalizedQuery ? entry.displayName.toLocaleLowerCase().includes(normalizedQuery) : true)
      )
      return entries.length ? [{ ...group, entries }] : []
    })
  }, [activeActionType, query, sheet.spells.activeGroups])

  return (
    <CharacterSheetDetailPanel
      ariaId='character-sheet-spells'
      hideTitle={hideTitle}
      title='Spells'
      headerActions={hideTitle ? undefined : manageSpellsButton}
    >
      <div className={spellSummaryStyles.spellSummaryRow}>
        <div aria-label='Spellcasting values' className={spellSummaryStyles.spellCastingSummary}>
          <span>
            <small>Spell attack</small>
            <strong>
              {sheet.spells.attackBonus == null ? (
                '—'
              ) : (
                <CharacterSheetRollValue
                  request={{
                    expression: withRollModifier('1d20', sheet.spells.attackBonus),
                    rollMode: sheet.spells.attackRollMode,
                    source: { kind: 'ATTACK', label: 'Spell attack' }
                  }}
                >
                  {formatSigned(sheet.spells.attackBonus)}
                </CharacterSheetRollValue>
              )}
            </strong>
          </span>
          <span>
            <small>Save DC</small>
            <strong>{sheet.spells.saveDc ?? '—'}</strong>
          </span>
        </div>
        {hideTitle ? manageSpellsButton : null}
      </div>

      <section className={spellSummaryStyles.spellSlotSection} aria-labelledby='spell-slot-heading'>
        <Text className={spellSummaryStyles.spellSlotHeading} fw={700} id='spell-slot-heading'>
          Slots
        </Text>
        <div className={spellSummaryStyles.spellSlotGrid}>
          {sheet.spells.slots.length ? (
            sheet.spells.slots.map((slot) => (
              <button
                aria-label={`${slot.label}: ${slot.remaining} of ${slot.max} remaining`}
                className={spellSummaryStyles.spellSlotCell}
                key={slot.slotKey}
                type='button'
                onClick={() => openPanel?.({ kind: 'SPELLS' })}
              >
                <span>{slot.level == null ? slot.label : `L${slot.level}`}</span>
                <strong>
                  {slot.remaining} / {slot.max}
                </strong>
              </button>
            ))
          ) : (
            <Text className={panelStyles.muted}>This character does not have spell slots.</Text>
          )}
        </div>
      </section>

      <div className={spellListStyles.sheetToolbar}>
        <TextInput
          aria-label='Search spells'
          className={spellListStyles.spellSearch}
          leftSection={<IconSearch size={16} />}
          placeholder='Search spells'
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <div
          aria-label='Spell action type filters'
          className={actionSummaryStyles.actionFilterBar}
          role='toolbar'
        >
          {availableActionFilters.map((filter) => (
            <button
              aria-pressed={activeActionType === filter.id}
              className={actionSummaryStyles.actionFilterChip}
              data-active={activeActionType === filter.id}
              key={filter.id}
              type='button'
              onClick={() => setActiveActionType(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className={spellListStyles.scrollableSheetList}>
        {filteredGroups.length ? (
          filteredGroups.map((group) => (
            <section
              aria-labelledby={`spell-group-${group.level}`}
              className={spellListStyles.spellGroup}
              key={group.level}
            >
              <Text
                className={spellListStyles.spellGroupTitle}
                fw={700}
                id={`spell-group-${group.level}`}
              >
                {group.label}
              </Text>
              <div aria-hidden='true' className={spellListStyles.spellTableHeader}>
                <span>Spell</span>
                <span>Use</span>
                <span>Range</span>
                <span>Hit / DC</span>
                <span>Effect</span>
                <span />
              </div>
              <div className={spellListStyles.spellList}>
                {group.entries.map((entry) => {
                  const sourceLabel =
                    entry.sourceLabel ??
                    sheet.spells.spells
                      .find((spell) => spell.id === entry.spellId)
                      ?.sources?.find(
                        (source) => (source.id ?? source.source.sourceInstanceId) === entry.sourceId
                      )?.label ??
                    entry.sourceQualifier
                  const sourceContext = sourceLabel ? ` from ${sourceLabel}` : ''
                  const castLevelContext =
                    entry.castLevel === 0 ? ' as a cantrip' : ` at level ${entry.castLevel}`
                  const accessibleSpellName = `${entry.displayName}${sourceContext}${castLevelContext}`
                  const rollTargets = getMechanicRollTargets(entry.mechanics, entry.displayName)

                  return (
                    <div
                      aria-label={accessibleSpellName}
                      className={spellListStyles.spellRow}
                      key={entry.rowId}
                      role='group'
                    >
                      <div className={spellListStyles.spellEntryButton}>
                        <button
                          aria-label={`Open details for ${accessibleSpellName}`}
                          className={spellListStyles.spellNameButton}
                          type='button'
                          onClick={() => openPanel?.(entry.target)}
                        >
                          <span className={spellListStyles.spellNameLine}>
                            <Text component='span' fw={700}>
                              {entry.displayName}
                            </Text>
                            {sourceLabel ? (
                              <Text
                                className={spellListStyles.spellQualifier}
                                component='span'
                                size='xs'
                              >
                                {sourceLabel}
                              </Text>
                            ) : null}
                          </span>
                        </button>
                        <Text
                          className={`${spellListStyles.spellFact} ${spellListStyles.spellActivationFact}`}
                          component='span'
                        >
                          {entry.activationLabel ?? '—'}
                        </Text>
                        <Text className={spellListStyles.spellFact} component='span'>
                          {entry.rangeLabel ?? '—'}
                        </Text>
                        <Text className={spellListStyles.spellFact} component='span'>
                          <CharacterSheetRollText
                            targets={rollTargets.filter(
                              (target) => target.source.kind === 'ATTACK'
                            )}
                            text={entry.hitOrDcLabel ?? '—'}
                          />
                        </Text>
                        <span className={spellListStyles.spellEffectLine}>
                          {entry.primaryEffect ? (
                            <Text className={spellListStyles.spellPrimaryEffect} component='span'>
                              <CharacterSheetRollText
                                targets={rollTargets.filter(
                                  (target) =>
                                    target.source.kind === 'DAMAGE' ||
                                    target.source.kind === 'HEALING'
                                )}
                                text={entry.primaryEffect}
                              />
                            </Text>
                          ) : null}
                          {!entry.available && entry.unavailableReason ? (
                            <>
                              {entry.primaryEffect ? (
                                <span
                                  aria-hidden='true'
                                  className={spellListStyles.spellInlineSeparator}
                                >
                                  ·
                                </span>
                              ) : null}
                              <Text
                                className={spellListStyles.spellUnavailable}
                                component='span'
                                id={`spell-unavailable-${entry.rowId}`}
                                size='xs'
                              >
                                {entry.unavailableReason}
                              </Text>
                            </>
                          ) : null}
                        </span>
                      </div>
                      <Button
                        aria-describedby={
                          !entry.available && entry.unavailableReason
                            ? `spell-unavailable-${entry.rowId}`
                            : undefined
                        }
                        aria-label={`Cast ${accessibleSpellName}`}
                        className={spellListStyles.spellCastButton}
                        disabled={pending || !entry.available}
                        size='compact-xs'
                        onClick={async () => {
                          setFailedSpellRowId(undefined)
                          const succeeded = await submitCommand({
                            type: 'CAST_SPELL',
                            expectedVersion: version,
                            ...entry.cast
                          })
                          if (!succeeded) setFailedSpellRowId(entry.rowId)
                        }}
                      >
                        Cast
                      </Button>
                      {failedSpellRowId === entry.rowId ? (
                        <Text className={spellListStyles.spellCommandError} role='alert'>
                          Cast failed. The sheet was refreshed; try again.
                        </Text>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        ) : (
          <Text className={panelStyles.muted}>No active spells match this search.</Text>
        )}
      </div>
    </CharacterSheetDetailPanel>
  )
}
