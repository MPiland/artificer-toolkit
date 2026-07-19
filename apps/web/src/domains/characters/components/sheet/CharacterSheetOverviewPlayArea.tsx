import { Text, Title } from '@mantine/core'
import { CircleDot, Swords, Zap } from 'lucide-react'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import * as styles from './characterSheet.css'
import type { CharacterSheet } from './CharacterSheet.types'
import {
  CHARACTER_SHEET_ACTION_FILTERS,
  formatPlayableActionKind,
  getFeatureSummaryItems,
  getPlayableActions,
  type CharacterSheetPlayableAction
} from './characterSheetActions.utils'

function OverviewActionRows({ sheet }: { sheet: CharacterSheet }) {
  const actions = getPlayableActions(sheet).slice(0, 6)

  if (!actions.length) return <Text className={styles.muted}>No playable actions are currently available.</Text>

  return (
    <div className={styles.actionSummary}>
      <div className={styles.actionFilterBar} aria-label='Action type filters'>
        {CHARACTER_SHEET_ACTION_FILTERS.map((filter, index) => (
          <span className={styles.actionFilterChip} data-active={index === 0} key={filter.id}>
            {filter.label}
          </span>
        ))}
      </div>
      <div className={styles.actionTable}>
        <div className={styles.actionTableHeader}>
          <span aria-hidden='true' />
          <Text>Name</Text>
          <Text>Type</Text>
          <Text>Notes</Text>
        </div>
        {actions.map((action) => (
          <div className={styles.actionTableRow} key={action.id}>
            <span className={styles.actionIcon} aria-hidden='true'>
              <ActionIcon kind={action.kind} />
            </span>
            <div>
              <Text className={styles.playRowTitle}>{action.label}</Text>
              <Text className={styles.playRowMeta}>{action.sourceLabel ?? 'Character'}</Text>
            </div>
            <Text className={styles.actionKindText}>{formatPlayableActionKind(action.kind)}</Text>
            <Text className={styles.playRowMeta}>{action.detail ?? '-'}</Text>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActionIcon({ kind }: { kind: CharacterSheetPlayableAction['kind'] }) {
  if (kind === 'ATTACK') return <Swords size={14} />
  if (kind === 'LIMITED_USE') return <Zap size={14} />
  return <CircleDot size={14} />
}

function OverviewFeatureRows({ sheet }: { sheet: CharacterSheet }) {
  const features = getFeatureSummaryItems(sheet, 4)

  if (!features.length) return <Text className={styles.muted}>No feature references are currently available.</Text>

  return (
    <div className={styles.featureSummaryList}>
      {features.map((feature) => (
        <div className={styles.featureSummaryRow} key={`${feature.sourceLabel}:${feature.id}`}>
          <div>
            <Text className={styles.playRowTitle}>{feature.label}</Text>
            <Text className={styles.playRowMeta}>{feature.sourceLabel}</Text>
          </div>
          {feature.description ? <AuthoredDetailProse html={feature.description} fallback='' /> : null}
        </div>
      ))}
    </div>
  )
}

export function CharacterSheetOverviewPlayArea({ sheet }: { sheet: CharacterSheet }) {
  return (
    <>
      <section className={styles.playPanel} aria-labelledby='character-sheet-play-area'>
        <div className={styles.playPanelHeader}>
          <div>
            <Title id='character-sheet-play-area' className={styles.panelTitle}>Actions</Title>
          </div>
        </div>
        <OverviewActionRows sheet={sheet} />
      </section>
      <section className={styles.playPanel} aria-labelledby='character-sheet-feature-summary'>
        <div className={styles.playPanelHeader}>
          <div>
            <Title id='character-sheet-feature-summary' className={styles.panelTitle}>Features & Traits</Title>
          </div>
        </div>
        <OverviewFeatureRows sheet={sheet} />
      </section>
    </>
  )
}
