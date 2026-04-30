import { Fragment, useEffect, useState, useMemo, useCallback } from 'react'
import { Categories, Sections } from '@enums'
import { useEnumChecks, useSystemData, useFieldUpdates, useFormField } from '@hooks'
import type { SpellListItem, FormDataType, CharacterInput, SpellInput } from '@types'
import { Stack, Text } from '@mantine/core'
import { LimitUse, Prerequisites } from '@components/Form'
import { SpellsByLevelInputSchema } from '@artificer-toolkit/shared/schemas'
import { useOptimizedSelector, useTypedFormStore } from '@store'
import { useListSpells, useListClasses } from '@apis'
import { v4 as uuidv4 } from 'uuid'
import type { UnionToIntersection, SetOptional } from 'type-fest'

type FeaturePath
  = | `ancestry.options[${number}].features[${number}].spells[${number}]`
    | `ancestry.options[${number}].features[${number}].options[${number}].spells[${number}]`
    | `features[${number}].spells[${number}]`
    | `features[${number}].options[${number}].spells[${number}]`

type StoreType = UnionToIntersection<SetOptional<Exclude<FormDataType, CharacterInput | SpellInput>, '__kind'>>

const Spells = () => {
  const store = useTypedFormStore<StoreType>()

  const { AppField } = useFormField({ store })

  const {
    updateField,
    category,
    subtypes,
    formAttributes,
    formClassLimit,
    formAttributeLimit,
    formSpellsByLevel,
    formLevelLimit,
    meta,
    stateKind
  } = useOptimizedSelector(store, (state) => {
    const { ancestryOptionIndex, featureIndex, optionIndex, sectionIndex } = state.meta.editing

    const feature
      = featureIndex !== null
        ? ancestryOptionIndex !== null && state.current?.__kind === 'RaceInput'
          ? state.current?.ancestry?.options?.[ancestryOptionIndex]?.features?.[featureIndex]
          : state.current?.features?.[featureIndex]
        : undefined

    const option = feature && (optionIndex !== null ? feature?.options?.[optionIndex] : undefined)

    const section = option ? option?.spells?.[sectionIndex || 0] : feature?.spells?.[sectionIndex || 0]

    return {
      updateField: state.updateField,
      category: feature?.category,
      subtypes: state.current?.__kind === 'ClassInput' ? state.current?.subtypes : undefined,
      formAttributes: section?.attributes,
      formClassLimit: section?.classLimit,
      formAttributeLimit: section?.attributeLimit,
      formSpellsByLevel: section?.spellsByLevel,
      formLevelLimit: section?.levelLimit,
      meta: state.meta,
      stateKind: state.current?.__kind
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
    segments.push(`spells[${meta.editing.sectionIndex || 0}]`)

    return segments.join('.') + '.'
  }, [meta, stateKind])

  const formPath = useMemo(() => {
    return computePath()
  }, [computePath]) as FeaturePath

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const { attributes, abilities } = useSystemData()

  const {
    data: { spells, metaData: spellMetaData }
  } = useListSpells()

  const {
    data: { classes }
  } = useListClasses()

  const { getAttributes } = useEnumChecks()

  const {
    spellsByLevel,
    classLimit,
    levelLimit,
    attributeLimit,
    subtypeSpecific,
    castAtLevel,
    optionalAbility,
    hasPrerequisites,
    limitUse,
    providesOptions
  } = getAttributes({
    attributes: formAttributes ?? []
  })

  const [spellsArray, setSpellsArray] = useState<SpellListItem[]>([])

  // Set spells array
  useEffect(() => {
    const filteredSpells = spells?.filter((spell) => {
      let meetsClassLimit: boolean = true
      let meetsLevelLimit: boolean = true
      let meetsAttributeLimit: boolean = true

      // Check against classLimit filter
      if (formClassLimit?.length) {
        meetsClassLimit
          = !formClassLimit
            || formClassLimit?.some((limit) => spellMetaData.classes.find((c) => c.id === limit)?.spellIds?.includes(spell.id))
      }

      // Check against levelLimit filter
      if (formLevelLimit?.length) {
        meetsLevelLimit = formLevelLimit?.includes(
          String(spellMetaData.levels?.find((level) => level.spellIds?.includes(spell.id))?.id)
        )
      }

      if (formAttributeLimit?.length) {
        meetsAttributeLimit = formAttributeLimit?.some((limitItem) => spellMetaData.attributes?.find((a) => a.id === limitItem)?.spellIds?.includes(spell.id))
      }

      // Combine filter conditions using logical AND operator
      return meetsClassLimit && meetsLevelLimit && meetsAttributeLimit
    })

    setSpellsArray(filteredSpells)
  }, [
    spells, formClassLimit, formLevelLimit, formAttributeLimit, spellMetaData
  ])

  // Add/Remove Spells By Level Data
  useEffect(() => {
    if (!spellsByLevel && formSpellsByLevel) {
      updateField({ path: `${formPath}.spellsByLevel`, value: undefined })
    }
    if (spellsByLevel && !formSpellsByLevel) {
      const spellsByLevelObject = SpellsByLevelInputSchema.parse({
        id: uuidv4(),
        __kind: 'SpellsByLevelInput'
      })
      updateField({ path: `${formPath}.spellsByLevel`, value: [spellsByLevelObject] })
    }
  }, [
    formSpellsByLevel, spellsByLevel, formPath, updateField
  ])

  return (
    <Stack>
      <AppField name={`${formPath}.attributes`} listeners={fieldListeners}>
        {({ DropdownField }) => (
          <DropdownField
            multiselect={true}
            options={attributes.filter(
              (attribute) => attribute?.sections?.length
                && (attribute.sections.includes(Sections.SPELL)
                  || attribute.sections.includes(Sections.ALL)
                  || (category === Categories.SUBCLASS && attribute.sections.includes(Sections.SUBCLASS)))
            )}
            label="Spell Attributes"
          />
        )}
      </AppField>
      {classLimit && (
        <AppField
          name={`${formPath}.classLimit`}
          validators={fieldValidators({
            onBlur: 'Select a class limit'
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <DropdownField multiselect={true} options={classes} label="Class Limit" required={true} />
          )}
        </AppField>
      )}
      {levelLimit && (
        <AppField
          name={`${formPath}.levelLimit`}
          validators={fieldValidators({
            onBlur: 'Select a level limit'
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <DropdownField
              multiselect={true}
              options={spellMetaData?.levels.map((l) => ({
                id: String(l.id),
                label: l.id,
                value: l.id
              }))}
              label="Level Limit"
              required={true}
            />
          )}
        </AppField>
      )}
      {attributeLimit && (
        <AppField
          name={`${formPath}.attributeLimit`}
          validators={fieldValidators({
            onBlur: 'Select an attribute limit'
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <DropdownField
              multiselect={true}
              options={attributes.filter(
                (attribute) => attribute?.sections?.length && attribute.sections.includes(Sections.SPELL)
              )}
              label="Attribute Limit"
              required={true}
            />
          )}
        </AppField>
      )}
      {subtypeSpecific && subtypes?.length && (
        <AppField
          name={`${formPath}.subtype`}
          validators={fieldValidators({
            onBlur: 'Select a subtype'
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => <DropdownField options={subtypes} label="Subtype" required={true} />}
        </AppField>
      )}
      {!spellsByLevel && (
        <>
          <AppField
            name={`${formPath}.ids`}
            validators={fieldValidators({
              onBlur: 'Select at least one spell'
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <DropdownField multiselect={true} options={spellsArray} label="Spells" required={true} />
            )}
          </AppField>
          {castAtLevel && (
            <AppField
              name={`${formPath}.spellLevel`}
              validators={fieldValidators({
                onBlur: 'Please set a spell level to cast the spell at',
                onChange: { type: 'integer', name: 'Spell level', min: 1 }
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => <TextField label="Spell Level" required={true} />}
            </AppField>
          )}
          {optionalAbility && (
            <AppField
              name={`${formPath}.ability`}
              validators={fieldValidators({
                onBlur: 'Select the optional ability'
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => <DropdownField options={abilities} label="Ability" required={true} />}
            </AppField>
          )}
          {providesOptions && (
            <AppField
              name={`${formPath}.selectionCount`}
              validators={fieldValidators({
                onBlur: 'Please set an amount of allowed selections',
                onChange: { type: 'integer', name: 'Selection count', min: 1 }
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => <TextField label="# of Selections" required={true} />}
            </AppField>
          )}
        </>
      )}
      {spellsByLevel && (
        <>
          <Text>Level</Text>
          <Text>Spell</Text>
          {castAtLevel && <Text>Die Value</Text>}
          <AppField name={`${formPath}.spellsByLevel`} mode="array">
            {({ state }) => state.value?.map((_, i) => (
              <Fragment key={`spellsByLevel-${i}`}>
                <AppField
                  name={`${formPath}.spellsByLevel[${i}].level`}
                  validators={fieldValidators({
                    onBlur: 'Select a spell level'
                  })}
                  listeners={fieldListeners}
                >
                  {({ DropdownField }) => <DropdownField options={spells} required={true} />}
                </AppField>
                <AppField
                  name={`${formPath}.spellsByLevel[${i}].ids`}
                  validators={fieldValidators({
                    onBlur: 'Select at least one spell'
                  })}
                  listeners={fieldListeners}
                >
                  {({ DropdownField }) => <DropdownField multiselect={true} options={spells} required={true} />}
                </AppField>
                {castAtLevel && (
                  <AppField
                    name={`${formPath}.spellsByLevel[${i}].spellLevel`}
                    validators={fieldValidators({
                      onBlur: 'Please set a spell level to cast the spell at',
                      onChange: { type: 'integer', name: 'Spell level', min: 1 }
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => <TextField label="Spell Level" required={true} />}
                  </AppField>
                )}
              </Fragment>
            ))}
          </AppField>
        </>
      )}
      {hasPrerequisites && <Prerequisites />}
      {limitUse && <LimitUse />}
    </Stack>
  )
}

export default Spells
