import { useEffect, useMemo, useState } from 'react'
import { ability_group, point_counter, point_counter_label } from '../Character.css'
import Dropdown from '../../../Dropdown/Dropdown'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { UpdateState } from '../../../../types/form'
import { isEqual } from 'lodash'
import Row from '../../../Row/Row'
import { AbilityGenerate } from '../../../../types/enums'
import { Character } from '../../../../../amplify/API'

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
    return system.rules.abilityGenerateMethod.find((method) => method.id === AbilityGenerate.pointBuy)
  }, [system?.rules?.abilityGenerateMethod])

  // Set pointsLeft for pointBuy
  useEffect(() => {
    if (pointsLeft == null) {
      setPointsLeft(system.rules.abilityGenerateMethod.find((method) => method.id === AbilityGenerate.pointBuy).total)
    }
  }, [system?.rules?.abilityGenerateMethod, pointsLeft])

  // Set the ability scores if pointBuy
  useEffect(() => {
    let emptyArray: boolean = true
    if (formData.abilities?.pointBuy?.distributed?.length > 0) {
      formData.abilities?.pointBuy?.distributed?.forEach((distribution) => {
        const scoreVavlue = Number(pointBuy.options.find((option) => option.id === distribution.id).value)
        if (distribution?.ability) {
          const abilityIndex = formData.abilities?.scores?.findIndex((score) => score.ability === distribution.ability)
          if (abilityIndex !== -1) {
            emptyArray = false
            if (!isEqual(formData.abilities?.scores[abilityIndex]?.baseScore, scoreVavlue)) {
              updateFormData({
                type: 'update',
                path: `abilities.scores.${abilityIndex}.baseScore`,
                value: scoreVavlue,
              })
            }
          }
        }
      })
    }
    if (emptyArray || !(formData.abilities?.pointBuy?.distributed?.length > 0)) {
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
    if (e.type === 'update') {
      const pointBuyObject = system.rules.abilityGenerateMethod
        .find((method) => method.id === AbilityGenerate.pointBuy)
        .options.find((option) => option === e?.value)
      if (pointBuyObject != null) {
        const applyObject = { ability: ability, pointBuy: pointBuyObject }
        if (pointsLeft != null) {
          const newPointsLeft = pointsLeft - e.value.reduce
          setPointsLeft(newPointsLeft)
        }

        updateFormData({
          type: 'update',
          path: `abilities.pointBuy.distributed.${aIndex}`,
          value: applyObject,
        })
      } else {
        const current = formData.abilities?.pointBuy?.distributed?.[aIndex]
        const pointValue = pointBuy.options.find((option) => option.id === current.id)
        const newPointsLeft = pointsLeft + pointValue.reduce
        setPointsLeft(newPointsLeft)
        updateFormData({
          type: 'update',
          path: `abilities.pointBuy.distributed.${aIndex}`,
          value: {},
        })
      }
    }
  }

  return (
    <>
      <div className={point_counter}>
        <span className={point_counter_label}>Points Remaining</span>
        <span>{`${pointsLeft} / ${
          system.rules.abilityGenerateMethod.find((method) => method.id === AbilityGenerate.pointBuy).total
        }`}</span>
      </div>
      <Row cols={{ base: 2, md: formData.abilities?.scores?.length }} className={ability_group}>
        {formData.abilities?.scores?.map((score, index) => {
          const current = formData.abilities?.pointBuy?.distributed[index]?.id
          const pointBuyObject = pointBuy.options.find((option) => option.id === current)
          return (
            <Dropdown<Character>
              name='id'
              label={`${system.abilities.find((sAbility) => sAbility.id === score.ability).value}`}
              key={index}
              value={formData.abilities?.pointBuy?.distributed[index]?.id}
              options={pointBuy.options
                .filter((option) => {
                  if (pointBuyObject) {
                    return option?.reduce - pointBuyObject?.reduce <= pointsLeft
                  }
                  return option?.reduce <= pointsLeft
                })
                .map((option) => {
                  if (current) {
                    let newReduce: number = 0
                    if (option.id !== current) {
                      newReduce = option.reduce - pointBuyObject.reduce
                    }
                    let newLabel: string = option.label
                    let newOperand: string = ''
                    let newPointString: string

                    if (newReduce >= 1) {
                      newOperand = '-'
                    } else if (newReduce <= -1) {
                      newOperand = '+'
                    }

                    if (Math.abs(newReduce) === 1) {
                      newPointString = 'Point'
                    } else {
                      newPointString = 'Points'
                    }

                    if (newReduce !== 0) {
                      newLabel += ` (${newOperand}${Math.abs(newReduce)} ${newPointString})`
                    }

                    return {
                      label: newLabel,
                      value: option.value,
                      reduce: newReduce,
                      id: option.id,
                    }
                  }
                  return {
                    label: option.value,
                    value: option.value,
                    reduce: option.reduce,
                    id: option.id,
                  }
                })}
              onChange={(e) => handlePointApply(e, score.ability, index)}
            />
          )
        })}
      </Row>
    </>
  )
}
export default PointBuy
