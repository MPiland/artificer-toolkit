import { Button, NumberInput, Text } from '@mantine/core'
import { Coffee, Moon } from 'lucide-react'
import { useState } from 'react'
import * as styles from './characterSheet.css'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'
import { formatSigned, toNumber } from './characterSheet.utils'
import { formatHitDiceSummary } from './characterSheetOverview.utils'

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
    <div className={styles.hpControlGrid}>
      <NumberInput
        classNames={{ input: styles.hpControlTarget }}
        disabled={pending}
        label='Amount'
        min={0}
        value={hitPointDelta}
        onChange={(value) => setHitPointDelta(toNumber(value))}
      />
      <Button
        className={styles.hpControlTarget}
        disabled={pending || hitPointDelta <= 0}
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
        className={styles.hpControlTarget}
        disabled={pending || hitPointDelta <= 0}
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
        classNames={{ input: styles.hpControlTarget }}
        disabled={pending}
        label='Temp HP'
        min={0}
        value={tempHitPoints}
        onChange={(value) => setTempHitPoints(toNumber(value))}
      />
      <NumberInput
        classNames={{ input: styles.hpControlTarget }}
        disabled={pending}
        label='Max HP override'
        min={0}
        placeholder={String(sheet.overview.maxHitPoints)}
        value={maxOverride}
        onChange={setMaxOverride}
      />
      <Button
        className={styles.hpControlTarget}
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

export function CharacterSheetOverviewVitals({
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  const version = sheet.meta.streamVersion
  const [hpControlsOpen, setHpControlsOpen] = useState(false)
  const hitPointPercent = sheet.overview.maxHitPoints > 0
    ? Math.max(0, Math.min(100, Math.round((sheet.overview.currentHitPoints / sheet.overview.maxHitPoints) * 100)))
    : 0
  const speedFact = sheet.overview.facts.find((fact) => fact.label.toLowerCase() === 'speed')
  const primaryFacts = [
    { label: 'Armor Class', value: String(sheet.overview.armorClass) },
    { label: 'Initiative', value: formatSigned(sheet.overview.initiative) },
    { label: 'Proficiency', value: formatSigned(sheet.overview.proficiencyBonus) },
    ...(speedFact ? [speedFact] : [])
  ]

  return (
    <section className={styles.combatPanel} aria-labelledby='character-sheet-vitals'>
      <h2 id='character-sheet-vitals' className={styles.visuallyHidden}>Combat facts and hit points</h2>
      <div className={styles.restActionDock}>
        <Button
          className={`${styles.compactActionControl} ${styles.restActionButton}`}
          disabled={pending}
          leftSection={<Coffee aria-hidden='true' size={14} />}
          size='xs'
          variant='default'
          onClick={() => submitCommand({ type: 'APPLY_REST', restKind: 'SHORT', expectedVersion: version })}
        >
          Short Rest
        </Button>
        <Button
          className={`${styles.compactActionControl} ${styles.restActionButton}`}
          disabled={pending}
          leftSection={<Moon aria-hidden='true' size={14} />}
          size='xs'
          onClick={() => submitCommand({ type: 'APPLY_REST', restKind: 'LONG', expectedVersion: version })}
        >
          Long Rest
        </Button>
      </div>
      <div className={styles.combatSummaryCard}>
        <div className={styles.combatFactGrid}>
          {primaryFacts.map((fact) => (
            <div className={styles.combatFact} key={`${fact.label}:${fact.value}`}>
              <Text className={styles.metricLabel}>{fact.label}</Text>
              <Text className={styles.metricValue}>{fact.value}</Text>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.hpReadout}>
        <div className={styles.hpTopLine}>
          <Text className={styles.metricLabel}>HP</Text>
          <Text className={styles.hpValue}>
            {sheet.overview.currentHitPoints}
            <span className={styles.hpValueSeparator}>/</span>
            {sheet.overview.maxHitPoints}
          </Text>
        </div>
        <div className={styles.hpMeter} aria-hidden='true'>
          <span className={styles.hpMeterFill} style={{ width: `${hitPointPercent}%` }} />
        </div>
        <div className={styles.hpMinorFacts}>
          <Text>
            Temp
            {' '}
            <strong>{sheet.overview.tempHitPoints || '-'}</strong>
          </Text>
          <Text>
            Hit Dice
            {' '}
            <strong>{formatHitDiceSummary(sheet.overview.hitDice)}</strong>
          </Text>
        </div>
        <Button
          className={styles.compactActionControl}
          aria-expanded={hpControlsOpen}
          disabled={pending}
          size='xs'
          variant='default'
          onClick={() => setHpControlsOpen((current) => !current)}
        >
          Manage HP
        </Button>
      </div>
      {hpControlsOpen
        ? (
            <div className={styles.hpInlineDrawer}>
              <CharacterSheetHpControls
                key={version}
                pending={pending}
                sheet={sheet}
                submitCommand={submitCommand}
                version={version}
              />
            </div>
          )
        : null}
    </section>
  )
}
