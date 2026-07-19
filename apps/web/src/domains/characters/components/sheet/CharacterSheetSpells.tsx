import { Badge, Button, Drawer, Select, Text, TextInput } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { IconAdjustments, IconSearch, IconWand } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import {
  CharacterSheetCompactActions,
  CharacterSheetDetailPanel,
  CharacterSheetDetailRow,
  CharacterSheetDetailRowList
} from './CharacterSheetDetailPanel'
import * as styles from './characterSheet.css'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'
import { summarizeCharacterSheetMechanics } from './characterSheetMechanics.utils'
import {
  formatSpellAttributes,
  formatSpellSourceSummary,
  formatSpellSummary,
  getPreparedSpellIdsForClass,
  getSpellSourceKey,
  type SheetSpell,
  type SheetSpellSource
} from './characterSheetSpells.utils'
import { formatSigned } from './characterSheet.utils'

type SpellFilter = 'all' | 'cantrip' | 'prepared' | 'known'

function spellLevelLabel(level: number | undefined) {
  if (!level) return 'Cantrip'
  return `Level ${level}`
}

export function CharacterSheetSpells({ pending, sheet, submitCommand }: CharacterSheetSectionProps) {
  const version = sheet.meta.streamVersion
  const isMobile = useMediaQuery('(max-width: 760px)', false)
  const [drawerOpened, drawer] = useDisclosure(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SpellFilter>('all')
  const [selectedSpell, setSelectedSpell] = useState<SheetSpell | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null)
  const selectedSource = selectedSpell?.sources?.find((source) =>
    getSpellSourceKey(source) === selectedSourceId)
  const selectedSlot = sheet.spells.slots.find((slot) => slot.slotKey === selectedSlotKey)
  const selectedCastLevel = selectedSlot?.level ?? selectedSource?.fixedLevel ?? selectedSpell?.level

  const filteredSpells = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return sheet.spells.spells.filter((spell) => {
      if (normalizedQuery && !spell.label.toLocaleLowerCase().includes(normalizedQuery)) return false
      if (filter === 'cantrip') return !spell.level
      if (filter === 'prepared') return Boolean(spell.prepared)
      if (filter === 'known') return Boolean(spell.known)
      return true
    })
  }, [filter, query, sheet.spells.spells])

  function sourceCanCast(spell: SheetSpell, source: SheetSpellSource) {
    if (source.canPrepare && !source.prepared && source.acquisition !== 'ALWAYS_PREPARED' && source.acquisition !== 'GRANTED') return false
    if (source.castMode === 'LIMITED_USE') {
      return Boolean(source.resourceGrantId && sheet.resources.items.find((resource) => resource.id === source.resourceGrantId)?.remaining)
    }
    if (!spell.level || source.castMode === 'AT_WILL' || source.castMode === 'FIXED_LEVEL') return true
    return sheet.spells.slots.some((slot) => (slot.level ?? 0) >= spell.level && slot.remaining > 0)
  }

  function togglePreparedSpell(spell: SheetSpell, source: SheetSpellSource) {
    if (!source.classId) return
    const currentPreparedSpellIds = getPreparedSpellIdsForClass(sheet, source.classId)
    void submitCommand({
      type: 'SET_PREPARED_SPELLS',
      classId: source.classId,
      spellIds: source.prepared
        ? currentPreparedSpellIds.filter((spellId) => spellId !== spell.id)
        : [...new Set([...currentPreparedSpellIds, spell.id])],
      expectedVersion: version
    })
  }

  function openSpell(spell: SheetSpell) {
    const source = spell.sources?.find((candidate) => sourceCanCast(spell, candidate)) ?? spell.sources?.[0]
    setSelectedSpell(spell)
    setSelectedSourceId(source ? getSpellSourceKey(source) : null)
    setSelectedSlotKey(spell.level
      && source?.castMode !== 'AT_WILL'
      && source?.castMode !== 'FIXED_LEVEL'
      && source?.castMode !== 'LIMITED_USE'
      ? sheet.spells.slots.find((slot) => (slot.level ?? 0) >= spell.level && slot.remaining > 0)?.slotKey ?? null
      : null)
    drawer.open()
  }

  function openSpellManager() {
    setSelectedSpell(null)
    setSelectedSourceId(null)
    setSelectedSlotKey(null)
    drawer.open()
  }

  function selectSpellSource(sourceId: string | null) {
    setSelectedSourceId(sourceId)
    const source = selectedSpell?.sources?.find((candidate) => getSpellSourceKey(candidate) === sourceId)
    const requiresSlot = Boolean(
      selectedSpell?.level
      && source?.castMode !== 'AT_WILL'
      && source?.castMode !== 'FIXED_LEVEL'
      && source?.castMode !== 'LIMITED_USE'
    )
    setSelectedSlotKey(requiresSlot
      ? sheet.spells.slots.find((slot) =>
          (slot.level ?? 0) >= (selectedSpell?.level ?? 0) && slot.remaining > 0)?.slotKey ?? null
      : null)
  }

  return (
    <CharacterSheetDetailPanel
      ariaId='character-sheet-spells'
      description={`Save DC ${sheet.spells.saveDc ?? 'not set'}, attack ${sheet.spells.attackBonus == null ? 'not set' : formatSigned(sheet.spells.attackBonus)}`}
      title='Spells'
      headerActions={(
        <Button className={styles.compactActionControl} leftSection={<IconAdjustments size={16} />} size='xs' variant='default' onClick={openSpellManager}>
          Manage Spells
        </Button>
      )}
    >
      <section className={styles.spellSlotSection} aria-labelledby='spell-slot-heading'>
        <div className={styles.sectionHeadingRow}>
          <Text fw={700} id='spell-slot-heading'>Spell Slots</Text>
          <Text className={styles.muted} size='sm'>Select a level to use or restore slots.</Text>
        </div>
        <div className={styles.spellSlotGrid}>
          {sheet.spells.slots.length
            ? sheet.spells.slots.map((slot) => (
                <button
                  aria-label={`${slot.label}: ${slot.remaining} of ${slot.max} remaining`}
                  className={styles.spellSlotCell}
                  key={slot.slotKey}
                  type='button'
                  onClick={() => {
                    setSelectedSpell(null)
                    setSelectedSlotKey(slot.slotKey)
                    drawer.open()
                  }}
                >
                  <span>{slot.level == null ? slot.label : `Level ${slot.level}`}</span>
                  <strong>{slot.remaining} / {slot.max}</strong>
                </button>
              ))
            : <Text className={styles.muted}>This character does not have spell slots.</Text>}
        </div>
      </section>

      <div className={styles.sheetToolbar}>
        <TextInput
          aria-label='Search spells'
          leftSection={<IconSearch size={16} />}
          placeholder='Search spells'
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <div className={styles.filterButtons} role='group' aria-label='Filter spells'>
          {(['all', 'cantrip', 'prepared', 'known'] as const).map((value) => (
            <Button
              key={value}
              size='xs'
              variant={filter === value ? 'filled' : 'default'}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? 'All' : value[0].toUpperCase() + value.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className={styles.scrollableSheetList}>
        <CharacterSheetDetailRowList>
          {filteredSpells.length
            ? filteredSpells.map((spell) => {
                const attributes = formatSpellAttributes(spell)
                const mechanics = summarizeCharacterSheetMechanics(spell.mechanics, spell.level)
                return (
                  <CharacterSheetDetailRow
                    ariaLabel={spell.label}
                    key={spell.id}
                    left={(
                      <>
                        <div className={styles.itemHeadingRow}>
                          <Text fw={700}>{spell.label}</Text>
                          <Badge size='sm' variant='default'>{spellLevelLabel(spell.level)}</Badge>
                        </div>
                        <Text className={styles.muted}>{formatSpellSummary(spell)}</Text>
                        {spell.sources?.length
                          ? (
                              <div className={styles.badgeRow}>
                                {spell.sources.map((source) => (
                                  <Badge key={getSpellSourceKey(source)} size='sm' variant='light'>
                                    {formatSpellSourceSummary(source)}
                                  </Badge>
                                ))}
                              </div>
                            )
                          : null}
                        {attributes ? <Text className={styles.muted}>Attributes: {attributes}</Text> : null}
                        {mechanics.length
                          ? (
                              <div className={styles.mechanicList}>
                                {mechanics.map((mechanic) => (
                                  <div className={styles.mechanicBlock} key={mechanic.effectId}>
                                    {mechanic.facts ? <Text className={styles.mechanicFacts}>{mechanic.facts}</Text> : null}
                                    {mechanic.outcomes.map((outcome) => (
                                      <Text className={styles.mechanicOutcome} key={outcome}>{outcome}</Text>
                                    ))}
                                    {mechanic.hasScaling ? <Text className={styles.mechanicScaling}>Can be cast using a higher-level spell slot.</Text> : null}
                                  </div>
                                ))}
                              </div>
                            )
                          : null}
                        {spell.description ? <AuthoredDetailProse html={spell.description} fallback='' /> : null}
                      </>
                    )}
                    right={(
                      <CharacterSheetCompactActions>
                        {spell.prepared ? <Badge variant='light'>Prepared</Badge> : null}
                        {spell.known ? <Badge variant='default'>Known</Badge> : null}
                        <Button className={styles.compactActionControl} disabled={pending || !spell.sources?.some((source) => sourceCanCast(spell, source))} leftSection={<IconWand size={14} />} size='xs' onClick={() => openSpell(spell)}>
                          Cast
                        </Button>
                      </CharacterSheetCompactActions>
                    )}
                  />
                )
              })
            : <Text className={styles.muted}>No spells match these filters.</Text>}
        </CharacterSheetDetailRowList>
      </div>

      <Drawer
        opened={drawerOpened}
        onClose={drawer.close}
        position={isMobile ? 'bottom' : 'right'}
        size={isMobile ? 'auto' : 'md'}
        title={selectedSpell ? `Cast ${selectedSpell.label}` : selectedSlotKey ? 'Manage Spell Slot' : 'Manage Spells'}
      >
        <div className={styles.drawerStack}>
          {selectedSpell
            ? (
                <>
                  <Text>{formatSpellSummary(selectedSpell)}</Text>
                  {summarizeCharacterSheetMechanics(selectedSpell.mechanics, selectedCastLevel).map((mechanic) => (
                    <div className={styles.mechanicBlock} key={mechanic.effectId}>
                      {mechanic.facts ? <Text className={styles.mechanicFacts}>{mechanic.facts}</Text> : null}
                      {mechanic.outcomes.map((outcome) => (
                        <Text className={styles.mechanicOutcome} key={outcome}>{outcome}</Text>
                      ))}
                    </div>
                  ))}
                  {selectedSpell.sources && selectedSpell.sources.length > 1
                    ? (
                        <Select
                          data={selectedSpell.sources.map((source) => ({
                            value: getSpellSourceKey(source),
                            label: formatSpellSourceSummary(source),
                            disabled: !sourceCanCast(selectedSpell, source)
                          }))}
                          label='Spell source'
                          value={selectedSourceId}
                          onChange={selectSpellSource}
                        />
                      )
                    : null}
                  {selectedSpell.level && !selectedSpell.sources?.some((source) =>
                    getSpellSourceKey(source) === selectedSourceId
                    && source.castMode && source.castMode !== 'SPELL_SLOT'
                  )
                    ? (
                        <Select
                          data={sheet.spells.slots
                            .filter((slot) => (slot.level ?? 0) >= (selectedSpell.level ?? 0) && slot.remaining > 0)
                            .map((slot) => ({ value: slot.slotKey, label: `${slot.label} · ${slot.remaining}/${slot.max}` }))}
                          label='Cast using'
                          value={selectedSlotKey}
                          onChange={setSelectedSlotKey}
                        />
                      )
                    : <Badge variant='light'>{selectedSpell.level ? 'Granted use · no spell slot choice' : 'At will · no spell slot'}</Badge>}
                  <Button
                    disabled={pending || !selectedSource || !sourceCanCast(selectedSpell, selectedSource) || (Boolean(selectedSpell.level)
                      && !selectedSlotKey
                      && !selectedSpell.sources?.some((source) =>
                        getSpellSourceKey(source) === selectedSourceId
                        && source.castMode && source.castMode !== 'SPELL_SLOT'
                      ))}
                    onClick={async () => {
                      await submitCommand({
                        type: 'CAST_SPELL',
                        spellId: selectedSpell.id,
                        sourceId: selectedSourceId ?? undefined,
                        slotKey: selectedSlotKey ?? undefined,
                        expectedVersion: version
                      })
                    }}
                  >
                    Cast {selectedSpell.label}
                  </Button>
                </>
              )
            : selectedSlotKey
              ? (() => {
                  const slot = sheet.spells.slots.find((candidate) => candidate.slotKey === selectedSlotKey)
                  if (!slot) return null
                  return (
                    <>
                      <Text>{slot.remaining} of {slot.max} {slot.label.toLocaleLowerCase()} slots remaining.</Text>
                      <Button disabled={pending || slot.remaining <= 0} onClick={() => submitCommand({ type: 'USE_SPELL_SLOT', slotKey: slot.slotKey, expectedVersion: version })}>Use one slot</Button>
                      <Button disabled={pending || slot.used <= 0} variant='default' onClick={() => submitCommand({ type: 'RESTORE_SPELL_SLOT', slotKey: slot.slotKey, expectedVersion: version })}>Restore one</Button>
                      <Button disabled={pending || slot.used <= 0} variant='default' onClick={() => submitCommand({ type: 'RESTORE_SPELL_SLOT', slotKey: slot.slotKey, all: true, expectedVersion: version })}>Restore all</Button>
                    </>
                  )
                })()
              : (
                  <CharacterSheetDetailRowList>
                    {sheet.spells.spells.flatMap((spell) => spell.sources
                      ?.filter((source) => source.canPrepare && source.classId)
                      .map((source) => (
                        <CharacterSheetDetailRow
                          ariaLabel={spell.label}
                          key={`${spell.id}:${source.classId}`}
                          left={<><Text fw={700}>{spell.label}</Text><Text className={styles.muted}>{source.label}</Text></>}
                          right={(
                            <Button disabled={pending} size='xs' variant={source.prepared ? 'default' : 'light'} onClick={() => togglePreparedSpell(spell, source)}>
                              {source.prepared ? 'Unprepare' : 'Prepare'}
                            </Button>
                          )}
                        />
                      )) ?? [])}
                  </CharacterSheetDetailRowList>
                )}
        </div>
      </Drawer>
    </CharacterSheetDetailPanel>
  )
}
