import type { CharacterSheetFeaturesDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { Badge, Text } from '@mantine/core'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import {
  CharacterSheetDetailPanel,
  CharacterSheetDetailRow,
  CharacterSheetDetailRowList
} from '../shared/CharacterSheetDetailPanel'
import { CharacterSheetFeatureUseControl } from '../shared/CharacterSheetFeatureUseControl'
import * as actionSummaryStyles from '../actions/actionSummary.css'
import * as actionTableStyles from '../actions/actionTable.css'
import * as featureUseStyles from '../shared/featureUse.css'
import * as panelStyles from '../shared/panel.css'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'

function ReferenceFactRows({
  badge,
  empty,
  items
}: {
  badge: string
  empty: string
  items: readonly { label: string; value: string }[]
}) {
  if (!items.length) return <Text className={panelStyles.muted}>{empty}</Text>

  return (
    <>
      {items.map((item) => (
        <CharacterSheetDetailRow
          key={`${badge}:${item.label}:${item.value}`}
          left={
            <>
              <Text fw={700}>{item.label}</Text>
              <Text className={panelStyles.muted}>{item.value}</Text>
            </>
          }
          right={<Badge variant='light'>{badge}</Badge>}
        />
      ))}
    </>
  )
}

export function CharacterSheetReference({
  hideTitle,
  mode = 'all',
  pending,
  sheet,
  submitCommand
}: {
  hideTitle?: boolean
  mode?: 'all' | 'features' | 'proficiencies'
  pending: boolean
  sheet: CharacterSheetFeaturesDto
  submitCommand: SubmitSheetCommand
}) {
  const showFeatures = mode !== 'proficiencies'
  const showProficiencies = mode !== 'features'
  const title =
    mode === 'features' ? 'Features' : mode === 'proficiencies' ? 'Proficiencies' : 'Reference'

  return (
    <CharacterSheetDetailPanel
      ariaId={`character-sheet-${mode}`}
      hideTitle={hideTitle}
      title={title}
    >
      <CharacterSheetDetailRowList>
        {showFeatures && sheet.reference.features.length ? (
          sheet.reference.features.map((feature) => {
            const resource = feature.resourceGrantId
              ? sheet.resources.items.find((candidate) => candidate.id === feature.resourceGrantId)
              : undefined
            const resourceCost = feature.resourceCost ?? 1

            return (
              <CharacterSheetDetailRow
                key={`${feature.sourceLabel}:${feature.id}`}
                left={
                  <>
                    <div className={featureUseStyles.heading}>
                      <Text className={actionTableStyles.playRowTitle}>{feature.label}</Text>
                      {resource ? (
                        <CharacterSheetFeatureUseControl
                          cost={resourceCost}
                          disabled={pending || resource.remaining < resourceCost}
                          label={feature.label}
                          maximum={resource.max}
                          remaining={resource.remaining}
                          onUse={() =>
                            void submitCommand({
                              type: 'USE_RESOURCE',
                              expectedVersion: sheet.meta.streamVersion,
                              resourceGrantId: resource.id,
                              ...(resourceCost > 1 ? { amount: resourceCost } : {})
                            })
                          }
                        />
                      ) : (
                        <Badge variant='light'>Feature</Badge>
                      )}
                    </div>
                    <Text className={actionTableStyles.actionCompactSource}>
                      {feature.sourceLabel}
                    </Text>
                    {feature.description ? (
                      <div className={actionSummaryStyles.actionDescriptionText}>
                        <AuthoredDetailProse html={feature.description} fallback='' />
                      </div>
                    ) : null}
                  </>
                }
              />
            )
          })
        ) : showFeatures ? (
          <Text className={panelStyles.muted}>No feature references are currently available.</Text>
        ) : null}
        {showProficiencies ? (
          <ReferenceFactRows
            badge='Proficiency'
            empty='No proficiencies are currently available.'
            items={sheet.reference.proficiencies}
          />
        ) : null}
        {mode === 'all' ? (
          <ReferenceFactRows
            badge='Defense'
            empty='No defenses are currently available.'
            items={sheet.reference.defenses}
          />
        ) : null}
        {mode === 'all' ? (
          <ReferenceFactRows
            badge='Sense'
            empty='No senses are currently available.'
            items={sheet.reference.senses}
          />
        ) : null}
      </CharacterSheetDetailRowList>
    </CharacterSheetDetailPanel>
  )
}
