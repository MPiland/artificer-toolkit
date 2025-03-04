import { useLocation, useNavigate } from 'react-router-dom'
import { card_group, card_header, card_header_subtext, card_header_title, main_card } from '../../../Character.css'
import clsx from 'clsx'
import Group from '../../../../Group/Group'
import { useListClassesQuery } from '../../../../../features/classes/classesApi'
import { Character, Class } from '../../../../../../amplify/gql/types'
import { Categories } from '../../../../../types/enums'
import { useGetSystemQuery } from '../../../../../features/systems/systemsApi'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import Grid from '../../../../Grid/Grid'

const ClassSelection = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { formData } = use(FormContext) as { formData: Character }

  const { data: classes } = useListClassesQuery()
  const { data: system } = useGetSystemQuery()

  const handleShowDetail = (item: Class, context: string) => {
    navigate(`class/detail/short/${item.value}`, {
      state: {
        background: location,
        item: item,
        size: 'sm',
        context: context,
      },
    })
  }

  return (
    <Grid.Item>
      <Grid>
        {classes
          .filter((uClass) => uClass.category === Categories.base)
          ?.map((uClass, index) => {
            const selected = formData?.classes?.some((stateClass) => stateClass.id === uClass.id)

            const selectedIndex = formData?.classes?.findIndex((stateClass) => stateClass.id === uClass.id)

            const primaryAbility = uClass.multiclass?.primaryAbility

            const primaryScore = primaryAbility?.minAmount

            const secondaryAbility = uClass.multiclass?.secondaryAbility

            const secondaryScore = secondaryAbility?.minAmount

            const statePrimaryScore =
              formData.abilities?.scores?.find((score) => score.ability === primaryAbility?.id)?.calculatedScore ?? 0

            const stateSecondaryScore =
              formData.abilities?.scores?.find((score) => score.ability === secondaryAbility?.id)?.calculatedScore ?? 0

            let invalidClass: boolean = false

            if (formData.classes?.length > 0) {
              if (statePrimaryScore != null && statePrimaryScore < primaryAbility?.minAmount) {
                invalidClass = true
              }

              if (stateSecondaryScore != null && stateSecondaryScore >= secondaryAbility?.minAmount) {
                invalidClass = false
              }
            }

            const primaryAbilityLabel = system.abilities.find((ability) => ability.id === primaryAbility?.id)

            let subText = `${primaryAbilityLabel} ${primaryScore} (${statePrimaryScore})`

            if (invalidClass) {
              subText = 'Character does not meeting class prerequisites: ' + subText
            }

            if (secondaryAbility) {
              const secondarAbilityLabel = system.abilities.find((ability) => ability.id === secondaryAbility?.id)
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
                  onClick={() => !selected && !invalidClass && handleShowDetail(uClass, 'class')}
                >
                  <span className={clsx(card_header, { ['selected']: selected }, { ['invalid']: invalidClass })}>
                    <Group>
                      <h3
                        className={clsx(card_header_title, { ['invalid']: invalidClass }, { ['selected']: selected })}
                      >
                        {uClass.label}
                      </h3>
                    </Group>
                    {selected && (
                      <Group>
                        <span className={card_header_subtext}>{`Level ${formData.classes[selectedIndex].level} ${
                          selectedIndex === 0 ? ' \u00B7 Starting Class' : ''
                        }`}</span>
                      </Group>
                    )}
                    {formData?.classes?.length > 0 && !selected && (
                      <span className={clsx(card_header_subtext, { ['invalid']: invalidClass })}>{subText}</span>
                    )}
                  </span>
                </div>
              </Grid.Item>
            )
          })}
      </Grid>
    </Grid.Item>
  )
}

export default ClassSelection
