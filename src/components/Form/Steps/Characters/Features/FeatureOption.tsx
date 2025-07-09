import type { CharacterFeatureInput, CharacterSpellcastingInput, CharacterAbilitiesInput } from '@/types'
import { Grid } from '@mantine/core'
import { option_dropdown, withFieldGroup } from '@/components/Form'
import { useFeatureData, useFieldUpdates, useGetFeatures, type FactoryFeature } from '@/hooks'
import { useStore } from '@tanstack/react-form'
import { useMemo, type ReactElement } from 'react'
import { useFormStore } from '@/store'

const defaultValues: {
  features?: CharacterFeatureInput[]
  spellcasting?: CharacterSpellcastingInput
  abilities?: CharacterAbilitiesInput
} = {
  features: undefined,
  spellcasting: undefined,
  abilities: undefined,
}

type FeatureOptionProps = {
  feature?: FactoryFeature
  featureIndex?: number
  classIndex?: number
}

const FeatureOption = withFieldGroup({
  defaultValues,
  props: {
    feature: undefined,
    featureIndex: 0,
    classIndex: 0,
  } as FeatureOptionProps,
  render: function Render({ group, feature, featureIndex, classIndex }) {
    const { AppField } = group

    const formStore = useFormStore()

    const { fieldListeners } = useFieldUpdates({ data: 'form' })

    const {
      features: { findFeature },
    } = useFeatureData()

    const { features, abilities, spellcasting } = useStore(group.store, (state) => ({
      features: state.values.features,
      spellcasting: state.values.spellcasting,
      abilities: state.values.abilities,
    }))

    const optionByLevel = findFeature(feature?.id)?.optionsByLevel?.find(
      (option) => Number(option.level) >= Number(features?.[featureIndex ?? 0]?.level)
    )

    const selectionCount = optionByLevel?.count || 1

    const { getFeatureOptions } = useGetFeatures()

    const dropdowns = useMemo(() => {
      if (!feature || !classIndex) return
      const elements: ReactElement[] = []

      for (let index = 0; index < selectionCount; index++) {
        const optionIndex = `${index}${featureIndex}${classIndex || 0}`

        const { path, exist, options } = getFeatureOptions({
          features,
          abilities,
          spellcasting,
          feature,
          optionIndex,
        })

        elements.push(
          <Grid.Col key={path + optionIndex}>
            <AppField
              name={path}
              listeners={{
                ...fieldListeners,
                onChange: ({ value }) => {
                  if (value == null) return formStore.removeField({ path })
                  return formStore.updateField({
                    path,
                    value: {
                      id: value,
                      optionIndex,
                      featureLevel: feature.level,
                    },
                  })
                },
              }}
            >
              {({ DropdownField }) => (
                <DropdownField
                  label={`${feature.label} Option`}
                  options={options}
                  className={option_dropdown}
                  exist={exist}
                />
              )}
            </AppField>
          </Grid.Col>
        )
      }

      return elements
    }, [
      selectionCount,
      classIndex,
      featureIndex,
      AppField,
      feature,
      abilities,
      features,
      spellcasting,
      getFeatureOptions,
      fieldListeners,
      formStore,
    ])

    return <>{dropdowns}</>
  },
})
export default FeatureOption
