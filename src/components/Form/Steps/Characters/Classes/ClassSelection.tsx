import { useState } from 'react'
import clsx from 'clsx'
import type { ClassListItem } from '@/types'
import { Grid, Group } from '@mantine/core'
import { useClassData, useSystemData } from '@/hooks'
import {
  ClassDetail,
  card_group,
  card_header,
  card_header_subtext,
  card_header_title,
  main_card,
  withForm,
} from '@/components/Form'
import { CharacterClassInputSchema, CharacterInputSchema } from '@/schemas'
import { useTypedFormStore } from '@/store'
import { z } from 'zod/v4'
import { CharacterInput } from '@/types'

const ClassSelection = withForm({
  defaultValues: {} as z.input<typeof CharacterInputSchema>,
  render: function Render({ form }) {
    const store = useTypedFormStore<CharacterInput>()
    const classes = store((state) => state.current?.classes)
    const formAbilities = store((state) => state.current?.abilities)
    const updateField = store((state) => state.updateField)

    const [formClass, setFormClass] = useState<ClassListItem | null>(null)

    const { baseClasses, metaData } = useClassData()
    const { abilities } = useSystemData()

    return (
      <>
        <Grid.Col>
          <Grid>
            {baseClasses?.map((uClass, index) => {
              const selected = classes?.some((stateClass) => stateClass.id === uClass.id)

              const selectedIndex = classes?.findIndex((stateClass) => stateClass.id === uClass.id)
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

              if (classes?.length && primaryScore) {
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
                          <span className={card_header_subtext}>{`Level ${classes?.[selectedIndex]?.level} ${
                            selectedIndex === 0 ? ' \u00B7 Starting Class' : ''
                          }`}</span>
                        </Group>
                      )}
                      {classes?.length && !selected && (
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
          <form.AppField name='classes'>
            {(field) => (
              <ClassDetail
                formClass={formClass}
                addClass={() => {
                  const ClassInputObject = CharacterClassInputSchema.parse({ id: formClass.id, level: 1 })
                  updateField({
                    path: `classes[${classes?.length}]`,
                    value: ClassInputObject,
                  })
                  field.pushValue(ClassInputObject)
                }}
                setClass={() => setFormClass(null)}
              />
            )}
          </form.AppField>
        )}
      </>
    )
  },
})

export default ClassSelection
