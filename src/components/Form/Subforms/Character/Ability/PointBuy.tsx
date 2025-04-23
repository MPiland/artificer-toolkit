import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  point_buy_option,
  point_buy_option_diff,
  point_buy_option_label,
  point_counter,
  point_counter_label,
} from '../../../Character.css'
import Dropdown from '../../../../Dropdown/Dropdown'
import { isEqual } from 'lodash'
import { AbilityGenerate } from '../../../../../types/enums'
import type { Character, GenerateOption } from '../../../../../../amplify/gql/types'
import Grid from '../../../../Grid/Grid'
import useSystemData from '../../../../../hooks/useSystemData'
import type { OnChange } from '../../../../../types/types'

const PointBuy = ({
  formStore: { data, updateField },
}: {
  formStore: {
    data: Character
    updateField: OnChange<Character>['updateField']
    removeField: OnChange<Character>['removeField']
  }
}) => {
  const { rules, abilities } = useSystemData()

  const [pointsLeft, setPointsLeft] = useState<number>()

  const pointBuy = useMemo(() => {
    return rules?.abilityGenerateMethod?.findAbilityGenerateMethod(AbilityGenerate.pointBuy)
  }, [rules?.abilityGenerateMethod])!

  // Set pointsLeft for pointBuy
  useEffect(() => {
    if (pointsLeft == null && pointBuy) {
      setPointsLeft(pointBuy?.total || 0)
    }
  }, [pointBuy, pointsLeft])

  // Set the ability scores if pointBuy
  useEffect(() => {
    if (!pointBuy) return

    let emptyArray: boolean = true
    if (data.abilities?.pointBuy?.distributed?.length) {
      data.abilities.pointBuy.distributed.forEach((distribution) => {
        if (distribution?.ability && distribution?.id) {
          const option = pointBuy.options?.find((option) => option.id === distribution.id)
          if (!option) return

          const scoreValue = Number(option.value)
          const abilityIndex = data.abilities?.scores?.findIndex((score) => score.ability === distribution.ability)

          if (abilityIndex && abilityIndex !== -1) {
            emptyArray = false
            if (!isEqual(data.abilities?.scores?.[abilityIndex]?.baseScore, scoreValue)) {
              updateField({
                path: `abilities.scores.${abilityIndex}.baseScore`,
                value: scoreValue,
              })
            }
          }
        }
      })
    }

    if (emptyArray || !data.abilities?.pointBuy?.distributed?.length) {
      // Reset ability score to 0 if there are no distributed points selected for that ability
      data.abilities?.scores?.forEach((score, index) => {
        if (score.baseScore !== 0) {
          updateField({
            path: `abilities.scores.${index}.baseScore`,
            value: 0,
          })
        }
      })
    }
  }, [data, updateField, pointBuy])

  const pointBuyOptions = useCallback(
    (currentOption?: GenerateOption | null) => {
      return (
        pointBuy.options
          ?.filter((option) => {
            if (option.reduce && pointsLeft) {
              if (currentOption?.reduce) {
                return option.reduce - currentOption.reduce <= pointsLeft
              }
              return option?.reduce <= pointsLeft
            }
          })
          .map((option) => {
            const baseLabel = option.label || option.value.toString()
            let pointsText = ''

            if (currentOption && currentOption.reduce && option.reduce) {
              // Something is already selected - show difference
              if (option.id !== currentOption.id) {
                const pointDifference = option.reduce - currentOption.reduce

                if (pointDifference !== 0) {
                  const absPointDiff = Math.abs(pointDifference)
                  const pointOrPoints = absPointDiff === 1 ? 'Point' : 'Points'
                  const sign = pointDifference ? '-' : '+'

                  pointsText = `${sign}${absPointDiff} ${pointOrPoints}`
                }
              }
            } else {
              // Nothing is selected - show cost
              if (option.reduce) {
                const pointOrPoints = option.reduce === 1 ? 'Point' : 'Points'
                pointsText = `-${option.reduce} ${pointOrPoints}`
              }
            }

            // Return an object with separate value and points properties
            return {
              label: option.label,
              renderedLabel: (
                <div className={point_buy_option}>
                  <span className={point_buy_option_label}>{baseLabel}</span>
                  {pointsText && <span className={point_buy_option_diff}>({pointsText})</span>}
                </div>
              ),

              value: option.id,
              id: option.id,
            }
          }) || []
      )
    },
    [pointBuy.options, pointsLeft]
  )

  return (
    <>
      <Grid.Item className={point_counter}>
        <span className={point_counter_label}>{`${pointsLeft} / ${pointBuy.total}`}</span>
        <span>Points Remaining</span>
      </Grid.Item>
      {data.abilities?.scores?.map((score, index) => {
        const currentId = data.abilities?.pointBuy?.distributed?.[index]?.id
        const currentOption = currentId ? pointBuy.options?.find((opt) => opt.id === currentId) : null
        const currentReduce = currentOption?.reduce
        const abilityLabel = abilities.findAbility(score.ability)?.label || 'Ability'

        return (
          <Grid.Item key={index} colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown<Character>
              name='label'
              label={abilityLabel}
              key={index}
              value={currentId}
              options={pointBuyOptions(currentOption)}
              onChange={{
                updateField: ({ value }) => {
                  const newPointBuyId = value
                  const pointBuyOption = pointBuy.options?.find((option) => option.id === newPointBuyId)

                  // Calculate new points left
                  const newReduce = pointBuyOption?.reduce

                  if (newReduce && currentReduce && pointsLeft) {
                    // Update points left
                    const pointDifference = newReduce - currentReduce
                    const newPointsLeft = pointsLeft - pointDifference
                    setPointsLeft(newPointsLeft)
                  }
                  // Update the form data
                  return {
                    path: `abilities.pointBuy.distributed.${index}`,
                    value: { ability: score.ability, id: newPointBuyId },
                  }
                },
                removeField: () => {
                  // Calculate new points left
                  // Handle deselection case
                  if (pointsLeft && currentReduce) {
                    const newPointsLeft = pointsLeft + currentReduce
                    setPointsLeft(newPointsLeft)
                  }

                  return {
                    path: `abilities.pointBuy.distributed.${index}`,
                  }
                },
              }}
            />
            handlePointApply(e, score.ability, index)
          </Grid.Item>
        )
      })}
    </>
  )
}

export default PointBuy
