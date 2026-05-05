import { Button, NumberInput, Select, Text, TextInput, Title } from '@mantine/core'
import { useState } from 'react'
import * as styles from './characterSheet.css'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'
import { formatSigned, toNumber } from './characterSheet.utils'

function CharacterSheetHpControls({
  pending,
  sheet,
  submitCommand,
  version
}: CharacterSheetSectionProps & { version: number }) {
  const [hitPointDelta, setHitPointDelta] = useState(1)
  const [tempHitPoints, setTempHitPoints] = useState(sheet.overview.tempHitPoints)
  const [maxOverride, setMaxOverride] = useState<string | number>(sheet.overview.maxHitPointsOverride ?? '')

  return (
    <div className={styles.hpControls}>
      <NumberInput
        label='Amount'
        min={0}
        value={hitPointDelta}
        onChange={(value) => setHitPointDelta(toNumber(value))}
      />
      <Button
        disabled={pending}
        onClick={() => submitCommand({
          type: 'ADJUST_HIT_POINTS',
          amount: hitPointDelta,
          mode: 'DAMAGE',
          expectedVersion: version
        })}
      >
        Apply Damage
      </Button>
      <Button
        disabled={pending}
        variant='default'
        onClick={() => submitCommand({
          type: 'ADJUST_HIT_POINTS',
          amount: hitPointDelta,
          mode: 'HEAL',
          expectedVersion: version
        })}
      >
        Heal
      </Button>
      <NumberInput
        label='Temp HP'
        min={0}
        value={tempHitPoints}
        onChange={(value) => setTempHitPoints(toNumber(value))}
      />
      <NumberInput
        label='Max HP override'
        min={0}
        placeholder={String(sheet.overview.maxHitPoints)}
        value={maxOverride}
        onChange={setMaxOverride}
      />
      <Button
        disabled={pending}
        variant='default'
        onClick={() => submitCommand({
          type: 'SET_HIT_POINTS',
          temp: tempHitPoints,
          maxOverride: maxOverride === '' ? null : toNumber(maxOverride),
          expectedVersion: version
        })}
      >
        Save HP Settings
      </Button>
    </div>
  )
}

export function CharacterSheetOverview({
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  const version = sheet.meta.streamVersion
  const [conditionTypeId, setConditionTypeId] = useState<string | null>(null)
  const [conditionNotes, setConditionNotes] = useState('')

  return (
    <section className={styles.panel} aria-labelledby='character-sheet-overview'>
      <div className={styles.panelHeader}>
        <div>
          <Title id='character-sheet-overview' className={styles.panelTitle}>Overview</Title>
          <Text className={styles.muted}>Health, defenses, conditions, and ability scores.</Text>
        </div>
      </div>

      <div className={styles.statDock}>
        <div className={styles.statTile}>
          <Text className={styles.statLabel}>HP</Text>
          <Text className={styles.statValue}>
            {sheet.overview.currentHitPoints}
            /
            {sheet.overview.maxHitPoints}
          </Text>
        </div>
        <div className={styles.statTile}>
          <Text className={styles.statLabel}>Temp HP</Text>
          <Text className={styles.statValue}>{sheet.overview.tempHitPoints}</Text>
        </div>
        <div className={styles.statTile}>
          <Text className={styles.statLabel}>Armor Class</Text>
          <Text className={styles.statValue}>{sheet.overview.armorClass}</Text>
        </div>
        <div className={styles.statTile}>
          <Text className={styles.statLabel}>Initiative</Text>
          <Text className={styles.statValue}>{formatSigned(sheet.overview.initiative)}</Text>
        </div>
      </div>

      <CharacterSheetHpControls
        key={version}
        pending={pending}
        sheet={sheet}
        submitCommand={submitCommand}
        version={version}
      />

      <div className={styles.abilityGrid}>
        {sheet.overview.abilities.map((ability) => (
          <div className={styles.abilityTile} key={ability.ability}>
            <Text className={styles.statLabel}>{ability.ability}</Text>
            <Text className={styles.statValue}>{formatSigned(ability.modifier)}</Text>
            <Text className={styles.muted}>{ability.score}</Text>
          </div>
        ))}
      </div>

      <div className={styles.rowList}>
        <div className={styles.row}>
          <div>
            <Text fw={700}>Exhaustion</Text>
            <Text className={styles.muted}>
              Level
              {sheet.overview.exhaustionLevel}
            </Text>
          </div>
          <div className={styles.compactActions}>
            <Button
              disabled={pending || sheet.overview.exhaustionLevel <= 0}
              size='xs'
              variant='default'
              onClick={() => submitCommand({
                type: 'SET_EXHAUSTION',
                level: Math.max(sheet.overview.exhaustionLevel - 1, 0),
                expectedVersion: version
              })}
            >
              Reduce
            </Button>
            <Button
              disabled={pending || sheet.overview.exhaustionLevel >= 6}
              size='xs'
              onClick={() => submitCommand({
                type: 'SET_EXHAUSTION',
                level: Math.min(sheet.overview.exhaustionLevel + 1, 6),
                expectedVersion: version
              })}
            >
              Increase
            </Button>
          </div>
        </div>

        <div className={styles.row}>
          <div>
            <Text fw={700}>Conditions</Text>
            <Text className={styles.muted}>
              {sheet.overview.conditions.length ? sheet.overview.conditions.map((condition) => condition.label).join(', ') : 'No active conditions'}
            </Text>
          </div>
          <div className={styles.compactActions}>
            <Select
              data={sheet.reference.conditionOptions.map((option) => ({
                value: option.id,
                label: option.label
              }))}
              placeholder='Add condition'
              value={conditionTypeId}
              onChange={setConditionTypeId}
              searchable
            />
            <TextInput
              aria-label='Condition notes'
              placeholder='Notes'
              value={conditionNotes}
              onChange={(event) => setConditionNotes(event.currentTarget.value)}
            />
            <Button
              disabled={pending || !conditionTypeId}
              size='xs'
              onClick={() => {
                if (!conditionTypeId) return
                submitCommand({
                  type: 'ADD_CONDITION',
                  conditionTypeId,
                  notes: conditionNotes.trim() || undefined,
                  expectedVersion: version
                })
                setConditionTypeId(null)
                setConditionNotes('')
              }}
            >
              Add
            </Button>
          </div>
        </div>

        {sheet.overview.conditions.map((condition) => (
          <div className={styles.row} key={condition.conditionTypeId}>
            <div>
              <Text>{condition.label}</Text>
              {condition.notes ? <Text className={styles.muted}>{condition.notes}</Text> : null}
            </div>
            <Button
              disabled={pending}
              size='xs'
              variant='default'
              onClick={() => submitCommand({
                type: 'REMOVE_CONDITION',
                conditionTypeId: condition.conditionTypeId,
                expectedVersion: version
              })}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
