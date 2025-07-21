import { useEffect } from 'react'
import { AbilityGenMethods } from '@/enums'
import { isEqual } from 'lodash'
import { Grid } from '@mantine/core'
import { useSystemData, useFieldUpdates } from '@/hooks'
import { withFieldGroup } from '@/components/Form'
import { StandardArrayInputSchema } from '@/schemas'
import { useTypedFormStore } from '@/store'
import type { CharacterAbilitiesInput, CharacterInput } from '@/types'

const StandardArray = withFieldGroup({
  defaultValues: {} as CharacterAbilitiesInput,
  render: function Render({ group }) {
    const { AppField } = group

    const store = useTypedFormStore<CharacterInput>()
    const updateField = store((state) => state.updateField)
    const standardArray = store((state) => state.current?.abilities?.standardArray)
    const scores = store((state) => state.current?.abilities?.scores)

    const { fieldListeners } = useFieldUpdates({ data: 'form', path: 'abilities' })

    const { rules, abilities } = useSystemData()

    const pointSystemRules = rules.abilityGenerateMethod.findAbilityGenerateMethod(AbilityGenMethods.STANDARD_ARRAY)

    useEffect(() => {
      if (standardArray?.length) {
        scores?.forEach((aScore, i) => {
          const arrayObject = standardArray?.find((arrayValue) => aScore.ability === arrayValue?.ability)

          if (arrayObject?.score) {
            const score = pointSystemRules?.options?.find((option) => option.id === arrayObject.score)?.label

            if (!isEqual(score, arrayObject.score)) {
              group.setFieldValue(`scores[${i}].baseScore`, Number(score))
              updateField({ path: `abilities.scores[${i}].score`, value: score })
            }
          } else {
            group.setFieldValue(`scores[${i}].baseScore`, 0)
            updateField({ path: `abilities.scores[${i}].score`, value: 0 })
          }
        })
      }
    }, [standardArray, group, pointSystemRules, scores, updateField])

    return (
      <AppField name='standardArray' mode='array'>
        {(standardArray) => {
          const scoreArray = standardArray.state.value
          return scores?.map((score, i) => {
            const ability = abilities.findAbility(score.ability)
            const currentIndex = scoreArray?.findIndex((sAbility) => sAbility?.ability === score.ability)
            if (currentIndex && currentIndex !== -1 && pointSystemRules?.options?.length) {
              return (
                <AppField
                  name={`standardArray[${i}].score`}
                  listeners={{
                    ...fieldListeners.onBlur,
                    onChange: ({ value }) => {
                      if (value == null) {
                        return standardArray.removeValue(i)
                      }
                      const standardArrayObject = StandardArrayInputSchema.parse({
                        ability: score.ability,
                        score: value,
                      })
                      return standardArray.replaceValue(i, standardArrayObject)
                    },
                  }}
                >
                  {({ DropdownField }) => (
                    <Grid.Col key={`${i}-score-baseScore`} span={{ sm: 6, md: 4, lg: 2 }}>
                      <DropdownField
                        key={i}
                        label={`${ability?.label}`}
                        options={
                          pointSystemRules?.options?.filter(
                            (option) =>
                              !scoreArray?.some(
                                (sAbility) => sAbility?.score === option.id && sAbility.ability !== ability?.id
                              )
                          ) ?? []
                        }
                      />
                    </Grid.Col>
                  )}
                </AppField>
              )
            }
          })
        }}
      </AppField>
    )
  },
})
export default StandardArray
