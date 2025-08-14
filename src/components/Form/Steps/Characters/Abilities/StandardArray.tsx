import { useEffect } from 'react'
import { AbilityGenMethods } from '~/enums'
import { isEqual } from 'lodash-es'
import { Grid } from '@mantine/core'
import { useSystemData, useFieldUpdates, useFormField } from '~/hooks'
import { StandardArrayInputSchema } from '~/schemas'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import type { CharacterInput } from '~/types'

const StandardArray = () => {
  const store = useTypedFormStore<CharacterInput>()

  const { AppField } = useFormField({ store })

  // Use optimized selector to batch standard array data with shallow comparison
  const { updateField, standardArray, scores } = useOptimizedSelector(store, (state) => ({
    updateField: state.updateField,
    standardArray: state.current?.abilities?.standardArray,
    scores: state.current?.abilities?.scores,
  }))

  const { fieldListeners } = useFieldUpdates()

  const { rules, abilities } = useSystemData()

  const pointSystemRules = rules.abilityGenerateMethod.findAbilityGenerateMethod(AbilityGenMethods.STANDARD_ARRAY)

  useEffect(() => {
    if (standardArray?.length) {
      scores?.forEach((aScore, i) => {
        const arrayObject = standardArray?.find((arrayValue) => aScore.ability === arrayValue?.ability)

        if (arrayObject?.score) {
          const score = pointSystemRules?.options?.find((option) => option.id === arrayObject.score)?.label

          if (!isEqual(score, arrayObject.score)) {
            updateField({ path: `abilities.scores[${i}].score`, value: score })
          }
        } else {
          updateField({ path: `abilities.scores[${i}].score`, value: 0 })
        }
      })
    }
  }, [standardArray, pointSystemRules, scores, updateField])

  return (
    <AppField name='abilities.standardArray' mode='array'>
      {(standardArray) => {
        const scoreArray = standardArray.state.value
        return scores?.map((score, i) => {
          const ability = abilities.findAbility(score.ability)
          const currentIndex = scoreArray?.findIndex((sAbility) => sAbility?.ability === score.ability)
          if (currentIndex && currentIndex !== -1 && pointSystemRules?.options?.length) {
            return (
              <AppField
                name={`abilities.standardArray[${i}].score`}
                listeners={{
                  ...fieldListeners.onBlur,
                  onChange: ({ value }) => {
                    if (value == null) {
                      updateField({ path: `abilities.standardArray[${i}]`, value: undefined })
                      return standardArray.removeValue(i)
                    }
                    const standardArrayObject = StandardArrayInputSchema.parse({
                      ability: score.ability,
                      score: value,
                    })
                    updateField({ path: `abilities.standardArray[${i}]`, value: standardArrayObject })
                    return standardArray.replaceValue(i, standardArrayObject)
                  },
                }}
              >
                {({ DropdownField }) => (
                  <Grid.Col key={`score-baseScore-${i}`} span={{ sm: 6, md: 4, lg: 2 }}>
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
}
export default StandardArray
