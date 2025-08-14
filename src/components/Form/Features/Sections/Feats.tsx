import { Categories, Sections } from '~/enums'
import { useSystemData, useEnumChecks, useFieldUpdates, useFormField } from '~/hooks'
import type { FormDataType, CharacterInput, SpellInput } from '~/types'
import { Stack } from '@mantine/core'
import { Prerequisites } from '~/components/Form'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import { useListFeats } from '~/apis'
import type { UnionToIntersection, SetOptional } from 'type-fest'
import { useMemo, useCallback } from 'react'

type FeaturePath =
  | `ancestry.options[${number}].features[${number}].feats[${number}]`
  | `ancestry.options[${number}].features[${number}].options[${number}].feats[${number}]`
  | `features[${number}].feats[${number}]`
  | `features[${number}].options[${number}].feats[${number}]`

type StoreType = UnionToIntersection<SetOptional<Exclude<FormDataType, CharacterInput | SpellInput>, '__kind'>>

const Feats = () => {
  const store = useTypedFormStore<StoreType>()

  const { AppField } = useFormField({ store })

  const { category, subtypes, formAttributes, meta, stateKind } = useOptimizedSelector(store, (state) => {
    const { ancestryOptionIndex, featureIndex, optionIndex, sectionIndex } = state.meta.editing

    const feature =
      featureIndex !== null ?
        ancestryOptionIndex !== null && state.current?.__kind === 'RaceInput' ?
          state.current?.ancestry?.options?.[ancestryOptionIndex]?.features?.[featureIndex]
        : state.current?.features?.[featureIndex]
      : undefined

    const option = feature && (optionIndex !== null ? feature?.options?.[optionIndex] : undefined)

    const section = option ? option?.proficiencies?.[sectionIndex || 0] : feature?.proficiencies?.[sectionIndex || 0]

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
    segments.push(`feats[${meta.editing.sectionIndex || 0}]`)

    return segments.join('.') + '.'
  }, [meta, stateKind])

  const formPath = useMemo(() => {
    return computePath()
  }, [computePath]) as FeaturePath

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const {
    data: { feats },
  } = useListFeats()

  const { attributes } = useSystemData()
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
                attribute?.sections?.length &&
                (attribute.sections.includes(Sections.SPELL) ||
                  attribute.sections.includes(Sections.ALL) ||
                  (category === Categories.SUBCLASS && attribute.sections.includes(Sections.SUBCLASS)))
            )}
            label='Attributes'
          />
        )}
      </AppField>
      <AppField
        name={`${formPath}.feats`}
        validators={fieldValidators({
          onBlur: 'Select at least one feat',
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => <DropdownField multiselect={true} options={feats} label='Feats' required={true} />}
      </AppField>
      {subtypeSpecific && subtypes?.length && (
        <AppField
          name={`${formPath}.subtype`}
          validators={fieldValidators({
            onBlur: 'Select a subtype',
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => <DropdownField options={feats} label='Subtype' required={true} />}
        </AppField>
      )}
      {providesOptions && (
        <AppField
          name={`${formPath}.selectionCount`}
          validators={fieldValidators({
            onBlur: 'Enter a selection amount allowed',
            onChange: { type: 'integer', name: 'Selection amount', min: 1 },
          })}
          listeners={fieldListeners}
        >
          {({ TextField }) => <TextField label='# of Selections' required={true} />}
        </AppField>
      )}
      {hasPrerequisites && <Prerequisites />}
    </Stack>
  )
}

export default Feats
