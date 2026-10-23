import { List, Text } from '@mantine/core'
import { Brain, CircleDot, Sparkles, TriangleAlert, type LucideIcon } from 'lucide-react'
import {
  statusCategoryColours,
  type VttStatusCategory,
  type VttTokenPresentation
} from './vttSceneRenderer.model'
import * as styles from './CampaignVttStage.css'

const categoryIcons = {
  CONCENTRATION: Brain,
  HARMFUL: TriangleAlert,
  BENEFICIAL: Sparkles,
  OTHER: CircleDot
} as const satisfies Record<VttStatusCategory, LucideIcon>

/**
 * Names every status of a token, with its category icon in the colour of the matching outer-ring
 * segment. The ring shows at most eight segments, so this is where all of them are read.
 */
export function CampaignVttTokenStatusList({
  dispositionLabel,
  label,
  statuses
}: {
  dispositionLabel: VttTokenPresentation['dispositionLabel']
  label: string
  statuses: VttTokenPresentation['statuses']
}) {
  return (
    <section aria-label={`${label} statuses`} className={styles.tokenStatusPanel}>
      <Text fw={650} size='xs'>
        {label}
      </Text>
      {dispositionLabel ? <Text size='xs'>{dispositionLabel}</Text> : null}
      <List listStyleType='none' size='xs' spacing={2}>
        {statuses.map((status) => {
          const Icon = categoryIcons[status.category]
          return (
            <List.Item
              icon={
                <Icon
                  aria-hidden
                  color={`#${statusCategoryColours[status.category].toString(16).padStart(6, '0')}`}
                  size={14}
                />
              }
              key={status.id}
              title={status.description}
            >
              {status.label}
            </List.Item>
          )
        })}
      </List>
    </section>
  )
}
