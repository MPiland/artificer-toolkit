import { useCallback, useEffect, useMemo, useState } from 'react'
import { isEqual, get } from 'lodash'
import { AbilityGenMethods } from '@/enums'
import { useSystemData } from '@/hooks'
import type { CharacterAbilitiesInput, GenerateOption } from '@/types'
import { Grid } from '@mantine/core'
import { DistributedInputSchema } from '@/schemas'
import {
  withFieldGroup,
  point_buy_option,
  point_buy_option_diff,
  point_buy_option_label,
  point_counter,
  point_counter_label,
} from '@/components/Form'
import { useStore } from '@tanstack/react-form'
import { useFormStore } from '@/store'

const PointBuy = withFieldGroup({
  defaultValues: {} as CharacterAbilitiesInput,
  render: function Render({ group }) {
    const { AppField } = group

    const formStore = useFormStore()

    const { rules, abilities } = useSystemData()

    const { pointBuy, scores } = useStore(group.store, (state) => ({
      pointBuy: state.values.pointBuy,
      scores: state.values.scores,
    }))

    const pointBuyRule = useMemo(() => {
      return rules?.abilityGenerateMethod?.findAbilityGenerateMethod(AbilityGenMethods.POINT_BUY)
    }, [rules?.abilityGenerateMethod])!

    const [pointsLeft, setPointsLeft] = useState<number>(pointBuyRule.total ?? 0)

    // Set pointsLeft for pointBuy
    useEffect(() => {
      if (pointsLeft == null && pointBuyRule) {
        setPointsLeft(pointBuyRule?.total || 0)
      }
    }, [pointBuyRule, pointsLeft])

    // Set the ability scores if pointBuy
    useEffect(() => {
      if (!pointBuy) return

      let emptyArray: boolean = true
      if (pointBuy?.distributed?.length) {
        pointBuy.distributed.forEach((distribution) => {
          if (distribution?.ability && distribution?.id) {
            const option = pointBuyRule.options?.find((option) => option.id === distribution.id)
            if (!option) return

            const scoreValue = Number(option.label)
            const abilityIndex = scores?.findIndex((score) => score.ability === distribution.ability)

            if (abilityIndex && abilityIndex !== -1) {
              emptyArray = false
              if (!isEqual(scores?.[abilityIndex]?.baseScore, scoreValue)) {
                group.setFieldValue(`scores[${abilityIndex}].baseScore`, scoreValue)
                formStore.updateField({ path: `abilities.scores[${abilityIndex}].baseScore`, value: scoreValue })
              }
            }
          }
        })
      }

      if (emptyArray || !pointBuy?.distributed?.length) {
        // Reset ability score to 0 if there are no distributed points selected for that ability
        const updatedScores = scores?.map((score) => {
          if (score.baseScore !== 0) {
            return {
              ...score,
              baseScore: 0,
            }
          }
          return score
        })
        group.setFieldValue('scores', updatedScores)
        formStore.updateField({ path: 'abilities.scores', value: updatedScores })
      }
    }, [group, pointBuy, scores, pointBuyRule.options, formStore])

    const pointBuyOptions = useCallback(
      (currentOption?: GenerateOption | null) => {
        return (
          pointBuyRule.options
            ?.filter((option) => {
              if (option.reduce && pointsLeft) {
                if (currentOption?.reduce) {
                  return option.reduce - currentOption.reduce <= pointsLeft
                }
                return option?.reduce <= pointsLeft
              }
            })
            .map((option) => {
              const baseLabel = option.label.toString()
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
      [pointBuyRule.options, pointsLeft]
    )

    const handleBlur = ({
      target: { name, value },
    }: {
      target: { name: string; value: string | string[] | object | number | null | undefined }
    }) => {
      const pathName = 'abilities' + (name.startsWith('[') ? '' : '.') + name
      const currentValue = get(formStore.current, pathName)
      if (value != null && !isEqual(currentValue, value)) {
        formStore.updateField({ path: pathName, value })
      } else if (currentValue && value == null) {
        formStore.removeField({ path: pathName })
      }
    }

    return (
      <>
        <Grid.Col className={point_counter}>
          <span className={point_counter_label}>{`${pointsLeft} / ${pointBuyRule.total}`}</span>
          <span>Points Remaining</span>
        </Grid.Col>
        <AppField name='scores' mode='array'>
          {(scoresField) => {
            const scoresArray = scoresField.state.value
            return scoresArray?.map((score, i) => {
              const currentId = pointBuy?.distributed?.[i]?.id
              const currentOption = currentId ? pointBuyRule.options?.find((opt) => opt.id === currentId) : null
              const currentReduce = currentOption?.reduce
              const abilityLabel = abilities.findAbility(score.ability)?.label || 'Ability'

              return (
                <AppField
                  name={`pointBuy.distributed[${i}]`}
                  key={`${i}-pointBuy-score`}
                  listeners={{
                    onBlur: ({ value, fieldApi }) =>
                      fieldApi.state.meta.isValid && handleBlur({ target: { name: fieldApi.name, value } }),
                    onChange: ({ value }) => {
                      if (value == null) {
                        const newPointsLeft = pointsLeft + (currentReduce ?? 0)
                        setPointsLeft(newPointsLeft)
                        scoresField.removeValue(i)
                        return value
                      } else {
                        const newPointBuyId = value.id
                        const pointBuyOption = pointBuyRule.options?.find((option) => option.id === newPointBuyId)

                        // Calculate new points left
                        const newReduce = pointBuyOption?.reduce

                        if (newReduce && currentReduce && pointsLeft) {
                          // Update points left
                          const pointDifference = newReduce - currentReduce
                          const newPointsLeft = pointsLeft - pointDifference
                          setPointsLeft(newPointsLeft)
                        }
                        const distributedObj = DistributedInputSchema.parse({
                          ability: score.ability,
                          id: newPointBuyId,
                        })

                        return distributedObj
                      }
                    },
                  }}
                >
                  {({ DropdownField }) => (
                    <Grid.Col key={i} span={{ sm: 6, md: 4, lg: 2 }}>
                      <DropdownField label={abilityLabel} options={pointBuyOptions(currentOption)} />
                    </Grid.Col>
                  )}
                </AppField>
              )
            })
          }}
        </AppField>
      </>
    )
  },
})

export default PointBuy
