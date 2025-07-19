import { useEffect, useState } from 'react'
import { Attributes, Categories, ModCats, ModMethods, ModSpellCats, ModTypes, Ranges, Sections } from '@/enums'
import { getKeyFromId, getModifierProperties, useAppForm, Prerequisites } from '@/components/Form'
import { useEnumChecks, useFeatureData, useFieldUpdates } from '@/hooks'
import { useSystemData, useSpellData } from '@/hooks'
import type { GenericType, SpellListItem, SubtypeInput } from '@/types'
import { Grid } from '@mantine/core'
import { FeatureModifierInputSchema, ModifierDiePerLevelInputSchema, ModifierSetPerLevelInputSchema } from '@/schemas'
import { useStore } from '@tanstack/react-form'
import Collapsible from '@/components/Collapse'
import {} from '@/components/Form'
import { useFormStore, useFeatureModifierStore } from '@/store'

type ModifiersProps = {
  category?: string
  __kind?: 'ClassInput' | 'RaceInput' | 'EquipmentInput' | 'BackgroundInput' | 'FeatInput'
  subtypes?: SubtypeInput[]
}

const Modifiers = ({ category, subtypes }: ModifiersProps) => {
  const modifierStore = useFeatureModifierStore()

  const formStore = useFormStore()

  const __kind = formStore.current?.__kind

  const form = useAppForm({
    defaultValues: FeatureModifierInputSchema.parse(modifierStore.current),
  })

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'modifier' })

  const { AppField, Subscribe } = form

  const { features } = useFeatureData()

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
    speeds,
  } = useSystemData()
  const { spells, metaData: spellMetaData } = useSpellData()

  const { getAttributes } = useEnumChecks()

  const [modTypes, setModTypes] = useState<GenericType[]>([])
  const [modMethods, setModMethods] = useState<GenericType[] | null>(null)
  const [spellsArray, setSpellsArray] = useState<SpellListItem[]>([])
  const [typeOptions, setTypeOptions] = useState<boolean>(false)

  const { formCategory, spellCategory, type, method, diePerLevel, setPerLevel } = useStore(form.store, (state) => ({
    formCategory: state.values.category,
    spellCategory: state.values.spellCategory,
    type: state.values.type,
    method: state.values.method,
    diePerLevel: state.values.diePerLevel,
    setPerLevel: state.values.setPerLevel,
  }))

  // Set if selected category has type options
  useEffect(() => {
    setTypeOptions(
      formCategory === ModCats.DAMAGE_TYPES ||
        formCategory === ModCats.ABILITY_SCORES ||
        formCategory === ModCats.SAVE_ABILITY ||
        formCategory === ModCats.CONDITIONS ||
        formCategory === ModCats.CONDITION_SAVE ||
        formCategory === ModCats.DAMAGE_SAVE ||
        formCategory === ModCats.SPEEDS ||
        formCategory === ModCats.SPELL_DAMAGE
    )
  }, [formCategory])

  const options = {
    damageTypes: damageTypes,
    conditions: conditions,
    abilities: abilities,
    speeds: speeds,
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
  }, [modTypes, spellCategory, formCategory, type, modifiers])

  // Filter spells array
  useEffect(() => {
    const filteredSpells = spells?.filter((spell) => {
      if (spellCategory === ModSpellCats.SPELL_DAMAGE) {
        return spellMetaData?.attributes
          ?.find((attribute) => attribute.id === Attributes.DOES_DAMAGE)
          ?.spellIds?.includes(spell.id)
      }
      if (
        spellCategory === ModSpellCats.SPELL_RANGE &&
        spellMetaData.ranges?.find((range) => range.spellIds?.includes(spell.id)) != null
      ) {
        return true
      }
      if (
        spellCategory === ModSpellCats.SPELL_SHAPE &&
        spellMetaData.shapes?.find((shape) => shape.spellIds?.includes(spell.id)) != null
      ) {
        return true
      }
      if (
        spellCategory === ModSpellCats.SPELL_DURATION &&
        spellMetaData.durations?.find((duration) => duration.spellIds?.includes(spell.id)) != null
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
      ((type !== ModTypes.SET_DIE && type !== ModTypes.BONUS_DIE && type !== ModTypes.PENALTY_DIE) ||
        method !== ModMethods.SET_PER_LEVEL ||
        !modMethods?.some((method) => method.id === ModMethods.SET_PER_LEVEL)) &&
      diePerLevel?.length
    ) {
      form.setFieldValue('diePerLevel', undefined)
      modifierStore.removeField({ path: 'diePerLevel' })
    }
    if (
      (type === ModTypes.SET_DIE || type === ModTypes.BONUS_DIE || type === ModTypes.PENALTY_DIE) &&
      method === ModMethods.SET_PER_LEVEL &&
      modMethods?.some((method) => method.id === ModMethods.SET_PER_LEVEL) &&
      (!diePerLevel || !diePerLevel?.length)
    ) {
      const modifierInputObject = ModifierDiePerLevelInputSchema.parse({})
      form.setFieldValue('diePerLevel', [modifierInputObject])
      modifierStore.updateField({ path: 'diePerLevel', value: [modifierInputObject] })
    }
  }, [type, method, modMethods, diePerLevel, form, modifierStore])

  // Add/remove setPerLevel table
  useEffect(() => {
    if (
      ((type !== ModTypes.SET_AMOUNT && type !== ModTypes.BONUS && type !== ModTypes.PENALTY) ||
        method !== ModMethods.SET_PER_LEVEL ||
        !modMethods?.some((method) => method.id === ModMethods.SET_PER_LEVEL)) &&
      setPerLevel?.length
    ) {
      form.setFieldValue('setPerLevel', undefined)
      modifierStore.removeField({ path: 'setPerLevel' })
    }
    if (
      (type === ModTypes.SET_AMOUNT || type === ModTypes.BONUS || type === ModTypes.PENALTY) &&
      method === ModMethods.SET_PER_LEVEL &&
      modMethods?.some((method) => method.id === ModMethods.SET_PER_LEVEL) &&
      (!setPerLevel || !setPerLevel?.length)
    ) {
      const modifierInputObject = ModifierSetPerLevelInputSchema.parse({})
      form.setFieldValue('setPerLevel', [modifierInputObject])
      modifierStore.updateField({ path: 'setPerLevel', value: [modifierInputObject] })
    }
  }, [type, method, setPerLevel, modMethods, form, modifierStore])

  useEffect(() => {
    if (!modifierStore.formReset) {
      modifierStore.registerFormReset(form.reset)
    }
  }, [form.reset, modifierStore])

  useEffect(() => {
    return form.store.subscribe((state) => {
      const isValid = state.currentVal.isValid
      if (modifierStore.current?.id && modifierStore.valid.get(modifierStore.current.id) !== isValid) {
        modifierStore.upsertValid(modifierStore.current.id, isValid)
      }
    })
  }, [modifierStore, form.store])

  return (
    <>
      <Grid>
        <AppField name='attributes' listeners={fieldListeners}>
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField
                multiselect={true}
                label='Attrbutes'
                options={attributes.filter(
                  (attribute) =>
                    attribute?.sections?.length &&
                    attribute?.sections?.includes(Sections.ALL) &&
                    category === Categories.SUBCLASS &&
                    attribute?.sections?.includes(Sections.SUBCLASS)
                )}
              />
            </Grid.Col>
          )}
        </AppField>
        <AppField
          name='category'
          validators={fieldValidators({
            onBlur: 'Select a category',
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField label='Modifier Category' options={modifiers.categories} required={true} />
            </Grid.Col>
          )}
        </AppField>
        <Subscribe
          selector={(state) => ({
            formAttributes: state.values.attributes,
            formCategory: state.values.category,
            type: state.values.type,
            method: state.values.method,
            spellCategory: state.values.spellCategory,
            diePerLevel: state.values.diePerLevel,
            setPerLevel: state.values.setPerLevel,
            range: state.values.range,
          })}
        >
          {({ formAttributes, formCategory, type, method, spellCategory, diePerLevel, setPerLevel, range }) => {
            if (!formCategory) return null
            const sectionCategory = modifiers.categories.findCategory(formCategory)
            const categoryName = getKeyFromId(formCategory, { ...ModCats, ...ModSpellCats })
            const path = getModifierProperties({
              category: categoryName,
            })
            const { subtypeSpecific, providesOptions, hasPrerequisites } = getAttributes({
              attributes: formAttributes || [],
            })
            return (
              <>
                {formCategory === ModCats.SPELL && (
                  <>
                    <AppField
                      name='spellCategory'
                      validators={fieldValidators({
                        onBlur: 'Select a spell category',
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField label='Spell Category' options={modifiers.spellCategories} required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                    <AppField
                      name='spells'
                      validators={fieldValidators({
                        onBlur: 'Select at least one spell',
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField label='Spells' multiselect={true} options={spellsArray} required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                  </>
                )}
                {modTypes?.length && sectionCategory != null && (
                  <AppField
                    name='type'
                    validators={fieldValidators({
                      onBlur: 'Select a modifier type',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField label='Modifier Type' options={modTypes} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
                {modMethods?.length && (
                  <AppField
                    name='method'
                    validators={fieldValidators({
                      onBlur: 'Select a modifier method',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField label='Modifier Method' options={modMethods} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
                {path && typeOptions && formCategory !== ModCats.SPELL && formCategory != null && (
                  <AppField
                    name={path}
                    validators={fieldValidators({
                      onBlur: 'Select a modifier method',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField
                          label='Modifier Method'
                          multiselect={true}
                          options={
                            formCategory === ModCats.SAVE_ABILITY ? abilities
                            : formCategory === ModCats.CONDITION_SAVE ?
                              conditions
                            : formCategory === ModCats.SPELL_DC || formCategory === ModCats.DAMAGE_SAVE ?
                              damageTypes
                            : options[path as 'damageTypes' | 'conditions' | 'abilities' | 'speeds']
                          }
                          required={true}
                        />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
                {formCategory === ModCats.CHARGE && type === ModTypes.USE_RESET && (
                  <>
                    <AppField
                      name='charges.reset'
                      validators={fieldValidators({
                        onBlur: 'Select a reset option',
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField label='Reset Option' options={charges.resets} required={true} />
                        </Grid.Col>
                      )}
                    </AppField>
                    <AppField
                      name='feature'
                      validators={fieldValidators({
                        onBlur: 'Select a feature',
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField
                            label='Feature'
                            options={
                              features?.map((feature) => ({
                                id: feature.id,
                                label: feature?.label || feature?.id,
                              })) ?? []
                            }
                            required={true}
                          />
                        </Grid.Col>
                      )}
                    </AppField>
                  </>
                )}
                {formCategory === ModCats.SPELL &&
                  (spellCategory === ModSpellCats.SPELL_DURATION ?
                    <>
                      <AppField
                        name='duration'
                        validators={fieldValidators({
                          onBlur: 'Select a spell duration type',
                        })}
                        listeners={fieldListeners}
                      >
                        {({ DropdownField }) => (
                          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                            <DropdownField
                              label='Spell Duration Type'
                              options={systemSpells.durations}
                              required={true}
                            />
                          </Grid.Col>
                        )}
                      </AppField>
                      {type === ModTypes.SET_AMOUNT && (
                        <AppField
                          name='setAmount'
                          validators={fieldValidators({
                            onBlur: 'Set a duration increment amount',
                            onChange: { type: 'integer', min: 1, name: 'Duration increment' },
                          })}
                          listeners={fieldListeners}
                        >
                          {({ TextField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <TextField label='Duration Increment' required={true} />
                            </Grid.Col>
                          )}
                        </AppField>
                      )}
                    </>
                  : spellCategory === ModSpellCats.SPELL_RANGE ?
                    <>
                      <AppField
                        name='range'
                        validators={fieldValidators({ onBlur: 'Select a spell range type' })}
                        listeners={fieldListeners}
                      >
                        {({ DropdownField }) => (
                          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                            <DropdownField label='Spell Range Type' options={systemSpells.ranges} required={true} />
                          </Grid.Col>
                        )}
                      </AppField>
                      {type === ModTypes.SET_AMOUNT && (
                        <>
                          <AppField
                            name='minAmount'
                            validators={fieldValidators({
                              onBlur: 'Set a min range amount',
                              onChange: { type: 'number', min: 0, name: 'Min. range amount' },
                            })}
                            listeners={fieldListeners}
                          >
                            {({ TextField }) => (
                              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                <TextField label='Min Range Amount' required={true} />
                              </Grid.Col>
                            )}
                          </AppField>
                          <AppField
                            name='maxAmount'
                            validators={fieldValidators({
                              onBlur: 'Set a max range amount',
                              onChange: { type: 'integer', min: 1, name: 'Max range amount' },
                            })}
                            listeners={fieldListeners}
                          >
                            {({ TextField }) => (
                              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                <TextField label='Max Range Amount' required={true} />
                              </Grid.Col>
                            )}
                          </AppField>
                          <AppField
                            name='unit'
                            validators={fieldValidators({
                              onBlur: 'Select a unit of measurement',
                              condition: range === Ranges.DISTANCE,
                            })}
                            listeners={fieldListeners}
                          >
                            {({ DropdownField }) => (
                              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                <DropdownField
                                  label='Spell Range UoM'
                                  options={rules.measurements.imperial.length}
                                  required={range === Ranges.DISTANCE ? true : false}
                                />
                              </Grid.Col>
                            )}
                          </AppField>
                        </>
                      )}
                    </>
                  : spellCategory === ModSpellCats.SPELL_SHAPE && (
                      <>
                        <AppField
                          name='shape'
                          validators={fieldValidators({
                            onBlur: 'Select a spell shape type',
                          })}
                          listeners={fieldListeners}
                        >
                          {({ DropdownField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <DropdownField label='Spell Shape Type' options={systemSpells.shapes} required={true} />
                            </Grid.Col>
                          )}
                        </AppField>
                        {type === ModTypes.SET_AMOUNT && (
                          <>
                            <AppField
                              name='size'
                              validators={fieldValidators({
                                onBlur: 'Set a max range amount',
                                onChange: { type: 'number', min: 1, name: 'Max range amount' },
                              })}
                              listeners={fieldListeners}
                            >
                              {({ TextField }) => (
                                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                  <TextField label='Shape Size Amount' required={true} />
                                </Grid.Col>
                              )}
                            </AppField>
                            <AppField
                              name='unit'
                              validators={fieldValidators({
                                onBlur: 'Select a unit of measurement',
                                condition: range === Ranges.DISTANCE,
                              })}
                              listeners={fieldListeners}
                            >
                              {({ DropdownField }) => (
                                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                  <DropdownField
                                    label='Spell Range UoM'
                                    options={rules.measurements.imperial.length}
                                    required={true}
                                  />
                                </Grid.Col>
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
                        {method === ModMethods.SET_GLOBALLY ?
                          <AppField
                            name='setAmount'
                            validators={fieldValidators({
                              onBlur: 'Set an amount',
                              onChange: { type: 'integer', min: 1, name: 'Amount' },
                            })}
                            listeners={fieldListeners}
                          >
                            {({ TextField }) => (
                              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                <TextField label='Set Amount' required={true} />
                              </Grid.Col>
                            )}
                          </AppField>
                        : method === ModMethods.ABILITY_SCORE_MODIFIER ?
                          <AppField
                            name='methodAbility'
                            validators={fieldValidators({
                              onBlur: 'Select an  ability',
                            })}
                            listeners={fieldListeners}
                          >
                            {({ DropdownField }) => (
                              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                <DropdownField label='Method Ability' options={abilities} required={true} />
                              </Grid.Col>
                            )}
                          </AppField>
                        : method === ModMethods.SKILL_MODIFIER && (
                            <AppField
                              name='methodSkill'
                              validators={fieldValidators({
                                onBlur: 'Select a skill',
                              })}
                              listeners={fieldListeners}
                            >
                              {({ DropdownField }) => (
                                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                  <DropdownField label='Method Skill' options={skills} required={true} />
                                </Grid.Col>
                              )}
                            </AppField>
                          )
                        }
                      </>
                    )}
                    {method !== ModMethods.SET_GLOBALLY && (
                      <>
                        <AppField
                          name='multiplier'
                          validators={fieldValidators({
                            onChange: { type: 'integer', min: 1, name: 'Multiplier' },
                          })}
                          listeners={fieldListeners}
                        >
                          {({ TextField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <TextField label='Multiplier' />
                            </Grid.Col>
                          )}
                        </AppField>
                        <AppField
                          name='minAmount'
                          validators={fieldValidators({
                            onChange: { type: 'integer', min: 1, name: 'Min. amount' },
                          })}
                          listeners={fieldListeners}
                        >
                          {({ TextField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <TextField label='Min Amount' />
                            </Grid.Col>
                          )}
                        </AppField>
                      </>
                    )}
                  </>
                )}
                {subtypeSpecific && __kind === 'ClassInput' && formCategory != null && subtypes?.length && (
                  <AppField
                    name='subtype'
                    validators={fieldValidators({
                      onBlur: 'Select a subtype',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField label='Subtype' options={subtypes} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
                {providesOptions && (
                  <AppField
                    name='selectionCount'
                    validators={fieldValidators({
                      onChange: { type: 'integer', min: 1, name: 'Selection amount' },
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='# of Selections' required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
                {hasPrerequisites && (
                  <Grid.Col>
                    <Prerequisites
                      form={form}
                      fields='prerequisites'
                      __kind='FeatureModifierInput'
                      updateFn={modifierStore.updateField}
                      removeFn={modifierStore.removeField}
                    />
                  </Grid.Col>
                )}
                {method === ModMethods.SET_PER_LEVEL && diePerLevel?.length && (
                  <Grid.Col>
                    <Collapsible
                      props={{
                        trigger: {
                          title: 'Die Per Level',
                        },
                      }}
                    >
                      <Grid>
                        <Grid.Col>
                          <Grid>
                            <Grid.Col>Level</Grid.Col>
                            <Grid.Col>Die Config</Grid.Col>
                          </Grid>
                        </Grid.Col>
                        <AppField name='diePerLevel' mode='array'>
                          {({ state }) =>
                            state.value?.map((_, i) => (
                              <Grid.Col key={i}>
                                <Grid>
                                  <AppField
                                    name={`diePerLevel[${i}].level`}
                                    validators={fieldValidators({
                                      onBlur: 'Level is required',
                                      onChange: { type: 'integer', min: 1, name: 'Level' },
                                    })}
                                    listeners={fieldListeners}
                                  >
                                    {({ TextField }) => (
                                      <Grid.Col>
                                        <TextField required={true} />
                                      </Grid.Col>
                                    )}
                                  </AppField>
                                  <AppField
                                    name={`diePerLevel[${i}].dieConfig`}
                                    validators={fieldValidators({
                                      onBlur: 'Please enter a die configuration',
                                      onChange: { type: 'die', name: 'Die configuration' },
                                    })}
                                    listeners={fieldListeners}
                                  >
                                    {({ TextField }) => (
                                      <Grid.Col>
                                        <TextField required={true} />
                                      </Grid.Col>
                                    )}
                                  </AppField>
                                </Grid>
                              </Grid.Col>
                            ))
                          }
                        </AppField>
                      </Grid>
                    </Collapsible>
                  </Grid.Col>
                )}
                {method === ModMethods.SET_PER_LEVEL && setPerLevel?.length && (
                  <Grid.Col>
                    <Collapsible
                      props={{
                        trigger: {
                          title: 'Set Per Level',
                        },
                      }}
                    >
                      <Grid>
                        <Grid.Col>
                          <Grid>
                            <Grid.Col>Level</Grid.Col>
                            <Grid.Col>Amount</Grid.Col>
                          </Grid>
                        </Grid.Col>

                        <AppField name='setPerLevel' mode='array'>
                          {({ state }) =>
                            state.value?.map((_, i) => (
                              <Grid.Col key={i}>
                                <Grid>
                                  <AppField
                                    name={`setPerLevel[${i}].level`}
                                    validators={fieldValidators({
                                      onBlur: 'Level is required',
                                      onChange: { type: 'integer', min: 1, name: 'Level' },
                                    })}
                                    listeners={fieldListeners}
                                  >
                                    {({ TextField }) => (
                                      <Grid.Col>
                                        <TextField required={true} />
                                      </Grid.Col>
                                    )}
                                  </AppField>
                                  <AppField
                                    name={`setPerLevel[${i}].setAmount`}
                                    validators={fieldValidators({
                                      onBlur: 'Please enter an amount',
                                      onChange: { type: 'integer', min: 1, name: 'Set amount' },
                                    })}
                                    listeners={fieldListeners}
                                  >
                                    {({ TextField }) => (
                                      <Grid.Col>
                                        <TextField required={true} />
                                      </Grid.Col>
                                    )}
                                  </AppField>
                                </Grid>
                              </Grid.Col>
                            ))
                          }
                        </AppField>
                      </Grid>
                    </Collapsible>
                  </Grid.Col>
                )}
              </>
            )
          }}
        </Subscribe>
      </Grid>
    </>
  )
}

export default Modifiers
