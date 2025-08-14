import { Categories, ProfCats, Sections } from '~/enums'
import { getKeyFromId, Prerequisites } from '~/components/Form'
import { useEnumChecks, useFieldUpdates, useSystemData, useFormField } from '~/hooks'
import type { FormDataType, CharacterInput, SpellInput } from '~/types'
import { Stack } from '@mantine/core'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import { useListEquipment } from '~/apis'
import type { UnionToIntersection, SetOptional } from 'type-fest'
import { useMemo, useCallback } from 'react'

type FeaturePath =
  | `ancestry.options[${number}].features[${number}].expertise[${number}]`
  | `ancestry.options[${number}].features[${number}].options[${number}].expertise[${number}]`
  | `features[${number}].expertise[${number}]`
  | `features[${number}].options[${number}].expertise[${number}]`

type StoreType = UnionToIntersection<SetOptional<Exclude<FormDataType, CharacterInput | SpellInput>, '__kind'>>

const Expertise = () => {
  const store = useTypedFormStore<StoreType>()

  const { AppField } = useFormField({ store })

  const {
    category,
    subtypes,
    formAttributes,
    formCategory,
    equipCat,
    equipProps,
    propsCat,
    propsProps,
    meta,
    stateKind,
  } = useOptimizedSelector(store, (state) => {
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
      formCategory: section?.category,
      equipCat: section?.equipment?.category,
      equipProps: section?.equipment?.properties,
      propsCat: section?.properties?.category,
      propsProps: section?.properties?.properties,
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
    segments.push(`expertise[${meta.editing.sectionIndex || 0}]`)

    return segments.join('.') + '.'
  }, [meta, stateKind])

  const formPath = useMemo(() => {
    return computePath()
  }, [computePath]) as FeaturePath

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const { proficiencies, attributes, abilities, skills, equipment: systemEquipment, languages } = useSystemData()

  const {
    data: { equipment, metaData: equipMeta },
  } = useListEquipment()

  const { getAttributes } = useEnumChecks()

  const systemOptions = {
    saveAbilities: abilities,
    skills: skills,
    languages: languages,
  } as const

  const sectionCategory = proficiencies.categories.findCategory(formCategory)
  const path = getKeyFromId(formCategory ?? '', ProfCats)

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
        name={`${formPath}.category`}
        validators={fieldValidators({
          onBlur: 'Select a expertise category',
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => (
          <DropdownField options={proficiencies.categories} required={true} label='Expertise Category' />
        )}
      </AppField>
      {sectionCategory != null &&
        path !== 'initiative' &&
        (path !== 'equipment' && path !== 'properties' ?
          <AppField
            name={`${formPath}.${path}`}
            validators={fieldValidators({
              onBlur: 'Select at lease one type',
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <DropdownField
                multiselect={true}
                options={systemOptions[path]}
                required={true}
                label={`${sectionCategory.label} Type`}
              />
            )}
          </AppField>
        : <>
            <AppField
              name={`${formPath}.category`}
              validators={fieldValidators({
                onBlur: 'Select an equipment category',
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => (
                <DropdownField options={systemEquipment.categories} required={true} label='Equipment Category' />
              )}
            </AppField>
            <AppField
              name={`${formPath}.${path as 'properties' | 'equipment'}.${
                sectionCategory.id === ProfCats.EQUIPMENT ? 'properties' : 'ids'
              }`}
              validators={fieldValidators({
                onBlur: 'Select at leaset one property',
                condition: sectionCategory.id === ProfCats.EQUIPMENT,
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => (
                <DropdownField
                  multiselect={true}
                  options={systemEquipment.properties.filterByCategory(propsCat !== null ? propsCat : equipCat)}
                  required={sectionCategory.id === ProfCats.EQUIPMENT ? false : true}
                  label='Equipment Properties'
                />
              )}
            </AppField>
            {sectionCategory.id === ProfCats.EQUIPMENT && (
              <AppField
                name={`${formPath}.${path as 'equipment'}.ids`}
                validators={fieldValidators({
                  onBlur: 'Select at leaset one equipment',
                })}
                listeners={fieldListeners}
              >
                {({ DropdownField }) => (
                  <DropdownField
                    multiselect={true}
                    options={equipment
                      .filter((e) => equipMeta.categories.find((c) => c.id === equipCat)?.equipmentIds.includes(e.id))
                      .filter((e) =>
                        equipMeta.properties?.some((p) =>
                          propsCat ?
                            propsProps?.includes(p.id)
                          : equipProps?.includes(p.id) && p.equipmentIds.includes(e.id)
                        )
                      )}
                    required={true}
                    label='Equipment'
                  />
                )}
              </AppField>
            )}
          </>)}
      {subtypeSpecific && subtypes?.length && (
        <AppField
          name={`${formPath}.subtype`}
          validators={fieldValidators({
            onBlur: 'Select a subtype',
          })}
        >
          {({ DropdownField }) => <DropdownField options={subtypes} required={true} label='Subclass Subtype' />}
        </AppField>
      )}
      {providesOptions && (
        <AppField
          name={`${formPath}.selectionCount`}
          validators={fieldValidators({
            onBlur: 'Enter a number of selections allowed',
            onChange: { type: 'number', min: 1, name: 'selectionCount' },
          })}
        >
          {({ TextField }) => <TextField required={true} label='# of Selections' />}
        </AppField>
      )}
      {hasPrerequisites && <Prerequisites />}
    </Stack>
  )
}

export default Expertise
