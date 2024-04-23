import { useEffect, useState } from 'react'
import { isEqual, startCase } from 'lodash'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import Table from '../../Table/Table'
import { DropdownOption, FormContext, ReducerActionType, RowHeader, RowInput, SectionName } from '../../../utils/types'
import Grid from '../../Grid/Grid'
import { useGetBuildersQuery } from '../../../features/builder/builderApiSlice'
import { selectAllClasses, useGetClassesQuery } from '../../../features/class/classApiSlice'
import { useGetItemsQuery, selectAllItems } from '../../../features/item/itemApiSlice'
import { selectAllSpells, useGetSpellsQuery } from '../../../features/spell/spellApiSlice'
import { selectAllFeats, useGetFeatsQuery } from '../../../features/feat/featApiSlice'
import Spinner from '../../Spinner/Spinner'
import { tableContent } from '../../../utils/formUtils'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { form_content } from '../Form.css'
import { selectAllRaces, useGetRacesQuery } from '../../../features/race/raceApiSlice'
import Collapse from '../../Collapse/Collapse'
import { sprinkles } from '../../../css/sprinkles.css'

export interface SectionContentProps {
  sectionState: any
  featureState?: any
  builders?: any
  feats?: any[]
  items?: any[]
  spells?: any[]
  classes?: any[]
  races?: any[]
  formState: any
  setSectionState: (arg: ReducerActionType) => void
  optionGroups: boolean
  providesOptions: boolean
  context: FormContext
}

interface SectionProps {
  formState: any
  sectionName: SectionName
  featureState: any
  setSectionState: (arg: ReducerActionType) => void
  sectionState: any
  context: FormContext
}

export const FeatContent = ({
  sectionState,
  setSectionState,
  builders,
  feats,
  formState,
  providesOptions,
}: SectionContentProps) => {
  return (
    <>
      <Grid>
        <Dropdown
          multiSelect={true}
          name={`attribute`}
          options={[].concat(
            builders.section.attribute,
            formState.category?.name === 'subclass' && builders.section.subclass.attribute
          )}
          label={`${startCase('feat')} Attributes`}
          value={sectionState.attribute}
          onChange={setSectionState}
        />
        <Dropdown
          name={`type`}
          multiSelect={true}
          label='Feat'
          value={sectionState.type}
          options={feats}
          required={true}
          onChange={setSectionState}
        />
        {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'subtypeSpecific') && (
          <Dropdown
            name={`subtype`}
            label='Subtype'
            value={sectionState.subtype}
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
      </Grid>
    </>
  )
}

type categoryType =
  | 'armorClass'
  | 'saveAbility'
  | 'spellSlot'
  | 'skill'
  | 'ability'
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

export const ModifierContent = ({
  sectionState,
  setSectionState,
  builders,
  formState,
  providesOptions,
  spells,
  context,
}: SectionContentProps) => {
  const [modMode, setModMode] = useState<DropdownOption[]>([])
  const [modMethod, setModMethod] = useState<DropdownOption[] | null>(null)
  const [spellsArray, setSpellsArray] = useState<DropdownOption[]>()
  const [typeOptions, setTypeOptions] = useState<boolean>(false)

  const categoryName: categoryType = sectionState?.category?.name
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
    categoryName === 'ability' ||
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
        const mode = builders.modifier.spellCategory?.find(
          (cat: any) => cat._id === sectionState.spellCategory?._id
        )?.mode

        setModMode(mode)
      } else {
        const mode = builders.modifier.category?.find((cat: any) => cat._id === sectionState.category?._id)?.mode

        setModMode(mode)
      }
    }
    if (modMode?.length > 0) {
      if (categoryName === 'spell') {
        const method = builders.modifier.spellCategory
          ?.find((cat: any) => cat._id === sectionState.spellCategory?._id)
          ?.mode?.find((ty: any) => ty._id === sectionState[pathName]?.mode?._id)?.method

        setModMethod(method)
      } else {
        const method = builders.modifier.category
          ?.find((cat: any) => cat._id === sectionState.category?._id)
          ?.mode?.find((mo: any) => mo._id === sectionState[pathName]?.mode?._id)?.method

        setModMethod(method)
      }
    }
  }, [
    builders.modifier.category,
    builders.modifier.spellCategory,
    modMode,
    sectionState,
    sectionState.spellCategory?._id,
    categoryName,
    pathName,
  ])

  // Filter spells array
  useEffect(() => {
    const filteredSpells = spells?.filter((spell) => {
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
      <Grid>
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
          options={builders.modifier.category}
          required={true}
          onChange={setSectionState}
        />
        {categoryName === 'spell' && (
          <>
            <Dropdown
              name={`spellCategory`}
              label='Spell Category'
              value={sectionState.spellCategory}
              options={builders.modifier.spellCategory}
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
                ? builders.ability.type
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
            options={modMode}
            required={true}
            onChange={setSectionState}
          />
        )}
        {modMethod != null && modMethod?.length > 0 && (
          <Dropdown
            name={`${pathName}.method`}
            label='Method'
            value={sectionState[categoryName]?.method}
            options={modMethod}
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
              options={builders.feature.charge.reset}
              required={true}
              onChange={setSectionState}
            />
            <Dropdown
              name={`${pathName}.feature`}
              label='Feature'
              value={sectionState[pathName]?.feature}
              options={[].concat(formState?.feature, context.title === 'class' && formState.resource)}
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
              options={builders.modifier.spellCategory}
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
                  options={builders.spell.duration.type}
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
                  options={builders.spell.range.type}
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
                      options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOption[]}
                      required={sectionState[categoryName][subCategoryName]?.type?.name === 'distance' ? true : false}
                      optionalKey='short'
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
                    options={builders.spell.shape.type}
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
                        options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOption[]}
                        required={sectionState[pathName]?.type?.name === 'distance' ? true : false}
                        optionalKey='short'
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
                      options={builders.ability.type}
                      required={true}
                      onChange={setSectionState}
                    />
                  ) : (
                    sectionState[pathName]?.method?.name === 'skill' && (
                      <Dropdown
                        name={`${pathName}.modSkill.type`}
                        label='Method Skill'
                        value={sectionState[pathName]?.modSkill?.type}
                        options={builders.skill.type}
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
      </Grid>
      {sectionState[pathName]?.mode?.name === 'setValue' && sectionState[pathName]?.method?.name === 'diePerLevel' && (
        <Collapse title='Die Per Level' className={sprinkles({ mt: 'size-3' })}>
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
                  errorMsg: 'Must be whole numbers only',
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
        </Collapse>
      )}
      {sectionState[pathName]?.method?.name === 'setPerLevel' && sectionState[pathName]?.setPerLevel?.length > 0 && (
        <Collapse title='Set Per Level' className={sprinkles({ mt: 'size-3' })}>
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
        </Collapse>
      )}
    </>
  )
}

export const ProficiencyContent = ({
  sectionState,
  setSectionState,
  builders,
  formState,
  items,
  providesOptions,
}: SectionContentProps) => {
  const categoryName: 'skill' | 'saveAbility' | 'property' | 'item' | 'language' | 'initiative' =
    sectionState?.category?.name
  return (
    <Grid>
      <Dropdown
        multiSelect={true}
        name={'attribute'}
        options={[].concat(
          builders.section.attribute,
          formState.category?.name === 'subclass' && builders.section.subclass.attribute
        )}
        label={`${startCase('proficiency')} Attributes`}
        value={sectionState.attribute}
        onChange={setSectionState}
      />
      <Dropdown
        name={`category`}
        label='Proficiency Category'
        value={sectionState.category}
        options={builders.proficiency.category}
        required={true}
        onChange={setSectionState}
      />
      {categoryName != null &&
        (categoryName !== 'property' && categoryName !== 'item' ? (
          <Dropdown
            name={`${categoryName}.type`}
            multiSelect={true}
            label={`${startCase(sectionState.category.value)} Type`}
            value={sectionState[categoryName]?.type}
            options={categoryName === 'saveAbility' ? builders.ability.type : builders[categoryName]?.type}
            required={true}
            onChange={setSectionState}
          />
        ) : (
          <>
            <Dropdown
              name={`${categoryName}.category`}
              multiSelect={true}
              label='Item Category'
              value={sectionState[categoryName]?.category}
              options={builders.item.category}
              onChange={setSectionState}
            />
            {categoryName === 'property' && (
              <Dropdown
                name={`${categoryName}.type`}
                multiSelect={true}
                label='Item Property'
                value={sectionState[categoryName]?.type}
                options={items
                  ?.filter((item) =>
                    sectionState[categoryName]?.category?.length > 0
                      ? sectionState[categoryName]?.category?.some(
                          (categoryItem: any) => categoryItem._id === item.category._id
                        )
                      : item
                  )
                  .flatMap((item) => item.property?.type)}
                onChange={setSectionState}
                required={true}
              />
            )}
            {categoryName === 'item' && (
              <Dropdown
                name={`${categoryName}.type`}
                multiSelect={true}
                label='Item Type'
                value={sectionState[categoryName]?.type}
                options={items
                  ?.filter((item) =>
                    sectionState[categoryName]?.category?.length > 0
                      ? sectionState[categoryName]?.category?.some(
                          (categoryItem: any) => categoryItem._id === item.category._id
                        )
                      : item
                  )
                  .map((item) => item)}
                required={true}
                onChange={setSectionState}
              />
            )}
          </>
        ))}
      <Dropdown
        name={`${categoryName}.level`}
        label='Proficiency Level'
        value={sectionState[categoryName]?.level}
        options={builders.proficiency.level}
        required={true}
        onChange={setSectionState}
      />
      {sectionState[categoryName]?.level?.name === 'half' && (
        <Dropdown
          name={`${categoryName}.rounding`}
          label='Rounding Type'
          value={sectionState[categoryName]?.rounding}
          options={builders.system.rules.rounding}
          required={true}
          onChange={setSectionState}
        />
      )}
      {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'subtypeSpecific') &&
        categoryName != null && (
          <Dropdown
            name={`${categoryName}.subtype`}
            multiSelect={true}
            label='Subclass Subtype'
            value={sectionState[categoryName]?.subtype}
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
    </Grid>
  )
}

export const SenseContent = ({
  sectionState,
  setSectionState,
  builders,
  formState,
  providesOptions,
}: SectionContentProps) => {
  return (
    <Grid>
      <Dropdown
        multiSelect={true}
        name={`attribute`}
        options={[].concat(
          builders.section.attribute,
          formState.category?.name === 'subclass' && builders.section.subclass.attribute
        )}
        label={`${startCase('sense')} Attributes`}
        value={sectionState.attribute}
        onChange={setSectionState}
      />
      <Dropdown
        name={`type`}
        multiSelect={true}
        label='Sense'
        value={sectionState.type}
        options={builders.sense.type}
        required={true}
        onChange={setSectionState}
      />
      {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'subtypeSpecific') && (
        <Dropdown
          name={`subtype`}
          label='Subtype'
          value={sectionState.subtype}
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
    </Grid>
  )
}

export const SpellContent = ({
  sectionState,
  setSectionState,
  builders,
  formState,
  spells,
  classes,
  featureState,
  providesOptions,
  context,
}: SectionContentProps) => {
  const [spellsArray, setSpellsArray] = useState<DropdownOption[]>()

  // Set spells array
  useEffect(() => {
    const filteredSpells = spells?.filter((spellItem) => {
      let meetsClassLimit: boolean = true
      let meetsLevelLimit: boolean = true
      let meetsAttributeLimit: boolean = true

      // Check against classLimit filter
      if (sectionState.classLimit?.length > 0) {
        meetsClassLimit =
          !sectionState.classLimit ||
          sectionState.classLimit?.some((limitItem: any) =>
            spellItem.classes?.some((classItem: any) => limitItem.name === classItem.name)
          )
      }

      // Check against levelLimit filter
      if (sectionState.levelLimit?.length > 0) {
        meetsLevelLimit = sectionState.levelLimit?.some((levelItem: any) => levelItem.value === spellItem.level)
      }

      if (sectionState.attributeLimit?.length > 0) {
        meetsAttributeLimit = sectionState.attributeLimit?.some((limitItem: any) =>
          spellItem.attribute?.some((attributeItem: any) => attributeItem.name === limitItem.name)
        )
      }

      // Combine filter conditions using logical AND operator
      return meetsClassLimit && meetsLevelLimit && meetsAttributeLimit
    })

    setSpellsArray(filteredSpells)
  }, [spells, sectionState.classLimit, sectionState.levelLimit, sectionState.attributeLimit])

  // Add/Remove Spells By Level Data
  useEffect(() => {
    if (
      (((featureState.levelAvailable == null || featureState.levelAvailable === '') && context.title === 'class') ||
        !sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellsByLevel')) &&
      sectionState.spellsByLevel
    ) {
      setSectionState({
        type: 'removed',
        target: {
          name: `spellsByLevel`,
        },
      })
    }
    if (
      sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellsByLevel') &&
      !sectionState.spellsByLevel
    ) {
      setSectionState({
        type: 'added',
        target: {
          name: `spellsByLevel`,
        },
      })
    }
  }, [featureState.levelAvailable, sectionState.spellsByLevel, sectionState.attribute, setSectionState, context.title])

  const spellTableColumns = () => {
    const inputArray: RowInput[] = [
      {
        name: 'level',
        value: 'Level',
        validation: 'num',
        required: true,
        errorMsg: 'Must not be blank. Enter whole numbers only.',
      },
      {
        name: 'spell',
        value: 'Spell',
        type: 'select',
        options: spells,
        multiple: true,
      },
    ]

    if (sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'castAtLevel')) {
      inputArray.push({
        name: 'spellLevel',
        value: 'Spell Level',
        validation: 'num',
        errorMsg: 'Must not be blank. Enter whole numbers only.',
      })
    }

    const headerArray: RowHeader[] = inputArray.map((inputItem) => ({
      value: inputItem.value,
      required: true,
    }))

    return { inputs: inputArray, headers: headerArray }
  }

  return (
    <>
      <Grid>
        <Dropdown
          multiSelect={true}
          name={`attribute`}
          options={[].concat(
            builders.section.spell.attribute,
            builders.section.attribute,
            formState.category?.name === 'subclass' && builders.section.subclass.attribute
          )}
          label={`${startCase('spell')} Attributes`}
          value={sectionState.attribute}
          onChange={setSectionState}
        />
        {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'classLimit') && (
          <Dropdown
            name={`classLimit`}
            multiSelect={true}
            label='Class Limit'
            value={sectionState.classLimit}
            options={classes?.filter((classItem: any) => classItem.category.name !== 'subclass')}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'levelLimit') && (
          <Dropdown
            name={`levelLimit`}
            multiSelect={true}
            label='Level Limit'
            value={sectionState.levelLimit?.map((levelItem: any) => ({
              value: String(levelItem.value),
              name: null,
              _id: null,
            }))}
            options={spells?.map((spellItem) => ({
              value: spellItem.level,
              name: null,
              _id: null,
            }))}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'attributeLimit') && (
          <Dropdown
            name={`attributeLimit`}
            multiSelect={true}
            label='Attribute'
            value={sectionState.attributeLimit}
            options={builders.spell.attribute}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'subtypeSpecific') && (
          <Dropdown
            name={`subtype`}
            label='Subtype'
            value={sectionState.subtype}
            options={formState?.subtype}
            required={true}
            onChange={setSectionState}
          />
        )}
        {!sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellsByLevel') && (
          <>
            <Dropdown
              name={`type`}
              multiSelect={true}
              label='Spell'
              value={sectionState.type}
              options={spellsArray}
              required={true}
              onChange={setSectionState}
            />
            {sectionState.attribute?.some(
              (attributeItem: any) =>
                attributeItem.name === 'castAtLevel' && (
                  <Input
                    validation='num'
                    name={`spellLevel`}
                    label='Spell Level'
                    autoComplete='off'
                    value={sectionState.spellLevel}
                    errorMsg='Must contain only numbers'
                    required={true}
                    onChange={setSectionState}
                  />
                )
            )}
            {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'optionalAbility') && (
              <Dropdown
                name={`ability.type`}
                label='Ability'
                value={sectionState.ability?.type}
                options={builders.ability.type}
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
          </>
        )}
      </Grid>
      {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellsByLevel') && (
        <>
          <Table
            rows={{
              inputs: spellTableColumns().inputs,
              headers: spellTableColumns().headers,
            }}
            name={`spellsByLevel`}
            value={sectionState.spellsByLevel}
            onChange={setSectionState}
            addRow={true}
          />
        </>
      )}
    </>
  )
}

export const AncestryContent = ({
  sectionState,
  setSectionState,
  builders,
  formState,
  races,
  providesOptions,
}: SectionContentProps) => {
  return (
    <>
      <Grid>
        <Dropdown
          multiSelect={true}
          name={`attribute`}
          options={[].concat(
            builders.section.attribute,
            formState.category?.name === 'subclass' && builders.section.subclass.attribute
          )}
          label={`${startCase('Ancestry')} Attributes`}
          value={sectionState.attribute}
          onChange={setSectionState}
        />
        <Dropdown
          name='origin'
          label='Ancestry Origin'
          value={sectionState?.origin}
          options={races?.filter((raceItem: any) => raceItem.ancestry?.name != null)}
          required={true}
          onChange={setSectionState}
        />
        <Dropdown
          name='option'
          label='Ancestry Option'
          multiSelect={providesOptions}
          value={sectionState?.option}
          options={races?.find((raceItem: any) => raceItem.name === sectionState?.origin?.name)?.ancestry?.option}
          required={true}
          onChange={setSectionState}
        />
        {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'subtypeSpecific') && (
          <Dropdown
            name={`subtype`}
            label='Subtype'
            value={sectionState.subtype}
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
      </Grid>
    </>
  )
}

const SectionContent = ({
  formState,
  sectionName,
  featureState,
  sectionState,
  setSectionState,
  context,
}: SectionProps) => {
  const { data: builders } = useGetBuildersQuery(undefined)

  const { spells } = useGetSpellsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      spells: data && selectAllSpells(data),
    }),
  })

  const { classes } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
  })

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({ items: data && selectAllItems(data) }),
  })

  const { feats } = useGetFeatsQuery(undefined, {
    selectFromResult: ({ data }) => ({ feats: data && selectAllFeats(data) }),
  })

  const { races } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      races: data && selectAllRaces(data),
    }),
  })

  const ContentComponent = tableContent[sectionName]?.content

  return !sectionState ? (
    <Spinner />
  ) : (
    <>
      <ScrollArea scrollDirection='vertical' className={form_content}>
        <ContentComponent
          formState={formState}
          context={context}
          sectionState={sectionState}
          featureState={featureState}
          items={items}
          spells={spells}
          feats={feats}
          classes={classes}
          races={races}
          setSectionState={setSectionState}
          builders={builders}
          providesOptions={sectionState.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'providesOptions'
          )}
          optionGroups={sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'optionGroups')}
        />
      </ScrollArea>
    </>
  )
}

export default SectionContent
