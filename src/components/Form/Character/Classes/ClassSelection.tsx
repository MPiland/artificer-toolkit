import { useLocation, useNavigate } from 'react-router-dom'
import { card_group, card_header, card_header_subtext, card_header_title, main_card } from '../Character.css'
import clsx from 'clsx'
import Group from '../../../Group/Group'
import { useForm } from '../../../../hooks/UseForm'
import { useGetClassesQuery } from '../../../../features/classes/classesApi'

const ClassSelection = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { formState } = useForm()

  const { data: classes } = useGetClassesQuery() as { data: any[] }

  const handleShowDetail = (item: any, context: string) => {
    navigate(`class/detail/short/${item.name}`, {
      state: {
        background: location,
        item: item,
        size: 'sm',
        context: context,
      },
    })
  }

  return (
    <>
      {classes
        .filter((uClass: any) => uClass.category.name === 'base')
        ?.map((uClass: any, index: number) => {
          const selected = formState?.class?.some((stateClass: any) => stateClass._id === uClass._id)

          const selectedIndex = formState?.class?.findIndex((stateClass: any) => stateClass._id === uClass._id)

          const primaryAbility = uClass.multiclass?.primaryAbility

          const primaryScore = primaryAbility?.minValue

          const secondaryAbility = uClass.multiclass?.secondaryAbility

          const secondaryScore = secondaryAbility?.minValue

          const statePrimaryScore =
            formState.abilities?.scores?.find((ability: any) => ability._id === primaryAbility?.type?._id)
              ?.calculatedScore ?? 0

          const stateSecondaryScore =
            formState.abilities?.scores?.find((ability: any) => ability._id === secondaryAbility?.type?._id)
              ?.calculatedScore ?? 0

          let invalidClass: boolean = false

          if (formState.class?.length > 0) {
            if (statePrimaryScore != null && statePrimaryScore < primaryAbility?.minValue) {
              invalidClass = true
            }

            if (stateSecondaryScore != null && stateSecondaryScore >= secondaryAbility?.minValue) {
              invalidClass = false
            }
          }

          let subText = `${primaryAbility?.type?.value} ${primaryScore} (${statePrimaryScore})`

          if (invalidClass) {
            subText = 'Character does not meeting class prerequisites: ' + subText
          }

          if (secondaryAbility) {
            subText += ` or ${secondaryAbility?.type?.value} ${secondaryScore} (${stateSecondaryScore})`
          }

          return (
            <div className={card_group} key={index}>
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
                    <h3 className={clsx(card_header_title, { ['invalid']: invalidClass }, { ['selected']: selected })}>
                      {uClass.value}
                    </h3>
                  </Group>
                  {selected && (
                    <Group>
                      <span className={card_header_subtext}>{`Level ${formState.class[selectedIndex].level} ${
                        selectedIndex === 0 ? ' \u00B7 Starting Class' : ''
                      }`}</span>
                    </Group>
                  )}
                  {formState?.class?.length > 0 && !selected && (
                    <span className={clsx(card_header_subtext, { ['invalid']: invalidClass })}>{subText}</span>
                  )}
                </span>
              </div>
            </div>
          )
        })}
    </>
  )
}

export default ClassSelection
