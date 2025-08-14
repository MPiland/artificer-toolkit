import { useState } from 'react'
import clsx from 'clsx'
import type { ClassListItem } from '~/types'
import { Grid, Group } from '@mantine/core'
import { useFormField, useSystemData } from '~/hooks'
import {
  ClassDetail,
  card_group,
  card_header,
  card_header_subtext,
  card_header_title,
  main_card,
} from '~/components/Form'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import { CharacterInput } from '~/types'
import { useListClasses } from '~/apis'
import { Categories } from '~/enums'
import { CharacterClassInputSchema } from '~/schemas'

const ClassSelection = () => {
  const store = useTypedFormStore<CharacterInput>()

  const { AppField } = useFormField({ store })

  const { formClasses, formAbilities, updateField } = useOptimizedSelector(store, (state) => ({
    formClasses: state.current?.classes,
    formAbilities: state.current?.abilities,
    updateField: state.updateField,
  }))

  const [formClass, setFormClass] = useState<ClassListItem | null>(null)

  const {
    data: { classes, metaData },
  } = useListClasses()
  const { abilities } = useSystemData()

  const baseClasses = classes?.filter((c) =>
    metaData?.categories?.find((cat) => cat.id === Categories.BASE)?.classIds?.includes(c.id)
  )

  return (
    <>
      <Grid.Col>
        <Grid>
          {baseClasses?.map((uClass, index) => {
            const selected = formClasses?.some((stateClass) => stateClass.id === uClass.id)

            const selectedIndex = formClasses?.findIndex((stateClass) => stateClass.id === uClass.id)
            const metaPrimary = metaData.primaryAbilities?.find((p) => p.classIds?.includes(uClass.id))
            const metaSecondary = metaData.secondaryAbilities?.find((p) => p.classIds?.includes(uClass.id))

            const primaryAbility = metaPrimary?.id
            const primaryScore = metaPrimary?.amount

            const secondaryAbility = metaSecondary?.id
            const secondaryScore = metaSecondary?.amount

            const statePrimaryScore =
              formAbilities?.scores?.find((score) => score.ability === primaryAbility)?.calculatedScore ?? 0

            const stateSecondaryScore =
              formAbilities?.scores?.find((score) => score.ability === secondaryAbility)?.calculatedScore ?? 0

            let invalidClass: boolean = false

            if (formClasses?.length && primaryScore) {
              if (statePrimaryScore != null && statePrimaryScore < primaryScore) {
                invalidClass = true
              }

              if (secondaryScore && stateSecondaryScore != null && stateSecondaryScore >= secondaryScore) {
                invalidClass = false
              }
            }

            const primaryAbilityLabel = abilities.findAbility(primaryAbility)

            let subText = `${primaryAbilityLabel} ${primaryScore} (${statePrimaryScore})`

            if (invalidClass) {
              subText = 'Character does not meeting class prerequisites: ' + subText
            }

            if (secondaryAbility) {
              const secondarAbilityLabel = abilities.findAbility(secondaryAbility)
              subText += ` or ${secondarAbilityLabel} ${secondaryScore} (${stateSecondaryScore})`
            }

            return (
              <Grid.Col className={card_group} key={index}>
                <div
                  className={clsx(
                    main_card,
                    {
                      ['clickable']: !selected && !invalidClass,
                    },
                    { ['selected']: selected },
                    { ['invalid']: invalidClass }
                  )}
                  onClick={() => !selected && !invalidClass && setFormClass(uClass)}
                >
                  <span className={clsx(card_header, { ['selected']: selected }, { ['invalid']: invalidClass })}>
                    <Group>
                      <h3
                        className={clsx(card_header_title, { ['invalid']: invalidClass }, { ['selected']: selected })}
                      >
                        {uClass.label}
                      </h3>
                    </Group>
                    {selected && selectedIndex && selectedIndex !== -1 && (
                      <Group>
                        <span className={card_header_subtext}>{`Level ${formClasses?.[selectedIndex]?.level} ${
                          selectedIndex === 0 ? ' \u00B7 Starting Class' : ''
                        }`}</span>
                      </Group>
                    )}
                    {formClasses?.length && !selected && (
                      <span className={clsx(card_header_subtext, { ['invalid']: invalidClass })}>{subText}</span>
                    )}
                  </span>
                </div>
              </Grid.Col>
            )
          })}
        </Grid>
      </Grid.Col>
      {formClass && (
        <AppField name='classes' mode='array'>
          {(field) => (
            <ClassDetail
              formClass={formClass}
              addClass={() => {
                const ClassInputObject = CharacterClassInputSchema.parse({ id: formClass.id, level: 1 })
                updateField({
                  path: `classes[${formClasses?.length}]`,
                  value: ClassInputObject,
                })
                field.pushValue(ClassInputObject)
              }}
              setClass={() => setFormClass(null)}
            />
          )}
        </AppField>
      )}
    </>
  )
}

export default ClassSelection
