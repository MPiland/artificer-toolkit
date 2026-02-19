import { Fragment, useEffect, useState } from 'react'
import { Attributes, Categories, ModCats, ModMethods, ModSpellCats, ModTypes, Ranges, Sections } from '@enums'
import { getKeyFromId, Prerequisites } from '@components/Form'
import { useEnumChecks, useFieldUpdates, useSystemData, useFormField } from '@hooks'
import type { GenericType, SpellListItem, FormDataType, CharacterInput, SpellInput } from '@types'
import { Stack, Text } from '@mantine/core'
import { ModifierDiePerLevelInputSchema, ModifierSetPerLevelInputSchema } from '@artificer-toolkit/shared/schemas'
import Collapsible from '@components/Collapse'
import { useOptimizedSelector, useTypedFormStore } from '@store'
import { useListFeatures, useListSpells } from '@apis'
import { getModifierProperties } from '@utils'
import type { UnionToIntersection, SetOptional } from 'type-fest'
import { useMemo, useCallback } from 'react'

type FeaturePath
  = | `ancestry.options[${number}].features[${number}].modifiers[${number}]`
    | `ancestry.options[${number}].features[${number}].options[${number}].modifiers[${number}]`
    | `features[${number}].modifiers[${number}]`
    | `features[${number}].options[${number}].modifiers[${number}]`

type StoreType = UnionToIntersection<SetOptional<Exclude<FormDataType, CharacterInput | SpellInput>, '__kind'>>

const Modifiers = () => {
  const store = useTypedFormStore<StoreType>()

  const { AppField } = useFormField({ store })

  const {
    category,
    subtypes,
    spellCategory,
    type,
    method,
    diePerLevel,
    setPerLevel,
    range,
    formAttributes,
    formCategory,
    meta,
    stateKind,
    updateField
  } = useOptimizedSelector(store, (state) => {
    const { ancestryOptionIndex, featureIndex, optionIndex, sectionIndex } = state.meta.editing

    const feature
      = featureIndex !== null
        ? ancestryOptionIndex !== null && state.current?.__kind === 'RaceInput'
          ? state.current?.ancestry?.options?.[ancestryOptionIndex]?.features?.[featureIndex]
          : state.current?.features?.[featureIndex]
        : undefined

    const option = feature && (optionIndex !== null ? feature?.options?.[optionIndex] : undefined)

    const section = option ? option?.modifiers?.[sectionIndex || 0] : feature?.modifiers?.[sectionIndex || 0]

    return {
      updateField: state.updateField,
      category: feature?.category,
      subtypes: state.current?.__kind === 'ClassInput' ? state.current?.subtypes : undefined,
      formAttributes: section?.attributes,
      formCategory: section?.category,
      spellCategory: section?.spellCategory,
      type: section?.type,
      method: section?.method,
      diePerLevel: section?.diePerLevel,
      setPerLevel: section?.setPerLevel,
      range: section?.range,
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
    segments.push(`modifiers[${meta.editing.sectionIndex || 0}]`)

    return segments.join('.') + '.'
  }, [meta, stateKind])

  const formPath = useMemo(() => {
    return computePath()
  }, [computePath]) as FeaturePath

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const {
    data: { features }
  } = useListFeatures()
  const {
    modifiers,
    attributes,
    conditions,
    damageTypes,
    abilities,
    spells: systemSpells,
    rules,
    skills,
    charges,
    speeds
  } = useSystemData()
  const {
    data: { spells, metaData: spellMetaData }
  } = useListSpells()
  const { getAttributes } = useEnumChecks()

  const [modTypes, setModTypes] = useState<GenericType[]>([])
  const [modMethods, setModMethods] = useState<GenericType[] | null>(null)
  const [spellsArray, setSpellsArray] = useState<SpellListItem[]>([])
  const [typeOptions, setTypeOptions] = useState<boolean>(false)

  // Set if selected category has type options
  useEffect(() => {
    setTypeOptions(
      formCategory === ModCats.DAMAGE_TYPES
      || formCategory === ModCats.ABILITY_SCORES
      || formCategory === ModCats.SAVE_ABILITY
      || formCategory === ModCats.CONDITIONS
      || formCategory === ModCats.CONDITION_SAVE
      || formCategory === ModCats.DAMAGE_SAVE
      || formCategory === ModCats.SPEEDS
      || formCategory === ModCats.SPELL_DAMAGE
    )
  }, [formCategory])

  const options = {
    damageTypes: damageTypes,
    conditions: conditions,
    abilities: abilities,
    speeds: speeds
  } as const

  // Set modTypes and modMethods options
  useEffect(() => {
    let types: GenericType[] = []
    if (formCategory === ModCats.SPELL) {
      types = modifiers.types.filterByCategory(spellCategory) || []
    } else {
      types = modifiers.types.filterByCategory(formCategory) || []
    }

    if (types?.length) {
      setModTypes(types)
    }
    if (modTypes?.length) {
      if (formCategory === ModCats.SPELL) {
        const methods = modifiers.methods.filterByCategory(spellCategory) || []

        setModMethods(methods)
      } else {
        const methods = modifiers.methods.filterByTypeAndCategory(type, formCategory)

        setModMethods(methods)
      }
    }
  }, [
    modTypes, spellCategory, formCategory, type, modifiers
  ])

  // Filter spells array
  useEffect(() => {
    const filteredSpells = spells?.filter((spell) => {
      if (spellCategory === ModSpellCats.SPELL_DAMAGE) {
        return spellMetaData?.attributes
          ?.find((attribute) => attribute.id === Attributes.DOES_DAMAGE)
          ?.spellIds?.includes(spell.id)
      }
      if (
        spellCategory === ModSpellCats.SPELL_RANGE
        && spellMetaData.ranges?.find((range) => range.spellIds?.includes(spell.id)) != null
      ) {
        return true
      }
      if (
        spellCategory === ModSpellCats.SPELL_SHAPE
        && spellMetaData.shapes?.find((shape) => shape.spellIds?.includes(spell.id)) != null
      ) {
        return true
      }
      if (
        spellCategory === ModSpellCats.SPELL_DURATION
        && spellMetaData.durations?.find((duration) => duration.spellIds?.includes(spell.id)) != null
      ) {
        return true
      }
      return false
    })
    setSpellsArray(filteredSpells)
  }, [spellCategory, spells, spellMetaData])

  // Add/Remove die per level Table
  useEffect(() => {
    if (
      ((type !== ModTypes.SET_DIE && type !== ModTypes.BONUS_DIE && type !== ModTypes.PENALTY_DIE)
        || method !== ModMethods.SET_PER_LEVEL
        || !modMethods?.some((method) => method.id === ModMethods.SET_PER_LEVEL))
      && diePerLevel?.length
    ) {
      updateField({ path: `${formPath}.diePerLevel`, value: undefined })
    }
    if (
      (type === ModTypes.SET_DIE || type === ModTypes.BONUS_DIE || type === ModTypes.PENALTY_DIE)
      && method === ModMethods.SET_PER_LEVEL
      && modMethods?.some((method) => method.id === ModMethods.SET_PER_LEVEL)
      && (!diePerLevel || !diePerLevel?.length)
    ) {
      const modifierInputObject = ModifierDiePerLevelInputSchema.parse({})
      updateField({ path: `${formPath}.diePerLevel`, value: [modifierInputObject] })
    }
  }, [
    type, method, modMethods, diePerLevel, updateField, formPath
  ])

  // Add/remove setPerLevel table
  useEffect(() => {
    if (
      ((type !== ModTypes.SET_AMOUNT && type !== ModTypes.BONUS && type !== ModTypes.PENALTY)
        || method !== ModMethods.SET_PER_LEVEL
        || !modMethods?.some((method) => method.id === ModMethods.SET_PER_LEVEL))
      && setPerLevel?.length
    ) {
      updateField({ path: `${formPath}.setPerLevel`, value: undefined })
    }
    if (
      (type === ModTypes.SET_AMOUNT || type === ModTypes.BONUS || type === ModTypes.PENALTY)
      && method === ModMethods.SET_PER_LEVEL
      && modMethods?.some((method) => method.id === ModMethods.SET_PER_LEVEL)
      && (!setPerLevel || !setPerLevel?.length)
    ) {
      const modifierInputObject = ModifierSetPerLevelInputSchema.parse({})
      updateField({ path: `${formPath}.setPerLevel`, value: [modifierInputObject] })
    }
  }, [
    type, method, setPerLevel, modMethods, updateField, formPath
  ])

  const sectionCategory = modifiers.categories.findCategory(formCategory)
  const categoryName = getKeyFromId(formCategory || '', { ...ModCats, ...ModSpellCats })
  const path = getModifierProperties({
    category: categoryName
  })
  const { subtypeSpecific, providesOptions, hasPrerequisites } = getAttributes({
    attributes: formAttributes || []
  })

  return (
    <Stack>
      <AppField name={`${formPath}.attributes`} listeners={fieldListeners}>
        {({ DropdownField }) => (
          <DropdownField
            multiselect={true}
            label="Attrbutes"
            options={attributes.filter(
              (attribute) => attribute?.sections?.length
                && attribute?.sections?.includes(Sections.ALL)
                && category === Categories.SUBCLASS
                && attribute?.sections?.includes(Sections.SUBCLASS)
            )}
          />
        )}
      </AppField>
      <AppField
        name="category"
        validators={fieldValidators({
          onBlur: 'Select a category'
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => (
          <DropdownField label="Modifier Category" options={modifiers.categories} required={true} />
        )}
      </AppField>
      {formCategory === ModCats.SPELL && (
        <>
          <AppField
            name={`${formPath}.spellCategory`}
            validators={fieldValidators({
              onBlur: 'Select a spell category'
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <DropdownField label="Spell Category" options={modifiers.spellCategories} required={true} />
            )}
          </AppField>
          <AppField
            name={`${formPath}.spells`}
            validators={fieldValidators({
              onBlur: 'Select at least one spell'
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <DropdownField label="Spells" multiselect={true} options={spellsArray} required={true} />
            )}
          </AppField>
        </>
      )}
      {modTypes?.length && sectionCategory != null && (
        <AppField
          name={`${formPath}.type`}
          validators={fieldValidators({
            onBlur: 'Select a modifier type'
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => <DropdownField label="Modifier Type" options={modTypes} required={true} />}
        </AppField>
      )}
      {modMethods?.length && (
        <AppField
          name={`${formPath}.method`}
          validators={fieldValidators({
            onBlur: 'Select a modifier method'
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => <DropdownField label="Modifier Method" options={modMethods} required={true} />}
        </AppField>
      )}
      {path && typeOptions && formCategory !== ModCats.SPELL && formCategory != null && (
        <AppField
          name={`${formPath}.${path}`}
          validators={fieldValidators({
            onBlur: 'Select a modifier method'
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <DropdownField
              label="Modifier Method"
              multiselect={true}
              options={
                formCategory === ModCats.SAVE_ABILITY
                  ? abilities
                  : formCategory === ModCats.CONDITION_SAVE
                    ? conditions
                    : formCategory === ModCats.SPELL_DC || formCategory === ModCats.DAMAGE_SAVE
                      ? damageTypes
                      : options[path as 'damageTypes' | 'conditions' | 'abilities' | 'speeds']
              }
              required={true}
            />
          )}
        </AppField>
      )}
      {formCategory === ModCats.CHARGE && type === ModTypes.USE_RESET && (
        <>
          <AppField
            name={`${formPath}.charges.reset`}
            validators={fieldValidators({
              onBlur: 'Select a reset option'
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => <DropdownField label="Reset Option" options={charges.resets} required={true} />}
          </AppField>
          <AppField
            name={`${formPath}.chargeFeature`}
            validators={fieldValidators({
              onBlur: 'Select a feature'
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <DropdownField
                label="Feature"
                options={
                  features?.map((feature) => ({
                    id: feature.id,
                    label: feature?.label || feature?.id
                  })) ?? []
                }
                required={true}
              />
            )}
          </AppField>
        </>
      )}
      {formCategory === ModCats.SPELL
        && (spellCategory === ModSpellCats.SPELL_DURATION
          ? (
              <>
                <AppField
                  name={`${formPath}.duration`}
                  validators={fieldValidators({
                    onBlur: 'Select a spell duration type'
                  })}
                  listeners={fieldListeners}
                >
                  {({ DropdownField }) => (
                    <DropdownField label="Spell Duration Type" options={systemSpells.durations} required={true} />
                  )}
                </AppField>
                {type === ModTypes.SET_AMOUNT && (
                  <AppField
                    name={`${formPath}.setAmount`}
                    validators={fieldValidators({
                      onBlur: 'Set a duration increment amount',
                      onChange: { type: 'integer', min: 1, name: 'Duration increment' }
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => <TextField label="Duration Increment" required={true} />}
                  </AppField>
                )}
              </>
            )
          : spellCategory === ModSpellCats.SPELL_RANGE
            ? (
                <>
                  <AppField
                    name={`${formPath}.range`}
                    validators={fieldValidators({ onBlur: 'Select a spell range type' })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <DropdownField label="Spell Range Type" options={systemSpells.ranges} required={true} />
                    )}
                  </AppField>
                  {type === ModTypes.SET_AMOUNT && (
                    <>
                      <AppField
                        name={`${formPath}.minAmount`}
                        validators={fieldValidators({
                          onBlur: 'Set a min range amount',
                          onChange: { type: 'number', min: 0, name: 'Min. range amount' }
                        })}
                        listeners={fieldListeners}
                      >
                        {({ TextField }) => <TextField label="Min Range Amount" required={true} />}
                      </AppField>
                      <AppField
                        name={`${formPath}.maxAmount`}
                        validators={fieldValidators({
                          onBlur: 'Set a max range amount',
                          onChange: { type: 'integer', min: 1, name: 'Max range amount' }
                        })}
                        listeners={fieldListeners}
                      >
                        {({ TextField }) => <TextField label="Max Range Amount" required={true} />}
                      </AppField>
                      <AppField
                        name={`${formPath}.unit`}
                        validators={fieldValidators({
                          onBlur: 'Select a unit of measurement',
                          condition: range === Ranges.DISTANCE
                        })}
                        listeners={fieldListeners}
                      >
                        {({ DropdownField }) => (
                          <DropdownField
                            label="Spell Range UoM"
                            options={rules.measurements.imperial.length}
                            required={range === Ranges.DISTANCE ? true : false}
                          />
                        )}
                      </AppField>
                    </>
                  )}
                </>
              )
            : spellCategory === ModSpellCats.SPELL_SHAPE && (
              <>
                <AppField
                  name={`${formPath}.shape`}
                  validators={fieldValidators({
                    onBlur: 'Select a spell shape type'
                  })}
                  listeners={fieldListeners}
                >
                  {({ DropdownField }) => (
                    <DropdownField label="Spell Shape Type" options={systemSpells.shapes} required={true} />
                  )}
                </AppField>
                {type === ModTypes.SET_AMOUNT && (
                  <>
                    <AppField
                      name={`${formPath}.size`}
                      validators={fieldValidators({
                        onBlur: 'Set a max range amount',
                        onChange: { type: 'number', min: 1, name: 'Max range amount' }
                      })}
                      listeners={fieldListeners}
                    >
                      {({ TextField }) => <TextField label="Shape Size Amount" required={true} />}
                    </AppField>
                    <AppField
                      name={`${formPath}.unit`}
                      validators={fieldValidators({
                        onBlur: 'Select a unit of measurement',
                        condition: range === Ranges.DISTANCE
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => (
                        <DropdownField
                          label="Spell Range UoM"
                          options={rules.measurements.imperial.length}
                          required={true}
                        />
                      )}
                    </AppField>
                  </>
                )}
              </>
            ))}
      {method != null && method !== ModMethods.SET_PER_LEVEL && (
        <>
          {(type === ModTypes.BONUS || type === ModTypes.SET_AMOUNT) && (
            <>
              {method === ModMethods.SET_GLOBALLY
                ? (
                    <AppField
                      name={`${formPath}.setAmount`}
                      validators={fieldValidators({
                        onBlur: 'Set an amount',
                        onChange: { type: 'integer', min: 1, name: 'Amount' }
                      })}
                      listeners={fieldListeners}
                    >
                      {({ TextField }) => <TextField label="Set Amount" required={true} />}
                    </AppField>
                  )
                : method === ModMethods.ABILITY_SCORE_MODIFIER
                  ? (
                      <AppField
                        name={`${formPath}.methodAbility`}
                        validators={fieldValidators({
                          onBlur: 'Select an  ability'
                        })}
                        listeners={fieldListeners}
                      >
                        {({ DropdownField }) => <DropdownField label="Method Ability" options={abilities} required={true} />}
                      </AppField>
                    )
                  : method === ModMethods.SKILL_MODIFIER && (
                    <AppField
                      name={`${formPath}.methodSkill`}
                      validators={fieldValidators({
                        onBlur: 'Select a skill'
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => <DropdownField label="Method Skill" options={skills} required={true} />}
                    </AppField>
                  )}
            </>
          )}
          {method !== ModMethods.SET_GLOBALLY && (
            <>
              <AppField
                name={`${formPath}.multiplier`}
                validators={fieldValidators({
                  onChange: { type: 'integer', min: 1, name: 'Multiplier' }
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => <TextField label="Multiplier" />}
              </AppField>
              <AppField
                name={`${formPath}.minAmount`}
                validators={fieldValidators({
                  onChange: { type: 'integer', min: 1, name: 'Min. amount' }
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => <TextField label="Min Amount" />}
              </AppField>
            </>
          )}
        </>
      )}
      {subtypeSpecific && subtypes?.length && (
        <AppField
          name={`${formPath}.subtype`}
          validators={fieldValidators({
            onBlur: 'Select a subtype'
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => <DropdownField label="Subtype" options={subtypes} required={true} />}
        </AppField>
      )}
      {providesOptions && (
        <AppField
          name={`${formPath}.selectionCount`}
          validators={fieldValidators({
            onChange: { type: 'integer', min: 1, name: 'Selection amount' }
          })}
          listeners={fieldListeners}
        >
          {({ TextField }) => <TextField label="# of Selections" required={true} />}
        </AppField>
      )}
      {hasPrerequisites && <Prerequisites />}
      {method === ModMethods.SET_PER_LEVEL && diePerLevel?.length && (
        <Collapsible
          props={{
            trigger: {
              title: 'Die Per Level'
            }
          }}
        >
          Level Die Config
          <AppField name={`${formPath}.diePerLevel`} mode="array">
            {({ state }) => state.value?.map((_, i) => (
              <Fragment key={`diePerLevel-${i}`}>
                <AppField
                  name={`${formPath}.diePerLevel[${i}].level`}
                  validators={fieldValidators({
                    onBlur: 'Level is required',
                    onChange: { type: 'integer', min: 1, name: 'Level' }
                  })}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => <TextField required={true} />}
                </AppField>
                <AppField
                  name={`${formPath}.diePerLevel[${i}].dieConfig`}
                  validators={fieldValidators({
                    onBlur: 'Please enter a die configuration',
                    onChange: { type: 'die', name: 'Die configuration' }
                  })}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => <TextField required={true} />}
                </AppField>
              </Fragment>
            ))}
          </AppField>
        </Collapsible>
      )}
      {method === ModMethods.SET_PER_LEVEL && setPerLevel?.length && (
        <Collapsible
          props={{
            trigger: {
              title: 'Set Per Level'
            }
          }}
        >
          <Text>Level</Text>
          <Text>Amount</Text>
          <AppField name={`${formPath}.setPerLevel`} mode="array">
            {({ state }) => state.value?.map((_, i) => (
              <Fragment key={`setPerLevel-${i}`}>
                <AppField
                  name={`${formPath}.setPerLevel[${i}].level`}
                  validators={fieldValidators({
                    onBlur: 'Level is required',
                    onChange: { type: 'integer', min: 1, name: 'Level' }
                  })}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => <TextField required={true} />}
                </AppField>
                <AppField
                  name={`${formPath}.setPerLevel[${i}].setAmount`}
                  validators={fieldValidators({
                    onBlur: 'Please enter an amount',
                    onChange: { type: 'integer', min: 1, name: 'Set amount' }
                  })}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => <TextField required={true} />}
                </AppField>
              </Fragment>
            ))}
          </AppField>
        </Collapsible>
      )}
    </Stack>
  )
}

export default Modifiers
