import { useEffect, useState } from 'react'
import Row from '../../../Row/Row'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import Collapse from '../../../Collapse/Collapse'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { useListSpellsQuery } from '../../../../features/spells/spellsApi'
import { FeatureContext } from '../FeatureContext'
import { FormDataType, UpdateState } from '../../../../types/form'
import { Character, Class, FeatureModifier, SectionEnum, Spell } from '../../../../../amplify/gql/types'
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
import Prerequisites from '../../Generic/Requirements'

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
  const [modMethods, setModMethods] = useState<typeof system.modifiers.methods>(null)
  const [spellsArray, setSpellsArray] = useState<Spell[]>([])
  const [typeOptions, setTypeOptions] = useState<boolean>(false)

  const sectionCategory = system.modifiers.categories.find((category) => category.id === sectionData?.category)

  const categoryName = getKeyFromId(sectionData?.category, { ...ModifierCategories, ...ModifierSpellCategories })

  const path = getModifierProperties({
    category: categoryName,
  })

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
      if (sectionData?.category === ModifierCategories.spell) {
        const types = system.modifiers.spellCategories?.find(
          (category) => category.id === sectionData?.spellCategory
        )?.types

        setModTypes(types)
      } else {
        const types = system.modifiers.categories?.find((category) => category.id === sectionData?.category)?.types

        setModTypes(types)
      }
    }
    if (modTypes?.length > 0) {
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
  }, [system.modifiers.categories, system.modifiers.spellCategories, modTypes, sectionData, system.modifiers])

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

  console.log({ sectionData })

  // Add/Remove die per level Table
  useEffect(() => {
    if (
      (sectionData?.diePerLevel || sectionData?.diePerLevel?.length > 0) &&
      (sectionData?.type !== ModifierTypes.setDie || sectionData?.method !== ModifierMethods.setPerLevel)
    ) {
      updateSectionData({
        type: 'remove',
        path: 'diePerLevel',
      })
    }
    if (
      sectionData?.type === ModifierTypes.setDie &&
      sectionData?.method === ModifierMethods.setPerLevel &&
      (!sectionData?.diePerLevel || !(sectionData?.diePerLevel?.length > 0))
    ) {
      updateSectionData({
        type: 'add',
        path: 'diePerLevel',
      })
    }
  }, [sectionData, updateSectionData, sectionData?.type, sectionData?.method])

  // Add/remove setPerLevel table
  useEffect(() => {
    if (
      (sectionData?.setPerLevel || sectionData?.setPerLevel?.length > 0) &&
      (sectionData?.type !== ModifierTypes.setAmount || sectionData?.method !== ModifierMethods.setPerLevel)
    ) {
      updateSectionData({
        type: 'remove',
        path: 'setPerLevel',
      })
    }
    if (
      sectionData?.type === ModifierTypes.setAmount &&
      sectionData?.method === ModifierMethods.setPerLevel &&
      (!sectionData?.setPerLevel || !(sectionData?.setPerLevel?.length > 0))
    ) {
      updateSectionData({
        type: 'add',
        path: 'setPerLevel',
      })
    }
  }, [sectionData, updateSectionData])

  return (
    <>
      <Row>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={system.attributes.filter(
            (attribute) =>
              attribute?.sections?.length > 0 &&
              attribute?.sections?.includes(SectionEnum.all) &&
              (formData as Class).category === Categories.subclass &&
              attribute?.sections?.includes(SectionEnum.subclasses)
          )}
          label='Attrbutes'
          value={sectionData?.attributes}
          onChange={updateSectionData}
        />
        <Dropdown
          name='category'
          label='Modifier Category'
          value={sectionData?.category}
          options={system.modifiers.categories}
          required={true}
          onChange={updateSectionData}
        />
        {sectionData?.category === ModifierCategories.spell && (
          <>
            <Dropdown
              name='spellCategory'
              label='Spell Category'
              value={sectionData?.spellCategory}
              options={system.modifiers.spellCategories}
              required={true}
              onChange={updateSectionData}
            />
            <Dropdown
              name='spell'
              label='Spell'
              value={sectionData?.spell}
              options={spellsArray}
              required={true}
              onChange={updateSectionData}
            />
          </>
        )}
        {modTypes?.length > 0 && sectionCategory != null && (
          <Dropdown
            name='type'
            label='Modifier Type'
            value={sectionData?.type}
            options={modTypes}
            required={true}
            onChange={updateSectionData}
          />
        )}
        {typeOptions && sectionData?.category !== ModifierCategories.spell && (
          <Dropdown
            name={`${path}`}
            multiSelect={true}
            label={`${sectionCategory.label}`}
            value={sectionData[path]}
            options={
              sectionData?.category === ModifierCategories.saveAbilities
                ? system.abilities
                : sectionData?.category === ModifierCategories.conditionSave
                ? system.conditions
                : sectionData?.category === ModifierCategories.spellDC ||
                  sectionData?.category === ModifierCategories.damageSave
                ? system.damageTypes
                : system[path as 'damageTypes' | 'conditions' | 'abilities' | 'speeds']
            }
            required={true}
            onChange={updateSectionData}
          />
        )}
        {modMethods != null && modMethods?.length > 0 && (
          <Dropdown
            name='method'
            label='Method'
            value={sectionData?.method}
            options={modMethods}
            required={true}
            onChange={updateSectionData}
          />
        )}
        {sectionData?.category === ModifierCategories.charge && sectionData?.type === ModifierTypes.useReset && (
          <>
            <Dropdown
              name='charge.reset'
              label='Reset Option'
              value={sectionData?.charge?.reset}
              options={system.charges.resets}
              required={true}
              onChange={updateSectionData}
            />
            <Dropdown
              name='feature'
              label='Feature'
              value={sectionData?.feature}
              options={[].concat(
                (formData as Exclude<FormDataType, Spell | Character>)?.features,
                (formData as Class).resource
              )}
              required={true}
              onChange={updateSectionData}
            />
          </>
        )}
        {sectionData?.category === ModifierCategories.spell &&
          (sectionData?.spellCategory === ModifierSpellCategories.spellDuration ? (
            <>
              <Dropdown
                name='duration'
                label='Spell Duration Type'
                value={sectionData?.duration}
                options={system.spells.durations}
                required={true}
                onChange={updateSectionData}
              />
              {sectionData?.type === ModifierTypes.setAmount && (
                <>
                  <Input
                    validation='num'
                    name='setAmount'
                    label='Duration Increment'
                    errorMsg='Must contain only whole numbers'
                    autoComplete='off'
                    value={sectionData?.setAmount}
                    onChange={updateSectionData}
                  />
                </>
              )}
            </>
          ) : sectionData?.spellCategory === ModifierSpellCategories.spellRange ? (
            <>
              <Dropdown
                name='range'
                label='Spell Range Type'
                value={sectionData?.range}
                options={system.spells.ranges}
                required={true}
                onChange={updateSectionData}
              />
              {sectionData?.type === ModifierTypes.setAmount && (
                <>
                  <Input
                    validation='num'
                    name='minAmount'
                    label='Minimum Value'
                    errorMsg='Must contain only whole numbers'
                    autoComplete='off'
                    value={sectionData?.minAmount}
                    onChange={updateSectionData}
                  />
                  <Input
                    validation='num'
                    name='maxAmount'
                    label='Maximum Value'
                    errorMsg='Must contain only whole numbers'
                    autoComplete='off'
                    value={sectionData?.maxAmount}
                    onChange={updateSectionData}
                  />
                  <Dropdown
                    name='unit'
                    label='UoM'
                    value={sectionData?.unit}
                    options={Object.values(system.rules.measurements.imperial).flatMap(
                      (rule) => Array.isArray(rule) && rule
                    )}
                    required={sectionData?.range === Ranges.distance ? true : false}
                    onChange={updateSectionData}
                  />
                </>
              )}
            </>
          ) : (
            sectionData?.spellCategory === ModifierSpellCategories.spellShape && (
              <>
                <Dropdown
                  name='shape'
                  label='Spell Shape Type'
                  value={sectionData?.shape}
                  options={system.spells.shapes}
                  required={true}
                  onChange={updateSectionData}
                />
                {sectionData?.type === ModifierTypes.setAmount && (
                  <>
                    <Input
                      validation='num'
                      name='size'
                      label='Shape Size'
                      errorMsg='Must contain only whole numbers'
                      autoComplete='off'
                      value={sectionData?.size}
                      onChange={updateSectionData}
                    />
                    <Dropdown
                      name='unit'
                      label='UoM'
                      value={sectionData?.unit}
                      options={Object.values(system.rules.measurements.imperial).flatMap(
                        (rule) => Array.isArray(rule) && rule
                      )}
                      required={true}
                      onChange={updateSectionData}
                    />
                  </>
                )}
              </>
            )
          ))}
        {sectionData?.method != null && sectionData?.method !== ModifierMethods.setPerLevel && (
          <>
            {(sectionData?.type === ModifierTypes.bonus || sectionData?.type === ModifierTypes.setAmount) && (
              <>
                {sectionData?.method === ModifierMethods.setGlobally ? (
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
                ) : sectionData?.method === ModifierMethods.abilityScoreModifier ? (
                  <Dropdown
                    name='methodAbility'
                    label='Method Ability'
                    value={sectionData?.methodAbility}
                    options={system.abilities}
                    required={true}
                    onChange={updateSectionData}
                  />
                ) : (
                  sectionData?.method === ModifierMethods.skillModifier && (
                    <Dropdown
                      name='methodSkill'
                      label='Method Skill'
                      value={sectionData?.methodSkill}
                      options={system.skills}
                      required={true}
                      onChange={updateSectionData}
                    />
                  )
                )}
              </>
            )}
            {sectionData?.method !== ModifierMethods.setGlobally && (
              <>
                <Input
                  validation='num'
                  name='multiplier'
                  label='Multiplier'
                  errorMsg='Must contain only whole numbers'
                  autoComplete='off'
                  value={sectionData?.multiplier}
                  onChange={updateSectionData}
                />
                <Input
                  validation='num'
                  name='minAmount'
                  label='Minimum Value'
                  errorMsg='Must contain only whole numbers'
                  autoComplete='off'
                  value={sectionData?.minAmount}
                  onChange={updateSectionData}
                />
              </>
            )}
          </>
        )}
        {subtypeSpecific && formData.__typename === 'Class' && sectionData?.category != null && (
          <Dropdown
            name='subtype'
            label='Subclass Subtype'
            value={sectionData?.subtype}
            options={formData?.subtypes}
            required={true}
            onChange={updateSectionData}
          />
        )}
        {providesOptions && (
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
        )}
      </Row>
      {hasPrerequisites && <Prerequisites formData={sectionData} updateFormData={updateSectionData} />}
      {sectionData?.type === ModifierTypes.setDie &&
        sectionData?.method === ModifierMethods.setPerLevel &&
        sectionData?.diePerLevel?.length > 0 && (
          <Collapse>
            <Collapse.Header title='Die Per Level' />
            <Collapse.Body>
              <Row spacing='spaceBetween' cellSize='auto'>
                <span>Level</span>
                <span>Die Count</span>
                <span>Die Value</span>
              </Row>
              {sectionData?.diePerLevel?.map((setLevel, index) => (
                <Row key={index} spacing='spaceBetween' cellSize='auto'>
                  <Input
                    name={`diePerLevel.${index}.level`}
                    value={setLevel.level}
                    validation='num'
                    errorMsg='Please enter a whole number'
                    onChange={updateSectionData}
                    required={true}
                  />
                  <Input
                    name={`diePerLevel.${index}.dieConfig`}
                    value={setLevel.dieConfig}
                    validation='num'
                    errorMsg='Please enter a valid die value'
                    onChange={updateSectionData}
                    required={true}
                  />
                </Row>
              ))}
            </Collapse.Body>
          </Collapse>
        )}
      {sectionData?.method === ModifierMethods.setPerLevel && sectionData?.setPerLevel?.length > 0 && (
        <Collapse>
          <Collapse.Header title='Set Per Level' />
          <Collapse.Body>
            <Row spacing='spaceBetween' cellSize='auto'>
              <span>Level</span>
              <span>Amount</span>
            </Row>
            {sectionData?.setPerLevel?.map((setLevel, index) => (
              <Row key={index} spacing='spaceBetween' cellSize='auto'>
                <Input
                  name={`setPerLevel.${index}.level`}
                  value={setLevel.level}
                  validation='num'
                  errorMsg='Please enter a whole number'
                  onChange={updateSectionData}
                  required={true}
                />
                <Input
                  name={`setPerLevel.${index}.setAmount`}
                  value={setLevel.setAmount}
                  validation='num'
                  errorMsg='Please enter a whole number'
                  onChange={updateSectionData}
                  required={true}
                />
              </Row>
            ))}
          </Collapse.Body>
        </Collapse>
      )}
    </>
  )
}

export default Modifiers
