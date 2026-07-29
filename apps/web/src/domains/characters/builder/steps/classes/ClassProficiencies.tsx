import { Text, VisuallyHidden } from '@mantine/core'
import type {
  CharacterBuilderChosenGrantChoiceViewDto,
  CharacterBuilderClassViewItemDto
} from '@artificer-toolkit/schema/api/characters'
import type { CharacterFormValues } from '../../core/characterBuilder.types'
import { CharacterChosenGrantChoices } from '../../choices/CharacterChosenGrantChoices'
import * as styles from './characterClasses.css'

export function ClassProficiencies({
  allChoices,
  grantChoices,
  onChange,
  readOnly,
  selections,
  view
}: {
  allChoices: CharacterBuilderChosenGrantChoiceViewDto[]
  grantChoices: CharacterBuilderChosenGrantChoiceViewDto[]
  onChange: (selections: CharacterFormValues['intent']['chosenGrantSelections']) => void
  readOnly: boolean
  selections: CharacterFormValues['intent']['chosenGrantSelections']
  view: CharacterBuilderClassViewItemDto | undefined
}) {
  if (!view?.proficiencyGroups.length) return null

  return (
    <section className={styles.classProficiencyCard} aria-label='Proficiencies'>
      <Text fw={700}>Proficiencies</Text>
      {view.proficiencyGroups.map((group) => {
        const choices = grantChoices.filter((choice) => group.choiceIds.includes(choice.id))

        return (
          <div key={group.category} className={styles.classProficiencyRow}>
            <Text fw={600} size='sm'>
              {group.label}
            </Text>
            <div className={styles.classProficiencyContent}>
              {group.grantedEntries.length ? (
                <Text size='sm'>{group.grantedEntries.join(', ')}</Text>
              ) : null}
              {group.choiceInstructions.map((instruction) => (
                <Text key={instruction.label} size='sm'>
                  {instruction.label}
                  {instruction.required ? (
                    <>
                      <span aria-hidden='true'> *</span>
                      <VisuallyHidden> Required</VisuallyHidden>
                    </>
                  ) : null}
                </Text>
              ))}
              <CharacterChosenGrantChoices
                allChoices={allChoices}
                choices={choices}
                presentation='controls'
                selections={selections}
                readOnly={readOnly}
                showControlLabels={false}
                onChange={onChange}
              />
            </div>
          </div>
        )
      })}
    </section>
  )
}
