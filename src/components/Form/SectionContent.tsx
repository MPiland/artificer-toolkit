import { useEffect, useState } from 'react'
import { startCase } from 'lodash'
import Dropdown from '../Dropdown/Dropdown'
import Input from '../Input/Input'
import Table from '../Table/Table'
import {
  DropdownOption,
  ReducerActionType,
  RowHeader,
  RowInput,
  SectionName,
} from '../../utils/types'
import Grid from '../Grid/Grid'
import { useGetBuildersQuery } from '../../features/builder/builderApiSlice'
import {
  selectAllClasses,
  useGetClassesQuery,
} from '../../features/class/classApiSlice'
import {
  useGetItemsQuery,
  selectAllItems,
} from '../../features/item/itemApiSlice'
import {
  selectAllSpells,
  useGetSpellsQuery,
} from '../../features/spell/spellApiSlice'
import {
  selectAllFeats,
  useGetFeatsQuery,
} from '../../features/feat/featApiSlice'
import Spinner from '../Spinner/Spinner'
import { tableContent } from '../../utils/formUtils'
import ScrollArea from '../ScrollArea/ScrollArea'
import { form_content } from './Form.css'
import {
  selectAllRaces,
  useGetRacesQuery,
} from '../../features/race/raceApiSlice'

export interface SectionContentProps {
  sectionState: any
  featureState?: any
  builders?: any
  feats?: any[]
  items?: any[]
  spells?: any[]
  classes?: any[]
  races?: any[]
  state: any
  setSectionState: (arg: ReducerActionType) => void
  optionGroups: boolean
  providesOptions: boolean
}

interface SectionProps {
  state: any
  sectionName: SectionName
  featureState: any
  setSectionState: (arg: ReducerActionType) => void
  sectionState: any
}

export const FeatContent = ({
  sectionState,
  setSectionState,
  builders,
  feats,
  state,
  providesOptions,
  optionGroups,
}: SectionContentProps) => {
  return (
    <>
      <Grid>
        <Dropdown
          multiSelect={true}
          name={`attribute`}
          options={[].concat(
            builders.section.attribute,
            state.category?.name === 'subclass' &&
              builders.section.subclass.attribute
          )}
          label={`${startCase('feat')} Attributes`}
          value={sectionState.attribute}
          onChange={setSectionState}
        />
        {sectionState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'subtypeSpecific'
        ) && (
          <Dropdown
            name={`subtype`}
            label='Subtype'
            value={sectionState.subtype}
            options={state?.subtype}
            required={true}
            onChange={setSectionState}
          />
        )}
        {optionGroups && (
          <Input
            validation='num'
            name={`optionGroup`}
            label='Opt. Grp. #'
            autoComplete='off'
            value={sectionState.optionGroup}
            errorMsg='Must contain only numbers'
            onChange={setSectionState}
          />
        )}
        <Dropdown
          name={`feat`}
          multiSelect={true}
          label='Feat'
          value={sectionState.feat}
          options={feats}
          required={true}
          onChange={setSectionState}
        />
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

export const ModifierContent = ({
  sectionState,
  setSectionState,
  builders,
  state,
  providesOptions,
  optionGroups,
  spells,
}: SectionContentProps) => {
  const [modType, setModType] = useState<DropdownOption[]>([])
  const [modMethod, setModMethod] = useState<DropdownOption[] | null>(null)
  const [spellsArray, setSpellsArray] = useState<DropdownOption[]>()

  // Set modType and modMethod options
  useEffect(() => {
    if (sectionState.category != null) {
      if (sectionState.category?.name === 'spell') {
        const type = builders.modifier.spellCategory?.find(
          (cat: any) => cat._id === sectionState.spellCategory?._id
        )?.type

        setModType(type)
      } else {
        const type = builders.modifier.category?.find(
          (cat: any) => cat._id === sectionState.category?._id
        )?.type

        setModType(type)
      }
    }
    if (modType?.length > 0) {
      if (sectionState.category?.name === 'spell') {
        const method = builders.modifier.spellCategory
          ?.find((cat: any) => cat._id === sectionState.spellCategory?._id)
          ?.type?.find((ty: any) => ty._id === sectionState.type?._id)?.method

        setModMethod(method)
      } else {
        const method = builders.modifier.category
          ?.find((cat: any) => cat._id === sectionState.category?._id)
          ?.type?.find((ty: any) => ty._id === sectionState.type?._id)?.method

        setModMethod(method)
      }
    }
  }, [
    builders.modifier.category,
    builders.modifier.spellCategory,
    modType,
    sectionState.type,
    sectionState.category,
    sectionState.spellCategory?._id,
  ])

  // Filter spells array
  useEffect(() => {
    const filteredSpells = spells?.filter((spell) => {
      if (sectionState.spellCategory?.name === 'damageSave') {
        return spell.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'requireSave'
        )
      }
      if (sectionState.spellCategory?.name === 'spellDamage') {
        return spell.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'doesDamage'
        )
      }
      if (sectionState.spellCategory?.name === 'spellMaxRange') {
        return spell.range && spell.range.minRange
      }
      if (sectionState.spellCategory?.name === 'spellMinRange') {
        return spell.range && spell.range.maxRange
      }
      if (sectionState.spellCategory?.name === 'spellShapeType') {
        return spell.shape && spell.shape.type
      }
      if (sectionState.spellCategory?.name === 'spellShapeSize') {
        return spell.shape && spell.shape.size
      }
      if (sectionState.spellCategory?.name === 'spellDurationType') {
        return spell.duration && spell.duration.type
      }
      if (sectionState.spellCategory?.name === 'spellDurationValue') {
        return spell.duration && spell.duration.value
      }
      return false
    })
    setSpellsArray(filteredSpells)
  }, [sectionState.spellCategory?.name, spells])

  // Add/Remove die per level Table
  useEffect(() => {
    if (
      (sectionState.diePerLevel || sectionState.diePerLevel?.length > 0) &&
      (sectionState.type?.name !== 'setDieValue' ||
        sectionState.method?.option?.name !== 'diePerLevel')
    ) {
      setSectionState({
        type: 'removed',
        target: {
          name: `diePerLevel`,
        },
      })
    }
    if (
      sectionState.type?.name === 'setDieValue' &&
      sectionState.method?.option?.name === 'diePerLevel' &&
      (!sectionState.diePerLevel || !(sectionState.diePerLevel?.length > 0))
    ) {
      setSectionState({
        type: 'added',
        target: {
          name: `diePerLevel`,
        },
      })
    }
  }, [
    sectionState.diePerLevel,
    setSectionState,
    sectionState.type,
    sectionState.method,
  ])

  // Add/remove setPerLevel table
  useEffect(() => {
    if (
      sectionState.setPerLevel &&
      sectionState.method?.option?.name !== 'setPerLevel'
    ) {
      setSectionState({
        type: 'removed',
        target: {
          name: `setPerLevel`,
        },
      })
    }
    if (
      sectionState.method?.option?.name === 'setPerLevel' &&
      (!sectionState.setPerLevel || !(sectionState.setPerLevel?.length > 0))
    ) {
      setSectionState({
        type: 'added',
        target: {
          name: `setPerLevel`,
        },
      })
    }
  }, [sectionState.setPerLevel, sectionState.method, setSectionState])

  return (
    <>
      <Grid>
        <Dropdown
          multiSelect={true}
          name={`attribute`}
          options={[].concat(
            builders.section.attribute,
            state.category?.name === 'subclass' &&
              builders.section.subclass.attribute
          )}
          label={`${startCase('modifier')} Attributes`}
          value={sectionState.attribute}
          onChange={setSectionState}
        />
        {sectionState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'subtypeSpecific'
        ) && (
          <Dropdown
            name={`subtype`}
            label='Subtype'
            value={sectionState.subtype}
            options={state?.subtype}
            required={true}
            onChange={setSectionState}
          />
        )}
        {optionGroups && (
          <Input
            validation='num'
            name={`optionGroup`}
            label='Opt. Grp. #'
            autoComplete='off'
            value={sectionState.optionGroup}
            errorMsg='Must contain only numbers'
            onChange={setSectionState}
          />
        )}
        <Dropdown
          name={`category`}
          label='Modifier Category'
          value={sectionState.category}
          options={builders.modifier.category}
          required={true}
          onChange={setSectionState}
        />
        {sectionState.category?.name === 'spell' && (
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
              name={`spell`}
              label='Spell'
              value={sectionState.spell}
              options={spellsArray}
              required={true}
              onChange={setSectionState}
            />
          </>
        )}
        {modType?.length > 0 &&
          (sectionState.category || sectionState.spellCategory) && (
            <Dropdown
              name={`type`}
              label='Modifier Type'
              value={sectionState.type}
              options={modType}
              required={true}
              onChange={setSectionState}
            />
          )}
        {sectionState.category?.name === 'limitUse' &&
          sectionState.type?.name === 'useReset' && (
            <>
              <Dropdown
                name={`limitUse.resetOption`}
                label='Reset Option'
                value={sectionState.limitUse?.resetOption}
                options={builders.feature.chargeReset}
                required={true}
                onChange={setSectionState}
              />
              <Dropdown
                name={`limitUse.feature`}
                label='Feature'
                value={sectionState.limitUse?.feature}
                options={state?.feature}
                required={true}
                onChange={setSectionState}
              />
              <Dropdown
                name={`method.option`}
                label='Method'
                value={sectionState.method?.option}
                options={sectionState.type.method}
                required={true}
                onChange={setSectionState}
              />
            </>
          )}
        {sectionState.category?.name === 'ability' && (
          <Dropdown
            name={`ability`}
            multiSelect={true}
            label='Ability'
            value={sectionState.ability}
            options={builders.ability}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.category?.name === 'saveAbility' && (
          <Dropdown
            name={`saveAbility`}
            multiSelect={true}
            label='Save Ability'
            value={sectionState.saveAbility}
            options={builders.ability}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.category?.name === 'skill' && (
          <Dropdown
            name={`skill`}
            multiSelect={true}
            label='Skill'
            value={sectionState.skill}
            options={builders.skill}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.category?.name === 'damageSave' && (
          <Dropdown
            name={`damage.damageSave`}
            multiSelect={true}
            label='Damage'
            value={sectionState.damage?.damageSave}
            options={builders.damage}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.category?.name === 'conditionSave' && (
          <Dropdown
            name={`conditionSave`}
            multiSelect={true}
            label='Condition'
            value={sectionState.conditionSave}
            options={builders.condition}
            required={true}
            onChange={setSectionState}
          />
        )}
        {modMethod != null && (
          <Dropdown
            name={`method.option`}
            label='Method'
            value={sectionState.method?.option}
            options={modMethod}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.spellCategory &&
        sectionState.spellCategory?.name === 'spellShapeType' ? (
          <Dropdown
            name={`shape.type`}
            label='Shape'
            value={sectionState.shape?.type}
            options={builders.spell.shape}
            required={true}
            onChange={setSectionState}
          />
        ) : (
          sectionState.spellCategory?.name === 'spellDurationType' && (
            <Dropdown
              name={`duration.type`}
              label='Duration'
              value={sectionState.duration?.type}
              options={builders.spell.duration}
              required={true}
              onChange={setSectionState}
            />
          )
        )}
        {sectionState.method?.option?.name &&
          sectionState.method?.option?.name !== 'setPerLevel' &&
          sectionState.method?.option?.name !== 'diePerLevel' && (
            <>
              <Input
                validation='num'
                name={`minValue`}
                label='Minimum Value'
                errorMsg='Must contain only whole numbers'
                autoComplete='off'
                value={sectionState.minValue}
                onChange={setSectionState}
              />
              <Input
                validation='num'
                name={`multiplier`}
                label='Multiplier'
                errorMsg='Must contain only whole numbers'
                autoComplete='off'
                value={sectionState.multiplier}
                onChange={setSectionState}
              />
            </>
          )}
        {sectionState.category?.name === 'condition' ? (
          <Dropdown
            name={`condition`}
            multiSelect={true}
            label='Condition Type'
            value={sectionState.condition}
            options={builders.condition}
            required={true}
            onChange={setSectionState}
          />
        ) : sectionState.category?.name === 'speed' ? (
          <Dropdown
            name={`speed`}
            multiSelect={true}
            value={sectionState.speed}
            label='Speed Type'
            options={builders.speed}
            required={true}
            onChange={setSectionState}
          />
        ) : sectionState.category?.name === 'passive' ? (
          <Dropdown
            name={`passive`}
            multiSelect={true}
            label='Passive Type'
            value={sectionState.passive?.options}
            options={builders.passive}
            required={true}
            onChange={setSectionState}
          />
        ) : (
          (sectionState.category?.name === 'damage' ||
            sectionState.category?.name === 'spellDamage') && (
            <Dropdown
              name={`damage.type`}
              multiSelect={true}
              label='Damage Type'
              value={sectionState.damage?.type}
              options={builders.damage}
              required={true}
              onChange={setSectionState}
            />
          )
        )}
        {sectionState.method?.option?.name === 'setValue' ? (
          sectionState.spellCategory?.name === 'spellMinValue' ? (
            <>
              <Input
                validation='num'
                name={`range.minValue`}
                label='Minimum Value'
                errorMsg='Must contain only whole numbers'
                autoComplete='off'
                value={sectionState.range?.minValue}
                onChange={setSectionState}
              />
              <Dropdown
                name='shape.unit'
                label='UoM'
                value={sectionState?.range?.unit}
                options={
                  Object.values(builders.unit.imperial).flatMap(
                    (item) => item
                  ) as DropdownOption[]
                }
                required={
                  sectionState.range?.type?.name === 'distance' ? true : false
                }
                optionalKey='short'
                onChange={setSectionState}
              />
            </>
          ) : sectionState.spellCategory?.name === 'spellMaxValue' ? (
            <>
              <Input
                validation='num'
                name={`range.maxValue`}
                label='Minimum Value'
                errorMsg='Must contain only whole numbers'
                autoComplete='off'
                value={sectionState.range?.maxValue}
                onChange={setSectionState}
              />
              <Dropdown
                name='shape.unit'
                label='UoM'
                value={sectionState?.range?.unit}
                options={
                  Object.values(builders.unit.imperial).flatMap(
                    (item) => item
                  ) as DropdownOption[]
                }
                required={
                  sectionState.range?.type?.name === 'distance' ? true : false
                }
                optionalKey='short'
                onChange={setSectionState}
              />
            </>
          ) : sectionState.spellCategory?.name === 'spellShapeSize' ? (
            <>
              <Input
                validation='num'
                name={`shape.size`}
                label='Minimum Value'
                errorMsg='Must contain only whole numbers'
                autoComplete='off'
                value={sectionState.shape.size}
                onChange={setSectionState}
              />
              <Dropdown
                name='shape.unit'
                label='UoM'
                value={sectionState?.shape?.unit}
                options={
                  Object.values(builders.unit.imperial).flatMap(
                    (item) => item
                  ) as DropdownOption[]
                }
                required={
                  sectionState.shape?.type?.name === 'distance' ? true : false
                }
                optionalKey='short'
                onChange={setSectionState}
              />
            </>
          ) : sectionState.spellCategory?.name === 'spellDurationValue' ? (
            <Input
              validation={'num'}
              name='duration.value'
              errorMsg='Must contain only numbers'
              label='Duration Increment'
              autoComplete='off'
              required={true}
              value={sectionState.duration?.value}
              onChange={setSectionState}
            />
          ) : (
            <Input
              validation='num'
              name={`method.setValue`}
              label='Set Value'
              errorMsg='Must contain only numbers'
              autoComplete='off'
              value={sectionState.method?.setValue}
              required={true}
              onChange={setSectionState}
            />
          )
        ) : sectionState.method?.option?.name === 'ability' ? (
          <Dropdown
            name={`method.ability`}
            label='Method Ability'
            value={sectionState.method.ability}
            options={builders.ability}
            required={true}
            onChange={setSectionState}
          />
        ) : sectionState.method?.option?.name === 'setValue' &&
          sectionState.type?.name === 'setDieValue' ? (
          <>
            <Input
              validation='num'
              name={`dieCount`}
              label='Die Count'
              errorMsg='Must contain only whole numbers'
              autoComplete='off'
              value={sectionState.dieCount}
              onChange={setSectionState}
            />
            <Input
              validation='num'
              name={`dieValue`}
              label='Die Value'
              errorMsg='Must contain only whole numbers'
              autoComplete='off'
              value={sectionState.dieValue}
              onChange={setSectionState}
            />
          </>
        ) : (
          sectionState.method?.option?.name === 'skill' && (
            <Dropdown
              name={`method.skill`}
              label='Method Skill'
              value={sectionState.method.skill}
              options={builders.skill}
              required={true}
              onChange={setSectionState}
            />
          )
        )}
        {(sectionState.type?.name === 'bonus' ||
          sectionState.type?.name === 'setValue') && (
          <Input
            validation='num'
            name={`maxValue`}
            label='Max Value'
            autoComplete='off'
            value={sectionState.maxValue}
            errorMsg='Must contain only numbers'
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
      <>
        {sectionState.type?.name === 'setDieValue' &&
          sectionState.method?.option?.name === 'diePerLevel' && (
            <Table
              name={`diePerLevel`}
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
              value={sectionState.diePerLevel}
              addRow={true}
              onChange={setSectionState}
            />
          )}
        {sectionState.method?.option?.name === 'setPerLevel' &&
          sectionState.setPerLevel?.length > 0 && (
            <Table
              name={`setPerLevel`}
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
              value={sectionState.setPerLevel}
              addRow={true}
              onChange={setSectionState}
            />
          )}
      </>
    </>
  )
}

export const ProficiencyContent = ({
  sectionState,
  setSectionState,
  builders,
  state,
  items,
  providesOptions,
  optionGroups,
}: SectionContentProps) => {
  return (
    <Grid>
      <Dropdown
        multiSelect={true}
        name={'attribute'}
        options={[].concat(
          builders.section.attribute,
          state.category?.name === 'subclass' &&
            builders.section.subclass.attribute
        )}
        label={`${startCase('proficiency')} Attributes`}
        value={sectionState.attribute}
        onChange={setSectionState}
      />
      {sectionState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'subtypeSpecific'
      ) && (
        <Dropdown
          name={`subtype`}
          label='Subtype'
          value={sectionState.subtype}
          options={state?.subtype}
          required={true}
          onChange={setSectionState}
        />
      )}
      {optionGroups && (
        <Input
          validation='num'
          name={`optionGroup`}
          label='Opt. Grp. #'
          autoComplete='off'
          value={sectionState.optionGroup}
          errorMsg='Must contain only numbers'
          onChange={setSectionState}
        />
      )}
      <Dropdown
        name={`area`}
        label='Proficiency Area'
        value={sectionState.area}
        options={builders.proficiency.area}
        required={true}
        onChange={setSectionState}
      />
      {sectionState?.area?.name === 'ability' && (
        <Dropdown
          name={`ability`}
          multiSelect={true}
          label='Ability'
          value={sectionState.ability}
          options={builders.ability}
          required={true}
          onChange={setSectionState}
        />
      )}
      {sectionState?.area?.name === 'skill' && (
        <Dropdown
          name={`skill`}
          multiSelect={true}
          label='Skill'
          value={sectionState.skill}
          options={builders.skill}
          required={true}
          onChange={setSectionState}
        />
      )}
      {sectionState?.area?.name === 'saveAbility' && (
        <Dropdown
          name={`saveAbility`}
          multiSelect={true}
          label='Save Ability'
          value={sectionState.saveAbility}
          options={builders.ability}
          required={true}
          onChange={setSectionState}
        />
      )}
      {sectionState?.area?.name === 'language' && (
        <Dropdown
          name={`language`}
          multiSelect={true}
          label='Language'
          value={sectionState.language}
          options={builders.language}
          onChange={setSectionState}
        />
      )}
      {(sectionState.area?.name === 'property' ||
        sectionState.area?.name === 'item') && (
        <>
          <Dropdown
            name={`category`}
            multiSelect={true}
            label='Item Category'
            value={sectionState.category}
            options={builders.item.category}
            onChange={setSectionState}
          />
          {sectionState.area?.name === 'property' && (
            <Dropdown
              name={`property`}
              multiSelect={true}
              label='Item Property'
              value={sectionState.property}
              options={[].concat(
                ...builders.item.category
                  .filter((bCategoryItem: any) =>
                    sectionState.category?.length > 0
                      ? sectionState.category?.some(
                          (categoryItem: any) =>
                            categoryItem.name === bCategoryItem.name
                        )
                      : bCategoryItem
                  )
                  .map((category: any) => category.property)
              )}
              onChange={setSectionState}
            />
          )}
          {sectionState.area?.name === 'item' && (
            <Dropdown
              name={`item`}
              multiSelect={true}
              label='Item'
              value={sectionState.item}
              options={items
                ?.filter((item) =>
                  sectionState.category?.length > 0
                    ? sectionState.category?.some(
                        (categoryItem: any) =>
                          categoryItem.name === item.category.name
                      )
                    : item
                )
                .map((item) => item)}
              onChange={setSectionState}
            />
          )}
        </>
      )}
      <Dropdown
        name={`level`}
        label='Proficiency Level'
        value={sectionState.level}
        options={builders.proficiency.level}
        required={true}
        onChange={setSectionState}
      />
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
  state,
  providesOptions,
  optionGroups,
}: SectionContentProps) => {
  return (
    <Grid>
      <Dropdown
        multiSelect={true}
        name={`attribute`}
        options={[].concat(
          builders.section.attribute,
          state.category?.name === 'subclass' &&
            builders.section.subclass.attribute
        )}
        label={`${startCase('sense')} Attributes`}
        value={sectionState.attribute}
        onChange={setSectionState}
      />
      {sectionState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'subtypeSpecific'
      ) && (
        <Dropdown
          name={`subtype`}
          label='Subtype'
          value={sectionState.subtype}
          options={state?.subtype}
          required={true}
          onChange={setSectionState}
        />
      )}
      {optionGroups && (
        <Input
          validation='num'
          name={`optionGroup`}
          label='Opt. Grp. #'
          autoComplete='off'
          value={sectionState.optionGroup}
          errorMsg='Must contain only numbers'
          onChange={setSectionState}
        />
      )}
      <Dropdown
        name={`sense`}
        multiSelect={true}
        label='Sense'
        value={sectionState.sense}
        options={builders.sense}
        required={true}
        onChange={setSectionState}
      />
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
  state,
  spells,
  classes,
  featureState,
  providesOptions,
  optionGroups,
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
            spellItem.classes?.some(
              (classItem: any) => limitItem.name === classItem.name
            )
          )
      }

      // Check against levelLimit filter
      if (sectionState.levelLimit?.length > 0) {
        meetsLevelLimit = sectionState.levelLimit?.some(
          (levelItem: any) => levelItem.value === spellItem.level
        )
      }

      if (sectionState.attributeLimit?.length > 0) {
        meetsAttributeLimit = sectionState.attributeLimit?.some(
          (limitItem: any) =>
            spellItem.attribute?.some(
              (attributeItem: any) => attributeItem.name === limitItem.name
            )
        )
      }

      // Combine filter conditions using logical AND operator
      return meetsClassLimit && meetsLevelLimit && meetsAttributeLimit
    })

    setSpellsArray(filteredSpells)
  }, [
    spells,
    sectionState.classLimit,
    sectionState.levelLimit,
    sectionState.attributeLimit,
  ])

  // Add/Remove Spells By Level Data
  useEffect(() => {
    if (
      (featureState.levelAvailable == null ||
        featureState.levelAvailable === '' ||
        !sectionState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'spellsByLevel'
        )) &&
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
      sectionState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'spellsByLevel'
      ) &&
      !sectionState.spellsByLevel
    ) {
      setSectionState({
        type: 'added',
        target: {
          name: `spellsByLevel`,
        },
      })
    }
  }, [
    featureState.levelAvailable,
    sectionState.spellsByLevel,
    sectionState.attribute,
    setSectionState,
  ])

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

    if (
      sectionState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'castAtLevel'
      )
    ) {
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
            state.category?.name === 'subclass' &&
              builders.section.subclass.attribute
          )}
          label={`${startCase('spell')} Attributes`}
          value={sectionState.attribute}
          onChange={setSectionState}
        />
        {sectionState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'classLimit'
        ) && (
          <Dropdown
            name={`classLimit`}
            multiSelect={true}
            label='Class Limit'
            value={sectionState.classLimit}
            options={classes?.filter(
              (classItem: any) => classItem.category.name !== 'subclass'
            )}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'levelLimit'
        ) && (
          <Dropdown
            name={`levelLimit`}
            multiSelect={true}
            label='Level Limit'
            value={sectionState.levelLimit}
            options={spells?.map((spellItem) => ({
              value: spellItem.level,
              name: null,
              _id: null,
            }))}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'attributeLimit'
        ) && (
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
        {sectionState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'subtypeSpecific'
        ) && (
          <Dropdown
            name={`subtype`}
            label='Subtype'
            value={sectionState.subtype}
            options={state?.subtype}
            required={true}
            onChange={setSectionState}
          />
        )}
        {optionGroups && (
          <Input
            validation='num'
            name={`optionGroup`}
            label='Opt. Grp. #'
            autoComplete='off'
            value={sectionState.optionGroup}
            errorMsg='Must contain only numbers'
            onChange={setSectionState}
          />
        )}
        {!sectionState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'spellsByLevel'
        ) && (
          <>
            <Dropdown
              name={`spell`}
              multiSelect={true}
              label='Spell'
              value={sectionState.spell}
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
            {sectionState.attribute?.some(
              (attributeItem: any) => attributeItem.name === 'optionalAbility'
            ) && (
              <Dropdown
                name={`ability`}
                multiSelect={true}
                label='Ability'
                value={sectionState.ability}
                options={builders.ability}
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
      {sectionState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'spellsByLevel'
      ) && (
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
  state,
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
            state.category?.name === 'subclass' &&
              builders.section.subclass.attribute
          )}
          label={`${startCase('Ancestry')} Attributes`}
          value={sectionState.attribute}
          onChange={setSectionState}
        />
        <Dropdown
          name='origin'
          label='Ancestry Origin'
          value={sectionState?.origin}
          options={races?.filter(
            (raceItem: any) => raceItem.ancestry?.name != null
          )}
          required={true}
          onChange={setSectionState}
        />
        <Dropdown
          name='option'
          label='Ancestry Option'
          multiSelect={providesOptions}
          value={sectionState?.option}
          options={
            races?.find(
              (raceItem: any) => raceItem.name === sectionState?.origin?.name
            )?.ancestry?.option
          }
          required={true}
          onChange={setSectionState}
        />
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
        {sectionState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'subtypeSpecific'
        ) && (
          <Dropdown
            name={`subtype`}
            label='Subtype'
            value={sectionState.subtype}
            options={state?.subtype}
            required={true}
            onChange={setSectionState}
          />
        )}
      </Grid>
    </>
  )
}

const SectionContent = ({
  state,
  sectionName,
  featureState,
  sectionState,
  setSectionState,
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
          state={state}
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
          optionGroups={sectionState.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'optionGroups'
          )}
        />
      </ScrollArea>
    </>
  )
}

export default SectionContent
