import { Text, Title } from '@mantine/core'
import { Swords } from 'lucide-react'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import * as styles from './characterSheet.css'
import type { CharacterSheet } from './CharacterSheet.types'
import { getFeatureSummaryItems, getPlayableActions } from './characterSheetActions.utils'

function OverviewActionRows({ sheet }: { sheet: CharacterSheet }) {
  const actions = getPlayableActions(sheet)
    .filter((action) => action.kind === 'ATTACK')
    .slice(0, 6)

  if (!actions.length)
    return <Text className={styles.muted}>No attacks are currently available.</Text>

  return (
    <div className={styles.actionSummary}>
      <div className={styles.actionTable}>
        <div className={styles.actionTableHeader}>
          <span aria-hidden='true' />
          <Text>Name</Text>
          <Text>Range</Text>
          <Text>Hit / DC</Text>
          <Text>Damage</Text>
        </div>
        {actions.map((action) => (
          <div className={styles.actionTableRow} key={action.id}>
            <span className={styles.actionIcon} aria-hidden='true'>
              <Swords size={14} />
            </span>
            <div>
              <Text className={styles.playRowTitle}>{action.label}</Text>
              <Text className={styles.playRowMeta}>{action.sourceLabel ?? 'Character'}</Text>
            </div>
            <Text className={styles.playRowMeta}>{action.playFacts?.range ?? '—'}</Text>
            <Text className={styles.playRowMeta}>{action.playFacts?.hitOrDc ?? '—'}</Text>
            <Text className={styles.playRowMeta}>{action.playFacts?.effect ?? '—'}</Text>
          </div>
        ))}
      </div>
    </div>
  )
}

function OverviewFeatureRows({ sheet }: { sheet: CharacterSheet }) {
  const features = getFeatureSummaryItems(sheet, 4)

  if (!features.length)
    return <Text className={styles.muted}>No feature references are currently available.</Text>

  return (
    <div className={styles.featureSummaryList}>
      {features.map((feature) => (
        <div className={styles.featureSummaryRow} key={`${feature.sourceLabel}:${feature.id}`}>
          <div>
            <Text className={styles.playRowTitle}>{feature.label}</Text>
            <Text className={styles.playRowMeta}>{feature.sourceLabel}</Text>
          </div>
          {feature.description ? (
            <AuthoredDetailProse html={feature.description} fallback='' />
          ) : null}
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
            <Title id='character-sheet-play-area' className={styles.panelTitle}>
              Attacks
            </Title>
          </div>
        </div>
        <OverviewActionRows sheet={sheet} />
      </section>
      <section className={styles.playPanel} aria-labelledby='character-sheet-feature-summary'>
        <div className={styles.playPanelHeader}>
          <div>
            <Title id='character-sheet-feature-summary' className={styles.panelTitle}>
              Features & Traits
            </Title>
          </div>
        </div>
        <OverviewFeatureRows sheet={sheet} />
      </section>
    </>
  )
}
