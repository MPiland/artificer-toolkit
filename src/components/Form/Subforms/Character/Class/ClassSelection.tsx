import { card_group, card_header, card_header_subtext, card_header_title, main_card } from '../../../Character.css'
import clsx from 'clsx'
import Group from '../../../../Group/Group'
import type { Character, ClassListItem } from '../../../../../../amplify/gql/types'
import { use, useState } from 'react'
import { FormContext } from '../../../FormContext'
import Grid from '../../../../Grid/Grid'
import ClassDetail from './ClassDetail'
import useClassData from '../../../../../hooks/useClassData'
import useSystemData from '../../../../../hooks/useSystemData'

const ClassSelection = () => {
  const [formClass, setFormClass] = useState<ClassListItem | null>(null)

  const {
    formStore: { data },
  } = use(FormContext) as {
    formStore: {
      data: Character
    }
  }

  const { baseClasses, metaData } = useClassData()
  const { abilities } = useSystemData()

  return (
    <>
      <Grid.Item>
        <Grid>
          {baseClasses?.map((uClass, index) => {
            const selected = data?.classes?.some((stateClass) => stateClass.id === uClass.id)

            const selectedIndex = data?.classes?.findIndex((stateClass) => stateClass.id === uClass.id)
            const metaPrimary = metaData.primaryAbilities?.find((p) => p.classIds?.includes(uClass.id))
            const metaSecondary = metaData.secondaryAbilities?.find((p) => p.classIds?.includes(uClass.id))

            const primaryAbility = metaPrimary?.id
            const primaryScore = metaPrimary?.amount

            const secondaryAbility = metaSecondary?.id
            const secondaryScore = metaSecondary?.amount

            const statePrimaryScore =
              data.abilities?.scores?.find((score) => score.ability === primaryAbility)?.calculatedScore ?? 0

            const stateSecondaryScore =
              data.abilities?.scores?.find((score) => score.ability === secondaryAbility)?.calculatedScore ?? 0

            let invalidClass: boolean = false

            if (data.classes?.length && primaryScore) {
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
              <Grid.Item className={card_group} key={index}>
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
                        <span className={card_header_subtext}>{`Level ${data.classes?.[selectedIndex]?.level} ${
                          selectedIndex === 0 ? ' \u00B7 Starting Class' : ''
                        }`}</span>
                      </Group>
                    )}
                    {data?.classes?.length && !selected && (
                      <span className={clsx(card_header_subtext, { ['invalid']: invalidClass })}>{subText}</span>
                    )}
                  </span>
                </div>
              </Grid.Item>
            )
          })}
        </Grid>
      </Grid.Item>
      {formClass && <ClassDetail formClass={formClass} setFormClass={() => setFormClass(null)} />}
    </>
  )
}

export default ClassSelection
