import { useEffect, useState } from 'react'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import Collapse from '../../../Collapse/Collapse'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { FeatureContext } from '../FeatureContext'
import { FormDataType } from '../../../../types/form'
import {
  Character,
  Class,
  FeatureModifier,
  Resource,
  SectionEnum,
  Spell,
  type GenericType,
  type SpellListItem,
} from '../../../../../amplify/gql/types'
import {
  Attributes,
  Categories,
  ModifierCategories,
  ModifierMethods,
  ModifierSpellCategories,
  ModifierTypes,
  Ranges,
} from '../../../../types/enums'
import { getKeyFromId, getModifierProperties } from '../../../../utils/form'
import { useEnumChecks } from '../../../../hooks/useEnumChecks'
import Prerequisites from '../../Subforms/Prerequisites'
import Grid from '../../../Grid/Grid'
import useSystemData from '../../../../hooks/useSystemData'
import useSpellData from '../../../../hooks/useSpellData'
import type { SectionStore } from '../../../../store/sectionStore'
import type { OnChange } from '../../../../types/form'

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

  const categoryName =
    data?.category ? getKeyFromId(data?.category, { ...ModifierCategories, ...ModifierSpellCategories }) : null

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
  }, [sectionStore, data.__typename])

  // Set if selected category has type options
  useEffect(() => {
    setTypeOptions(
      data?.category === ModifierCategories.damageTypes ||
        data?.category === ModifierCategories.abilityScores ||
        data?.category === ModifierCategories.saveAbilities ||
        data?.category === ModifierCategories.conditions ||
        data?.category === ModifierCategories.conditionSave ||
        data?.category === ModifierCategories.damageSave ||
        data?.category === ModifierCategories.speeds ||
        data?.category === ModifierCategories.spellDamage
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
      if (data?.category === ModifierCategories.spell) {
        types = modifiers.types.filterByCategory(data?.spellCategory) || []
      } else {
        types = modifiers.types.filterByCategory(data?.category) || []
      }

      if (types?.length) {
        setModTypes(types)
      }
    }
    if (modTypes?.length) {
      if (data?.category === ModifierCategories.spell) {
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
      if (data?.spellCategory === ModifierSpellCategories.spellDamage) {
        return spellMetaData?.attributes
          ?.find((attribute) => attribute.id === Attributes.doesDamage)
          ?.spellIds?.includes(spell.id)
      }
      if (
        data?.spellCategory === ModifierSpellCategories.spellRange &&
        spellMetaData.ranges?.find((range) => range.spellIds?.includes(spell.id)) != null
      ) {
        return true
      }
      if (
        data?.spellCategory === ModifierSpellCategories.spellShape &&
        spellMetaData.shapes?.find((shape) => shape.spellIds?.includes(spell.id)) != null
      ) {
        return true
      }
      if (
        data?.spellCategory === ModifierSpellCategories.spellDuration &&
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
      ((data?.type !== ModifierTypes.setDie &&
        data?.type !== ModifierTypes.bonusDie &&
        data?.type !== ModifierTypes.penaltyDie) ||
        data?.method !== ModifierMethods.setPerLevel ||
        !modMethods?.some((method) => method.id === ModifierMethods.setPerLevel)) &&
      data?.diePerLevel?.length
    ) {
      removeField({ path: 'diePerLevel' })
    }
    if (
      (data?.type === ModifierTypes.setDie ||
        data?.type === ModifierTypes.bonusDie ||
        data?.type === ModifierTypes.penaltyDie) &&
      data?.method === ModifierMethods.setPerLevel &&
      modMethods?.some((method) => method.id === ModifierMethods.setPerLevel) &&
      (!data?.diePerLevel || !data?.diePerLevel?.length)
    ) {
      addField({ path: 'diePerLevel' })
    }
  }, [data, sectionStore, data?.type, data?.method, modMethods])

  // Add/remove setPerLevel table
  useEffect(() => {
    if (
      ((data?.type !== ModifierTypes.setAmount &&
        data?.type !== ModifierTypes.bonus &&
        data?.type !== ModifierTypes.penalty) ||
        data?.method !== ModifierMethods.setPerLevel ||
        !modMethods?.some((method) => method.id === ModifierMethods.setPerLevel)) &&
      data?.setPerLevel?.length
    ) {
      removeField({ path: 'setPerLevel' })
    }
    if (
      (data?.type === ModifierTypes.setAmount ||
        data?.type === ModifierTypes.bonus ||
        data?.type === ModifierTypes.penalty) &&
      data?.method === ModifierMethods.setPerLevel &&
      modMethods?.some((method) => method.id === ModifierMethods.setPerLevel) &&
      (!data?.setPerLevel || !data?.setPerLevel?.length)
    ) {
      addField({ path: 'setPerLevel' })
    }
  }, [data?.type, data?.method, data?.setPerLevel, sectionStore, modMethods])

  if (!path) return null

  return (
    <>
      <Grid>
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            multiSelect={true}
            name='attributes'
            options={attributes.filter(
              (attribute) =>
                attribute?.sections?.length &&
                attribute?.sections?.includes(SectionEnum.all) &&
                (formStore.data as Class).category === Categories.subclass &&
                attribute?.sections?.includes(SectionEnum.subclasses)
            )}
            label='Attrbutes'
            value={data?.attributes}
            onChange={{ updateField, removeField }}
          />
        </Grid.Item>
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            name='category'
            label='Modifier Category'
            value={data?.category}
            options={modifiers.categories}
            required={true}
            onChange={{ updateField, removeField }}
          />
        </Grid.Item>
        {data?.category === ModifierCategories.spell && (
          <>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='spellCategory'
                label='Spell Category'
                value={data?.spellCategory}
                options={modifiers.spellCategories}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='spell'
                label='Spell'
                value={data?.spell}
                options={spellsArray}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Item>
          </>
        )}
        {modTypes?.length && sectionCategory != null && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='type'
              label='Modifier Type'
              value={data?.type}
              options={modTypes}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
        )}
        {modMethods != null && modMethods?.length && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='method'
              label='Method'
              value={data?.method}
              options={modMethods}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
        )}
        {typeOptions && data?.category !== ModifierCategories.spell && data?.category != null && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name={path}
              multiSelect={true}
              label={sectionCategory?.label}
              value={data[path]}
              options={
                data?.category === ModifierCategories.saveAbilities ? abilities
                : data?.category === ModifierCategories.conditionSave ?
                  conditions
                : data?.category === ModifierCategories.spellDC || data?.category === ModifierCategories.damageSave ?
                  damageTypes
                : options[path as 'damageTypes' | 'conditions' | 'abilities' | 'speeds']
              }
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
        )}
        {data?.category === ModifierCategories.charge && data?.type === ModifierTypes.useReset && (
          <>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='charge.reset'
                label='Reset Option'
                value={data?.charge?.reset}
                options={charges.resets}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
            </Grid.Item>
          </>
        )}
        {data?.category === ModifierCategories.spell &&
          (data?.spellCategory === ModifierSpellCategories.spellDuration ?
            <>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='duration'
                  label='Spell Duration Type'
                  value={data?.duration}
                  options={systemSpells.durations}
                  required={true}
                  onChange={{ updateField, removeField }}
                />
              </Grid.Item>
              {data?.type === ModifierTypes.setAmount && (
                <>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      validation='num'
                      name='setAmount'
                      label='Duration Increment'
                      errorMsg='Must contain only whole numbers'
                      autoComplete='off'
                      value={data?.setAmount}
                      onChange={{ updateField }}
                    />
                  </Grid.Item>
                </>
              )}
            </>
          : data?.spellCategory === ModifierSpellCategories.spellRange ?
            <>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='range'
                  label='Spell Range Type'
                  value={data?.range}
                  options={systemSpells.ranges}
                  required={true}
                  onChange={{ updateField, removeField }}
                />
              </Grid.Item>
              {data?.type === ModifierTypes.setAmount && (
                <>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      validation='num'
                      name='minAmount'
                      label='Minimum Value'
                      errorMsg='Must contain only whole numbers'
                      autoComplete='off'
                      value={data?.minAmount}
                      onChange={{ updateField }}
                    />
                  </Grid.Item>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      validation='num'
                      name='maxAmount'
                      label='Maximum Value'
                      errorMsg='Must contain only whole numbers'
                      autoComplete='off'
                      value={data?.maxAmount}
                      onChange={{ updateField }}
                    />
                  </Grid.Item>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      name='unit'
                      label='UoM'
                      value={data?.unit}
                      options={rules.measurements.imperial.length}
                      required={data?.range === Ranges.distance ? true : false}
                      onChange={{ updateField, removeField }}
                    />
                  </Grid.Item>
                </>
              )}
            </>
          : data?.spellCategory === ModifierSpellCategories.spellShape && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='shape'
                    label='Spell Shape Type'
                    value={data?.shape}
                    options={systemSpells.shapes}
                    required={true}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Item>
                {data?.type === ModifierTypes.setAmount && (
                  <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        validation='num'
                        name='size'
                        label='Shape Size'
                        errorMsg='Must contain only whole numbers'
                        autoComplete='off'
                        value={data?.size}
                        onChange={{ updateField }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='unit'
                        label='UoM'
                        value={data?.unit}
                        options={rules.measurements.imperial.length}
                        required={true}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Item>
                  </>
                )}
              </>
            ))}
        {data?.method != null && data?.method !== ModifierMethods.setPerLevel && (
          <>
            {(data?.type === ModifierTypes.bonus || data?.type === ModifierTypes.setAmount) && (
              <>
                {data?.method === ModifierMethods.setGlobally ?
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                  </Grid.Item>
                : data?.method === ModifierMethods.abilityScoreModifier ?
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      name='methodAbility'
                      label='Method Ability'
                      value={data?.methodAbility}
                      options={abilities}
                      required={true}
                      onChange={{ updateField, removeField }}
                    />
                  </Grid.Item>
                : data?.method === ModifierMethods.skillModifier && (
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='methodSkill'
                        label='Method Skill'
                        value={data?.methodSkill}
                        options={skills}
                        required={true}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Item>
                  )
                }
              </>
            )}
            {data?.method !== ModifierMethods.setGlobally && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    validation='num'
                    name='multiplier'
                    label='Multiplier'
                    errorMsg='Must contain only whole numbers'
                    autoComplete='off'
                    value={data?.multiplier}
                    onChange={{ updateField }}
                  />
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    validation='num'
                    name='minAmount'
                    label='Minimum Value'
                    errorMsg='Must contain only whole numbers'
                    autoComplete='off'
                    value={data?.minAmount}
                    onChange={{ updateField }}
                  />
                </Grid.Item>
              </>
            )}
          </>
        )}
        {subtypeSpecific &&
          formStore.data.__typename === 'Class' &&
          data?.category != null &&
          formStore.data?.subtypes?.length && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='subtype'
                label='Subclass Subtype'
                value={data?.subtype}
                options={formStore.data?.subtypes}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Item>
          )}
        {providesOptions && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
          </Grid.Item>
        )}
        {hasPrerequisites && (
          <Grid.Item>
            <Prerequisites formStore={sectionStore} />
          </Grid.Item>
        )}
        {data?.method === ModifierMethods.setPerLevel && data?.diePerLevel?.length && (
          <Grid.Item>
            <Collapse>
              <Collapse.Header title='Die Per Level' />
              <Collapse.Body>
                <Grid>
                  <Grid.Item>
                    <Grid>
                      <Grid.Item colSpan={'auto'}>Level</Grid.Item>
                      <Grid.Item colSpan={'auto'}>Die Config</Grid.Item>
                    </Grid>
                  </Grid.Item>
                  {data?.diePerLevel?.map((setLevel, index) => (
                    <Grid.Item key={index}>
                      <Grid>
                        <Grid.Item colSpan={'auto'}>
                          <Input
                            name={`diePerLevel.${index}.level`}
                            value={setLevel.level}
                            validation='num'
                            errorMsg='Please enter a whole number'
                            onChange={{ updateField }}
                            required={true}
                          />
                        </Grid.Item>
                        <Grid.Item colSpan={'auto'}>
                          <Input
                            name={`diePerLevel.${index}.dieConfig`}
                            value={setLevel.dieConfig}
                            validation='num'
                            errorMsg='Please enter a valid die value'
                            onChange={{ updateField }}
                            required={true}
                          />
                        </Grid.Item>
                      </Grid>
                    </Grid.Item>
                  ))}
                </Grid>
              </Collapse.Body>
            </Collapse>
          </Grid.Item>
        )}
        {data?.method === ModifierMethods.setPerLevel && data?.setPerLevel?.length && (
          <Grid.Item>
            <Collapse>
              <Collapse.Header title='Set Per Level' />
              <Collapse.Body>
                <Grid>
                  <Grid.Item>
                    <Grid>
                      <Grid.Item colSpan={'auto'}>Level</Grid.Item>
                      <Grid.Item colSpan={'auto'}>Amount</Grid.Item>
                    </Grid>
                  </Grid.Item>
                  {data?.setPerLevel?.map((setLevel, index) => (
                    <Grid.Item key={index}>
                      <Grid>
                        <Grid.Item colSpan={'auto'}>
                          <Input
                            name={`setPerLevel.${index}.level`}
                            value={setLevel.level}
                            validation='num'
                            errorMsg='Please enter a whole number'
                            onChange={{ updateField }}
                            required={true}
                          />
                        </Grid.Item>
                        <Grid.Item colSpan={'auto'}>
                          <Input
                            name={`setPerLevel.${index}.setAmount`}
                            value={setLevel.setAmount}
                            validation='num'
                            errorMsg='Please enter a whole number'
                            onChange={{ updateField }}
                            required={true}
                          />
                        </Grid.Item>
                      </Grid>
                    </Grid.Item>
                  ))}
                </Grid>
              </Collapse.Body>
            </Collapse>
          </Grid.Item>
        )}
      </Grid>
    </>
  )
}

export default Modifiers
