import type { CharacterInput } from '~/types'
import { Grid } from '@mantine/core'
import { useFieldUpdates, useCharacterFeatureOptions, useFormField } from '~/hooks'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import { useMemo } from 'react'
import { useGetFeature } from '~/apis'

const FeatureOptions = ({ featureId }: { featureId: string }) => {
  const store = useTypedFormStore<CharacterInput>()

  const { AppField } = useFormField({ store })

  // Use optimized selector to batch multiple character properties with shallow comparison
  const { features, abilities, spellcasting, updateField } = useOptimizedSelector(store, (state) => ({
    features: state.current?.features,
    abilities: state.current?.abilities,
    spellcasting: state.current?.spellcasting,
    updateField: state.updateField,
  }))
  const { fieldListeners } = useFieldUpdates()

  const feature = features?.find((f) => f?.id === featureId)

  const { data: fullFeature } = useGetFeature(feature?.id || '')

  const optionByLevel = fullFeature?.optionsByLevel?.find((option) => Number(option.level) >= Number(feature?.level))

  const selectionCount = optionByLevel?.count || 1

  const FeatureOptionField = ({ index, optionIndex }: { index: number; optionIndex: string }) => {
    const optionQuery = useCharacterFeatureOptions({
      features: features || [],
      abilities: abilities || { __kind: 'CharacterAbilitiesInput', scores: [] },
      spellcasting: spellcasting || { __kind: 'CharacterSpellcastingInput' },
      optionIndex,
      featureId,
    })

    if (optionQuery.isLoading) {
      return (
        <Grid.Col>
          <div>Loading option {index + 1}...</div>
        </Grid.Col>
      )
    }

    if (!optionQuery.data) return null

    const { path, exist, options } = optionQuery.data

    return (
      <Grid.Col>
        <AppField
          name={path}
          listeners={{
            ...fieldListeners,
            onChange: ({ value }) => {
              if (value == null) return updateField({ path, value: undefined })
              return updateField({
                path,
                value: {
                  id: value,
                  optionIndex,
                  featureLevel: feature?.level,
                },
              })
            },
          }}
        >
          {({ DropdownField }) => (
            <DropdownField
              label={`${fullFeature?.label} Option ${index + 1}`}
              placeholder='Select an option'
              options={options || []}
              exist={exist}
            />
          )}
        </AppField>
      </Grid.Col>
    )
  }

  // Generate array of option indices for mapping
  const optionIndices = useMemo(() => {
    return Array.from({ length: selectionCount }, (_, index) => ({
      index,
      optionIndex: `${index}-${feature?.id}`,
    }))
  }, [selectionCount, feature?.id])

  return (
    <>
      {optionIndices.map(({ index, optionIndex }) => (
        <FeatureOptionField key={optionIndex} index={index} optionIndex={optionIndex} />
      ))}
    </>
  )
}
export default FeatureOptions
