import { Stack } from '@mantine/core'
import { AuthoredDetailItemList, AuthoredDetailProse } from '#components/AuthoredDetail'
import * as styles from './CreatureDetailPage.css'
import type { CreatureDetailModel } from './CreatureDetail.model'

type CreatureStatsModel = CreatureDetailModel['stats']
type LegendaryActionsModel = NonNullable<CreatureDetailModel['legendaryActions']>

export function CreatureStats({ stats }: { stats: CreatureStatsModel }) {
  return (
    <div className={styles.statBlock}>
      <div className={styles.abilityGrid}>
        {stats.abilities.map((ability) => (
          <div className={styles.abilityCell} key={ability.abbreviation}>
            <span className={styles.abilityLabel}>{ability.abbreviation}</span>
            <strong className={styles.abilityScore}>{ability.score}</strong>
            <span className={styles.abilityModifier}>{ability.modifier}</span>
          </div>
        ))}
      </div>
      {stats.speeds.length ? (
        <div className={styles.speedGrid} aria-label='Speeds'>
          {stats.speeds.map((speed) => (
            <span className={styles.speedPill} key={speed.id}>
              <span>{speed.label}</span>
              <strong>
                {speed.amount} {speed.unit}
              </strong>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function LegendaryActionsContent({ feature }: { feature: LegendaryActionsModel }) {
  return (
    <Stack gap='md'>
      <AuthoredDetailProse html={feature.description} fallback='' />
      <AuthoredDetailItemList
        empty='No legendary action options have been added.'
        items={feature.options}
      />
    </Stack>
  )
}
