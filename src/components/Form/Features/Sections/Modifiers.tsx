import { useEffect, useState } from 'react'
import Dropdown from '@/components/Dropdown'
import Input from '@/components/Input'
import Collapsible from '@/components/Collapsible'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { FeatureContext } from '../FeatureContext'
import { Attributes, Categories, ModCats, ModMethods, ModSpellCats, ModTypes, Ranges, Sections } from '@/enums'
import { getKeyFromId, getModifierProperties } from '../../utils'
import { useEnumChecks } from '@/hooks'
import Prerequisites from '../../Substeps/Prerequisites'
import { useSystemData, useSpellData } from '@/hooks'
import type { SectionStore } from '@/store'
import type {
  OnChange,
  FormDataType,
  FeatureModifier,
  GenericType,
  SpellListItem,
  Class,
  Resource,
  Spell,
  Character,
} from '@/types'
import { Grid } from '@mantine/core'

const Modifiers = () => {
  const { formStore } = use(FormContext)

  const { sectionStore } = use(FeatureContext) as {
    sectionStore: SectionStore<FeatureModifier>
  }

  const {
    data,
    updateField,
    removeField,
    addField,
  }: {
    data: FeatureModifier
    updateField: OnChange<FeatureModifier>['updateField']
    removeField: OnChange<FeatureModifier>['removeField']
    addField: OnChange<FeatureModifier>['addField']
  } = sectionStore

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

  const { subtypeSpecific, providesOptions, hasPrerequisites, doesDamage } = useEnumChecks({
    data: data,
  })

  const [modTypes, setModTypes] = useState<GenericType[]>([])
  const [modMethods, setModMethods] = useState<GenericType[] | null>(null)
  const [spellsArray, setSpellsArray] = useState<SpellListItem[]>([])
  const [typeOptions, setTypeOptions] = useState<boolean>(false)

  const sectionCategory = modifiers.categories.findCategory(data?.category)

  const categoryName = data?.category ? getKeyFromId(data?.category, { ...ModCats, ...ModSpellCats }) : null

  const path =
    categoryName ?
      getModifierProperties({
        category: categoryName,
      })
    : null

  useEffect(() => {
    if (data.__typename == null) {
      updateField({
        path: '__typename',
        value: 'FeatureModifier',
      })
    }
  }, [sectionStore, data.__typename, updateField])

  // Set if selected category has type options
  useEffect(() => {
    setTypeOptions(
      data?.category === ModCats.DAMAGE_TYPES ||
        data?.category === ModCats.ABILITY_SCORES ||
        data?.category === ModCats.SAVE_ABILITY ||
        data?.category === ModCats.CONDITIONS ||
        data?.category === ModCats.CONDITION_SAVE ||
        data?.category === ModCats.DAMAGE_SAVE ||
        data?.category === ModCats.SPEEDS ||
        data?.category === ModCats.SPELL_DAMAGE
    )
  }, [data?.category])

  const options = {
    damageTypes: damageTypes,
    conditions: conditions,
    abilities: abilities,
    speeds: speeds,
  } as const

  // Set modTypes and modMethods options
  useEffect(() => {
    if (data != null) {
      let types: GenericType[] = []
      if (data?.category === ModCats.SPELL) {
        types = modifiers.types.filterByCategory(data?.spellCategory) || []
      } else {
        types = modifiers.types.filterByCategory(data?.category) || []
      }

      if (types?.length) {
        setModTypes(types)
      }
    }
    if (modTypes?.length) {
      if (data?.category === ModCats.SPELL) {
        const methods = modifiers.methods.filterByCategory(data?.spellCategory) || []

        setModMethods(methods)
      } else {
        const methods = modifiers.methods.filterByTypeAndCategory(data?.type, data?.category)

        setModMethods(methods)
      }
    }
  }, [modTypes, data, modifiers])

  // Filter spells array
  useEffect(() => {
    const filteredSpells = spells?.filter((spell) => {
      if (data?.spellCategory === ModSpellCats.SPELL_DAMAGE) {
        return spellMetaData?.attributes
          ?.find((attribute) => attribute.id === Attributes.DOES_DAMAGE)
          ?.spellIds?.includes(spell.id)
      }
      if (
        data?.spellCategory === ModSpellCats.SPELL_RANGE &&
        spellMetaData.ranges?.find((range) => range.spellIds?.includes(spell.id)) != null
      ) {
        return true
      }
      if (
        data?.spellCategory === ModSpellCats.SPELL_SHAPE &&
        spellMetaData.shapes?.find((shape) => shape.spellIds?.includes(spell.id)) != null
      ) {
        return true
      }
      if (
        data?.spellCategory === ModSpellCats.SPELL_DURATION &&
        spellMetaData.durations?.find((duration) => duration.spellIds?.includes(spell.id)) != null
      ) {
        return true
      }
      return false
    })
    setSpellsArray(filteredSpells)
  }, [data?.spellCategory, spells, doesDamage, spellMetaData])

  // Add/Remove die per level Table
  useEffect(() => {
    if (
      ((data?.type !== ModTypes.SET_DIE && data?.type !== ModTypes.BONUS_DIE && data?.type !== ModTypes.PENALTY_DIE) ||
        data?.method !== ModMethods.SET_PER_LEVEL ||
        !modMethods?.some((method) => method.id === ModMethods.SET_PER_LEVEL)) &&
      data?.diePerLevel?.length
    ) {
      removeField({ path: 'diePerLevel' })
    }
    if (
      (data?.type === ModTypes.SET_DIE || data?.type === ModTypes.BONUS_DIE || data?.type === ModTypes.PENALTY_DIE) &&
      data?.method === ModMethods.SET_PER_LEVEL &&
      modMethods?.some((method) => method.id === ModMethods.SET_PER_LEVEL) &&
      (!data?.diePerLevel || !data?.diePerLevel?.length)
    ) {
      addField({ path: 'diePerLevel' })
    }
  }, [data, sectionStore, data?.type, data?.method, modMethods, addField, removeField])

  // Add/remove setPerLevel table
  useEffect(() => {
    if (
      ((data?.type !== ModTypes.SET_AMOUNT && data?.type !== ModTypes.BONUS && data?.type !== ModTypes.PENALTY) ||
        data?.method !== ModMethods.SET_PER_LEVEL ||
        !modMethods?.some((method) => method.id === ModMethods.SET_PER_LEVEL)) &&
      data?.setPerLevel?.length
    ) {
      removeField({ path: 'setPerLevel' })
    }
    if (
      (data?.type === ModTypes.SET_AMOUNT || data?.type === ModTypes.BONUS || data?.type === ModTypes.PENALTY) &&
      data?.method === ModMethods.SET_PER_LEVEL &&
      modMethods?.some((method) => method.id === ModMethods.SET_PER_LEVEL) &&
      (!data?.setPerLevel || !data?.setPerLevel?.length)
    ) {
      addField({ path: 'setPerLevel' })
    }
  }, [data?.type, data?.method, data?.setPerLevel, sectionStore, modMethods, addField, removeField])

  if (!path) return null

  return (
    <>
      <Grid>
        <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            multiSelect={true}
            name='attributes'
            options={attributes.filter(
              (attribute) =>
                attribute?.sections?.length &&
                attribute?.sections?.includes(Sections.ALL) &&
                (formStore.data as Class).category === Categories.SUBCLASS &&
                attribute?.sections?.includes(Sections.SUBCLASS)
            )}
            label='Attrbutes'
            value={data?.attributes}
            onChange={{ updateField, removeField }}
          />
        </Grid.Col>
        <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            name='category'
            label='Modifier Category'
            value={data?.category}
            options={modifiers.categories}
            required={true}
            onChange={{ updateField, removeField }}
          />
        </Grid.Col>
        {data?.category === ModCats.SPELL && (
          <>
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='spellCategory'
                label='Spell Category'
                value={data?.spellCategory}
                options={modifiers.spellCategories}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Col>
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='spell'
                label='Spell'
                value={data?.spell}
                options={spellsArray}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Col>
          </>
        )}
        {modTypes?.length && sectionCategory != null && (
          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='type'
              label='Modifier Type'
              value={data?.type}
              options={modTypes}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Col>
        )}
        {modMethods != null && modMethods?.length && (
          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='method'
              label='Method'
              value={data?.method}
              options={modMethods}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Col>
        )}
        {typeOptions && data?.category !== ModCats.SPELL && data?.category != null && (
          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name={path}
              multiSelect={true}
              label={sectionCategory?.label}
              value={data[path]}
              options={
                data?.category === ModCats.SAVE_ABILITY ? abilities
                : data?.category === ModCats.CONDITION_SAVE ?
                  conditions
                : data?.category === ModCats.SPELL_DC || data?.category === ModCats.DAMAGE_SAVE ?
                  damageTypes
                : options[path as 'damageTypes' | 'conditions' | 'abilities' | 'speeds']
              }
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Col>
        )}
        {data?.category === ModCats.CHARGE && data?.type === ModTypes.USE_RESET && (
          <>
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='charge.reset'
                label='Reset Option'
                value={data?.charge?.reset}
                options={charges.resets}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Col>
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='feature'
                label='Feature'
                value={data?.feature}
                options={[
                  ...((formStore.data as Exclude<FormDataType, Spell | Character>)?.features?.map((feature) => ({
                    label: feature.label!,
                    value: feature.value!,
                    id: feature.id,
                  })) || []),
                  { ...((formStore.data as Class)?.resource as Resource) },
                ]}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Col>
          </>
        )}
        {data?.category === ModCats.SPELL &&
          (data?.spellCategory === ModSpellCats.SPELL_DURATION ?
            <>
              <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='duration'
                  label='Spell Duration Type'
                  value={data?.duration}
                  options={systemSpells.durations}
                  required={true}
                  onChange={{ updateField, removeField }}
                />
              </Grid.Col>
              {data?.type === ModTypes.SET_AMOUNT && (
                <>
                  <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      validation='num'
                      name='setAmount'
                      label='Duration Increment'
                      errorMsg='Must contain only whole numbers'
                      autoComplete='off'
                      value={data?.setAmount}
                      onChange={{ updateField }}
                    />
                  </Grid.Col>
                </>
              )}
            </>
          : data?.spellCategory === ModSpellCats.SPELL_RANGE ?
            <>
              <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='range'
                  label='Spell Range Type'
                  value={data?.range}
                  options={systemSpells.ranges}
                  required={true}
                  onChange={{ updateField, removeField }}
                />
              </Grid.Col>
              {data?.type === ModTypes.SET_AMOUNT && (
                <>
                  <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      validation='num'
                      name='minAmount'
                      label='Minimum Value'
                      errorMsg='Must contain only whole numbers'
                      autoComplete='off'
                      value={data?.minAmount}
                      onChange={{ updateField }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      validation='num'
                      name='maxAmount'
                      label='Maximum Value'
                      errorMsg='Must contain only whole numbers'
                      autoComplete='off'
                      value={data?.maxAmount}
                      onChange={{ updateField }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      name='unit'
                      label='UoM'
                      value={data?.unit}
                      options={rules.measurements.imperial.length}
                      required={data?.range === Ranges.DISTANCE ? true : false}
                      onChange={{ updateField, removeField }}
                    />
                  </Grid.Col>
                </>
              )}
            </>
          : data?.spellCategory === ModSpellCats.SPELL_SHAPE && (
              <>
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='shape'
                    label='Spell Shape Type'
                    value={data?.shape}
                    options={systemSpells.shapes}
                    required={true}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Col>
                {data?.type === ModTypes.SET_AMOUNT && (
                  <>
                    <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        validation='num'
                        name='size'
                        label='Shape Size'
                        errorMsg='Must contain only whole numbers'
                        autoComplete='off'
                        value={data?.size}
                        onChange={{ updateField }}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='unit'
                        label='UoM'
                        value={data?.unit}
                        options={rules.measurements.imperial.length}
                        required={true}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Col>
                  </>
                )}
              </>
            ))}
        {data?.method != null && data?.method !== ModMethods.SET_PER_LEVEL && (
          <>
            {(data?.type === ModTypes.BONUS || data?.type === ModTypes.SET_AMOUNT) && (
              <>
                {data?.method === ModMethods.SET_GLOBALLY ?
                  <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      validation='num'
                      name='setAmount'
                      label='Set Value'
                      errorMsg='Must contain only numbers'
                      autoComplete='off'
                      value={data?.setAmount}
                      required={true}
                      onChange={{ updateField }}
                    />
                  </Grid.Col>
                : data?.method === ModMethods.ABILITY_SCORE_MODIFIER ?
                  <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      name='methodAbility'
                      label='Method Ability'
                      value={data?.methodAbility}
                      options={abilities}
                      required={true}
                      onChange={{ updateField, removeField }}
                    />
                  </Grid.Col>
                : data?.method === ModMethods.SKILL_MODIFIER && (
                    <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='methodSkill'
                        label='Method Skill'
                        value={data?.methodSkill}
                        options={skills}
                        required={true}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Col>
                  )
                }
              </>
            )}
            {data?.method !== ModMethods.SET_GLOBALLY && (
              <>
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    validation='num'
                    name='multiplier'
                    label='Multiplier'
                    errorMsg='Must contain only whole numbers'
                    autoComplete='off'
                    value={data?.multiplier}
                    onChange={{ updateField }}
                  />
                </Grid.Col>
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    validation='num'
                    name='minAmount'
                    label='Minimum Value'
                    errorMsg='Must contain only whole numbers'
                    autoComplete='off'
                    value={data?.minAmount}
                    onChange={{ updateField }}
                  />
                </Grid.Col>
              </>
            )}
          </>
        )}
        {subtypeSpecific &&
          formStore.data.__typename === 'Class' &&
          data?.category != null &&
          formStore.data?.subtypes?.length && (
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='subtype'
                label='Subclass Subtype'
                value={data?.subtype}
                options={formStore.data?.subtypes}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Col>
          )}
        {providesOptions && (
          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
            <Input
              validation='num'
              name={`selectionCount`}
              label='# of Selections'
              autoComplete='off'
              value={data?.selectionCount}
              errorMsg='Must contain only numbers'
              required={true}
              onChange={{ updateField }}
            />
          </Grid.Col>
        )}
        {hasPrerequisites && (
          <Grid.Col>
            <Prerequisites formStore={sectionStore} />
          </Grid.Col>
        )}
        {data?.method === ModMethods.SET_PER_LEVEL && data?.diePerLevel?.length && (
          <Grid.Col>
            <Collapsible>
              <Collapsible.Trigger title='Die Per Level' />
              <Collapsible.Content>
                <Grid>
                  <Grid.Col>
                    <Grid>
                      <Grid.Col >Level</Grid.Col>
                      <Grid.Col >Die Config</Grid.Col>
                    </Grid>
                  </Grid.Col>
                  {data?.diePerLevel?.map((setLevel, index) => (
                    <Grid.Col key={index}>
                      <Grid>
                        <Grid.Col >
                          <Input
                            name={`diePerLevel.${index}.level`}
                            value={setLevel.level}
                            validation='num'
                            errorMsg='Please enter a whole number'
                            onChange={{ updateField }}
                            required={true}
                          />
                        </Grid.Col>
                        <Grid.Col >
                          <Input
                            name={`diePerLevel.${index}.dieConfig`}
                            value={setLevel.dieConfig}
                            validation='num'
                            errorMsg='Please enter a valid die value'
                            onChange={{ updateField }}
                            required={true}
                          />
                        </Grid.Col>
                      </Grid>
                    </Grid.Col>
                  ))}
                </Grid>
              </Collapsible.Content>
            </Collapsible>
          </Grid.Col>
        )}
        {data?.method === ModMethods.SET_PER_LEVEL && data?.setPerLevel?.length && (
          <Grid.Col>
            <Collapsible>
              <Collapsible.Trigger title='Set Per Level' />
              <Collapsible.Content>
                <Grid>
                  <Grid.Col>
                    <Grid>
                      <Grid.Col >Level</Grid.Col>
                      <Grid.Col >Amount</Grid.Col>
                    </Grid>
                  </Grid.Col>
                  {data?.setPerLevel?.map((setLevel, index) => (
                    <Grid.Col key={index}>
                      <Grid>
                        <Grid.Col >
                          <Input
                            name={`setPerLevel.${index}.level`}
                            value={setLevel.level}
                            validation='num'
                            errorMsg='Please enter a whole number'
                            onChange={{ updateField }}
                            required={true}
                          />
                        </Grid.Col>
                        <Grid.Col >
                          <Input
                            name={`setPerLevel.${index}.setAmount`}
                            value={setLevel.setAmount}
                            validation='num'
                            errorMsg='Please enter a whole number'
                            onChange={{ updateField }}
                            required={true}
                          />
                        </Grid.Col>
                      </Grid>
                    </Grid.Col>
                  ))}
                </Grid>
              </Collapsible.Content>
            </Collapsible>
          </Grid.Col>
        )}
      </Grid>
    </>
  )
}

export default Modifiers
