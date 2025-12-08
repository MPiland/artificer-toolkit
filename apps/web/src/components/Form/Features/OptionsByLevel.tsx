import { Grid } from '@mantine/core'
import { useFieldUpdates } from '~hooks'
import type { FormDataType, CharacterInput, SpellInput } from '~types'
import { useOptimizedSelector, useTypedFormStore } from '~store'
import { UnionToIntersection, SetOptional } from 'type-fest'
import { useFormField } from '~hooks'
import { useCallback, useMemo } from 'react'

type FeaturePath =
  | `ancestry.options[${number}].features[${number}].optionsByLevel[${number}]`
  | `features[${number}].optionsByLevel[${number}]`

type StoreType = UnionToIntersection<SetOptional<Exclude<FormDataType, CharacterInput | SpellInput>, '__kind'>>

const OptionByLevel = ({ index, replaceAtLevel }: { index: number; replaceAtLevel: boolean }) => {
  {
    const store = useTypedFormStore<StoreType>()

    const { AppField } = useFormField({ store })

    const { meta, stateKind } = useOptimizedSelector(store, (state) => {
      return {
        meta: state.meta,
        stateKind: state.current?.__kind,
      }
    })

    const computePath = useCallback(() => {
      const segments: string[] = []

      if (meta.editing.ancestryOptionIndex && stateKind === 'RaceInput') {
        segments.push(`ancestry.options[${meta.editing.ancestryOptionIndex}]`)
      }

      segments.push(`features[${meta.editing.featureIndex || 0}]`)
      segments.push(`optionsByLevel[${index}]`)

      return segments.join('.') + '.'
    }, [meta, stateKind, index])

    const formPath = useMemo(() => {
      return computePath()
    }, [computePath]) as FeaturePath

    const { fieldListeners, fieldValidators } = useFieldUpdates()

    return (
      <Grid.Col>
        <Grid>
          <AppField
            name={`${formPath}.level`}
            validators={fieldValidators({
              onBlur: 'Please enter a level',
              onChange: { type: 'integer', name: 'Level', min: 1 },
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => (
              <Grid.Col>
                <TextField />
              </Grid.Col>
            )}
          </AppField>
          <AppField
            name={`${formPath}.count`}
            validators={fieldValidators({
              onBlur: 'Please enter a count',
              onChange: { type: 'integer', name: 'Count', min: 1 },
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => (
              <Grid.Col>
                <TextField />
              </Grid.Col>
            )}
          </AppField>
          {replaceAtLevel && (
            <AppField
              name={`${formPath}.replaceCount`}
              validators={fieldValidators({
                onBlur: 'Please enter a number of replacements',
                onChange: { type: 'integer', name: 'Replacements', min: 1 },
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => (
                <Grid.Col>
                  <TextField />
                </Grid.Col>
              )}
            </AppField>
          )}
        </Grid>
      </Grid.Col>
    )
  }
}
export default OptionByLevel
