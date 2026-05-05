import { Alert, Skeleton, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { getCharacterHistory } from '#app/data/characters/queries'
import type { CharacterHistoryResponseDto } from '#app/lib/api'
import * as styles from './characterSheet.css'
import { formatHistoryEventType, formatHistoryTimestamp } from './characterSheetHistory.utils'

export function CharacterSheetHistoryList({
  entries
}: {
  entries: CharacterHistoryResponseDto['entries']
}) {
  return (
    <div className={styles.rowList}>
      {entries.length
        ? entries.map((entry) => (
            <div className={styles.row} key={entry.eventId}>
              <div>
                <Text fw={700}>{entry.summary}</Text>
                <Text className={styles.muted}>
                  <time dateTime={entry.occurredAt}>{formatHistoryTimestamp(entry.occurredAt)}</time>
                  {' '}
                  -
                  {' '}
                  {formatHistoryEventType(entry.eventType)}
                </Text>
              </div>
            </div>
          ))
        : <Text className={styles.muted}>No sheet activity has been recorded yet.</Text>}
    </div>
  )
}

function CharacterSheetHistoryLoading() {
  return (
    <div className={styles.rowList} aria-label='Loading history'>
      <div className={styles.row}>
        <div>
          <Skeleton height={18} radius='sm' width='45%' />
          <Skeleton height={14} mt={8} radius='sm' width='32%' />
        </div>
      </div>
      <div className={styles.row}>
        <div>
          <Skeleton height={18} radius='sm' width='52%' />
          <Skeleton height={14} mt={8} radius='sm' width='28%' />
        </div>
      </div>
    </div>
  )
}

export function CharacterSheetHistory({
  characterId
}: {
  characterId: string
}) {
  const historyQuery = useQuery(getCharacterHistory(characterId))

  return (
    <section className={styles.panel} aria-labelledby='character-sheet-history'>
      <div className={styles.panelHeader}>
        <div>
          <Title id='character-sheet-history' className={styles.panelTitle}>History</Title>
          <Text className={styles.muted}>Recent play-state changes for this character.</Text>
        </div>
      </div>
      {historyQuery.isPending ? <CharacterSheetHistoryLoading /> : null}
      {historyQuery.isError ? <Alert color='red'>{historyQuery.error.message}</Alert> : null}
      {historyQuery.data ? <CharacterSheetHistoryList entries={historyQuery.data.entries} /> : null}
    </section>
  )
}
