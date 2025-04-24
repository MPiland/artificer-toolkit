import { useEffect } from 'react'
import Dropdown from '@/components/Dropdown'
import type { OnChange, Character } from '@/types'
import { AbilityGenMethods } from '@/enums'
import { isEqual } from 'lodash'
import Grid from '@/components/Grid'
import { useSystemData } from '@/hooks'

const StandardArray = ({
  formStore: { data, updateField },
}: {
  formStore: {
    data: Character
    updateField: OnChange<Character>['updateField']
    removeField: OnChange<Character>['removeField']
  }
}) => {
  const { rules, abilities } = useSystemData()

  const pointSystem = rules.abilityGenerateMethod.findAbilityGenerateMethod(AbilityGenMethods.STANDARD_ARRAY)

  useEffect(() => {
    if (data.abilities?.standardArray?.length) {
      data.abilities?.scores?.forEach((aScore, aIndex) => {
        const arrayObject = data.abilities?.standardArray?.find((arrayValue) => aScore.ability === arrayValue?.ability)

        if (arrayObject?.score) {
          const score = pointSystem?.options?.find((option) => option.id === arrayObject.score)?.value

          if (!isEqual(score, arrayObject.score)) {
            updateField({
              path: `abilities.scores.${aIndex}.baseScore`,
              value: score,
            })
          }
        } else {
          updateField({
            path: `abilities.scores.${aIndex}.baseScore`,
            value: 0,
          })
        }
      })
    }
  }, [data.abilities, updateField, pointSystem])

  return (
    <>
      {data.abilities?.scores?.map((score, index) => {
        const ability = abilities.findAbility(score.ability)
        const currentIndex = data.abilities?.standardArray?.findIndex((sAbility) => sAbility?.ability === score.ability)
        if (currentIndex && currentIndex !== -1 && pointSystem?.options?.length) {
          const current = data.abilities?.standardArray?.[currentIndex]?.score
          return (
            <Grid.Item key={index} colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown<Character>
                key={index}
                name={'abilities'}
                label={`${ability?.label}`}
                value={current}
                options={pointSystem?.options?.filter(
                  (option) =>
                    !data.abilities?.standardArray?.some(
                      (sAbility) => sAbility?.score === option.id && sAbility.ability !== ability?.id
                    )
                )}
                onChange={{
                  updateField: ({ value }) => {
                    const valueObject: string = value
                    console.log({ valueObject })
                    if (valueObject) {
                      const standardArrayObject: { ability: string; score: string | number } = {
                        ability: score.ability,
                        score: value,
                      }
                      return {
                        path: `abilities.standardArray.${index}`,
                        value: standardArrayObject,
                      }
                    }
                  },
                  removeField: () =>
                    updateField({
                      path: `abilities.standardArray.${index}`,
                      value: [],
                    }),
                }}
              />
            </Grid.Item>
          )
        }
      })}
    </>
  )
}
export default StandardArray
