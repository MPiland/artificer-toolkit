import { FC, useEffect, useState } from 'react'
import { startCase, isEqual } from 'lodash'
import Dropdown from '../Dropdown/Dropdown'
import Input from '../Input/Input'
import Table from '../Table/Table'
import { ReducerActionType, SectionName, StepName } from '../../utils/types'
import Grid from '../Grid/Grid'
import { useGetBuildersQuery } from '../../features/builders/buildersApiSlice'
import {
  selectAllClasses,
  useGetClassesQuery,
} from '../../features/classes/classesApiSlice'
import {
  useGetItemsQuery,
  selectAllItems,
} from '../../features/items/itemsApiSlice'
import {
  selectAllSpells,
  useGetSpellsQuery,
} from '../../features/spells/spellsApiSlice'
import {
  selectAllFeats,
  useGetFeatsQuery,
} from '../../features/feats/featsApiSlice'
import Spinner from '../Spinner/Spinner'
import { tableContent } from './FormUtils'
import ScrollArea from '../ScrollArea/ScrollArea'
import { form_content } from './Form.css'
import FormFooter from './FormFooter'

export interface SectionProps {
  sectionState: any
  featureState?: any
  builders?: any
  feats?: any[]
  items?: any[]
  spells?: any[]
  classes?: any[]
  state: any
  setSectionState: (arg: ReducerActionType) => void
}

interface SectionContentProps {
  state: any
  sectionName: SectionName
  featureState: any
  setSectionState: (arg: ReducerActionType) => void
  sectionState: any
  setSectionIndex: (arg: number) => void
  sectionIndex: number
  handleForward: () => void
  handleUpdate?: () => void
  setStepName: (arg: StepName) => void
}

export const FeatContent: FC<SectionProps> = ({
  sectionState,
  setSectionState,
  builders,
  feats,
  state,
}) => {
  const multipleOptions = sectionState.attribute?.some((attributeItem: any) => {
    attributeItem.name === 'providesOptions'
  })
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
        {sectionState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'optionGroups'
        ) && (
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
        {multipleOptions && (
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

export const ModifierContent: FC<SectionProps> = ({
  sectionState,
  setSectionState,
  builders,
  state,
}) => {
  useEffect(() => {
    if (
      (sectionState.diePerLevel || sectionState.diePerLevel?.length > 0) &&
      (sectionState.modType?.name !== 'setDieValue' ||
        sectionState.method?.methodType?.name !== 'diePerLevel')
    ) {
      setSectionState({
        type: 'removed',
        target: {
          name: `diePerLevel`,
        },
      })
    }
  }, [
    sectionState.diePerLevel,
    setSectionState,
    sectionState.modType,
    sectionState.method,
  ])

  useEffect(() => {
    if (
      sectionState.addPerLevel &&
      sectionState.method?.methodType?.name !== 'addPerLevel'
    ) {
      setSectionState({
        type: 'removed',
        target: {
          name: `addPerLevel`,
        },
      })
    }
  }, [sectionState.addPerLevel, sectionState.method, setSectionState])

  const multipleOptions = sectionState.attribute?.some((attributeItem: any) => {
    attributeItem.name === 'providesOptions'
  })
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
        {sectionState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'optionGroups'
        ) && (
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
          name={`module`}
          label='Modifier Category'
          value={sectionState.module}
          options={builders.modifier.module}
          required={true}
          onChange={setSectionState}
        />
        {sectionState.module?._id && (
          <Dropdown
            name={`modType`}
            label='Modifier Type'
            value={sectionState.modType}
            options={builders.modifier.modType?.filter((modItem: any) =>
              modItem.module.some(
                (moduleItem: any) => moduleItem.id === sectionState.module?._id
              )
            )}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.module?.name === 'limitUse' &&
          sectionState.modType?.name === 'useReset' && (
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
            </>
          )}
        {sectionState.module?.name === 'ability' && (
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
        {sectionState.module?.name === 'saveAbility' && (
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
        {sectionState.module?.name === 'skill' && (
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
        {sectionState.module?.name === 'damageSave' && (
          <Dropdown
            name={`damageSave`}
            multiSelect={true}
            label='Damage'
            value={sectionState.damageSave}
            options={builders.damage}
            required={true}
            onChange={setSectionState}
          />
        )}
        {sectionState.module?.name === 'conditionSave' && (
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
        {(sectionState.modType?.name === 'bonus' ||
          sectionState.modType?.name === 'penalty' ||
          sectionState.modType?.name === 'setDieValue' ||
          sectionState.modType?.name === 'setBonus') && (
          <>
            <Dropdown
              name={`method.methodType`}
              label='Method'
              value={sectionState.method?.methodType}
              options={builders.modifier.method.filter((methodItem: any) =>
                methodItem.module?.some(
                  (moduleItem: any) =>
                    moduleItem.id === sectionState.module?._id
                )
              )}
              required={true}
              onChange={setSectionState}
            />

            {sectionState.method?.methodType?.name !== 'addPerLevel' &&
              sectionState.method?.methodType?.name !== 'diePerLevel' && (
                <>
                  <Input
                    validation='num'
                    name={`minValue`}
                    label='Minimum Value'
                    errorMsg='Must contain only whole numbers'
                    autoComplete='off'
                    value={sectionState.multiplier}
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
          </>
        )}
        {sectionState.module?.name === 'condition' ? (
          <Dropdown
            name={`condition`}
            multiSelect={true}
            label='Condition Type'
            value={sectionState.condition}
            options={builders.condition}
            required={true}
            onChange={setSectionState}
          />
        ) : sectionState.module?.name === 'speed' ? (
          <Dropdown
            name={`speed`}
            multiSelect={true}
            value={sectionState.speed}
            label='Speed Type'
            options={builders.speed}
            required={true}
            onChange={setSectionState}
          />
        ) : sectionState.module?.name === 'passive' ? (
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
          (sectionState.module?.name === 'damage' ||
            sectionState.module?.name === 'spellDamage') && (
            <Dropdown
              name={`damage`}
              multiSelect={true}
              label='Damage Type'
              value={sectionState.damage}
              options={builders.damage}
              required={true}
              onChange={setSectionState}
            />
          )
        )}
        {(sectionState.method?.methodType?.name === 'setValue' &&
          sectionState.modType?.name !== 'setDieValue') ||
        sectionState.modType?.name === 'setValue' ? (
          <>
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
          </>
        ) : sectionState.method?.methodType?.name === 'ability' ? (
          <>
            <Dropdown
              name={`method.ability`}
              label='Method Ability'
              value={sectionState.method.ability}
              options={builders.ability}
              required={true}
              onChange={setSectionState}
            />
          </>
        ) : sectionState.method?.methodType?.name === 'setValue' &&
          sectionState.modType?.name === 'setDieValue' ? (
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
          sectionState.method?.methodType?.name === 'skill' && (
            <>
              <Dropdown
                name={`method.skill`}
                label='Method Skill'
                value={sectionState.method.skill}
                options={builders.skill}
                required={true}
                onChange={setSectionState}
              />
            </>
          )
        )}
        {(sectionState.modType?.name === 'bonus' ||
          sectionState.modType?.name === 'setValue') &&
          sectionState.module?.name === 'ability' && (
            <Input
              validation='num'
              name={`maxValue`}
              label='Max Value'
              autoComplete='off'
              value={sectionState.maxValue}
              errorMsg='Must contain only numbers'
              required={true}
              onChange={setSectionState}
            />
          )}
        {multipleOptions && (
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
        {sectionState.modType?.name === 'setDieValue' &&
          sectionState.method?.methodType?.name === 'diePerLevel' &&
          (!sectionState.diePerLevel ||
          !(sectionState.diePerLevel?.length > 0) ? (
            setSectionState({
              type: 'added',
              target: {
                name: `diePerLevel`,
              },
            })
          ) : (
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
          ))}
        {sectionState.method?.methodType?.name === 'addPerLevel' &&
          (!sectionState.addPerLevel ||
          !(sectionState.addPerLevel?.length > 0) ? (
            setSectionState({
              type: 'added',
              target: {
                name: `addPerLevel`,
              },
            })
          ) : (
            <Table
              name={`addPerLevel`}
              rows={{
                inputs: [
                  {
                    name: 'level',
                    validation: 'num',
                    errorMsg: 'Must be whole numbers, commas, and spaces only',
                  },
                  {
                    name: 'amount',
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
              value={sectionState.addPerLevel}
              addRow={true}
              onChange={setSectionState}
            />
          ))}
      </>
    </>
  )
}

export const ProficiencyContent: FC<SectionProps> = ({
  sectionState,
  setSectionState,
  builders,
  state,
  items,
}) => {
  const multipleOptions = sectionState.attribute?.some((attributeItem: any) => {
    attributeItem.name === 'providesOptions'
  })
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
      {sectionState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'optionGroups'
      ) && (
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
        sectionState.area?.name === 'itemType') && (
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
          {sectionState.area?.name === 'itemType' && (
            <Dropdown
              name={`itemType`}
              multiSelect={true}
              label='Item Type'
              value={sectionState.itemType}
              options={items
                ?.filter((itemType) =>
                  sectionState.category?.length > 0
                    ? sectionState.category?.some(
                        (categoryItem: any) =>
                          categoryItem.name === itemType.category.name
                      )
                    : itemType
                )
                .map((itemType) => itemType)}
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
      {multipleOptions && (
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

export const SenseContent: FC<SectionProps> = ({
  sectionState,
  setSectionState,
  builders,
  state,
}) => {
  const multipleOptions = sectionState.attribute?.some((attributeItem: any) => {
    attributeItem.name === 'providesOptions'
  })
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
      {sectionState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'optionGroups'
      ) && (
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
      {multipleOptions && (
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

export const SpellContent: FC<SectionProps> = ({
  sectionState,
  setSectionState,
  builders,
  state,
  spells,
  classes,
  featureState,
}) => {
  useEffect(() => {
    if (
      !sectionState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'spellsByLevel'
      )
    ) {
      setSectionState({
        type: 'removed',
        target: {
          name: `spellsByLevel`,
        },
      })
    }
  }, [sectionState, setSectionState])

  const multipleOptions = sectionState.attribute?.some((attributeItem: any) => {
    attributeItem.name === 'providesOptions'
  })

  return (
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
            ...spellItem,
            value: spellItem.level,
          }))}
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
      {sectionState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'optionGroups'
      ) && (
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
      {sectionState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'spellsByLevel'
      ) ? (
        (featureState.levelAvailable != null &&
          featureState.levelAvailable !== '' &&
          !(sectionState.spellsByLevel?.length > 0)) ||
        featureState?.levelAvailable?.split(', ')?.length !==
          sectionState.spellsByLevel?.length ? (
          setSectionState({
            type: 'added',
            target: {
              name: `spellsByLevel`,
              value: featureState?.levelAvailable
                ?.split(', ')
                .map((levelItem: string) => ({
                  level: Number(levelItem),
                })),
            },
          })
        ) : (
          <>
            <Table
              rows={{
                inputs: [
                  {
                    name: 'level',
                    readOnly: true,
                  },
                  {
                    name: 'spell',
                    type: 'select',
                    options: spells,
                    multiple: true,
                  },
                ],
                headers: [
                  {
                    value: 'Level',
                  },
                  {
                    value: 'Spells',
                  },
                ],
              }}
              name={`spellsByLevel`}
              value={sectionState.spellsByLevel}
              onChange={setSectionState}
            />
          </>
        )
      ) : (
        <>
          <Dropdown
            name={`spell`}
            multiSelect={true}
            label='Spell'
            value={sectionState.spell}
            options={spells?.filter(
              (spellItem) =>
                (sectionState?.classLimit?.length > 0
                  ? sectionState?.classLimit?.some((limitItem: any) =>
                      spellItem?.classes?.some(
                        (classItem: any) => limitItem.name === classItem.name
                      )
                    )
                  : spellItem) &&
                (sectionState?.levelLimit?.length > 0
                  ? sectionState?.levelLimit?.some(
                      (levelItem: any) => levelItem.value === spellItem.level
                    )
                  : spellItem)
            )}
            required={true}
            onChange={setSectionState}
          />
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
          {multipleOptions && (
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
  )
}

const SectionContent: FC<SectionContentProps> = ({
  state,
  sectionName,
  featureState,
  sectionState,
  setSectionState,
  setSectionIndex,
  sectionIndex,
  handleForward,
  handleUpdate,
  setStepName,
}) => {
  const [oldSectionState] = useState<any>(sectionState)
  const [matches, setMatches] = useState<boolean>(false)
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

  useEffect(() => {
    if (featureState[sectionName]?.length > 0) {
      setSectionIndex(featureState[sectionName]?.length)
    }
  }, [featureState, sectionName, setSectionIndex, sectionIndex])

  //Determine if changes made for warning in handleBack
  useEffect(() => {
    if (isEqual(sectionState, oldSectionState)) {
      setMatches(true)
    } else {
      setMatches(false)
    }
  }, [sectionState, oldSectionState])

  const handleReset = () => {
    setSectionState({
      type: 'reset',
      target: { value: oldSectionState },
    })
    setMatches(true)
  }

  const handleBack = () => {
    if (matches) {
      console.log('matches, alert')
    }
    setSectionState({
      type: 'reset',
      target: { value: {} },
    })
    setStepName('FeatureContent')
  }

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
          setSectionState={setSectionState}
          builders={builders}
        />
      </ScrollArea>
      <FormFooter
        handleBack={handleBack}
        forwardLabel={'Finish'}
        handleReset={handleReset}
        handleForward={handleForward}
        backLabel={'Back'}
        handleUpdate={handleUpdate}
      />
    </>
  )
}

export default SectionContent
