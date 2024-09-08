import { useEffect, useState } from 'react'
import { DropdownOptionType } from '../../../../utils/types'
import Row from '../../../Row/Row'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { startCase, isEqual } from 'lodash'
import Collapse from '../../../Collapse/Collapse'
import Table from '../../../Table/Table'
import { useForm } from '../../../../hooks/UseForm'
import { useFeature } from '../../../../hooks/UseFeature'
import { useGetBuildersQuery } from '../../../../features/builders/buildersApi'
import { useGetSpellsQuery } from '../../../../features/spells/spellsApi'

type CategoryType =
  | 'armorClass'
  | 'saveAbility'
  | 'spellSlot'
  | 'skills'
  | 'abilities'
  | 'meleeAttack'
  | 'rangeAttack'
  | 'unarmedAttack'
  | 'unarmedDamage'
  | 'spellAttack'
  | 'spellDC'
  | 'damage'
  | 'spellDamage'
  | 'passive'
  | 'speed'
  | 'condition'
  | 'proficiencyBonus'
  | 'initiative'
  | 'hitPoints'
  | 'meleeDamage'
  | 'rangeDamage'
  | 'damageSave'
  | 'conditionSave'
  | 'limitUse'
  | 'spell'
  | 'modifierAbility'
  | 'optionalModifierAbility'

const Modifiers = () => {
  const { formState, context } = useForm()
  const { sectionState, setSectionState } = useFeature()

  const { data: builders } = useGetBuildersQuery()
  const { data: spells } = useGetSpellsQuery() as { data: any[] }

  const providesOptions = sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'providesOptions')

  const [modMode, setModMode] = useState<DropdownOptionType[]>([])
  const [modMethod, setModMethod] = useState<DropdownOptionType[] | null>(null)
  const [spellsArray, setSpellsArray] = useState<DropdownOptionType[]>([])
  const [typeOptions, setTypeOptions] = useState<boolean>(false)

  const categoryName: CategoryType = sectionState?.category?.name
  const subCategoryName = sectionState.spellCategory?.name
  const pathName = subCategoryName != null ? `${categoryName}.${subCategoryName}` : `${categoryName}`

  useEffect(() => {
    const sectionItem = JSON.parse(JSON.stringify(sectionState))
    if (Object.keys(sectionItem)?.length > 0) {
      if (sectionItem.category) {
        Object.keys(sectionItem).forEach((key) => {
          if (
            key !== 'category' &&
            key !== sectionItem.category?.name &&
            key !== '_id' &&
            key !== 'id' &&
            key !== 'attribute' &&
            key !== 'selectionCount'
          ) {
            delete sectionItem[key]
          }
        })
      }
    }

    if (!isEqual(sectionItem, sectionState)) {
      setSectionState({
        type: 'reset',
        target: { value: sectionItem },
      })
    }
  }, [sectionState, setSectionState])

  // Set if selected category has type options
  useEffect(() => {
    categoryName === 'damage' ||
    categoryName === 'abilities' ||
    categoryName === 'saveAbility' ||
    categoryName === 'condition' ||
    categoryName === 'conditionSave' ||
    categoryName === 'damageSave' ||
    categoryName === 'speed' ||
    categoryName === 'passive' ||
    categoryName === 'modifierAbility' ||
    categoryName === 'optionalModifierAbility' ||
    categoryName === 'spellDamage'
      ? setTypeOptions(true)
      : setTypeOptions(false)
  }, [categoryName])

  // Set modMode and modMethod options
  useEffect(() => {
    if (categoryName != null) {
      if (categoryName === 'spell') {
        const mode = builders.modifiers.spellCategory?.find(
          (cat: any) => cat._id === sectionState.spellCategory?._id
        )?.mode

        setModMode(mode)
      } else {
        const modeCategory = builders.modifiers.category?.find((cat: any) => cat._id === sectionState.category?._id)
        const mode = modeCategory?.mode

        setModMode(mode)
      }
    }
    if (modMode?.length > 0) {
      if (categoryName === 'spell') {
        const method = builders.modifiers.spellCategory
          ?.find((cat: any) => cat._id === sectionState.spellCategory?._id)
          ?.mode?.find((ty: any) => ty._id === sectionState[pathName]?.mode?._id)?.method

        setModMethod(method)
      } else {
        const methodCategory = builders.modifiers.category
          ?.find((cat: any) => cat._id === sectionState.category?._id)
          ?.mode?.find((mo: any) => mo._id === sectionState[pathName]?.mode?._id)

        const method = methodCategory?.method

        setModMethod(method)
      }
    }
  }, [
    builders.modifiers.category,
    builders.modifiers.spellCategory,
    modMode,
    sectionState,
    sectionState.spellCategory?._id,
    categoryName,
    pathName,
  ])

  // Filter spells array
  useEffect(() => {
    const filteredSpells = (spells as DropdownOptionType[])?.filter((spell) => {
      if (subCategoryName === 'damageSave') {
        return spell.attribute?.some((attributeItem: any) => attributeItem.name === 'requireSave')
      }
      if (subCategoryName === 'spellDamage') {
        return spell.attribute?.some((attributeItem: any) => attributeItem.name === 'doesDamage')
      }
      if (subCategoryName === 'spellRange') {
        return spell.range && spell.range.minRange && spell.range.maxRange
      }
      if (subCategoryName === 'spellShape') {
        return spell.shape && spell.shape.type && spell.shape.size
      }
      if (subCategoryName === 'spellDuration') {
        return spell.duration && spell.duration.type && spell.duration.value
      }
      return false
    })
    setSpellsArray(filteredSpells)
  }, [subCategoryName, spells])

  // Add/Remove die per level Table
  useEffect(() => {
    if (
      (sectionState?.[pathName]?.diePerLevel || sectionState?.[pathName]?.diePerLevel?.length > 0) &&
      (sectionState?.[pathName]?.mode?.name !== 'setValue' || sectionState?.[pathName]?.method?.name !== 'diePerLevel')
    ) {
      setSectionState({
        type: 'removed',
        target: {
          name: `${pathName}.diePerLevel`,
        },
      })
    }
    if (
      sectionState?.[pathName]?.mode?.name === 'setValue' &&
      sectionState?.[pathName]?.method?.name === 'diePerLevel' &&
      (!sectionState?.[pathName]?.diePerLevel || !(sectionState?.[pathName]?.diePerLevel?.length > 0))
    ) {
      setSectionState({
        type: 'added',
        target: {
          name: `${pathName}.diePerLevel`,
        },
      })
    }
  }, [pathName, sectionState, setSectionState, sectionState.type, sectionState.method])

  // Add/remove setPerLevel table
  useEffect(() => {
    if (sectionState[pathName]?.setPerLevel && sectionState[pathName]?.method?.name !== 'setPerLevel') {
      setSectionState({
        type: 'removed',
        target: {
          name: `${pathName}.setPerLevel`,
        },
      })
    }
    if (
      sectionState[pathName]?.method?.name === 'setPerLevel' &&
      (!sectionState[pathName]?.setPerLevel || !(sectionState[pathName]?.setPerLevel?.length > 0))
    ) {
      setSectionState({
        type: 'added',
        target: {
          name: `${pathName}.setPerLevel`,
        },
      })
    }
  }, [sectionState, pathName, setSectionState])

  return (
    <>
      <Row>
        <Dropdown
          multiSelect={true}
          name={`attribute`}
          options={[].concat(
            builders.section.attribute,
            formState.category?.name === 'subclass' && builders.section.subclass.attribute
          )}
          label={`${startCase('modifier')} Attributes`}
          value={sectionState.attribute}
          onChange={setSectionState}
        />
        <Dropdown
          name={`category`}
          label='Modifier Category'
          value={sectionState.category}
          options={builders.modifiers.category}
          required={true}
          onChange={setSectionState}
        />
        {categoryName === 'spell' && (
          <>
            <Dropdown
              name={`spellCategory`}
              label='Spell Category'
              value={sectionState.spellCategory}
              options={builders.modifiers.spellCategory}
              required={true}
              onChange={setSectionState}
            />
            <Dropdown
              name={`${categoryName}.type`}
              label='Spell'
              value={sectionState[categoryName]?.type}
              options={spellsArray}
              required={true}
              onChange={setSectionState}
            />
          </>
        )}
        {typeOptions && (
          <Dropdown
            name={`${pathName}.type`}
            multiSelect={true}
            label={`${startCase(sectionState.category?.value)} Type`}
            value={sectionState[pathName]?.type}
            options={
              categoryName === 'saveAbility'
                ? builders.abilities.type
                : categoryName === 'conditionSave'
                  ? builders.condition.type
                  : categoryName === 'spellDamage' || categoryName === 'damageSave'
                    ? builders.damage.type
                    : builders[categoryName]?.type
            }
            required={true}
            onChange={setSectionState}
          />
        )}
        {modMode?.length > 0 && categoryName && (
          <Dropdown
            name={`${pathName}.mode`}
            label='Modifier Mode'
            value={sectionState[pathName]?.mode}
            options={modMode.map((mode: any) => ({
              name: mode.name,
              value: mode.value,
              _id: mode._id,
              desc: mode?.desc,
            }))}
            required={true}
            onChange={setSectionState}
          />
        )}
        {modMethod != null && modMethod?.length > 0 && (
          <Dropdown
            name={`${pathName}.method`}
            label='Method'
            value={sectionState[pathName]?.method}
            options={modMethod?.map((method: any) => ({
              name: method.name,
              value: method.value,
              _id: method._id,
              desc: method?.desc,
            }))}
            required={true}
            onChange={setSectionState}
          />
        )}
        {categoryName === 'limitUse' && sectionState[pathName]?.mode?.name === 'useReset' && (
          <>
            <Dropdown
              name={`${pathName}.charge.reset`}
              label='Reset Option'
              value={sectionState[pathName]?.charge?.reset}
              options={builders.features.charge.reset}
              required={true}
              onChange={setSectionState}
            />
            <Dropdown
              name={`${pathName}.feature`}
              label='Feature'
              value={sectionState[pathName]?.feature}
              options={[].concat(formState?.feature, context.title === 'classes' && formState.resource)}
              required={true}
              onChange={setSectionState}
            />
          </>
        )}
        {categoryName === 'spell' && (
          <>
            <Dropdown
              name={`spellCategory`}
              label='Spell Category'
              value={sectionState.spellCategory}
              options={builders.modifiers.spellCategory}
              required={true}
              onChange={setSectionState}
            />
            <Dropdown
              name={`${categoryName}.type`}
              label='Spell'
              value={sectionState[categoryName]?.type}
              options={spellsArray}
              required={true}
              onChange={setSectionState}
            />
            {subCategoryName === 'spellDuration' ? (
              <>
                <Dropdown
                  name={`${pathName}.type`}
                  label='Spell Duration Type'
                  value={sectionState[pathName]?.type}
                  options={builders.spells.duration.type}
                  required={true}
                  onChange={setSectionState}
                />
                {sectionState[pathName]?.mode?.name === 'setValue' && (
                  <>
                    <Input
                      validation='num'
                      name={`${pathName}.value`}
                      label='Duration Increment'
                      errorMsg='Must contain only whole numbers'
                      autoComplete='off'
                      value={sectionState[pathName]?.value}
                      onChange={setSectionState}
                    />
                  </>
                )}
              </>
            ) : subCategoryName === 'spellRange' ? (
              <>
                <Dropdown
                  name={`${pathName}.type`}
                  label='Spell Range Type'
                  value={sectionState[pathName]?.type}
                  options={builders.spells.range.type}
                  required={true}
                  onChange={setSectionState}
                />
                {sectionState[pathName]?.method.name === 'setValue' && (
                  <>
                    <Input
                      validation='num'
                      name={`${pathName}.minValue`}
                      label='Minimum Value'
                      errorMsg='Must contain only whole numbers'
                      autoComplete='off'
                      value={sectionState[categoryName][subCategoryName]?.minValue}
                      onChange={setSectionState}
                    />
                    <Input
                      validation='num'
                      name={`${pathName}.maxValue`}
                      label='Maximum Value'
                      errorMsg='Must contain only whole numbers'
                      autoComplete='off'
                      value={sectionState[categoryName][subCategoryName]?.maxValue}
                      onChange={setSectionState}
                    />
                    <Dropdown
                      name={`${pathName}.unit`}
                      label='UoM'
                      value={sectionState[categoryName][subCategoryName]?.unit}
                      options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOptionType[]}
                      required={sectionState[categoryName][subCategoryName]?.type?.name === 'distance' ? true : false}
                      onChange={setSectionState}
                    />
                  </>
                )}
              </>
            ) : (
              subCategoryName === 'spellShape' && (
                <>
                  <Dropdown
                    name={`${pathName}.type`}
                    label='Spell Shape Type'
                    value={sectionState[pathName]?.type}
                    options={builders.spells.shape.type}
                    required={true}
                    onChange={setSectionState}
                  />
                  {sectionState[pathName]?.mode?.name === 'setValue' && (
                    <>
                      <Input
                        validation='num'
                        name={`${pathName}.size`}
                        label='Shape Size'
                        errorMsg='Must contain only whole numbers'
                        autoComplete='off'
                        value={sectionState[pathName]?.size}
                        onChange={setSectionState}
                      />
                      <Dropdown
                        name={`${pathName}.unit`}
                        label='UoM'
                        value={sectionState[pathName]?.unit}
                        options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOptionType[]}
                        required={sectionState[pathName]?.type?.name === 'distance' ? true : false}
                        onChange={setSectionState}
                      />
                    </>
                  )}
                </>
              )
            )}
          </>
        )}
        {categoryName !== 'spell' &&
          sectionState[pathName]?.method?.name &&
          sectionState[pathName]?.method?.name !== 'setPerLevel' &&
          sectionState[pathName]?.method?.name !== 'diePerLevel' && (
            <>
              {(sectionState[pathName]?.mode?.name === 'bonus' ||
                sectionState[pathName]?.mode?.name === 'setValue' ||
                sectionState[pathName]?.mode?.name === 'modifierAbility' ||
                sectionState[pathName]?.mode?.name === 'optionalModifierAbility') && (
                <>
                  {sectionState[pathName]?.method?.name === 'setValue' ? (
                    <Input
                      validation='num'
                      name={`${pathName}.setValue`}
                      label='Set Value'
                      errorMsg='Must contain only numbers'
                      autoComplete='off'
                      value={sectionState[pathName]?.setValue}
                      required={true}
                      onChange={setSectionState}
                    />
                  ) : sectionState[pathName]?.method?.name === 'ability' ? (
                    <Dropdown
                      name={`${pathName}.modAbility.type`}
                      label='Method Ability'
                      value={sectionState[pathName]?.modAbility?.type}
                      options={builders.abilities.type}
                      required={true}
                      onChange={setSectionState}
                    />
                  ) : (
                    sectionState[pathName]?.method?.name === 'skill' && (
                      <Dropdown
                        name={`${pathName}.modSkill.type`}
                        label='Method Skill'
                        value={sectionState[pathName]?.modSkill?.type}
                        options={builders.skills.type}
                        required={true}
                        onChange={setSectionState}
                      />
                    )
                  )}
                  {sectionState[pathName]?.mode?.name !== 'modifierAbility' && (
                    <Input
                      validation='num'
                      name={`${pathName}.maxValue`}
                      label='Max Value'
                      autoComplete='off'
                      value={sectionState[pathName]?.maxValue}
                      errorMsg='Must contain only numbers'
                      onChange={setSectionState}
                    />
                  )}
                </>
              )}
              {sectionState[pathName]?.method?.name !== 'setValue' && (
                <>
                  <Input
                    validation='num'
                    name={`${pathName}.multiplier`}
                    label='Multiplier'
                    errorMsg='Must contain only whole numbers'
                    autoComplete='off'
                    value={sectionState[pathName]?.multiplier}
                    onChange={setSectionState}
                  />
                  <Input
                    validation='num'
                    name={`${pathName}.minValue`}
                    label='Minimum Value'
                    errorMsg='Must contain only whole numbers'
                    autoComplete='off'
                    value={sectionState[pathName]?.minValue}
                    onChange={setSectionState}
                  />
                </>
              )}
            </>
          )}
        {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'subtypeSpecific') &&
          categoryName != null && (
            <Dropdown
              name={`${pathName}.subtype`}
              multiSelect={true}
              label='Subclass Subtype'
              value={sectionState[pathName]?.subtype}
              options={formState?.subtype}
              required={true}
              onChange={setSectionState}
            />
          )}
        {providesOptions && (
          <Input
            validation='num'
            name={`selectionCount`}
            label='# of Selections'
            autoComplete='off'
            value={sectionState.selectionCount}
            errorMsg='Must contain only numbers'
            required={true}
            onChange={setSectionState}
          />
        )}
      </Row>
      {sectionState[pathName]?.mode?.name === 'setValue' && sectionState[pathName]?.method?.name === 'diePerLevel' && (
        <Collapse>
          <Collapse.Header title='Die Per Level' />
          <Collapse.Body>
            <Table
              name={`${pathName}.diePerLevel`}
              rows={{
                inputs: [
                  {
                    name: 'level',
                    validation: 'num',
                    errorMsg: 'Must be whole numbers only',
                  },
                  {
                    name: 'diceCount',
                    validation: 'num',
                    errorMsg: 'Must be whole numbers only',
                  },
                  {
                    name: 'diceValue',
                    validation: 'num',
                    type: 'select',
                    options: builders.system.dice,
                  },
                ],
                headers: [
                  {
                    value: 'Level',
                  },
                  {
                    value: 'Die Count',
                  },
                  {
                    value: 'Die Value',
                  },
                ],
              }}
              value={sectionState[pathName]?.diePerLevel}
              addRow={true}
              onChange={setSectionState}
            />
          </Collapse.Body>
        </Collapse>
      )}
      {sectionState[pathName]?.method?.name === 'setPerLevel' && sectionState[pathName]?.setPerLevel?.length > 0 && (
        <Collapse>
          <Collapse.Header title='Set Per Level' />
          <Collapse.Body>
            <Table
              name={`${pathName}.setPerLevel`}
              rows={{
                inputs: [
                  {
                    name: 'level',
                    validation: 'num',
                    errorMsg: 'Must be whole numbers, commas, and spaces only',
                  },
                  {
                    name: 'value',
                    validation: 'num',
                    errorMsg: 'Must be whole numbers only',
                  },
                ],
                headers: [
                  {
                    value: 'Level',
                  },
                  {
                    value: 'Amount',
                  },
                ],
              }}
              value={sectionState[pathName]?.setPerLevel}
              addRow={true}
              onChange={setSectionState}
            />
          </Collapse.Body>
        </Collapse>
      )}
    </>
  )
}

export default Modifiers
