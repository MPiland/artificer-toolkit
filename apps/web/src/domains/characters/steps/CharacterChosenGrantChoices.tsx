import { Text } from '@mantine/core'
import type { CharacterBuilderChosenGrantChoiceViewDto } from '@artificer-toolkit/schema/api/characters'
import { AppSelect } from '#ui/primitives/Select'
import {
  choiceOptions,
  type CharacterFormValues
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import {
  getChosenGrantSlotOptions,
  getSelectedChosenGrantTargetIds,
  setChosenGrantSlotValue
} from './CharacterChosenGrantChoices.utils'

export function CharacterChosenGrantChoices({
  choices,
  onChange,
  readOnly,
  selections
}: {
  choices: CharacterBuilderChosenGrantChoiceViewDto[]
  onChange: (selections: CharacterFormValues['intent']['chosenGrantSelections']) => void
  readOnly: boolean
  selections: CharacterFormValues['intent']['chosenGrantSelections']
}) {
  if (choices.length === 0) return null

  return (
    <section className={styles.grantedFeatureSection} aria-label='Choices'>
      <Text fw={700}>Choices</Text>
      <div className={styles.grantedFeatureChoices}>
        {choices.map((choice) => {
          const selectedTargetIds = getSelectedChosenGrantTargetIds(selections, choice)

          return (
            <div key={choice.id} className={styles.choiceSlotGrid}>
              {Array.from({ length: choice.requiredCount }, (_, slotIndex) => {
                const currentTargetId = selectedTargetIds[slotIndex]
                const options = getChosenGrantSlotOptions(choice, selectedTargetIds, slotIndex)

                return (
                  <AppSelect
                    key={choice.id + ':' + slotIndex}
                    label={choice.requiredCount === 1
                      ? choice.label
                      : choice.label + ' ' + (slotIndex + 1) + ' of ' + choice.requiredCount}
                    description={slotIndex === 0 ? choice.sourceLabel : undefined}
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
        })}
      </div>
    </section>
  )
}
