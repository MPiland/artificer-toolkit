import { useState } from 'react'
import { Badge, Text } from '@mantine/core'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import {
  CharacterSheetDetailPanel,
  CharacterSheetDetailRow,
  CharacterSheetDetailRowList
} from './CharacterSheetDetailPanel'
import * as styles from './characterSheet.css'
import type { CharacterSheet } from './CharacterSheet.types'
import { summarizeCharacterSheetMechanics } from './characterSheetMechanics.utils'
import {
  CHARACTER_SHEET_ACTION_FILTERS,
  filterPlayableActions,
  formatPlayableActionKind,
  getPlayableActions,
  type CharacterSheetActionFilter
} from './characterSheetActions.utils'

export function CharacterSheetActions({ sheet }: { sheet: CharacterSheet }) {
  const actions = getPlayableActions(sheet)
  const [activeFilter, setActiveFilter] = useState<CharacterSheetActionFilter>('ALL')
  const filteredActions = filterPlayableActions(actions, activeFilter)

  return (
    <CharacterSheetDetailPanel
      ariaId='character-sheet-actions'
      description='Attacks, turn actions, reactions, and limited-use options.'
      title='Actions'
    >
      <div className={styles.actionFilterBar} aria-label='Action type filters' role='toolbar'>
        {CHARACTER_SHEET_ACTION_FILTERS.map((filter) => (
          <button
            aria-pressed={activeFilter === filter.id}
            className={styles.actionFilterChip}
            data-active={activeFilter === filter.id}
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            type='button'
          >
            {filter.label}
          </button>
        ))}
      </div>
      <CharacterSheetDetailRowList>
        {filteredActions.length
          ? filteredActions.map((action) => {
              const mechanicSummaries = summarizeCharacterSheetMechanics(action.mechanics)

              return (
                <CharacterSheetDetailRow
                  ariaLabel={action.label}
                  key={action.id}
                  left={(
                    <>
                      <Text className={styles.playRowTitle}>{action.label}</Text>
                      <Text className={styles.muted}>{action.sourceLabel ?? 'Character'}</Text>
                      {action.detail ? <Text className={styles.muted}>{action.detail}</Text> : null}
                      {mechanicSummaries.length
                        ? (
                            <div className={styles.mechanicList}>
                              {mechanicSummaries.map((mechanic) => (
                                <div className={styles.mechanicBlock} key={mechanic.effectId}>
                                  {mechanic.facts ? <Text className={styles.mechanicFacts}>{mechanic.facts}</Text> : null}
                                  {mechanic.outcomes.map((outcome) => (
                                    <Text className={styles.mechanicOutcome} key={outcome}>{outcome}</Text>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )
                        : null}
                      {action.description ? <AuthoredDetailProse html={action.description} fallback='' /> : null}
                    </>
                  )}
                  right={<Badge variant='light'>{formatPlayableActionKind(action.kind)}</Badge>}
                />
              )
            })
          : <Text className={styles.muted}>No matching actions are currently available.</Text>}
      </CharacterSheetDetailRowList>
    </CharacterSheetDetailPanel>
  )
}
