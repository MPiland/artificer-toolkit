import { useEffect } from 'react'
import { ability_group } from '../Character.css'
import Dropdown from '../../../Dropdown/Dropdown'
import { DeepKeyOf, UpdateState } from '../../../../types/form'
import Row from '../../../Row/Row'
import { Character, Scores } from '../../../../../amplify/API'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { AbilityGenerate } from '../../../../types/enums'

const StandardArray = ({
  formData,
  updateFormData,
}: {
  formData: Character
  updateFormData: (arg: UpdateState<Character>) => void
}) => {
  const { data: system } = useGetSystemQuery()

  useEffect(() => {
    if (formData.abilities?.standardArray?.length > 0) {
      formData.abilities?.scores?.forEach((ability: any, aIndex: number) => {
        const score = formData.abilities?.standardArray?.find(
          (arrayValue: any) => ability._id === arrayValue?.ability?._id
        )?.score

        if (score) {
          updateFormData({
            type: 'update',
            path: `abilities.scores.${aIndex}.baseScore`,
            value: score,
          })
        } else {
          updateFormData({
            type: 'update',
            path: `abilities.scores.${aIndex}.baseScore`,
            value: 0,
          })
        }
      })
    }
  }, [formData.abilities, updateFormData])

  const handleStandardArray = (e: UpdateState<Character>, score: Scores, index: number) => {
    if (e.type === 'update') {
      const valueObject: string = e.value
      if (valueObject) {
        const standardArrayObject: { ability: string; score: string } = {
          ability: score.ability,
          score: e.value,
        }
        return updateFormData({
          type: 'update',
          path: `abilities.standardArray.${index}`,
          value: standardArrayObject,
        })
      }

      return updateFormData({
        type: 'update',
        path: `abilities.standardArray.${index}`,
        value: undefined,
      })
    }
  }

  return (
    <Row cols={{ base: 2, md: formData.abilities?.scores?.length }} className={ability_group}>
      {formData.abilities?.scores?.map((score, index) => (
        <Dropdown<Character>
          key={index}
          name={'ability' as DeepKeyOf<Character>}
          label='Dice Value'
          value={
            system.rules.abilityGenerateMethod
              .find((method) => method.id === AbilityGenerate.standardArray)
              .options.find((option) => option.id === formData.abilities?.standardArray?.[index]?.score).id
          }
          options={system.rules.abilityGenerateMethod
            .find((method) => method.id === AbilityGenerate.standardArray)
            .options.filter(
              (option) =>
                !formData.abilities?.standardArray?.some(
                  (aValue, vIndex) => aValue?.score === option.id && vIndex !== index
                )
            )}
          onChange={(e) => handleStandardArray(e, score, index)}
        />
      ))}
    </Row>
  )
}
export default StandardArray
