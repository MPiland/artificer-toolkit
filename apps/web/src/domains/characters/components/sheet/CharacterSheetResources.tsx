import { Button, Text, Title } from '@mantine/core'
import * as styles from './characterSheet.css'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetResources({
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  const version = sheet.meta.streamVersion

  return (
    <section className={styles.panel} aria-labelledby='character-sheet-resources'>
      <div className={styles.panelHeader}>
        <div>
          <Title id='character-sheet-resources' className={styles.panelTitle}>Resources</Title>
          <Text className={styles.muted}>Limited uses, recovery, and hit dice.</Text>
        </div>
      </div>
      <div className={styles.rowList}>
        {sheet.resources.items.length
          ? sheet.resources.items.map((resource) => (
              <div className={styles.row} key={resource.id}>
                <div>
                  <Text fw={700}>{resource.label}</Text>
                  <Text className={styles.muted}>
                    {resource.sourceLabel}
                    ,
                    {' '}
                    {resource.remaining}
                    /
                    {resource.max}
                    {' '}
                    remaining
                  </Text>
                </div>
                <div className={styles.compactActions}>
                  <Button
                    disabled={pending || resource.remaining <= 0}
                    size='xs'
                    onClick={() => submitCommand({
                      type: 'USE_RESOURCE',
                      resourceGrantId: resource.id,
                      expectedVersion: version
                    })}
                  >
                    Use
                  </Button>
                  <Button
                    disabled={pending || resource.used <= 0}
                    size='xs'
                    variant='default'
                    onClick={() => submitCommand({
                      type: 'RESTORE_RESOURCE',
                      resourceGrantId: resource.id,
                      all: true,
                      expectedVersion: version
                    })}
                  >
                    Restore
                  </Button>
                </div>
              </div>
            ))
          : <Text className={styles.muted}>No limited resources are currently available.</Text>}

        {sheet.resources.hitDice.map((hitDie) => (
          <div className={styles.row} key={hitDie.die}>
            <div>
              <Text fw={700}>
                d
                {hitDie.die}
                {' '}
                Hit Dice
              </Text>
              <Text className={styles.muted}>
                {hitDie.remaining}
                /
                {hitDie.total}
                {' '}
                available
              </Text>
            </div>
            <Button
              disabled={pending || hitDie.remaining <= 0}
              size='xs'
              variant='default'
              onClick={() => submitCommand({
                type: 'USE_HIT_DIE',
                die: hitDie.die,
                expectedVersion: version
              })}
            >
              Spend
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
