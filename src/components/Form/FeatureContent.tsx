import { FC, useState, useEffect } from 'react'
import { useGetBuildersQuery } from '../../features/builders/buildersApiSlice'
import {
  selectAllItems,
  useGetItemsQuery,
} from '../../features/items/itemsApiSlice'
import Input from '../Input/Input'
import Dropdown from '../Dropdown/Dropdown'
import RichTextEditor from '../RichTextEditor/RichTextEditor'
import Table from '../Table/Table'
import Divider from '../Divider/Divider'
import CollapseContainer from '../Collapse/Collapse'
import { getSectionNames } from './FormUtils'
import Spinner from '../Spinner/Spinner'
import {
  DropdownOption,
  ReducerActionType,
  RowHeader,
  RowInput,
  FormContext,
  StepName,
  SectionName,
} from '../../utils/types'
import Grid from '../Grid/Grid'
import Select from '../Select/Select'
import { startCase, isEqual } from 'lodash'
import { feature_description, feature_list, form_content } from './Form.css'
import Accordion from '../Accordion/Accordion'
import parse from 'html-react-parser'
import { sprinkles } from '../../css/sprinkles.css'
import useIsLoading from '../../hooks/useIsLoading'
import ScrollArea from '../ScrollArea/ScrollArea'
import FormFooter from './FormFooter'
import { useNavigate } from 'react-router-dom'

interface FeatureContentProps {
  state?: any
  context: {
    type?: 'edit' | 'create'
    title: string
  }
  setSectionName: (arg: SectionName) => void
  setStepName: (arg: StepName) => void
  formContext: FormContext
  setFormContext: (arg: FormContext) => void
  featureState: any
  setFeatureState: (arg: ReducerActionType) => void
  setOptionState?: (arg: ReducerActionType) => void
  setSectionState: (arg: ReducerActionType) => void
  setOptionIndex?: (arg: number) => void
  handleForward: () => void
  handleUpdate?: () => void
}

const FeatureContent: FC<FeatureContentProps> = ({
  state,
  context,
  setSectionName,
  setStepName,
  formContext,
  setFormContext,
  featureState,
  setFeatureState,
  setOptionState,
  setOptionIndex,
  setSectionState,
  handleForward,
  handleUpdate,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [oldFeatureState] = useState<any>(featureState)
  const [matches, setMatches] = useState<boolean>(false)

  const navigate = useNavigate()

  const { data: builders } = useGetBuildersQuery(undefined)

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({ items: data && selectAllItems(data) }),
  })

  const isLoading = useIsLoading()

  //Determine if changes made for warning in handleBack
  useEffect(() => {
    if (isEqual(featureState, oldFeatureState)) {
      setMatches(true)
    } else {
      setMatches(false)
    }
  }, [featureState, oldFeatureState])

  const damageTableColumns = (feature: any) => {
    const secondary = feature?.damageAttribute?.some(
      (attributeItem: any) => attributeItem.name === 'secondaryDamage'
    )
    const bonus =
      feature?.damageAttribute?.some(
        (attributeItem: any) => attributeItem.name === 'bonusDamage'
      ) && feature?.bonus?.bonusAttribute?.name === 'setValue'
    const inputArray: RowInput[] = [
      {
        name: 'level',
        value: 'Level',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      },
      {
        name: 'diceCount',
        value: 'Dice Count',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      },
      {
        name: 'diceValue',
        value: 'Dice Value',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      },
    ]
    if (secondary) {
      inputArray.splice(
        3,
        0,
        {
          name: 'secDiceCount',
          value: 'Sec. Dice Count',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
        {
          name: 'secDiceValue',
          value: 'Sec. Dice Value',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        }
      )
    }
    if (bonus) {
      inputArray.push({
        name: 'bonusDamage',
        value: 'Bonus Damage',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      })
    }

    const headerArray: RowHeader[] = inputArray.map((inputItem) => ({
      value: inputItem.value,
      required: true,
    }))

    return { inputs: inputArray, headers: headerArray }
  }

  const toggle = (index: number) => {
    if (activeIndex === index) {
      return setActiveIndex(null)
    }
    setActiveIndex(index)
  }

  const handleRemove = (sectionName: SectionName, sectionIndex: number) => {
    setFeatureState({
      type: 'removed',
      target: { name: `${sectionName}.${sectionIndex}` },
    })
  }

  const handleEdit = (sectionName: SectionName, sectionIndex: number) => {
    const sectionState = featureState[sectionName][sectionIndex]
    console.log('sectionState', sectionState)
    if (sectionName === 'option') {
      setOptionState &&
        setOptionState({
          type: 'reset',
          target: { value: sectionState },
        })
      return setFormContext('OptionContent')
    }
    setSectionName(sectionName)
    setSectionState({
      type: 'reset',
      target: { value: sectionState },
    })
    setStepName('SectionContent')
  }

  const handleReset = () => {
    setFeatureState({
      type: 'reset',
      target: { value: oldFeatureState },
    })
    setMatches(true)
  }

  const handleBack = () => {
    if (matches) {
      console.log('matches, alert')
    }
    setFeatureState({
      type: 'reset',
      target: { value: {} },
    })
    if (formContext === 'OptionContent') {
      setFormContext('')
      return setStepName('FeatureContent')
    }
    if (context.title === 'feat') {
      return navigate(-1)
    }
    setStepName('')
  }

  const sectionNames = getSectionNames().filter(
    (sectionName) =>
      (formContext === 'OptionContent'
        ? sectionName !== 'option'
        : sectionName) &&
      (featureState?.option?.length > 0
        ? sectionName === 'option'
        : sectionName)
  )

  const selectSection = (sectionName: SectionName) => {
    if (sectionName !== '') {
      if (sectionName === 'option') {
        const optionIndex =
          featureState.option?.length > 0 ? featureState.option.length : 0
        setOptionIndex && setOptionIndex(optionIndex)
        setFormContext('OptionContent')
        return setStepName('FeatureContent')
      }
      setSectionName(sectionName)
      setStepName('SectionContent')
    }
  }

  return !featureState || !state || isLoading || !builders ? (
    <Spinner />
  ) : (
    <>
      <ScrollArea scrollDirection='vertical' className={form_content}>
        <div>
          <Grid className={sprinkles({ mb: 'size-3' })}>
            <Input
              name={`value`}
              autoComplete='off'
              label={
                formContext === 'OptionContent'
                  ? 'Option Name'
                  : context.title === 'feat'
                  ? 'Feat Name'
                  : 'Feature Name'
              }
              value={featureState?.value}
              onChange={setFeatureState}
            />
            <Select
              handleChange={selectSection as (arg: string) => void}
              placeholder='Add...'
              label={'Add Section'}
              options={sectionNames}
            />
          </Grid>
          <RichTextEditor
            label='Feature description'
            value={featureState?.desc}
            name={`desc`}
            onChange={setFeatureState}
            className={sprinkles({ mb: 'size-3' })}
          />
          <Grid className={sprinkles({ mb: 'size-3' })}>
            {context.title !== 'item' && formContext !== 'OptionContent' && (
              <Input
                name={`levelAvailable`}
                autoComplete='off'
                label='Level(s) Available'
                required={true}
                value={featureState?.levelAvailable}
                validation='num'
                errorMsg='Must contain whole numbers and commas only'
                onChange={setFeatureState}
              />
            )}
            <Dropdown
              multiSelect={true}
              name={`attribute`}
              options={[]
                .concat(
                  builders.feature.attribute,
                  context.title &&
                    builders.feature[context.title]?.attribute?.length > 0 &&
                    builders.feature[context.title]?.attribute
                )
                .filter((attributeItem: any) =>
                  context.title === 'item'
                    ? attributeItem.name !== 'providesOptions' &&
                      attributeItem.name !== 'optionGroups'
                    : attributeItem
                )}
              label='Feature Attributes'
              value={featureState?.attribute}
              onChange={setFeatureState}
            />
            {featureState?.option?.length > 0 &&
              featureState?.attribute?.some(
                (attributeItem: any) => attributeItem.name === 'replaceAtLevel'
              ) && (
                <Input
                  name={`replaceCount`}
                  value={featureState?.replaceCount}
                  label='Replacement at Level Count'
                  onChange={setFeatureState}
                  validation='num'
                  required={true}
                  errorMsg={'Must contain only numbers'}
                />
              )}
            {featureState?.attribute?.some(
              (attributeItem: any) => attributeItem.name === 'ancestrySpecific'
            ) && (
              <Dropdown
                multiSelect={true}
                name={`ancestry`}
                options={state?.ancestry}
                label='Ancestry'
                value={featureState?.ancestry}
                required={true}
                onChange={setFeatureState}
              />
            )}
            {featureState?.attribute?.some(
              (attributeItem: any) => attributeItem.name === 'limitUse'
            ) && (
              <>
                <Dropdown
                  name={`limitUse.limitBy`}
                  label='Limit By Option'
                  value={featureState?.limitUse?.limitBy}
                  options={[].concat(
                    builders.feature.chargeLimit,
                    context.title &&
                      builders.feature[context.title]?.chargeLimit?.length >
                        0 &&
                      builders.feature[context.title]?.chargeLimit
                  )}
                  required={true}
                  onChange={setFeatureState}
                />
                {featureState?.limitUse?.limitBy?.name === 'ability' ? (
                  <>
                    <Dropdown
                      name={`limitUse.ability`}
                      label='Ability'
                      value={featureState?.limitUse?.ability}
                      options={builders.ability}
                      required={true}
                      onChange={setFeatureState}
                    />
                    <Input
                      name={`limitUse.minValue`}
                      autoComplete='off'
                      label='Minimal Value'
                      value={featureState?.limitUse?.minValue}
                      onChange={setFeatureState}
                    />
                  </>
                ) : featureState.limitUse?.limitBy?.name === 'skill' ? (
                  <Dropdown
                    name={`limitUse.skill`}
                    label='Skill'
                    value={featureState?.limitUse?.skill}
                    options={builders.skill}
                    required={true}
                    onChange={setFeatureState}
                  />
                ) : (
                  featureState.limitUse?.limitBy?.name === 'setValue' && (
                    <Input
                      validation='num'
                      type='text'
                      name={`limitUse.setValue`}
                      errorMsg='Must contain only numbers'
                      label='Use Amount'
                      value={featureState?.limitUse?.setValue}
                      required={true}
                      onChange={setFeatureState}
                    />
                  )
                )}
                {featureState?.limitUse?.limitBy?.name !== 'level' &&
                  featureState.limitUse?.limitBy?.name !== 'setValue' && (
                    <>
                      <Input
                        name={`limitUse.addValue`}
                        autoComplete='off'
                        label='Additional Amount'
                        value={featureState?.limitUse?.addValue}
                        onChange={setFeatureState}
                      />
                      <Input
                        name={`limitUse.minValue`}
                        autoComplete='off'
                        label='Minimal Value'
                        value={featureState?.limitUse?.minValue}
                        onChange={setFeatureState}
                      />
                    </>
                  )}
                {featureState?.limitUse?.limitBy?.name !== 'setValue' && (
                  <Input
                    name={`limitUse.multiplier`}
                    autoComplete='off'
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    label='Multiplier'
                    value={featureState?.limitUse?.multiplier}
                    onChange={setFeatureState}
                  />
                )}
                <Dropdown
                  name={`limitUse.resetOption`}
                  label='Reset Option'
                  value={featureState?.limitUse?.resetOption}
                  options={builders.feature.chargeReset}
                  required={true}
                  onChange={setFeatureState}
                />
              </>
            )}
            {featureState?.attribute?.some(
              (attributeItem: any) => attributeItem.name === 'isAction'
            ) && (
              <>
                <Dropdown
                  name={`action`}
                  label='Action Type'
                  value={featureState?.action}
                  options={builders.feature.action}
                  required={true}
                  onChange={setFeatureState}
                />
              </>
            )}
            {featureState?.attribute?.some(
              (attributeItem: any) => attributeItem.name === 'hasRange'
            ) && (
              <>
                <Input
                  validation='num'
                  name={`range.minRange`}
                  autoComplete='off'
                  label='Minimum Range'
                  required={true}
                  value={featureState?.range?.minRange}
                  errorMsg='Must contain only numbers'
                  onChange={setFeatureState}
                />
                <Input
                  validation='num'
                  name={`range.maxRange`}
                  autoComplete='off'
                  label='Max Range'
                  required={true}
                  errorMsg='Must contain only numbers'
                  value={featureState?.range?.maxRange}
                  onChange={setFeatureState}
                />
                <Dropdown
                  name={`range.unit`}
                  label='UoM'
                  value={featureState?.range?.unit}
                  options={[
                    ...(Object.values(builders.unit.imperial).flatMap(
                      (item) => item
                    ) as DropdownOption[]),
                  ]}
                  optionalKey='short'
                  onChange={setFeatureState}
                />
              </>
            )}
            {featureState?.attribute?.some(
              (attributeItem: any) => attributeItem.name === 'requireSave'
            ) && (
              <>
                <Dropdown
                  name={`saveAbility.attribute`}
                  multiSelect={true}
                  label='Save Attribute'
                  value={featureState?.saveAbility?.attribute}
                  options={builders.feature.saveAttribute}
                  onChange={setFeatureState}
                />
                <Dropdown
                  name={`saveAbility.ability`}
                  label='DC Ability'
                  value={featureState?.saveAbility?.ability}
                  options={builders.ability}
                  required={true}
                  onChange={setFeatureState}
                />
                <Input
                  validation='num'
                  name={`saveAbility.minValue`}
                  autoComplete='off'
                  label='Minimum Value'
                  required={true}
                  errorMsg='Must contain only numbers'
                  value={featureState?.saveAbility?.minValue}
                  onChange={setFeatureState}
                />
                {featureState?.saveAbility?.attribute?.some(
                  (attributeItem: any) =>
                    attributeItem.name === 'addAbilityModifier'
                ) && (
                  <Dropdown
                    name={`saveAbility.abilityModifier`}
                    label='Modifier Ability'
                    value={featureState?.saveAbility?.abilityModifier}
                    options={builders.ability}
                    required={true}
                    onChange={setFeatureState}
                  />
                )}
              </>
            )}
            {featureState?.attribute?.some(
              (attributeItem: any) => attributeItem.name === 'hasRequirements'
            ) && (
              <Dropdown
                multiSelect={true}
                name={`requirement.option`}
                label='Requirement'
                options={[].concat(
                  builders.feature.requirement,
                  context.title &&
                    builders.feature[context.title]?.requirement?.length > 0 &&
                    builders.feature[context.title]?.requirement
                )}
                value={featureState?.requirement?.option}
                required={true}
                onChange={setFeatureState}
              />
            )}
          </Grid>
          {featureState?.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'hasRequirements'
          ) &&
            !featureState.requirement?.option?.every(
              (featureState: any) => featureState.name === 'notProficient'
            ) && (
              <>
                <Divider label={'Requirements'} />{' '}
                <Grid>
                  {featureState?.requirement?.option?.some(
                    (featureState: any) =>
                      featureState.name === 'skillProficiency'
                  ) && (
                    <Dropdown
                      multiSelect={true}
                      name={`requirement.skillProficiency.skill`}
                      label='Skill Proficiency'
                      value={featureState?.requirement?.skillProficiency?.skill}
                      options={builders.skill}
                      required={true}
                      onChange={setFeatureState}
                    />
                  )}
                  {featureState?.requirement?.option?.some(
                    (featureState: any) => featureState.name === 'abilityScore'
                  ) && (
                    <>
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.abilityScore.ability`}
                        value={featureState?.requirement?.abilityScore?.ability}
                        label='Ability'
                        options={builders.ability}
                        required={true}
                        onChange={setFeatureState}
                      />
                      <Input
                        name={`requirement.abilityScore.score`}
                        value={featureState?.requirement?.abilityScore?.score}
                        label='Score'
                        required={true}
                        validation='num'
                        errorMsg='Must contain only numbers'
                        onChange={setFeatureState}
                      />
                    </>
                  )}
                </Grid>
                {featureState?.requirement?.option?.some(
                  (requirementItem: any) =>
                    requirementItem.name === 'itemProficiency'
                ) && (
                  <>
                    <Divider label={'Item Proficiency'} />{' '}
                    <Grid>
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.itemProficiency.category`}
                        value={
                          featureState?.requirement?.itemProficiency?.category
                        }
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setFeatureState}
                      />
                      <Dropdown
                        name={`requirement.itemProficiency.property`}
                        multiSelect={true}
                        label='Item Property'
                        value={
                          featureState?.requirement?.itemProficiency?.property
                        }
                        options={items
                          ?.filter((item: any) =>
                            featureState.requirement?.itemProficiency?.category
                              ?.length > 0
                              ? featureState.requirement?.itemProficiency?.category?.some(
                                  (categoryItem: any) =>
                                    categoryItem.name ===
                                    item.categoryItem?.name
                                )
                              : item
                          )
                          .map((item: any) => item.property)}
                        onChange={setFeatureState}
                      />
                      <Dropdown
                        name={`requirement.itemProficiency.itemType`}
                        multiSelect={true}
                        label='Item type'
                        value={
                          featureState?.requirement?.itemProficiency?.itemType
                        }
                        options={items
                          ?.filter((item: any) =>
                            featureState.requirement.itemProficiency?.category
                              ?.length > 0
                              ? featureState.requirement.itemProficiency?.category?.some(
                                  (categoryItem: any) =>
                                    categoryItem.name ===
                                    item.categoryItem?.name
                                )
                              : item
                          )
                          .map((item: any) => item)}
                        onChange={setFeatureState}
                      />
                    </Grid>
                  </>
                )}
                {(formContext === 'OptionContent'
                  ? featureState
                  : featureState
                )?.requirement?.option?.some(
                  (featureState: any) => featureState.name === 'equipped'
                ) && (
                  <>
                    <Divider label={'Equipped'} />{' '}
                    <Grid>
                      <Input
                        name={`requirement.equipped.numberEquipped`}
                        value={
                          featureState?.requirement?.equipped?.numberEquipped
                        }
                        label='Number Equipped'
                        onChange={setFeatureState}
                        validation='num'
                        errorMsg={'Must contain only numbers'}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.equipped.category`}
                        value={featureState?.requirement?.equipped?.category}
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setFeatureState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.equipped.property`}
                        label='Item Property'
                        value={featureState?.requirement?.equipped?.property}
                        options={items
                          ?.filter((item: any) =>
                            featureState.requirement?.equipped?.category
                              ?.length > 0
                              ? featureState.requirement?.equipped?.category?.some(
                                  (categoryItem: any) =>
                                    categoryItem.name ===
                                    item.categoryItem?.name
                                )
                              : item
                          )
                          .map((item: any) => item.property)}
                        onChange={setFeatureState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.equipped.itemType`}
                        label='Item type'
                        value={featureState?.requirement?.equipped?.itemType}
                        options={items
                          ?.filter((item: any) =>
                            featureState.requirement.equipped?.category
                              ?.length > 0
                              ? featureState.requirement.equipped?.category?.some(
                                  (categoryItem: any) =>
                                    categoryItem.name ===
                                    item.categoryItem?.name
                                )
                              : item
                          )
                          .map((item: any) => item)}
                        onChange={setFeatureState}
                      />
                    </Grid>
                  </>
                )}
                {(formContext === 'OptionContent'
                  ? featureState
                  : featureState
                )?.requirement?.option?.some(
                  (featureState: any) => featureState.name === 'notEquipped'
                ) && (
                  <>
                    <Divider label={'Not Equipped'} />{' '}
                    <Grid className={sprinkles({ mb: 'size-2' })}>
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.notEquipped.category`}
                        value={featureState?.requirement?.notEquipped?.category}
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setFeatureState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.notEquipped.property`}
                        value={featureState?.requirement?.notEquipped?.property}
                        label='Item Property'
                        options={items
                          ?.filter((item: any) =>
                            featureState.requirement.notEquipped?.category
                              ?.length > 0
                              ? featureState.requirement.notEquipped?.category?.some(
                                  (categoryItem: any) =>
                                    categoryItem.name ===
                                    item.categoryItem?.name
                                )
                              : item
                          )
                          .map((item: any) => item.property)}
                        onChange={setFeatureState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.notEquipped.itemType`}
                        label='Item type'
                        value={featureState?.requirement?.notEquipped?.itemType}
                        options={items
                          ?.filter((item: any) =>
                            featureState.requirement.notEquipped?.category
                              ?.length > 0
                              ? featureState.requirement.notEquipped?.category?.some(
                                  (categoryItem: any) =>
                                    categoryItem.name ===
                                    item.categoryItem?.name
                                )
                              : item
                          )
                          .map((item: any) => item)}
                        onChange={setFeatureState}
                      />
                    </Grid>
                  </>
                )}
              </>
            )}
          {featureState?.limitUse?.limitBy?.name === 'level' &&
            featureState.attribute?.some(
              (attributeItem: any) => attributeItem.name === 'limitUse'
            ) &&
            (!featureState.limitUse.level ? (
              setFeatureState({
                type: 'added',
                target: {
                  name: `limitUse.level`,
                },
              })
            ) : (
              <>
                <CollapseContainer title={'Limit Use Table'}>
                  <div className='section-content'>
                    <Table
                      rows={{
                        inputs: [
                          {
                            name: 'value',
                            errorMsg: 'Must contain only numbers',
                            validation: 'num',
                          },
                          {
                            name: 'useNum',
                            errorMsg: 'Must contain only numbers',
                            validation: 'num',
                          },
                        ],
                        headers: [
                          {
                            value: 'Level',
                          },
                          {
                            value: 'Uses',
                          },
                        ],
                      }}
                      name={`limitUse.level`}
                      value={featureState?.limitUse?.level}
                      onChange={setFeatureState}
                      addRow={true}
                    />
                  </div>
                </CollapseContainer>
              </>
            ))}
          {featureState?.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'doesDamage'
          ) && (
            <>
              <Grid>
                <Dropdown
                  multiSelect={true}
                  name={`damage.damageAttribute`}
                  label='Damage Attribute'
                  value={featureState?.damage?.damageAttribute}
                  options={builders.feature.damageAttribute}
                  onChange={setFeatureState}
                />
                <Dropdown
                  name={`damage.damageType`}
                  multiSelect={true}
                  label='Damage Type'
                  value={featureState?.damage?.damageType}
                  options={builders.damage}
                  required={true}
                  onChange={setFeatureState}
                />
                {(formContext === 'OptionContent'
                  ? featureState
                  : featureState
                )?.damage?.damageAttribute?.some(
                  (attributeItem: any) => attributeItem.name === 'bonusDamage'
                ) && (
                  <Dropdown
                    name={`damage.bonus.bonusAttribute`}
                    label='Bonus Type'
                    value={featureState?.damage?.bonus?.bonusAttribute}
                    options={builders.feature.bonusAttribute}
                    required={true}
                    onChange={setFeatureState}
                  />
                )}
                {featureState?.damage?.bonus?.bonusAttribute?.name ===
                  'abilityBonus' && (
                  <Dropdown
                    name={`damage.bonus.ability`}
                    label='Abilty'
                    value={featureState?.damage?.bonus?.ability}
                    options={builders.ability}
                    required={true}
                    onChange={setFeatureState}
                  />
                )}
                {(formContext === 'OptionContent'
                  ? featureState
                  : featureState
                )?.damage?.damageAttribute?.some(
                  (attributeItem: any) => attributeItem.name === 'damagePool'
                ) && (
                  <>
                    <Dropdown
                      name={`damage.pool.option`}
                      label='Pool Option'
                      value={featureState?.damage?.pool?.option}
                      options={builders.feature.poolOptions}
                      required={true}
                      onChange={setFeatureState}
                    />
                    {featureState?.damage?.pool?.option.name === 'level' ? (
                      <>
                        <Input
                          name={`damage.pool.multiplier`}
                          value={featureState?.damage?.pool?.multiplier}
                          label='Multiplier'
                          onChange={setFeatureState}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                        <Input
                          name={`damage.pool.minValue`}
                          value={featureState?.damage?.pool?.minValue}
                          label='Minimum Value'
                          onChange={setFeatureState}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                      </>
                    ) : featureState.damage?.pool?.option?.name ===
                      'ability' ? (
                      <Dropdown
                        name={`damage.pool.ability`}
                        label='Pool Abilty'
                        value={featureState?.damage?.pool?.ability}
                        options={builders.ability}
                        required={true}
                        onChange={setFeatureState}
                      />
                    ) : (
                      featureState.damage?.pool?.option?.name ===
                        'setValue' && (
                        <Input
                          name={`damage.pool.setValue`}
                          value={featureState?.damage?.pool?.setValue}
                          label='Pool Total'
                          onChange={setFeatureState}
                          validation='num'
                          required={true}
                          errorMsg={'Must contain only numbers'}
                        />
                      )
                    )}
                    {(formContext === 'OptionContent'
                      ? featureState
                      : featureState
                    )?.damage?.damageAttribute.some(
                      (attributeItem: any) =>
                        attributeItem.name === 'secondaryDamage'
                    ) && (
                      <>
                        <Dropdown
                          name={`damage.secondaryPool.option`}
                          label='Secondary Pool Option'
                          value={featureState?.damage?.secondaryPool?.option}
                          options={builders.feature.poolOptions}
                          required={true}
                          onChange={setFeatureState}
                        />
                        {featureState?.damage?.secondaryPool?.option.name ===
                        'classLevel' ? (
                          <>
                            <Input
                              name={`damage.secondaryPool.multiplier`}
                              value={
                                featureState.damage?.secondaryPool?.multiplier
                              }
                              label='Multiplier'
                              onChange={setFeatureState}
                              validation='num'
                              errorMsg={'Must contain only numbers'}
                            />
                            <Input
                              name={`damage.secondaryPool.minValue`}
                              value={
                                featureState?.damage?.secondaryPool?.minValue
                              }
                              label='Minimum Value'
                              onChange={setFeatureState}
                              validation='num'
                              errorMsg={'Must contain only numbers'}
                            />
                          </>
                        ) : featureState.damage?.secondaryPool?.option?.name ===
                          'ability' ? (
                          <Dropdown
                            name={`damage.secondaryPool.ability`}
                            label='Pool Abilty'
                            value={featureState?.damage?.secondaryPool?.ability}
                            options={builders.ability}
                            required={true}
                            onChange={setFeatureState}
                          />
                        ) : (
                          featureState.damage?.secondaryPool?.option?.name ===
                            'setValue' && (
                            <Input
                              name={`damage.secondaryPool.setValue`}
                              value={
                                featureState?.damage?.secondaryPool?.setValue
                              }
                              label='Pool Total'
                              onChange={setFeatureState}
                              validation='num'
                              required={true}
                              errorMsg={'Must contain only numbers'}
                            />
                          )
                        )}
                      </>
                    )}
                  </>
                )}
              </Grid>
              {!featureState.damage?.damageAttribute?.some(
                (attributeItem: any) => attributeItem.name === 'damagePool'
              ) && !featureState.damage?.damageByLevel ? (
                setFeatureState({
                  type: 'added',
                  target: {
                    name: `damage.damageByLevel`,
                  },
                })
              ) : (
                <>
                  <CollapseContainer title={'Damage Table'}>
                    <div className='section-content'>
                      <Table
                        rows={{
                          inputs: damageTableColumns(featureState.damage)
                            .inputs,
                          headers: damageTableColumns(featureState.damage)
                            .headers,
                        }}
                        name={`damage.damageByLevel`}
                        value={featureState?.damage?.damageByLevel}
                        onChange={setFeatureState}
                        addRow={true}
                        scrollable={true}
                      />
                    </div>
                  </CollapseContainer>
                </>
              )}
            </>
          )}
        </div>
        {Object.keys(featureState).some((key) =>
          sectionNames.includes(key as SectionName)
        ) && (
          <div className={feature_list}>
            {sectionNames.map(
              (sectionName: SectionName, sectionNameIndex: number) => {
                return (
                  <Accordion
                    key={sectionNameIndex}
                    dataArray={featureState[sectionName]}
                    setState={setFeatureState}
                    name={sectionName}
                  >
                    {featureState[sectionName]?.map(
                      (sectionItem: any, sectionIndex: number) => (
                        <Accordion.Container
                          key={sectionIndex}
                          itemId={sectionItem.id}
                        >
                          <Accordion.Header
                            key={sectionIndex}
                            handleRemove={() =>
                              handleRemove(sectionName, sectionIndex)
                            }
                            handleClick={() => toggle(sectionIndex)}
                            handleEdit={() =>
                              handleEdit(sectionName, sectionIndex)
                            }
                            active={activeIndex === sectionIndex}
                          >
                            {`${startCase(sectionName)} ${sectionIndex + 1}`}
                            {sectionItem.value != null &&
                              sectionItem.value !== '' &&
                              ` (${sectionItem.value})`}
                          </Accordion.Header>
                          <Accordion.Content
                            active={activeIndex === sectionIndex}
                          >
                            <div className={feature_description}>
                              {sectionItem.desc && parse(sectionItem.desc)}
                            </div>
                          </Accordion.Content>
                        </Accordion.Container>
                      )
                    )}
                  </Accordion>
                )
              }
            )}
          </div>
        )}
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

export default FeatureContent
