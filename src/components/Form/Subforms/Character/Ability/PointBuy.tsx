import { useEffect, useMemo, useState } from 'react'
import {
  point_buy_option,
  point_buy_option_diff,
  point_buy_option_label,
  point_counter,
  point_counter_label,
} from '../../../Character.css'
import Dropdown from '../../../../Dropdown/Dropdown'
import { useGetSystemQuery } from '../../../../../apis/systemsApi'
import { UpdateState } from '../../../../../types/form'
import { isEqual } from 'lodash'
import { AbilityGenerate } from '../../../../../types/enums'
import { Character } from '../../../../../../amplify/gql/types'
import Grid from '../../../../Grid/Grid'

const PointBuy = ({
  formData,
  updateFormData,
}: {
  formData: Character
  updateFormData: (arg: UpdateState<Character>) => void
}) => {
  const { data: system } = useGetSystemQuery()

  const [pointsLeft, setPointsLeft] = useState<number>()

  const pointBuy = useMemo(() => {
    return system?.rules?.abilityGenerateMethod?.find((method) => method.id === AbilityGenerate.pointBuy)
  }, [system?.rules?.abilityGenerateMethod])

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
    if (formData.abilities?.pointBuy?.distributed?.length) {
      formData.abilities.pointBuy.distributed.forEach((distribution) => {
        if (distribution?.ability && distribution?.id) {
          const option = pointBuy.options?.find((option) => option.id === distribution.id)
          if (!option) return

          const scoreValue = Number(option.value)
          const abilityIndex = formData.abilities?.scores?.findIndex((score) => score.ability === distribution.ability)

          if (abilityIndex && abilityIndex !== -1) {
            emptyArray = false
            if (!isEqual(formData.abilities?.scores?.[abilityIndex]?.baseScore, scoreValue)) {
              updateFormData({
                type: 'update',
                path: `abilities.scores.${abilityIndex}.baseScore`,
                value: scoreValue,
              })
            }
          }
        }
      })
    }

    if (emptyArray || !formData.abilities?.pointBuy?.distributed?.length) {
      // Reset ability score to 0 if there are no distributed points selected for that ability
      formData.abilities?.scores?.forEach((score, index) => {
        if (score.baseScore !== 0) {
          updateFormData({
            type: 'update',
            path: `abilities.scores.${index}.baseScore`,
            value: 0,
          })
        }
      })
    }
  }, [formData.abilities?.pointBuy?.distributed, formData.abilities?.scores, updateFormData, pointBuy])

  const handlePointApply = (e: UpdateState<Character>, ability: string, aIndex: number) => {
    if (!pointBuy || e.type !== 'update') return

    const newPointBuyId = String(e?.value)
    const pointBuyOption = pointBuy.options?.find((option) => option.id === newPointBuyId)

    // Calculate new points left
    const currentId = formData.abilities?.pointBuy?.distributed?.[aIndex]?.id
    const currentOption = pointBuy.options?.find((opt) => opt.id === currentId)
    const currentReduce = currentOption?.reduce
    if (currentOption) {
      if (pointBuyOption) {
        const newReduce = pointBuyOption.reduce

        if (newReduce && currentReduce && pointsLeft) {
          // Update points left
          const pointDifference = newReduce - currentReduce
          const newPointsLeft = pointsLeft - pointDifference
          setPointsLeft(newPointsLeft)
        }
        // Update the form data
        updateFormData({
          type: 'update',
          path: `abilities.pointBuy.distributed.${aIndex}`,
          value: { ability: ability, id: newPointBuyId },
        })
      } else {
        // Handle deselection case
        if (pointsLeft && currentReduce) {
          const newPointsLeft = pointsLeft + currentReduce
          setPointsLeft(newPointsLeft)
        }

        updateFormData({
          type: 'remove',
          path: `abilities.pointBuy.distributed.${aIndex}`,
        })
      }
    }
  }

  if (!system || !pointBuy) return null

  return (
    <>
      <Grid.Item className={point_counter}>
        <span className={point_counter_label}>{`${pointsLeft} / ${pointBuy.total}`}</span>
        <span>Points Remaining</span>
      </Grid.Item>
      {formData.abilities?.scores?.map((score, index) => {
        const currentId = formData.abilities?.pointBuy?.distributed?.[index]?.id
        const currentOption = currentId ? pointBuy.options?.find((opt) => opt.id === currentId) : null

        const abilityLabel = system.abilities.find((a) => a.id === score.ability)?.label || 'Ability'

        return (
          <Grid.Item key={index} colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown<Character>
              name='label'
              label={abilityLabel}
              key={index}
              value={currentId}
              options={
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
              }
              onChange={(e) => handlePointApply(e, score.ability, index)}
            />
          </Grid.Item>
        )
      })}
    </>
  )
}

export default PointBuy
