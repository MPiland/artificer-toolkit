import { useEffect } from 'react'
import { AbilityGenMethods } from '@/enums'
import { isEqual, get } from 'lodash'
import { Grid } from '@mantine/core'
import { useSystemData } from '@/hooks'
import { withFieldGroup } from '@/components/Form'
import { StandardArrayInputSchema } from '@/schemas'
import { useStore } from '@tanstack/react-form'
import { useFormStore } from '@/store'
import type { CharacterAbilitiesInput } from 'gql/types'

const StandardArray = withFieldGroup({
  defaultValues: {} as CharacterAbilitiesInput,
  render: function Render({ group }) {
    const { AppField, Subscribe } = group

    const formStore = useFormStore()

    const { rules, abilities } = useSystemData()

    const { standardArray, scores } = useStore(group.store, (state) => ({
      standardArray: state.values?.standardArray,
      scores: state.values?.scores,
    }))

    const pointSystemRules = rules.abilityGenerateMethod.findAbilityGenerateMethod(AbilityGenMethods.STANDARD_ARRAY)

    useEffect(() => {
      if (standardArray?.length) {
        scores?.forEach((aScore, i) => {
          const arrayObject = standardArray?.find((arrayValue) => aScore.ability === arrayValue?.ability)

          if (arrayObject?.score) {
            const score = pointSystemRules?.options?.find((option) => option.id === arrayObject.score)?.label

            if (!isEqual(score, arrayObject.score)) {
              group.setFieldValue(`scores[${i}].baseScore`, Number(score))
              formStore.updateField({ path: `abilities.scores[${i}].score`, value: score })
            }
          } else {
            group.setFieldValue(`scores[${i}].baseScore`, 0)
            formStore.updateField({ path: `abilities.scores[${i}].score`, value: 0 })
          }
        })
      }
    }, [standardArray, group, pointSystemRules, scores, formStore])

    const handleBlur = ({
      target: { name, value },
    }: {
      target: { name: string; value: string | string[] | number | null | undefined }
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
        <Subscribe
          selector={(state) => ({
            scores: state.values.scores,
          })}
        >
          {({ scores }) => (
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
                          onBlur: ({ value, fieldApi }) =>
                            fieldApi.state.meta.isValid && handleBlur({ target: { name: fieldApi.name, value } }),
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
          )}
        </Subscribe>
      </>
    )
  },
})
export default StandardArray
