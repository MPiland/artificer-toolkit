import type {
  CharacterFeatureInput,
  CharacterSpellcastingInput,
  CharacterAbilitiesInput,
  CharacterInput,
} from '@/types'
import { Grid } from '@mantine/core'
import { option_dropdown, withFieldGroup } from '@/components/Form'
import { useFeatureData, useFieldUpdates, useGetFeatures } from '@/hooks'
import { useMemo, type ReactElement } from 'react'
import { useFormStore } from '@/store'

type FeatureOptionProps = {
  featureIndex?: number
}

const FeatureOptions = withFieldGroup({
  defaultValues: {
    features: [] as CharacterFeatureInput[] | null | undefined,
    spellcasting: {} as CharacterSpellcastingInput | null | undefined,
    abilities: {} as CharacterAbilitiesInput | null | undefined,
  },
  props: {
    featureIndex: undefined,
  } as FeatureOptionProps,
  render: function Render({ group, featureIndex }) {
    const { AppField } = group

    const formStore = useFormStore()

    const { features: featuresData } = useFeatureData()
    const { createFeatures } = useGetFeatures()
    const { fieldListeners } = useFieldUpdates({ data: 'form' })

    const feature = (formStore.current as CharacterInput)?.features?.[featureIndex ?? 0]

    const factoryFeatures = createFeatures({ data: formStore.current as CharacterInput })

    const factoryFeature = factoryFeatures?.find((f) => f.id === feature?.id)

    const optionByLevel = featuresData
      ?.find((f) => f.id === feature?.id)
      ?.optionsByLevel?.find((option) => Number(option.level) >= Number(feature?.level))

    const selectionCount = optionByLevel?.count || 1

    const { getFeatureOptions } = useGetFeatures()

    const dropdowns = useMemo(() => {
      if (!factoryFeature) return
      const elements: ReactElement[] = []

      for (let index = 0; index < selectionCount; index++) {
        const optionIndex = `${index}-${featureIndex}-${feature?.id}`

        const { path, exist, options } = getFeatureOptions({
          features: (formStore.current as CharacterInput)?.features,
          abilities: (formStore.current as CharacterInput)?.abilities,
          spellcasting: (formStore.current as CharacterInput)?.spellcasting,
          feature: factoryFeature,
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
                      featureLevel: factoryFeature.level,
                    },
                  })
                },
              }}
            >
              {({ DropdownField }) => (
                <DropdownField
                  label={`${factoryFeature.label} Option`}
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
      featureIndex,
      AppField,
      factoryFeature,
      getFeatureOptions,
      fieldListeners,
      formStore,
      feature?.id,
    ])

    return <>{dropdowns}</>
  },
})
export default FeatureOptions
