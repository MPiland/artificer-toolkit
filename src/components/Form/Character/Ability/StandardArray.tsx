import { useEffect } from 'react'
import { ability_group } from '../Character.css'
import Dropdown from '../../../Dropdown/Dropdown'
import { DeepKeyOf, UpdateState } from '../../../../types/form'
import Row from '../../../Row/Row'
import { Character, Scores } from '../../../../../amplify/gql/types'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { AbilityGenerate } from '../../../../types/enums'
import { isEqual } from 'lodash'

const StandardArray = ({
  formData,
  updateFormData,
}: {
  formData: Character
  updateFormData: (arg: UpdateState<Character>) => void
}) => {
  const { data: system } = useGetSystemQuery()

  const pointSystem = system.rules.abilityGenerateMethod.find((method) => method.id === AbilityGenerate.standardArray)

  useEffect(() => {
    if (formData.abilities?.standardArray?.length > 0) {
      formData.abilities?.scores?.forEach((aScore, aIndex) => {
        const arrayObject = formData.abilities?.standardArray?.find(
          (arrayValue) => aScore.ability === arrayValue?.ability
        )

        if (arrayObject?.score) {
          const score = pointSystem?.options.find((option) => option.id === arrayObject.score).value

          if (!isEqual(score, arrayObject.score)) {
            updateFormData({
              type: 'update',
              path: `abilities.scores.${aIndex}.baseScore`,
              value: score,
            })
          }
        } else {
          updateFormData({
            type: 'update',
            path: `abilities.scores.${aIndex}.baseScore`,
            value: 0,
          })
        }
      })
    }
  }, [formData.abilities, updateFormData, pointSystem])

  const handleStandardArray = (e: UpdateState<Character>, score: Scores, index: number) => {
    if (e.type === 'update') {
      const valueObject: string = e.value
      console.log({ valueObject })
      if (valueObject) {
        const standardArrayObject: { ability: string; score: string | number } = {
          ability: score.ability,
          score: e.value,
        }
        return updateFormData({
          type: 'update',
          path: `abilities.standardArray.${index}`,
          value: standardArrayObject,
        })
      }
    }
    if (e.type === 'remove') {
      return updateFormData({
        type: 'update',
        path: `abilities.standardArray.${index}`,
        value: [],
      })
    }
  }

  return (
    <Row cols={{ base: 2, md: formData.abilities?.scores?.length }} className={ability_group}>
      {formData.abilities?.scores?.map((score, index) => {
        const ability = system.abilities.find((sAbility) => sAbility.id === score.ability)
        const currentIndex = formData.abilities?.standardArray?.findIndex(
          (sAbility) => sAbility?.ability === score.ability
        )
        const current = formData.abilities?.standardArray?.[currentIndex]?.score
        return (
          <Dropdown<Character>
            key={index}
            name={'ability' as DeepKeyOf<Character>}
            label={`${ability?.label}`}
            value={current}
            options={pointSystem.options.filter(
              (option) =>
                !formData.abilities?.standardArray?.some(
                  (sAbility) => sAbility?.score === option.id && sAbility.ability !== ability.id
                )
            )}
            onChange={(e) => handleStandardArray(e, score, index)}
          />
        )
      })}
    </Row>
  )
}
export default StandardArray
