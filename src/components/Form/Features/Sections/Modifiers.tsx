import { useEffect, useState } from 'react'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import Collapse from '../../../Collapse/Collapse'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { useGetSystemQuery } from '../../../../apis/systemsApi'
import { useListSpellsQuery } from '../../../../apis/spellsApi'
import { FeatureContext } from '../FeatureContext'
import { FormDataType, UpdateState } from '../../../../types/form'
import { Character, Class, FeatureModifier, Resource, SectionEnum, Spell } from '../../../../../amplify/gql/types'
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
import Prerequisites from '../../Subforms/Requirements'
import Grid from '../../../Grid/Grid'

const Modifiers = () => {
  const { formData } = use(FormContext)

  const { sectionData, updateSectionData } = use(FeatureContext) as {
    sectionData: FeatureModifier
    updateSectionData: (arg: UpdateState<FeatureModifier>) => void
  }

  const { data: system } = useGetSystemQuery()
  const { data: spells } = useListSpellsQuery()

  const { subtypeSpecific, providesOptions, hasPrerequisites, doesDamage } = useEnumChecks({
    data: sectionData,
  })

  const [modTypes, setModTypes] = useState<typeof system.modifiers.types>([])
  const [modMethods, setModMethods] = useState<typeof system.modifiers.methods | null>(null)
  const [spellsArray, setSpellsArray] = useState<Spell[]>([])
  const [typeOptions, setTypeOptions] = useState<boolean>(false)

  const sectionCategory = system.modifiers.categories.find((category) => category.id === sectionData?.category)

  const categoryName =
    sectionData?.category ?
      getKeyFromId(sectionData?.category, { ...ModifierCategories, ...ModifierSpellCategories })
    : null

  const path =
    categoryName ?
      getModifierProperties({
        category: categoryName,
      })
    : null

  useEffect(() => {
    if (sectionData.__typename == null) {
      updateSectionData({
        type: 'update',
        path: '__typename',
        value: 'FeatureModifier',
      })
    }
  }, [updateSectionData, sectionData.__typename])

  // Set if selected category has type options
  useEffect(() => {
    setTypeOptions(
      sectionData?.category === ModifierCategories.damageTypes ||
        sectionData?.category === ModifierCategories.abilityScores ||
        sectionData?.category === ModifierCategories.saveAbilities ||
        sectionData?.category === ModifierCategories.conditions ||
        sectionData?.category === ModifierCategories.conditionSave ||
        sectionData?.category === ModifierCategories.damageSave ||
        sectionData?.category === ModifierCategories.speeds ||
        sectionData?.category === ModifierCategories.spellDamage
    )
  }, [sectionData?.category])

  // Set modTypes and modMethods options
  useEffect(() => {
    if (sectionData != null) {
      let types: typeof system.modifiers.types = []
      if (sectionData?.category === ModifierCategories.spell) {
        types =
          system.modifiers.spellCategories
            ?.find((category) => category.id === sectionData?.spellCategory)
            ?.types?.map((type) => ({
              label: type.label,
              value: type.value,
              id: type.id,
              __typename: 'GenericType',
            })) || []
      } else {
        types =
          system.modifiers.categories
            ?.find((category) => category.id === sectionData?.category)
            ?.types?.map((type) => ({
              label: type.label,
              value: type.value,
              id: type.id,
              __typename: 'GenericType',
            })) || []
      }

      if (types?.length) {
        setModTypes(types)
      }
    }
    if (modTypes?.length) {
      if (sectionData?.category === ModifierCategories.spell) {
        const methods = system.modifiers.methods.filter((method) => {
          return system.modifiers.categoryMethods.some(
            (bridge) =>
              bridge.categoryId === sectionData?.spellCategory &&
              bridge.typeId === sectionData?.type &&
              bridge.methodId === method.id
          )
        })

        setModMethods(methods)
      } else {
        const methods = system.modifiers.methods.filter((method) => {
          return system.modifiers.categoryMethods.some(
            (bridge) =>
              bridge.methodId === method.id &&
              bridge.categoryId === sectionData?.category &&
              bridge.typeId === sectionData?.type
          )
        })

        setModMethods(methods)
      }
    }
  }, [modTypes, sectionData, system])

  // Filter spells array
  useEffect(() => {
    const filteredSpells = spells?.filter((spell) => {
      if (sectionData?.spellCategory === ModifierSpellCategories.spellDamage) {
        return spell.attributes?.some((attribute) => attribute === Attributes.doesDamage)
      }
      if (sectionData?.spellCategory === ModifierSpellCategories.spellRange && spell.range != null) {
        return true
      }
      if (sectionData?.spellCategory === ModifierSpellCategories.spellShape && spell.shape != null) {
        return true
      }
      if (sectionData?.spellCategory === ModifierSpellCategories.spellDuration && spell.duration != null) {
        return true
      }
      return false
    })
    setSpellsArray(filteredSpells)
  }, [sectionData?.spellCategory, spells, doesDamage])

  // Add/Remove die per level Table
  useEffect(() => {
    if (
      ((sectionData?.type !== ModifierTypes.setDie &&
        sectionData?.type !== ModifierTypes.bonusDie &&
        sectionData?.type !== ModifierTypes.penaltyDie) ||
        sectionData?.method !== ModifierMethods.setPerLevel ||
        !modMethods?.some((method) => method.id === ModifierMethods.setPerLevel)) &&
      sectionData?.diePerLevel?.length
    ) {
      updateSectionData({
        type: 'remove',
        path: 'diePerLevel',
      })
    }
    if (
      (sectionData?.type === ModifierTypes.setDie ||
        sectionData?.type === ModifierTypes.bonusDie ||
        sectionData?.type === ModifierTypes.penaltyDie) &&
      sectionData?.method === ModifierMethods.setPerLevel &&
      modMethods?.some((method) => method.id === ModifierMethods.setPerLevel) &&
      (!sectionData?.diePerLevel || !sectionData?.diePerLevel?.length)
    ) {
      updateSectionData({
        type: 'add',
        path: 'diePerLevel',
      })
    }
  }, [sectionData, updateSectionData, sectionData?.type, sectionData?.method, modMethods])

  // Add/remove setPerLevel table
  useEffect(() => {
    if (
      ((sectionData?.type !== ModifierTypes.setAmount &&
        sectionData?.type !== ModifierTypes.bonus &&
        sectionData?.type !== ModifierTypes.penalty) ||
        sectionData?.method !== ModifierMethods.setPerLevel ||
        !modMethods?.some((method) => method.id === ModifierMethods.setPerLevel)) &&
      sectionData?.setPerLevel?.length
    ) {
      updateSectionData({
        type: 'remove',
        path: 'setPerLevel',
      })
    }
    if (
      (sectionData?.type === ModifierTypes.setAmount ||
        sectionData?.type === ModifierTypes.bonus ||
        sectionData?.type === ModifierTypes.penalty) &&
      sectionData?.method === ModifierMethods.setPerLevel &&
      modMethods?.some((method) => method.id === ModifierMethods.setPerLevel) &&
      (!sectionData?.setPerLevel || !sectionData?.setPerLevel?.length)
    ) {
      updateSectionData({
        type: 'add',
        path: 'setPerLevel',
      })
    }
  }, [sectionData?.type, sectionData?.method, sectionData?.setPerLevel, updateSectionData, modMethods])

  if (!path) return null

  return (
    <>
      <Grid>
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            multiSelect={true}
            name='attributes'
            options={system.attributes.filter(
              (attribute) =>
                attribute?.sections?.length &&
                attribute?.sections?.includes(SectionEnum.all) &&
                (formData as Class).category === Categories.subclass &&
                attribute?.sections?.includes(SectionEnum.subclasses)
            )}
            label='Attrbutes'
            value={sectionData?.attributes}
            onChange={updateSectionData}
          />
        </Grid.Item>
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            name='category'
            label='Modifier Category'
            value={sectionData?.category}
            options={system.modifiers.categories}
            required={true}
            onChange={updateSectionData}
          />
        </Grid.Item>
        {sectionData?.category === ModifierCategories.spell && (
          <>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='spellCategory'
                label='Spell Category'
                value={sectionData?.spellCategory}
                options={system.modifiers.spellCategories}
                required={true}
                onChange={updateSectionData}
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='spell'
                label='Spell'
                value={sectionData?.spell}
                options={spellsArray}
                required={true}
                onChange={updateSectionData}
              />
            </Grid.Item>
          </>
        )}
        {modTypes?.length && sectionCategory != null && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='type'
              label='Modifier Type'
              value={sectionData?.type}
              options={modTypes}
              required={true}
              onChange={updateSectionData}
            />
          </Grid.Item>
        )}
        {modMethods != null && modMethods?.length && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='method'
              label='Method'
              value={sectionData?.method}
              options={modMethods}
              required={true}
              onChange={updateSectionData}
            />
          </Grid.Item>
        )}
        {typeOptions && sectionData?.category !== ModifierCategories.spell && sectionData?.category != null && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name={path}
              multiSelect={true}
              label={sectionCategory?.label}
              value={sectionData[path]}
              options={
                sectionData?.category === ModifierCategories.saveAbilities ? system.abilities
                : sectionData?.category === ModifierCategories.conditionSave ?
                  system.conditions
                : (
                  sectionData?.category === ModifierCategories.spellDC ||
                  sectionData?.category === ModifierCategories.damageSave
                ) ?
                  system.damageTypes
                : system[path as 'damageTypes' | 'conditions' | 'abilities' | 'speeds']
              }
              required={true}
              onChange={updateSectionData}
            />
          </Grid.Item>
        )}
        {sectionData?.category === ModifierCategories.charge && sectionData?.type === ModifierTypes.useReset && (
          <>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='charge.reset'
                label='Reset Option'
                value={sectionData?.charge?.reset}
                options={system.charges.resets}
                required={true}
                onChange={updateSectionData}
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='feature'
                label='Feature'
                value={sectionData?.feature}
                options={[
                  ...((formData as Exclude<FormDataType, Spell | Character>)?.features || []),
                  { ...((formData as Class)?.resource as Resource) },
                ]}
                required={true}
                onChange={updateSectionData}
              />
            </Grid.Item>
          </>
        )}
        {sectionData?.category === ModifierCategories.spell &&
          (sectionData?.spellCategory === ModifierSpellCategories.spellDuration ?
            <>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='duration'
                  label='Spell Duration Type'
                  value={sectionData?.duration}
                  options={system.spells.durations}
                  required={true}
                  onChange={updateSectionData}
                />
              </Grid.Item>
              {sectionData?.type === ModifierTypes.setAmount && (
                <>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      validation='num'
                      name='setAmount'
                      label='Duration Increment'
                      errorMsg='Must contain only whole numbers'
                      autoComplete='off'
                      value={sectionData?.setAmount}
                      onChange={updateSectionData}
                    />
                  </Grid.Item>
                </>
              )}
            </>
          : sectionData?.spellCategory === ModifierSpellCategories.spellRange ?
            <>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='range'
                  label='Spell Range Type'
                  value={sectionData?.range}
                  options={system.spells.ranges}
                  required={true}
                  onChange={updateSectionData}
                />
              </Grid.Item>
              {sectionData?.type === ModifierTypes.setAmount && (
                <>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      validation='num'
                      name='minAmount'
                      label='Minimum Value'
                      errorMsg='Must contain only whole numbers'
                      autoComplete='off'
                      value={sectionData?.minAmount}
                      onChange={updateSectionData}
                    />
                  </Grid.Item>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      validation='num'
                      name='maxAmount'
                      label='Maximum Value'
                      errorMsg='Must contain only whole numbers'
                      autoComplete='off'
                      value={sectionData?.maxAmount}
                      onChange={updateSectionData}
                    />
                  </Grid.Item>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      name='unit'
                      label='UoM'
                      value={sectionData?.unit}
                      options={Object.values(system.rules.measurements.imperial).flatMap((rule) => {
                        if (Array.isArray(rule)) {
                          return rule
                        }
                        return []
                      })}
                      required={sectionData?.range === Ranges.distance ? true : false}
                      onChange={updateSectionData}
                    />
                  </Grid.Item>
                </>
              )}
            </>
          : sectionData?.spellCategory === ModifierSpellCategories.spellShape && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='shape'
                    label='Spell Shape Type'
                    value={sectionData?.shape}
                    options={system.spells.shapes}
                    required={true}
                    onChange={updateSectionData}
                  />
                </Grid.Item>
                {sectionData?.type === ModifierTypes.setAmount && (
                  <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        validation='num'
                        name='size'
                        label='Shape Size'
                        errorMsg='Must contain only whole numbers'
                        autoComplete='off'
                        value={sectionData?.size}
                        onChange={updateSectionData}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='unit'
                        label='UoM'
                        value={sectionData?.unit}
                        options={Object.values(system.rules.measurements.imperial).flatMap((rule) => {
                          if (Array.isArray(rule)) {
                            return rule
                          }
                          return []
                        })}
                        required={true}
                        onChange={updateSectionData}
                      />
                    </Grid.Item>
                  </>
                )}
              </>
            ))}
        {sectionData?.method != null && sectionData?.method !== ModifierMethods.setPerLevel && (
          <>
            {(sectionData?.type === ModifierTypes.bonus || sectionData?.type === ModifierTypes.setAmount) && (
              <>
                {sectionData?.method === ModifierMethods.setGlobally ?
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      validation='num'
                      name='setAmount'
                      label='Set Value'
                      errorMsg='Must contain only numbers'
                      autoComplete='off'
                      value={sectionData?.setAmount}
                      required={true}
                      onChange={updateSectionData}
                    />
                  </Grid.Item>
                : sectionData?.method === ModifierMethods.abilityScoreModifier ?
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      name='methodAbility'
                      label='Method Ability'
                      value={sectionData?.methodAbility}
                      options={system.abilities}
                      required={true}
                      onChange={updateSectionData}
                    />
                  </Grid.Item>
                : sectionData?.method === ModifierMethods.skillModifier && (
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='methodSkill'
                        label='Method Skill'
                        value={sectionData?.methodSkill}
                        options={system.skills}
                        required={true}
                        onChange={updateSectionData}
                      />
                    </Grid.Item>
                  )
                }
              </>
            )}
            {sectionData?.method !== ModifierMethods.setGlobally && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    validation='num'
                    name='multiplier'
                    label='Multiplier'
                    errorMsg='Must contain only whole numbers'
                    autoComplete='off'
                    value={sectionData?.multiplier}
                    onChange={updateSectionData}
                  />
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    validation='num'
                    name='minAmount'
                    label='Minimum Value'
                    errorMsg='Must contain only whole numbers'
                    autoComplete='off'
                    value={sectionData?.minAmount}
                    onChange={updateSectionData}
                  />
                </Grid.Item>
              </>
            )}
          </>
        )}
        {subtypeSpecific &&
          formData.__typename === 'Class' &&
          sectionData?.category != null &&
          formData?.subtypes?.length && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='subtype'
                label='Subclass Subtype'
                value={sectionData?.subtype}
                options={formData?.subtypes}
                required={true}
                onChange={updateSectionData}
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
              value={sectionData?.selectionCount}
              errorMsg='Must contain only numbers'
              required={true}
              onChange={updateSectionData}
            />
          </Grid.Item>
        )}
        {hasPrerequisites && (
          <Grid.Item>
            <Prerequisites formData={sectionData} updateFormData={updateSectionData} />
          </Grid.Item>
        )}
        {sectionData?.method === ModifierMethods.setPerLevel && sectionData?.diePerLevel?.length && (
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
                  {sectionData?.diePerLevel?.map((setLevel, index) => (
                    <Grid.Item key={index}>
                      <Grid>
                        <Grid.Item colSpan={'auto'}>
                          <Input
                            name={`diePerLevel.${index}.level`}
                            value={setLevel.level}
                            validation='num'
                            errorMsg='Please enter a whole number'
                            onChange={updateSectionData}
                            required={true}
                          />
                        </Grid.Item>
                        <Grid.Item colSpan={'auto'}>
                          <Input
                            name={`diePerLevel.${index}.dieConfig`}
                            value={setLevel.dieConfig}
                            validation='num'
                            errorMsg='Please enter a valid die value'
                            onChange={updateSectionData}
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
        {sectionData?.method === ModifierMethods.setPerLevel && sectionData?.setPerLevel?.length && (
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
                  {sectionData?.setPerLevel?.map((setLevel, index) => (
                    <Grid.Item key={index}>
                      <Grid>
                        <Grid.Item colSpan={'auto'}>
                          <Input
                            name={`setPerLevel.${index}.level`}
                            value={setLevel.level}
                            validation='num'
                            errorMsg='Please enter a whole number'
                            onChange={updateSectionData}
                            required={true}
                          />
                        </Grid.Item>
                        <Grid.Item colSpan={'auto'}>
                          <Input
                            name={`setPerLevel.${index}.setAmount`}
                            value={setLevel.setAmount}
                            validation='num'
                            errorMsg='Please enter a whole number'
                            onChange={updateSectionData}
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
