import { Categories, Sections } from '@enums'
import { useFieldUpdates, useSystemData, useEnumChecks, useFormField } from '@hooks'
import { Stack } from '@mantine/core'
import { Prerequisites } from '@components/Form'
import { FormDataType, CharacterInput, SpellInput } from '@types'
import { useOptimizedSelector, useTypedFormStore } from '@store'
import type { UnionToIntersection, SetOptional } from 'type-fest'
import { useMemo, useCallback } from 'react'

type FeaturePath =
  | `ancestry.options[${number}].features[${number}].senses[${number}]`
  | `ancestry.options[${number}].features[${number}].options[${number}].senses[${number}]`
  | `features[${number}].senses[${number}]`
  | `features[${number}].options[${number}].senses[${number}]`

type StoreType = UnionToIntersection<SetOptional<Exclude<FormDataType, CharacterInput | SpellInput>, '__kind'>>

const Senses = () => {
  const store = useTypedFormStore<StoreType>()
  const { category, subtypes, formAttributes, meta, stateKind } = useOptimizedSelector(store, (state) => {
    const { ancestryOptionIndex, featureIndex, optionIndex, sectionIndex } = state.meta.editing

    const feature =
      featureIndex !== null ?
        ancestryOptionIndex !== null && state.current?.__kind === 'RaceInput' ?
          state.current?.ancestry?.options?.[ancestryOptionIndex]?.features?.[featureIndex]
        : state.current?.features?.[featureIndex]
      : undefined

    const option = feature && (optionIndex !== null ? feature?.options?.[optionIndex] : undefined)

    const section = option ? option?.senses?.[sectionIndex || 0] : feature?.senses?.[sectionIndex || 0]

    return {
      category: feature?.category,
      subtypes: state.current?.__kind === 'ClassInput' ? state.current?.subtypes : undefined,
      formAttributes: section?.attributes,
      meta: state.meta,
      stateKind: state.current?.__kind,
    }
  })

  const computePath = useCallback(() => {
    const segments: string[] = []

    if (meta.editing.ancestryOptionIndex && stateKind === 'RaceInput') {
      segments.push(`ancestry.options[${meta.editing.ancestryOptionIndex}]`)
    }

    if (meta.editing.featureIndex !== undefined) {
      segments.push(`features[${meta.editing.featureIndex}]`)
    }

    if (meta.editing.optionIndex !== undefined) {
      segments.push(`options[${meta.editing.optionIndex}]`)
    }
    segments.push(`senses[${meta.editing.sectionIndex || 0}]`)

    return segments.join('.') + '.'
  }, [meta, stateKind])

  const formPath = useMemo(() => {
    return computePath()
  }, [computePath]) as FeaturePath

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const { AppField } = useFormField({ store })

  const { senses, attributes } = useSystemData()
  const { getAttributes } = useEnumChecks()

  const { subtypeSpecific, providesOptions, hasPrerequisites } = getAttributes({
    attributes: formAttributes || [],
  })

  return (
    <Stack>
      <AppField name={`${formPath}.attributes`} listeners={fieldListeners}>
        {({ DropdownField }) => (
          <DropdownField
            multiselect={true}
            options={attributes.filter(
              (attribute) =>
                attribute.sections &&
                (attribute.sections.includes(Sections.ALL) ||
                  (category === Categories.SUBCLASS && attribute.sections.includes(Sections.SUBCLASS)))
            )}
            label='Sense Attributes'
          />
        )}
      </AppField>
      <AppField
        name={`${formPath}.ids`}
        validators={fieldValidators({
          onBlur: 'Select at least one sense',
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => <DropdownField multiselect={true} options={senses} required={true} label='Senses' />}
      </AppField>
      {subtypeSpecific && subtypes?.length && (
        <AppField
          name={`${formPath}.subtype`}
          validators={fieldValidators({
            onBlur: 'Select a subtype',
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => <DropdownField options={subtypes} required={true} label='Subtype' />}
        </AppField>
      )}
      {providesOptions && (
        <AppField
          name={`${formPath}.selectionCount`}
          validators={fieldValidators({
            onBlur: 'Set an amount of selections allowed',
            onChange: { type: 'number', min: 1, name: 'Selection count' },
          })}
          listeners={fieldListeners}
        >
          {({ TextField }) => <TextField required={true} label='# of Selections' />}
        </AppField>
      )}
      {hasPrerequisites && <Prerequisites />}
    </Stack>
  )
}
export default Senses
