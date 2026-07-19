import { Button, Text } from '@mantine/core'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import {
  CharacterSheetCompactActions,
  CharacterSheetDetailPanel,
  CharacterSheetDetailRow,
  CharacterSheetDetailRowList
} from './CharacterSheetDetailPanel'
import * as styles from './characterSheet.css'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetResources({
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  const version = sheet.meta.streamVersion
  const headerActions = (
    <CharacterSheetCompactActions>
      <Button
        className={styles.compactActionControl}
        disabled={pending}
        size='xs'
        variant='default'
        onClick={() => submitCommand({ type: 'APPLY_REST', restKind: 'SHORT', expectedVersion: version })}
      >
        Short Rest
      </Button>
      <Button
        className={styles.compactActionControl}
        disabled={pending}
        size='xs'
        onClick={() => submitCommand({ type: 'APPLY_REST', restKind: 'LONG', expectedVersion: version })}
      >
        Long Rest
      </Button>
    </CharacterSheetCompactActions>
  )

  return (
    <CharacterSheetDetailPanel
      ariaId='character-sheet-resources'
      description='Limited uses, recovery, and hit dice.'
      headerActions={headerActions}
      title='Resources'
    >
      <CharacterSheetDetailRowList>
        {sheet.resources.items.length
          ? sheet.resources.items.map((resource) => (
              <CharacterSheetDetailRow
                key={resource.id}
                left={(
                  <>
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
                    {resource.description ? <AuthoredDetailProse html={resource.description} fallback='' /> : null}
                  </>
                )}
                right={(
                  <CharacterSheetCompactActions>
                    <Button
                      className={styles.compactActionControl}
                      aria-label={`Use ${resource.label}`}
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
                      className={styles.compactActionControl}
                      aria-label={`Restore 1 ${resource.label}`}
                      disabled={pending || resource.used <= 0}
                      size='xs'
                      variant='default'
                      onClick={() => submitCommand({
                        type: 'RESTORE_RESOURCE',
                        resourceGrantId: resource.id,
                        expectedVersion: version
                      })}
                    >
                      Restore 1
                    </Button>
                    <Button
                      className={styles.compactActionControl}
                      aria-label={`Restore all ${resource.label}`}
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
                      Restore All
                    </Button>
                  </CharacterSheetCompactActions>
                )}
              />
            ))
          : <Text className={styles.muted}>No limited resources are currently available.</Text>}

        {sheet.resources.hitDice.map((hitDie) => (
          <CharacterSheetDetailRow
            key={hitDie.die}
            left={(
              <>
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
              </>
            )}
            right={(
              <CharacterSheetCompactActions>
                <Button
                  className={styles.compactActionControl}
                  aria-label={`Spend d${hitDie.die} hit die`}
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
              </CharacterSheetCompactActions>
            )}
          />
        ))}
      </CharacterSheetDetailRowList>
    </CharacterSheetDetailPanel>
  )
}
