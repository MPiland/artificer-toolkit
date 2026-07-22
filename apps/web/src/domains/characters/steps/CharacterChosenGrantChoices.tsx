import { Text } from '@mantine/core'
import type { CharacterBuilderChosenGrantChoiceViewDto } from '@artificer-toolkit/schema/api/characters'
import { AppMultiSelect, AppSelect } from '#ui/primitives/Select'
import {
  choiceOptions,
  type CharacterFormValues
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import {
  applyLocalProficiencyEligibility,
  getChosenGrantSlotOptions,
  getSelectedChosenGrantTargetIds,
  setChosenGrantTargetIds,
  setChosenGrantSlotValue
} from './CharacterChosenGrantChoices.utils'

export function CharacterChosenGrantChoices({
  allChoices,
  choices,
  onChange,
  presentation = 'feature',
  readOnly,
  selections,
  showControlLabels = true
}: {
  allChoices?: CharacterBuilderChosenGrantChoiceViewDto[]
  choices: CharacterBuilderChosenGrantChoiceViewDto[]
  onChange: (selections: CharacterFormValues['intent']['chosenGrantSelections']) => void
  presentation?: 'controls' | 'feature' | 'row'
  readOnly: boolean
  selections: CharacterFormValues['intent']['chosenGrantSelections']
  showControlLabels?: boolean
}) {
  if (choices.length === 0) return null

  const choiceFields = choices.map((rawChoice) => {
    const choice = applyLocalProficiencyEligibility(
      rawChoice,
      allChoices ?? choices,
      selections
    )
    const selectedTargetIds = getSelectedChosenGrantTargetIds(selections, choice)

    const fields = choice.duplicatePolicy === 'UNIQUE' && choice.requiredCount > 1
      ? (
          <AppMultiSelect
            key={choice.id}
            label={showControlLabels ? `Choose ${choice.requiredCount}` : undefined}
            aria-label={!showControlLabels ? `Choose ${choice.requiredCount}` : undefined}
            data={choiceOptions(choice.options)}
            value={selectedTargetIds}
            required
            clearable
            disabled={readOnly}
            maxValues={choice.requiredCount}
            onChange={(targetIds) => {
              if (readOnly) return
              onChange(setChosenGrantTargetIds(selections, choice, targetIds))
            }}
          />
        )
      : (
          <div key={choice.id} className={styles.choiceSlotGrid}>
            {Array.from({ length: choice.requiredCount }, (_, slotIndex) => {
              const currentTargetId = selectedTargetIds[slotIndex]
              const options = getChosenGrantSlotOptions(choice, selectedTargetIds, slotIndex)
              const label = choice.requiredCount === 1
                ? 'Choose 1'
                : `Choice ${slotIndex + 1} of ${choice.requiredCount}`

              return (
                <AppSelect
                  key={`${choice.id}:${slotIndex}`}
                  label={showControlLabels ? label : undefined}
                  aria-label={!showControlLabels ? label : undefined}
                  data={choiceOptions(options)}
                  value={currentTargetId ?? null}
                  required
                  clearable
                  disabled={readOnly}
                  onChange={(targetId) => {
                    if (readOnly) return
                    onChange(setChosenGrantSlotValue(selections, choice, selectedTargetIds, slotIndex, targetId))
                  }}
                />
              )
            })}
          </div>
        )

    return {
      choice,
      fields
    }
  })

  if (presentation === 'controls') {
    return <div className={styles.grantedFeatureChoices}>{choiceFields.map(({ fields }) => fields)}</div>
  }

  return choiceFields.map(({ choice, fields }) => (
    <article
      key={choice.id}
      className={presentation === 'row' ? styles.grantedFeatureRow : styles.grantedFeatureItem}
    >
      <div className={styles.grantedFeatureHeader}>
        <Text fw={700}>{choice.label}</Text>
      </div>
      {fields}
    </article>
  ))
}
