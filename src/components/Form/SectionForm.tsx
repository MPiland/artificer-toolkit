import { Fragment, memo, FC } from 'react'
import { startCase } from 'lodash'
import Dropdown from '../Dropdown/Dropdown'
import Input from '../Input/Input'
import Table from '../Table/Table'
import FeatureContent from './FeatureForm'
import { Action } from '../../utils/types'
import Grid from '../Grid/Grid'

interface SectionProps {
  stateName: string
  item: any
  index: number
  featureItem?: any
  builders?: any
  feats?: any[]
  items?: any[]
  spells?: any[]
  classes?: any[]
  state: any
  setState: (arg: Action) => void
}

type TableContent = {
  [key: string]: {
    content: FC<SectionProps>
  }
}

interface SectionContentProps {
  stateName: string
  sectionItem: any
  sectionName: string
  sectionIndex: number
  featureItem: any
  setState: (arg: Action) => void
  builders: any
  items: any[]
  spells: any[]
  classes: any[]
  feats: any[]
  state: any
}

const FeatContent: FC<SectionProps> = ({
  stateName,
  item,
  index,
  setState,
  builders,
  feats,
  state,
}) => {
  const multipleOptions = item.attribute?.some((attributeItem: any) => {
    attributeItem.name === 'providesOptions'
  })
  return (
    <Fragment key={index}>
      <Grid>
        <Dropdown
          multiSelect={true}
          name={`${stateName}.feat.${index}.attribute`}
          options={[].concat(
            builders.section.attribute,
            state.category?.name === 'subclass' &&
              builders.section.subclass.attribute
          )}
          label={`${startCase('feat')} Attributes`}
          value={item.attribute}
          onChange={setState}
        />
        {item.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'subtypeSpecific'
        ) && (
          <Dropdown
            name={`${stateName}.feat.${index}.subtype`}
            label='Subtype'
            value={item.subtype}
            options={state.subtype}
            required={true}
            onChange={setState}
          />
        )}
        {item.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'optionGroups'
        ) && (
          <Input
            validation='num'
            name={`${stateName}.feat.${index}.optionGroup`}
            label='Opt. Grp. #'
            autoComplete='off'
            value={item.optionGroup}
            errorMsg='Must contain only numbers'
            onChange={setState}
          />
        )}
        <Dropdown
          name={`${stateName}.feat.${index}.feat`}
          multiSelect={true}
          label='Feat'
          value={item.feat}
          options={feats}
          required={true}
          onChange={setState}
        />
        {multipleOptions && (
          <Input
            validation='num'
            name={`${stateName}.feat.${index}.selectionCount`}
            label='# of Selections'
            autoComplete='off'
            value={item.selectionCount}
            errorMsg='Must contain only numbers'
            required={true}
            onChange={setState}
          />
        )}
      </Grid>
    </Fragment>
  )
}

const ModifierContent: FC<SectionProps> = ({
  stateName,
  item,
  index,
  setState,
  builders,
  state,
}) => {
  const multipleOptions = item.attribute?.some((attributeItem: any) => {
    attributeItem.name === 'providesOptions'
  })
  return (
    <Fragment key={index}>
      <Grid>
        <Dropdown
          multiSelect={true}
          name={`${stateName}.modifier.${index}.attribute`}
          options={[].concat(
            builders.section.attribute,
            state.category?.name === 'subclass' &&
              builders.section.subclass.attribute
          )}
          label={`${startCase('modifier')} Attributes`}
          value={item.attribute}
          onChange={setState}
        />
        {item.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'subtypeSpecific'
        ) && (
          <Dropdown
            name={`${stateName}.modifier.${index}.subtype`}
            label='Subtype'
            value={item.subtype}
            options={state.subtype}
            required={true}
            onChange={setState}
          />
        )}
        {item.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'optionGroups'
        ) && (
          <Input
            validation='num'
            name={`${stateName}.modifier.${index}.optionGroup`}
            label='Opt. Grp. #'
            autoComplete='off'
            value={item.optionGroup}
            errorMsg='Must contain only numbers'
            onChange={setState}
          />
        )}
        <Dropdown
          name={`${stateName}.modifier.${index}.module`}
          label='Modifier Category'
          value={item.module}
          options={builders.modifier.module}
          required={true}
          onChange={setState}
        />
        {item.module?._id && (
          <Dropdown
            name={`${stateName}.modifier.${index}.modType`}
            label='Modifier Type'
            value={item.modType}
            options={builders.modifier.modType?.filter((modItem: any) =>
              modItem.module.some(
                (moduleItem: any) => moduleItem.id === item.module?._id
              )
            )}
            required={true}
            onChange={setState}
          />
        )}
        {item.module?.name === 'limitUse' &&
          item.modType?.name === 'useReset' && (
            <>
              <Dropdown
                name={`${stateName}.modifier.${index}.limitUse.resetOption`}
                label='Reset Option'
                value={item.limitUse?.resetOption}
                options={builders.feature.chargeReset}
                required={true}
                onChange={setState}
              />
              <Dropdown
                name={`${stateName}.modifier.${index}.limitUse.feature`}
                label='Feature'
                value={item.limitUse?.feature}
                options={state.feature}
                required={true}
                onChange={setState}
              />
            </>
          )}
        {item.module?.name === 'ability' && (
          <Dropdown
            name={`${stateName}.modifier.${index}.ability`}
            multiSelect={true}
            label='Ability'
            value={item.ability}
            options={builders.ability}
            required={true}
            onChange={setState}
          />
        )}
        {item.module?.name === 'saveAbility' && (
          <Dropdown
            name={`${stateName}.modifier.${index}.saveAbility`}
            multiSelect={true}
            label='Save Ability'
            value={item.saveAbility}
            options={builders.ability}
            required={true}
            onChange={setState}
          />
        )}
        {item.module?.name === 'skill' && (
          <Dropdown
            name={`${stateName}.modifier.${index}.skill`}
            multiSelect={true}
            label='Skill'
            value={item.skill}
            options={builders.skill}
            required={true}
            onChange={setState}
          />
        )}
        {item.module?.name === 'damageSave' && (
          <Dropdown
            name={`${stateName}.modifier.${index}.damageSave`}
            multiSelect={true}
            label='Damage'
            value={item.damageSave}
            options={builders.damage}
            required={true}
            onChange={setState}
          />
        )}
        {item.module?.name === 'conditionSave' && (
          <Dropdown
            name={`${stateName}.modifier.${index}.conditionSave`}
            multiSelect={true}
            label='Condition'
            value={item.conditionSave}
            options={builders.condition}
            required={true}
            onChange={setState}
          />
        )}
        {(item.modType?.name === 'bonus' ||
          item.modType?.name === 'penalty' ||
          item.modType?.name === 'setDieValue' ||
          item.modType?.name === 'setBonus') && (
          <>
            <Dropdown
              name={`${stateName}.modifier.${index}.method.methodType`}
              label='Method'
              value={item.method?.methodType}
              options={builders.modifier.method.filter((methodItem: any) =>
                methodItem.module?.some(
                  (moduleItem: any) => moduleItem.id === item.module?._id
                )
              )}
              required={true}
              onChange={setState}
            />

            {item.method?.methodType?.name !== 'addPerLevel' &&
              item.method?.methodType?.name !== 'diePerLevel' && (
                <>
                  <Input
                    validation='num'
                    name={`${stateName}.modifier.${index}.minValue`}
                    label='Minimum Value'
                    errorMsg='Must contain only whole numbers'
                    autoComplete='off'
                    value={item.multiplier}
                    onChange={setState}
                  />
                  <Input
                    validation='num'
                    name={`${stateName}.modifier.${index}.multiplier`}
                    label='Multiplier'
                    errorMsg='Must contain only whole numbers'
                    autoComplete='off'
                    value={item.multiplier}
                    onChange={setState}
                  />
                </>
              )}
          </>
        )}
        {item.module?.name === 'condition' ? (
          <Dropdown
            name={`${stateName}.modifier.${index}.condition`}
            multiSelect={true}
            label='Condition Type'
            value={item.condition}
            options={builders.condition}
            required={true}
            onChange={setState}
          />
        ) : item.module?.name === 'speed' ? (
          <Dropdown
            name={`${stateName}.modifier.${index}.speed`}
            multiSelect={true}
            value={item.speed}
            label='Speed Type'
            options={builders.speed}
            required={true}
            onChange={setState}
          />
        ) : item.module?.name === 'passive' ? (
          <Dropdown
            name={`${stateName}.modifier.${index}.passive`}
            multiSelect={true}
            label='Passive Type'
            value={item.passive?.options}
            options={builders.passive}
            required={true}
            onChange={setState}
          />
        ) : (
          (item.module?.name === 'damage' ||
            item.module?.name === 'spellDamage') && (
            <Dropdown
              name={`${stateName}.modifier.${index}.damage`}
              multiSelect={true}
              label='Damage Type'
              value={item.damage}
              options={builders.damage}
              required={true}
              onChange={setState}
            />
          )
        )}
        {(item.method?.methodType?.name === 'setValue' &&
          item.modType?.name !== 'setDieValue') ||
        item.modType?.name === 'setValue' ? (
          <>
            <Input
              validation='num'
              name={`${stateName}.modifier.${index}.method.setValue`}
              label='Set Value'
              errorMsg='Must contain only numbers'
              autoComplete='off'
              value={item.method?.setValue}
              required={true}
              onChange={setState}
            />
          </>
        ) : item.method?.methodType?.name === 'ability' ? (
          <>
            <Dropdown
              name={`${stateName}.modifier.${index}.method.ability`}
              label='Method Ability'
              value={item.method.ability}
              options={builders.ability}
              required={true}
              onChange={setState}
            />
          </>
        ) : item.method?.methodType?.name === 'setValue' &&
          item.modType?.name === 'setDieValue' ? (
          <>
            <Input
              validation='num'
              name={`${stateName}.modifier.${index}.dieCount`}
              label='Die Count'
              errorMsg='Must contain only whole numbers'
              autoComplete='off'
              value={item.dieCount}
              onChange={setState}
            />
            <Input
              validation='num'
              name={`${stateName}.modifier.${index}.dieValue`}
              label='Die Value'
              errorMsg='Must contain only whole numbers'
              autoComplete='off'
              value={item.dieValue}
              onChange={setState}
            />
          </>
        ) : (
          item.method?.methodType?.name === 'skill' && (
            <>
              <Dropdown
                name={`${stateName}.modifier.${index}.method.skill`}
                label='Method Skill'
                value={item.method.skill}
                options={builders.skill}
                required={true}
                onChange={setState}
              />
            </>
          )
        )}
        {(item.modType?.name === 'bonus' ||
          item.modType?.name === 'setValue') &&
          item.module?.name === 'ability' && (
            <Input
              validation='num'
              name={`${stateName}.modifier.${index}.maxValue`}
              label='Max Value'
              autoComplete='off'
              value={item.maxValue}
              errorMsg='Must contain only numbers'
              required={true}
              onChange={setState}
            />
          )}
        {multipleOptions && (
          <Input
            validation='num'
            name={`${stateName}.modifier.${index}.selectionCount`}
            label='# of Selections'
            autoComplete='off'
            value={item.selectionCount}
            errorMsg='Must contain only numbers'
            required={true}
            onChange={setState}
          />
        )}
      </Grid>
      <>
        {item.modType?.name === 'setDieValue' &&
        item.method?.methodType?.name === 'diePerLevel' ? (
          !item.diePerLevel || !(item.diePerLevel?.length > 0) ? (
            setState({
              type: 'added',
              payload: {
                target: {
                  name: `${stateName}.modifier.${index}.diePerLevel`,
                },
              },
            })
          ) : (
            <Table
              name={`${stateName}.modifier.${index}.diePerLevel`}
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
              value={item.diePerLevel}
              addRow={true}
              onChange={setState}
            />
          )
        ) : (
          (!!item.diePerLevel || item.diePerLevel?.length > 0) &&
          setState({
            type: 'removed',
            payload: {
              target: {
                name: `${stateName}.modifier.${index}.diePerLevel`,
              },
            },
          })
        )}
        {item.method?.methodType?.name === 'addPerLevel' ? (
          !item.addPerLevel || !(item.addPerLevel?.length > 0) ? (
            setState({
              type: 'added',
              payload: {
                target: {
                  name: `${stateName}.modifier.${index}.addPerLevel`,
                },
              },
            })
          ) : (
            <Table
              name={`${stateName}.modifier.${index}.addPerLevel`}
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
              value={item.addPerLevel}
              addRow={true}
              onChange={setState}
            />
          )
        ) : (
          !!item.addPerLevel &&
          setState({
            type: 'removed',
            payload: {
              target: {
                name: `${stateName}.modifier.${index}.addPerLevel`,
              },
            },
          })
        )}
      </>
    </Fragment>
  )
}

const ProficiencyContent: FC<SectionProps> = ({
  stateName,
  item,
  index,
  setState,
  builders,
  state,
  items,
}) => {
  const multipleOptions = item.attribute?.some((attributeItem: any) => {
    attributeItem.name === 'providesOptions'
  })
  return (
    <Fragment key={index}>
      <Grid>
        <Dropdown
          multiSelect={true}
          name={`${stateName}.proficiency.${index}.attribute`}
          options={[].concat(
            builders.section.attribute,
            state.category?.name === 'subclass' &&
              builders.section.subclass.attribute
          )}
          label={`${startCase('proficiency')} Attributes`}
          value={item.attribute}
          onChange={setState}
        />
        {item.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'subtypeSpecific'
        ) && (
          <Dropdown
            name={`${stateName}.proficiency.${index}.subtype`}
            label='Subtype'
            value={item.subtype}
            options={state.subtype}
            required={true}
            onChange={setState}
          />
        )}
        {item.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'optionGroups'
        ) && (
          <Input
            validation='num'
            name={`${stateName}.proficiency.${index}.optionGroup`}
            label='Opt. Grp. #'
            autoComplete='off'
            value={item.optionGroup}
            errorMsg='Must contain only numbers'
            onChange={setState}
          />
        )}
        <Dropdown
          name={`${stateName}.proficiency.${index}.area`}
          label='Proficiency Area'
          value={item.area}
          options={builders.proficiency.area}
          required={true}
          onChange={setState}
        />
        {item?.area?.name === 'ability' && (
          <Dropdown
            name={`${stateName}.proficiency.${index}.ability`}
            multiSelect={true}
            label='Ability'
            value={item.ability}
            options={builders.ability}
            required={true}
            onChange={setState}
          />
        )}
        {item?.area?.name === 'skill' && (
          <Dropdown
            name={`${stateName}.proficiency.${index}.skill`}
            multiSelect={true}
            label='Skill'
            value={item.skill}
            options={builders.skill}
            required={true}
            onChange={setState}
          />
        )}
        {item?.area?.name === 'saveAbility' && (
          <Dropdown
            name={`${stateName}.proficiency.${index}.saveAbility`}
            multiSelect={true}
            label='Save Ability'
            value={item.saveAbility}
            options={builders.ability}
            required={true}
            onChange={setState}
          />
        )}
        {item?.area?.name === 'language' && (
          <Dropdown
            name={`${stateName}.proficiency.${index}.language`}
            multiSelect={true}
            label='Language'
            value={item.language}
            options={builders.language}
            onChange={setState}
          />
        )}
        {(item.area?.name === 'property' || item.area?.name === 'itemType') && (
          <>
            <Dropdown
              name={`${stateName}.proficiency.${index}.category`}
              multiSelect={true}
              label='Item Category'
              value={item.category}
              options={builders.item.category}
              onChange={setState}
            />
            {item.area?.name === 'property' && (
              <Dropdown
                name={`${stateName}.proficiency.${index}.property`}
                multiSelect={true}
                label='Item Property'
                value={item.property}
                options={[].concat(
                  ...builders.item.category
                    .filter((bCategoryItem: any) =>
                      item.category?.length > 0
                        ? item.category?.some(
                            (categoryItem: any) =>
                              categoryItem.name === bCategoryItem.name
                          )
                        : bCategoryItem
                    )
                    .map((category: any) => category.property)
                )}
                onChange={setState}
              />
            )}
            {item.area?.name === 'itemType' && (
              <Dropdown
                name={`${stateName}.proficiency.${index}.itemType`}
                multiSelect={true}
                label='Item Type'
                value={item.itemType}
                options={items?.filter((itemType) =>
                  item.category?.length > 0
                    ? item.category?.some(
                        (categoryItem: any) =>
                          categoryItem.name === itemType.category.name
                      )
                    : itemType
                )}
                onChange={setState}
              />
            )}
          </>
        )}
        <Dropdown
          name={`${stateName}.proficiency.${index}.level`}
          label='Proficiency Level'
          value={item.level}
          options={builders.proficiency.level}
          required={true}
          onChange={setState}
        />
        {multipleOptions && (
          <Input
            validation='num'
            name={`${stateName}.proficiency.${index}.selectionCount`}
            label='# of Selections'
            autoComplete='off'
            value={item.selectionCount}
            errorMsg='Must contain only numbers'
            required={true}
            onChange={setState}
          />
        )}
      </Grid>
    </Fragment>
  )
}

const SenseContent: FC<SectionProps> = ({
  stateName,
  item,
  index,
  setState,
  builders,
  state,
}) => {
  const multipleOptions = item.attribute?.some((attributeItem: any) => {
    attributeItem.name === 'providesOptions'
  })
  return (
    <Fragment key={index}>
      <Grid>
        <Dropdown
          multiSelect={true}
          name={`${stateName}.sense.${index}.attribute`}
          options={[].concat(
            builders.section.attribute,
            state.category?.name === 'subclass' &&
              builders.section.subclass.attribute
          )}
          label={`${startCase('sense')} Attributes`}
          value={item.attribute}
          onChange={setState}
        />
        {item.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'subtypeSpecific'
        ) && (
          <Dropdown
            name={`${stateName}.sense.${index}.subtype`}
            label='Subtype'
            value={item.subtype}
            options={state.subtype}
            required={true}
            onChange={setState}
          />
        )}
        {item.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'optionGroups'
        ) && (
          <Input
            validation='num'
            name={`${stateName}.sense.${index}.optionGroup`}
            label='Opt. Grp. #'
            autoComplete='off'
            value={item.optionGroup}
            errorMsg='Must contain only numbers'
            onChange={setState}
          />
        )}
        <Dropdown
          name={`${stateName}.sense.${index}.sense`}
          multiSelect={true}
          label='Sense'
          value={item.sense}
          options={builders.sense}
          required={true}
          onChange={setState}
        />
        {multipleOptions && (
          <Input
            validation='num'
            name={`${stateName}.sense.${index}.selectionCount`}
            label='# of Selections'
            autoComplete='off'
            value={item.selectionCount}
            errorMsg='Must contain only numbers'
            required={true}
            onChange={setState}
          />
        )}
      </Grid>
    </Fragment>
  )
}

const SpellContent: FC<SectionProps> = ({
  stateName,
  item,
  index,
  setState,
  builders,
  state,
  spells,
  classes,
  featureItem,
}) => {
  const multipleOptions = item.attribute?.some((attributeItem: any) => {
    attributeItem.name === 'providesOptions'
  })
  return (
    <Fragment key={index}>
      <Grid>
        <Dropdown
          multiSelect={true}
          name={`${stateName}.spell.${index}.attribute`}
          options={[].concat(
            builders.section.spell.attribute,
            builders.section.attribute,
            state.category?.name === 'subclass' &&
              builders.section.subclass.attribute
          )}
          label={`${startCase('spell')} Attributes`}
          value={item.attribute}
          onChange={setState}
        />
        {item.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'classLimit'
        ) && (
          <Dropdown
            name={`${stateName}.spell.${index}.classLimit`}
            multiSelect={true}
            label='Class Limit'
            value={item.classLimit}
            options={classes?.filter(
              (classItem: any) => classItem.category.name !== 'subclass'
            )}
            required={true}
            onChange={setState}
          />
        )}
        {item.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'levelLimit'
        ) && (
          <Dropdown
            name={`${stateName}.spell.${index}.levelLimit`}
            multiSelect={true}
            label='Level Limit'
            value={item.levelLimit}
            options={spells?.map((spellItem) => ({
              ...spellItem,
              value: spellItem.level,
            }))}
            required={true}
            onChange={setState}
          />
        )}
        {item.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'subtypeSpecific'
        ) && (
          <Dropdown
            name={`${stateName}.spell.${index}.subtype`}
            label='Subtype'
            value={item.subtype}
            options={state.subtype}
            required={true}
            onChange={setState}
          />
        )}
        {item.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'optionGroups'
        ) && (
          <Input
            validation='num'
            name={`${stateName}.spell.${index}.optionGroup`}
            label='Opt. Grp. #'
            autoComplete='off'
            value={item.optionGroup}
            errorMsg='Must contain only numbers'
            onChange={setState}
          />
        )}
        {item.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'spellsByLevel'
        ) ? (
          (featureItem.levelAvailable != null &&
            featureItem.levelAvailable !== '' &&
            !(item.spellsByLevel?.length > 0)) ||
          featureItem?.levelAvailable?.split(', ')?.length !==
            item.spellsByLevel?.length ? (
            setState({
              type: 'added',
              payload: {
                target: {
                  name: `${stateName}.spell.${index}.spellsByLevel`,
                  value: featureItem?.levelAvailable
                    ?.split(', ')
                    .map((levelItem: string) => ({
                      level: Number(levelItem),
                    })),
                },
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
                name={`${stateName}.spell.${index}.spellsByLevel`}
                value={item.spellsByLevel}
                onChange={setState}
              />
            </>
          )
        ) : (
          <>
            {!!item.spellsByLevel &&
              setState({
                type: 'removed',
                payload: {
                  target: {
                    name: `${stateName}.spell.${index}.spellsByLevel`,
                  },
                },
              })}
            <Dropdown
              name={`${stateName}.spell.${index}.spell`}
              multiSelect={true}
              label='Spell'
              value={item.spell}
              options={spells?.filter(
                (spellItem) =>
                  (item?.classLimit?.length > 0
                    ? item?.classLimit?.some((limitItem: any) =>
                        spellItem?.classes?.some(
                          (classItem: any) => limitItem.name === classItem.name
                        )
                      )
                    : spellItem) &&
                  (item?.levelLimit?.length > 0
                    ? item?.levelLimit?.some(
                        (levelItem: any) => levelItem.value === spellItem.level
                      )
                    : spellItem)
              )}
              required={true}
              onChange={setState}
            />
            {item.attribute?.some(
              (attributeItem: any) => attributeItem.name === 'optionalAbility'
            ) && (
              <Dropdown
                name={`${stateName}.spell.${index}.ability`}
                multiSelect={true}
                label='Ability'
                value={item.ability}
                options={builders.ability}
                required={true}
                onChange={setState}
              />
            )}
            {multipleOptions && (
              <Input
                validation='num'
                name={`${stateName}.spell.${index}.selectionCount`}
                label='# of Selections'
                autoComplete='off'
                value={item.selectionCount}
                errorMsg='Must contain only numbers'
                required={true}
                onChange={setState}
              />
            )}
          </>
        )}
      </Grid>
    </Fragment>
  )
}

const StyleContent: FC<SectionProps> = ({
  stateName,
  item,
  index,
  setState,
  state,
}) => {
  const styleSection = false
  const sectionStateName = `${stateName}.style.option.${index}`
  return (
    <FeatureContent
      stateName={sectionStateName}
      featureItem={item}
      styleSection={styleSection}
      setState={setState}
      state={state}
    />
  )
}

const tableContent: TableContent = {
  feat: {
    content: FeatContent,
  },
  modifier: {
    content: ModifierContent,
  },
  proficiency: {
    content: ProficiencyContent,
  },
  sense: {
    content: SenseContent,
  },
  spell: {
    content: SpellContent,
  },
  style: {
    content: StyleContent,
  },
}

const SectionForm: FC<SectionContentProps> = memo(
  ({
    stateName,
    sectionItem,
    sectionName,
    sectionIndex,
    featureItem,
    setState,
    builders,
    items,
    classes,
    spells,
    feats,
    state,
  }) => {
    const ContentComponent = tableContent[sectionName]?.content
    return (
      <ContentComponent
        stateName={stateName}
        state={state}
        item={sectionItem}
        items={items}
        spells={spells}
        feats={feats}
        classes={classes}
        index={sectionIndex}
        setState={setState}
        builders={builders}
        featureItem={featureItem}
      />
    )
  }
)

export const getSectionNames = () => {
  return Object.keys(tableContent)
}

SectionForm.displayName = 'SectionForm'

export default SectionForm
