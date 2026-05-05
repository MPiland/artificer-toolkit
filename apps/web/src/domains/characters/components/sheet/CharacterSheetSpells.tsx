import { Badge, Button, Text, Title } from '@mantine/core'
import * as styles from './characterSheet.css'
import type { CharacterSheet, CharacterSheetSectionProps } from './CharacterSheet.types'
import { formatSigned } from './characterSheet.utils'

type SheetSpell = CharacterSheet['spells']['spells'][number]
type SheetSpellSource = NonNullable<SheetSpell['sources']>[number]

function getPreparedSpellIdsForClass(sheet: CharacterSheet, classId: string) {
  const preparationSource = sheet.spells.preparationSources?.find((source) => source.classId === classId)
  if (preparationSource) return preparationSource.preparedSpellIds

  return sheet.spells.spells
    .filter((spell) => spell.sources?.some((source) => source.classId === classId && source.prepared))
    .map((spell) => spell.id)
}

export function CharacterSheetSpells({
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  const version = sheet.meta.streamVersion

  function togglePreparedSpell(spell: SheetSpell, source: SheetSpellSource) {
    const currentPreparedSpellIds = getPreparedSpellIdsForClass(sheet, source.classId)
    const nextPreparedSpellIds = source.prepared
      ? currentPreparedSpellIds.filter((spellId) => spellId !== spell.id)
      : [...new Set([...currentPreparedSpellIds, spell.id])]

    submitCommand({
      type: 'SET_PREPARED_SPELLS',
      classId: source.classId,
      spellIds: nextPreparedSpellIds,
      expectedVersion: version
    })
  }

  return (
    <section className={styles.panel} aria-labelledby='character-sheet-spells'>
      <div className={styles.panelHeader}>
        <div>
          <Title id='character-sheet-spells' className={styles.panelTitle}>Spells</Title>
          <Text className={styles.muted}>
            Save DC
            {' '}
            {sheet.spells.saveDc ?? 'not set'}
            , attack
            {' '}
            {sheet.spells.attackBonus == null ? 'not set' : formatSigned(sheet.spells.attackBonus)}
          </Text>
        </div>
      </div>

      <div className={styles.rowList}>
        {sheet.spells.slots.length
          ? sheet.spells.slots.map((slot) => (
              <div className={styles.row} key={slot.slotKey}>
                <div>
                  <Text fw={700}>{slot.label}</Text>
                  <Text className={styles.muted}>
                    {slot.remaining}
                    /
                    {slot.max}
                    {' '}
                    slots remaining
                  </Text>
                </div>
                <div className={styles.compactActions}>
                  <Button
                    disabled={pending || slot.remaining <= 0}
                    size='xs'
                    onClick={() => submitCommand({
                      type: 'USE_SPELL_SLOT',
                      slotKey: slot.slotKey,
                      expectedVersion: version
                    })}
                  >
                    Use
                  </Button>
                  <Button
                    disabled={pending || slot.used <= 0}
                    size='xs'
                    variant='default'
                    onClick={() => submitCommand({
                      type: 'RESTORE_SPELL_SLOT',
                      slotKey: slot.slotKey,
                      expectedVersion: version
                    })}
                  >
                    Restore 1
                  </Button>
                  <Button
                    disabled={pending || slot.used <= 0}
                    size='xs'
                    variant='default'
                    onClick={() => submitCommand({
                      type: 'RESTORE_SPELL_SLOT',
                      slotKey: slot.slotKey,
                      all: true,
                      expectedVersion: version
                    })}
                  >
                    Restore All
                  </Button>
                </div>
              </div>
            ))
          : <Text className={styles.muted}>No spell slots are currently available.</Text>}
      </div>

      <div className={styles.rowList}>
        {sheet.spells.spells.length
          ? sheet.spells.spells.map((spell) => (
              <div className={styles.row} key={spell.id}>
                <div>
                  <Text fw={700}>{spell.label}</Text>
                  <Text className={styles.muted}>
                    Level
                    {spell.level}
                    {spell.school ? `, ${spell.school}` : ''}
                    {spell.sourceLabel ? `, ${spell.sourceLabel}` : ''}
                  </Text>
                </div>
                <div className={styles.compactActions}>
                  {spell.prepared ? <Badge variant='light'>Prepared</Badge> : null}
                  {spell.known ? <Badge variant='default'>Known</Badge> : null}
                  {spell.sources?.map((source) => (
                    <Button
                      aria-label={`${source.prepared ? 'Unprepare' : 'Prepare'} ${spell.label} for ${source.label}`}
                      disabled={pending}
                      key={source.classId}
                      size='xs'
                      variant={source.prepared ? 'default' : 'light'}
                      onClick={() => togglePreparedSpell(spell, source)}
                    >
                      {source.prepared ? 'Unprepare' : 'Prepare'}
                    </Button>
                  ))}
                </div>
              </div>
            ))
          : <Text className={styles.muted}>No spells are currently selected.</Text>}
      </div>
    </section>
  )
}
