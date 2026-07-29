import { Text, Title } from '@mantine/core'
import { Swords } from 'lucide-react'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import { getFeatureSummaryItems, getPlayableActions } from '../actions/characterSheetActions.utils'
import type { CharacterSheet } from '../core/CharacterSheet.types'
import * as actionSummaryStyles from '../actions/actionSummary.css'
import * as actionTableStyles from '../actions/actionTable.css'
import * as panelStyles from '../shared/panel.css'
import * as rowStyles from '../shared/rows.css'

function OverviewActionRows({ sheet }: { sheet: CharacterSheet }) {
  const actions = getPlayableActions(sheet)
    .filter((action) => action.kind === 'ATTACK')
    .slice(0, 6)

  if (!actions.length)
    return <Text className={panelStyles.muted}>No attacks are currently available.</Text>

  return (
    <div className={actionSummaryStyles.actionSummary}>
      <div className={actionTableStyles.actionTable}>
        <div className={actionTableStyles.actionTableHeader}>
          <span aria-hidden='true' />
          <Text>Name</Text>
          <Text>Range</Text>
          <Text>Hit / DC</Text>
          <Text>Damage</Text>
        </div>
        {actions.map((action) => (
          <div className={actionTableStyles.actionTableRow} key={action.id}>
            <span className={actionTableStyles.actionIcon} aria-hidden='true'>
              <Swords size={14} />
            </span>
            <div>
              <Text className={actionTableStyles.playRowTitle}>{action.label}</Text>
              <Text className={actionTableStyles.playRowMeta}>
                {action.sourceLabel ?? 'Character'}
              </Text>
            </div>
            <Text className={actionTableStyles.playRowMeta}>{action.playFacts?.range ?? '—'}</Text>
            <Text className={actionTableStyles.playRowMeta}>
              {action.playFacts?.hitOrDc ?? '—'}
            </Text>
            <Text className={actionTableStyles.playRowMeta}>{action.playFacts?.effect ?? '—'}</Text>
          </div>
        ))}
      </div>
    </div>
  )
}

function OverviewFeatureRows({ sheet }: { sheet: CharacterSheet }) {
  const features = getFeatureSummaryItems(sheet, 4)

  if (!features.length)
    return <Text className={panelStyles.muted}>No feature references are currently available.</Text>

  return (
    <div className={rowStyles.featureSummaryList}>
      {features.map((feature) => (
        <div className={rowStyles.featureSummaryRow} key={`${feature.sourceLabel}:${feature.id}`}>
          <div>
            <Text className={actionTableStyles.playRowTitle}>{feature.label}</Text>
            <Text className={actionTableStyles.playRowMeta}>{feature.sourceLabel}</Text>
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
      <section
        className={actionSummaryStyles.playPanel}
        aria-labelledby='character-sheet-play-area'
      >
        <div className={actionSummaryStyles.playPanelHeader}>
          <div>
            <Title id='character-sheet-play-area' className={panelStyles.panelTitle}>
              Attacks
            </Title>
          </div>
        </div>
        <OverviewActionRows sheet={sheet} />
      </section>
      <section
        className={actionSummaryStyles.playPanel}
        aria-labelledby='character-sheet-feature-summary'
      >
        <div className={actionSummaryStyles.playPanelHeader}>
          <div>
            <Title id='character-sheet-feature-summary' className={panelStyles.panelTitle}>
              Features & Traits
            </Title>
          </div>
        </div>
        <OverviewFeatureRows sheet={sheet} />
      </section>
    </>
  )
}
