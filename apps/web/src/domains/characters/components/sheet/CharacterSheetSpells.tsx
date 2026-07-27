import { Button, Text, TextInput } from '@mantine/core'
import { IconAdjustments, IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { CharacterSheetDetailPanel } from './CharacterSheetDetailPanel'
import * as styles from './characterSheet.css'
import {
  CHARACTER_SHEET_SPELL_ACTION_FILTERS,
  type CharacterSheetSpellActionFilter
} from './characterSheetSpells.utils'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'
import { formatSigned } from './characterSheet.utils'

export function CharacterSheetSpells({
  hideTitle,
  openPanel,
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps & { hideTitle?: boolean }) {
  const version = sheet.meta.streamVersion
  const [query, setQuery] = useState('')
  const [activeActionType, setActiveActionType] = useState<CharacterSheetSpellActionFilter>('ALL')
  const [failedSpellRowId, setFailedSpellRowId] = useState<string>()
  const manageSpellsButton = (
    <Button
      className={styles.compactActionControl}
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
      <div className={styles.spellSummaryRow}>
        <div aria-label='Spellcasting values' className={styles.spellCastingSummary}>
          <span>
            <small>Spell attack</small>
            <strong>
              {sheet.spells.attackBonus == null ? '—' : formatSigned(sheet.spells.attackBonus)}
            </strong>
          </span>
          <span>
            <small>Save DC</small>
            <strong>{sheet.spells.saveDc ?? '—'}</strong>
          </span>
        </div>
        {hideTitle ? manageSpellsButton : null}
      </div>

      <section className={styles.spellSlotSection} aria-labelledby='spell-slot-heading'>
        <Text className={styles.spellSlotHeading} fw={700} id='spell-slot-heading'>
          Slots
        </Text>
        <div className={styles.spellSlotGrid}>
          {sheet.spells.slots.length ? (
            sheet.spells.slots.map((slot) => (
              <button
                aria-label={`${slot.label}: ${slot.remaining} of ${slot.max} remaining`}
                className={styles.spellSlotCell}
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
            <Text className={styles.muted}>This character does not have spell slots.</Text>
          )}
        </div>
      </section>

      <div className={styles.sheetToolbar}>
        <TextInput
          aria-label='Search spells'
          className={styles.spellSearch}
          leftSection={<IconSearch size={16} />}
          placeholder='Search spells'
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <div
          aria-label='Spell action type filters'
          className={styles.actionFilterBar}
          role='toolbar'
        >
          {availableActionFilters.map((filter) => (
            <button
              aria-pressed={activeActionType === filter.id}
              className={styles.actionFilterChip}
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

      <div className={styles.scrollableSheetList}>
        {filteredGroups.length ? (
          filteredGroups.map((group) => (
            <section
              aria-labelledby={`spell-group-${group.level}`}
              className={styles.spellGroup}
              key={group.level}
            >
              <Text className={styles.spellGroupTitle} fw={700} id={`spell-group-${group.level}`}>
                {group.label}
              </Text>
              <div aria-hidden='true' className={styles.spellTableHeader}>
                <span>Spell</span>
                <span>Use</span>
                <span>Range</span>
                <span>Hit / DC</span>
                <span>Effect</span>
                <span />
              </div>
              <div className={styles.spellList}>
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

                  return (
                    <div
                      aria-label={accessibleSpellName}
                      className={styles.spellRow}
                      key={entry.rowId}
                      role='group'
                    >
                      <button
                        aria-label={`Open details for ${accessibleSpellName}`}
                        className={styles.spellEntryButton}
                        type='button'
                        onClick={() => openPanel?.(entry.target)}
                      >
                        <span className={styles.spellNameLine}>
                          <Text component='span' fw={700}>
                            {entry.displayName}
                          </Text>
                          {sourceLabel ? (
                            <Text className={styles.spellQualifier} component='span' size='xs'>
                              {sourceLabel}
                            </Text>
                          ) : null}
                        </span>
                        <Text
                          className={`${styles.spellFact} ${styles.spellActivationFact}`}
                          component='span'
                        >
                          {entry.activationLabel ?? '—'}
                        </Text>
                        <Text className={styles.spellFact} component='span'>
                          {entry.rangeLabel ?? '—'}
                        </Text>
                        <Text className={styles.spellFact} component='span'>
                          {entry.hitOrDcLabel ?? '—'}
                        </Text>
                        <span className={styles.spellEffectLine}>
                          {entry.primaryEffect ? (
                            <Text className={styles.spellPrimaryEffect} component='span'>
                              {entry.primaryEffect}
                            </Text>
                          ) : null}
                          {!entry.available && entry.unavailableReason ? (
                            <>
                              {entry.primaryEffect ? (
                                <span aria-hidden='true' className={styles.spellInlineSeparator}>
                                  ·
                                </span>
                              ) : null}
                              <Text
                                className={styles.spellUnavailable}
                                component='span'
                                id={`spell-unavailable-${entry.rowId}`}
                                size='xs'
                              >
                                {entry.unavailableReason}
                              </Text>
                            </>
                          ) : null}
                        </span>
                      </button>
                      <Button
                        aria-describedby={
                          !entry.available && entry.unavailableReason
                            ? `spell-unavailable-${entry.rowId}`
                            : undefined
                        }
                        aria-label={`Cast ${accessibleSpellName}`}
                        className={styles.spellCastButton}
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
                        <Text className={styles.spellCommandError} role='alert'>
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
          <Text className={styles.muted}>No active spells match this search.</Text>
        )}
      </div>
    </CharacterSheetDetailPanel>
  )
}
