import { useState, useEffect } from 'react'
import { useGetBuildersQuery } from '../../features/builder/builderApiSlice'
import {
  selectAllItems,
  useGetItemsQuery,
} from '../../features/item/itemApiSlice'
import { getSectionNames } from '../../utils/formUtils'
import Input from '../Input/Input'
import Dropdown from '../Dropdown/Dropdown'
import RichTextEditor from '../RichTextEditor/RichTextEditor'
import Table from '../Table/Table'
import Divider from '../Divider/Divider'
import Collapse from '../Collapse/Collapse'
import Spinner from '../Spinner/Spinner'
import {
  DropdownOption,
  ReducerActionType,
  RowHeader,
  RowInput,
  FeatureContext,
  FeatureStepName,
  SectionName,
  FormContext,
  Step,
} from '../../utils/types'
import Grid from '../Grid/Grid'
import Select from '../Select/Select'
import { startCase } from 'lodash'
import {
  feature_description,
  feature_header,
  feature_list,
  form_content,
} from './Form.css'
import Accordion from '../Accordion/Accordion'
import parse from 'html-react-parser'
import { sprinkles } from '../../css/sprinkles.css'
import useIsLoading from '../../hooks/useIsLoading'
import ScrollArea from '../ScrollArea/ScrollArea'
import Group from '../Group/Group'
import {
  selectAllSpells,
  useGetSpellsQuery,
} from '../../features/spell/spellApiSlice'

interface FeatureContentProps {
  state?: any
  context: FormContext
  featureContext: FeatureContext
  setFeatureContext: (arg: FeatureContext) => void
  setFeatureStepName: (arg: FeatureStepName) => void
  setSectionName: (arg: SectionName) => void
  featureState: any
  setFeatureState: (arg: ReducerActionType) => void
  setOptionState?: (arg: ReducerActionType) => void
  setSectionState: (arg: ReducerActionType) => void
  setOptionIndex?: (arg: number) => void
  setOldOptionState?: (arg: any) => void
  setOldSectionState: (arg: any) => void
  setSubFeatureState?: (arg: ReducerActionType) => void
  setOldSubFeatureState?: (arg: any) => void
  setSubFeatureIndex?: (arg: number) => void
  setSectionIndex: (arg: number) => void
  stepName: Step
}

const FeatureContent = ({
  state,
  context,
  setSectionName,
  setFeatureStepName,
  featureContext,
  setFeatureContext,
  featureState,
  setFeatureState,
  setOptionState,
  setOldOptionState,
  setOptionIndex,
  setSectionState,
  setOldSectionState,
  setSectionIndex,
  setOldSubFeatureState,
  setSubFeatureIndex,
  setSubFeatureState,
  stepName,
}: FeatureContentProps) => {
  const isLoading = useIsLoading()

  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [subArray, setSubArray] = useState<'option' | 'feature' | ''>('')
  const [valueLabel, setValueLabel] = useState<
    'Feat' | 'Option' | 'Feature' | 'Ancestry' | 'Sub-Feature'
  >()

  const { data: builders } = useGetBuildersQuery(undefined)

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({ items: data && selectAllItems(data) }),
  })

  const { spells } = useGetSpellsQuery(undefined, {
    selectFromResult: ({ data }) => ({ spells: data && selectAllSpells(data) }),
  })

  // Add/Remove replace at level table
  useEffect(() => {
    if (
      featureState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'selectCountByLevel'
      ) &&
      (!featureState.selectCountByLevel ||
        !(featureState.selectCountByLevel?.length > 0))
    ) {
      setFeatureState({
        type: 'added',
        target: { name: 'selectCountByLevel' },
      })
    }
    if (
      featureState.selectCountByLevel &&
      !featureState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'selectCountByLevel'
      )
    ) {
      setFeatureState({
        type: 'removed',
        target: { name: 'selectCountByLevel' },
      })
    }
  })

  // Limit use table
  useEffect(() => {
    if (
      !featureState.limitUse?.level &&
      featureState?.limitUse?.limitBy?.name === 'level' &&
      featureState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'limitUse'
      )
    ) {
      setFeatureState({
        type: 'added',
        target: {
          name: `limitUse.level`,
        },
      })
    }
    if (
      featureState.limitUse?.level &&
      !(featureState?.limitUse?.limitBy?.name === 'level')
    ) {
      setFeatureState({
        type: 'removed',
        target: {
          name: `limitUse.level`,
        },
      })
    }
    if (
      !featureState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'limitUse'
      ) &&
      featureState.limitUse
    ) {
      setFeatureState({
        type: 'removed',
        target: {
          name: `limitUse`,
        },
      })
    }
  }, [
    featureState.limitUse?.limitBy?.name,
    featureState.attribute,
    setFeatureState,
    featureState.limitUse?.level,
    featureState.limitUse,
  ])

  // Add/remove Damage By Level table
  useEffect(() => {
    if (
      featureState.damage?.damageAttribute?.some(
        (attributeItem: any) => attributeItem.name === 'damageByLevel'
      ) &&
      !featureState.damage?.damageByLevel
    ) {
      setFeatureState({
        type: 'added',
        target: {
          name: `damage.damageByLevel`,
        },
      })
    }
    if (
      !featureState.damage?.damageAttribute?.some(
        (attributeItem: any) => attributeItem.name === 'damageByLevel'
      ) &&
      featureState.damage?.damageByLevel
    ) {
      setFeatureState({
        type: 'removed',
        target: {
          name: `damage.damageByLevel`,
        },
      })
    }
    if (
      !featureState.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'doesDamage'
      ) &&
      featureState.damage
    ) {
      setFeatureState({
        type: 'removed',
        target: {
          name: `damage`,
        },
      })
    }
  }, [
    featureState.damage?.damageAttribute,
    featureState.damage?.damageByLevel,
    setFeatureState,
    featureState.attribute,
    featureState.damage,
  ])

  // Add/remove Bonus Damage Set by Level
  useEffect(() => {
    if (
      featureState?.damage?.bonus?.bonusAttribute?.name === 'setPerLevel' &&
      !(featureState?.damage?.bonus?.setPerLevel?.length > 0)
    ) {
      setFeatureState({
        type: 'added',
        target: { name: 'damage.bonus.setPerLevel' },
      })
    }
    if (
      !(featureState?.damage?.bonus?.bonusAttribute?.name === 'setPerLevel') &&
      featureState?.damage?.bonus?.setPerLevel?.length > 0
    ) {
      setFeatureState({
        type: 'removed',
        target: { name: 'damage.bonus.setPerLevel' },
      })
    }
  }, [
    featureState?.damage?.bonus?.bonusAttribute?.name,
    featureState?.damage?.bonus?.setPerLevel?.length,
    setFeatureState,
  ])

  // Add/remove Bonus Damage Set by Level
  useEffect(() => {
    if (
      featureState?.damage?.bonus?.bonusAttribute?.name === 'diePerLevel' &&
      !(featureState?.damage?.bonus?.diePerLevel?.length > 0)
    ) {
      setFeatureState({
        type: 'added',
        target: { name: 'damage.bonus.diePerLevel' },
      })
    }
    if (
      !(featureState?.damage?.bonus?.bonusAttribute?.name === 'diePerLevel') &&
      featureState?.damage?.bonus?.diePerLevel?.length > 0
    ) {
      setFeatureState({
        type: 'removed',
        target: { name: 'damage.bonus.diePerLevel' },
      })
    }
  }, [
    featureState?.damage?.bonus?.bonusAttribute?.name,
    featureState?.damage?.bonus?.diePerLevel?.length,
    setFeatureState,
  ])

  // Set array name for Ancestry vs Feature (generic)
  useEffect(() => {
    if (stepName === 'Ancestry') {
      setSubArray('feature')
    } else {
      setSubArray('option')
    }
  }, [featureContext, stepName])

  // Set header label
  useEffect(() => {
    if (stepName === 'Ancestry') {
      if (featureContext === 'OptionContent') {
        setValueLabel('Feature')
      } else {
        setValueLabel('Ancestry')
      }
    } else if (context.title === 'feat') {
      setValueLabel('Feat')
    } else if (featureContext === 'OptionContent') {
      setValueLabel('Option')
    } else if (featureContext === 'OptionFeatureContent') {
      setValueLabel('Sub-Feature')
    } else {
      setValueLabel('Feature')
    }
  }, [context.title, featureContext, stepName])

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
        errorMsg: 'Must not be blank and contain only numbers',
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
    setSectionIndex(sectionIndex)
    if (sectionName === 'option' || sectionName === 'feature') {
      if (featureContext === 'OptionContent') {
        setSubFeatureState &&
          setSubFeatureState({
            type: 'reset',
            target: { value: sectionState },
          })
        setSubFeatureIndex && setSubFeatureIndex(sectionIndex)
        setOldSubFeatureState && setOldSubFeatureState(sectionState)
        return setFeatureContext('OptionFeatureContent')
      }
      setOptionState &&
        setOptionState({
          type: 'reset',
          target: { value: sectionState },
        })
      setOptionIndex && setOptionIndex(sectionIndex)
      setOldOptionState && setOldOptionState(sectionState)
      return setFeatureContext('OptionContent')
    }
    setSectionName(sectionName)
    setSectionState({
      type: 'reset',
      target: { value: sectionState },
    })
    setOldSectionState(sectionState)
    setFeatureStepName('SectionContent')
  }

  const sectionNames = getSectionNames().sort((a: any, b: any) =>
    a.localeCompare(b)
  )

  const selectSection = (sectionName: SectionName) => {
    if (featureState[sectionName]?.length > 0) {
      setSectionIndex(featureState[sectionName]?.length)
    } else {
      setSectionIndex(0)
    }

    if (sectionName !== '') {
      if (sectionName === 'option' || sectionName === 'feature') {
        // If Option content, add sub-feature
        if (featureContext === 'OptionContent') {
          setSubFeatureState &&
            setSubFeatureState({ type: 'reset', target: { value: {} } })
          setOldSubFeatureState && setOldSubFeatureState({})
          const optionIndex =
            featureState[sectionName]?.length > 0
              ? featureState[sectionName].length
              : 0
          setSubFeatureIndex && setSubFeatureIndex(optionIndex)
          return setFeatureContext('OptionFeatureContent')
        }
        // Add Option content
        setOptionState &&
          setOptionState({ type: 'reset', target: { value: {} } })
        setOldOptionState && setOldOptionState({})
        const optionIndex =
          featureState[sectionName]?.length > 0
            ? featureState[sectionName].length
            : 0
        setOptionIndex && setOptionIndex(optionIndex)
        return setFeatureContext('OptionContent')
      }
      // Add Section
      setSectionState({ type: 'reset', target: { value: {} } })
      setOldSectionState({})
      setSectionName(sectionName)
      setFeatureStepName('SectionContent')
    }
  }

  return !featureState || !state || isLoading || !builders ? (
    <Spinner />
  ) : (
    <>
      <Grid className={feature_header}>
        <Input
          name={`value`}
          autoComplete='off'
          label={`${valueLabel} Name`}
          required={true}
          value={featureState?.value}
          errorMsg='Name must not be blank'
          onChange={setFeatureState}
        />
        <Select
          handleChange={selectSection as (arg: string) => void}
          placeholder='Add...'
          label={'Add Section'}
          options={sectionNames.filter(
            (sectionName: SectionName) =>
              (featureContext === 'OptionContent'
                ? sectionName !== 'option'
                : sectionName) &&
              (stepName === 'Ancestry'
                ? sectionName !== 'option'
                : sectionName) &&
              (context.title !== 'class'
                ? sectionName !== 'ancestry'
                : sectionName) &&
              (featureContext !== 'OptionContent'
                ? sectionName !== 'feature'
                : sectionName) &&
              (featureContext === 'OptionFeatureContent'
                ? sectionName !== 'option'
                : sectionName)
          )}
        />
      </Grid>
      <ScrollArea scrollDirection='vertical' className={form_content}>
        <RichTextEditor
          label='Feature description'
          value={featureState?.desc}
          name={`desc`}
          onChange={setFeatureState}
          className={sprinkles({ mb: 'size-3' })}
        />
        <Grid className={sprinkles({ mb: 'size-2' })}>
          {context.title !== 'item' &&
            !(stepName === 'Ancestry' && featureContext !== 'OptionContent') &&
            !(context.title === 'race' && stepName !== 'Ancestry') && (
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
          {(stepName !== 'Ancestry' ||
            (stepName === 'Ancestry' &&
              featureContext === 'OptionContent')) && (
            <Dropdown
              multiSelect={true}
              name={`attribute`}
              options={[]
                .concat(
                  builders.feature.attribute,
                  context.title &&
                    builders.feature[context.title]?.attribute?.length > 0 &&
                    builders.feature[context.title]?.attribute,
                  featureState.option &&
                    featureState.option.length > 0 &&
                    builders.feature.option.attribute
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
          )}
          {featureState[subArray]?.length > 0 &&
            featureState?.attribute?.some(
              (attributeItem: any) => attributeItem.name === 'replaceAtLevel'
            ) && (
              <Input
                name={`replaceCountAtLevel`}
                value={featureState?.replaceCountAtLevel}
                label='Num. To Replace'
                onChange={setFeatureState}
                validation='num'
                required={true}
                errorMsg={'Must contain only numbers'}
              />
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
        </Grid>
        {featureState?.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'limitUse'
        ) && (
          <Grid>
            <Dropdown
              name={`limitUse.limitBy`}
              label='Limit By Option'
              value={featureState?.limitUse?.limitBy}
              options={[].concat(
                builders.feature.chargeLimit,
                context.title &&
                  builders.feature[context.title]?.chargeLimit?.length > 0 &&
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
            {featureState?.limitUse?.limitBy &&
              featureState.limitUse?.limitBy?.name !== 'setValue' && (
                <>
                  {featureState?.limitUse?.limitBy?.name !== 'level' && (
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
                  <Input
                    name={`limitUse.multiplier`}
                    autoComplete='off'
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    label='Multiplier'
                    value={featureState?.limitUse?.multiplier}
                    onChange={setFeatureState}
                  />
                </>
              )}
            <Dropdown
              name={`limitUse.resetOption`}
              label='Reset Option'
              value={featureState?.limitUse?.resetOption}
              options={builders.feature.chargeReset}
              required={true}
              onChange={setFeatureState}
            />
          </Grid>
        )}
        {featureState?.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'hasRange'
        ) && (
          <>
            <Grid className={sprinkles({ mb: 'size-2' })}>
              <Dropdown
                name='range.type'
                label='Range'
                value={featureState?.range?.type}
                options={builders.spell.range}
                required={true}
                onChange={setFeatureState}
              />
              {featureState?.range?.type?.name !== 'touch' &&
                featureState.range?.type?.name !== 'sight' &&
                featureState.range?.type?.name !== 'unlimited' &&
                featureState.range?.type && (
                  <>
                    <Input
                      validation={'num'}
                      name='range.minRange'
                      errorMsg='Please enter a valid number greater than 0'
                      label='Min. Range'
                      autoComplete='off'
                      required={
                        featureState.range?.type?.name === 'distance'
                          ? true
                          : false
                      }
                      value={featureState?.range?.minRange}
                      onChange={setFeatureState}
                    />
                    <Input
                      validation={'num'}
                      name='range.maxRange'
                      errorMsg='Must contain only numbers'
                      label='Max Range'
                      autoComplete='off'
                      required={
                        featureState.range?.type?.name === 'distance'
                          ? true
                          : false
                      }
                      value={featureState?.range?.maxRange}
                      onChange={setFeatureState}
                    />
                    <Dropdown
                      name='range.unit'
                      label='UoM'
                      value={featureState?.range?.unit}
                      options={
                        Object.values(builders.unit.imperial).flatMap(
                          (item) => item
                        ) as DropdownOption[]
                      }
                      required={
                        featureState.range?.type?.name === 'distance'
                          ? true
                          : false
                      }
                      optionalKey='short'
                      onChange={setFeatureState}
                    />
                  </>
                )}
              {featureState.attribute?.some(
                (attributeItem: any) => attributeItem.name === 'limitedTargets'
              ) && (
                <Input
                  name='targets'
                  value={featureState?.targets}
                  label='No. of Targets'
                  validation='num'
                  errorMsg='Must contain only numbers'
                  onChange={setFeatureState}
                  placeholder='1'
                />
              )}
            </Grid>
            <Grid>
              <Dropdown
                name='shape.type'
                label='Shape'
                options={builders.spell.shape}
                value={featureState?.shape?.type}
                onChange={setFeatureState}
              />
              {featureState?.shape?.type?.name &&
                featureState.shape?.type?.name !== 'none' &&
                featureState.shape?.type?.name !== 'weapon' && (
                  <>
                    <Input
                      validation={'cur'}
                      name='shape.size'
                      errorMsg='Please enter a valid number (can inlude decimals)'
                      label='Shape Size'
                      autoComplete='off'
                      required={true}
                      value={featureState?.shape?.size}
                      onChange={setFeatureState}
                    />
                    <Dropdown
                      name='shape.unit'
                      label='UoM'
                      value={featureState?.shape?.unit}
                      options={
                        Object.values(builders.unit.imperial).flatMap(
                          (item) => item
                        ) as DropdownOption[]
                      }
                      required={true}
                      optionalKey='short'
                      onChange={setFeatureState}
                    />
                  </>
                )}
            </Grid>
          </>
        )}
        {featureState?.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'requireSave'
        ) && (
          <Grid className={sprinkles({ mb: 'size-2' })}>
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
            <Input
              validation='num'
              name={`saveAbility.minValue`}
              autoComplete='off'
              label='Base Value'
              required={context.title !== 'class' && true}
              errorMsg='Must contain only numbers'
              value={featureState?.saveAbility?.minValue}
              onChange={setFeatureState}
            />
          </Grid>
        )}
        {featureState?.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'hasRequirements'
        ) && (
          <Grid className={sprinkles({ mb: 'size-2' })}>
            <Dropdown
              multiSelect={true}
              name={`requirement.option`}
              label='Requirement'
              options={[].concat(
                builders.feature.requirement,
                context.title &&
                  builders.feature[context.title]?.requirement?.length > 0 &&
                  builders.feature[context.title]?.requirement,
                featureContext === 'OptionContent' &&
                  builders.feature.option.requirement
              )}
              value={featureState?.requirement?.option}
              required={true}
              onChange={setFeatureState}
            />
            {featureState?.requirement?.option?.some(
              (requirementItem: any) => requirementItem.name === 'spellKnown'
            ) && (
              <Dropdown
                multiSelect={true}
                name={`requirement.spellKnown.spell`}
                value={featureState?.requirement?.spellKnown?.spell}
                label='Spell'
                options={spells as unknown as DropdownOption[]}
                onChange={setFeatureState}
              />
            )}
            {featureState?.requirement?.option?.some(
              (requirementItem: any) => requirementItem.name === 'featureKnown'
            ) && (
              <>
                <Dropdown
                  multiSelect={true}
                  name={`requirement.featureKnown.feature`}
                  value={featureState?.requirement?.featureKnown?.feature}
                  label='Feature'
                  options={state.feature as unknown as DropdownOption[]}
                  optionalKey={'option'}
                  onChange={setFeatureState}
                />
                {featureState?.requirement?.featureKnown?.feature?.some(
                  (featureItem: any) => featureItem.option?.length > 0
                ) && (
                  <Dropdown
                    multiSelect={true}
                    name={`requirement.featureKnown.option`}
                    value={featureState?.requirement?.featureKnown?.option}
                    label='Feature Option'
                    options={featureState?.requirement?.featureKnown?.feature?.flatMap(
                      (featureItem: any) =>
                        featureItem.option?.length > 0 && featureItem.option
                    )}
                    onChange={setFeatureState}
                  />
                )}
              </>
            )}
          </Grid>
        )}
        {featureState?.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'hasRequirements'
        ) &&
          !featureState.requirement?.option?.every(
            (featureState: any) => featureState.name === 'notProficient'
          ) &&
          !featureState.requirement?.option?.every(
            (featureState: any) => featureState.name === 'spellKnown'
          ) &&
          !featureState.requirement?.option?.every(
            (featureState: any) => featureState.name === 'featureKnown'
          ) &&
          featureState.requirement?.option?.length > 0 && (
            <>
              <Divider label={'Requirements'} />
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
                                  categoryItem.name === item.categoryItem?.name
                              )
                            : item
                        )
                        .map((item: any) => item.property)}
                      onChange={setFeatureState}
                    />
                    <Dropdown
                      name={`requirement.itemProficiency.type`}
                      multiSelect={true}
                      label='Item type'
                      value={featureState?.requirement?.itemProficiency?.type}
                      options={items
                        ?.filter((item: any) =>
                          featureState.requirement.itemProficiency?.category
                            ?.length > 0
                            ? featureState.requirement.itemProficiency?.category?.some(
                                (categoryItem: any) =>
                                  categoryItem.name === item.categoryItem?.name
                              )
                            : item
                        )
                        .map((item: any) => item)}
                      onChange={setFeatureState}
                    />
                  </Grid>
                </>
              )}
              {featureState?.requirement?.option?.some(
                (requirementItem: any) => requirementItem.name === 'equipped'
              ) && (
                <>
                  <Divider label={'Equipped'} />
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
                          featureState.requirement?.equipped?.category?.length >
                          0
                            ? featureState.requirement?.equipped?.category?.some(
                                (categoryItem: any) =>
                                  categoryItem.name === item.categoryItem?.name
                              )
                            : item
                        )
                        .map((item: any) => item.property)}
                      onChange={setFeatureState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name={`requirement.equipped.type`}
                      label='Item type'
                      value={featureState?.requirement?.equipped?.type}
                      options={items
                        ?.filter((item: any) =>
                          featureState.requirement.equipped?.category?.length >
                          0
                            ? featureState.requirement.equipped?.category?.some(
                                (categoryItem: any) =>
                                  categoryItem.name === item.categoryItem?.name
                              )
                            : item
                        )
                        .map((item: any) => item)}
                      onChange={setFeatureState}
                    />
                  </Grid>
                </>
              )}
              {featureState?.requirement?.option?.some(
                (requirementItem: any) => requirementItem.name === 'notEquipped'
              ) && (
                <>
                  <Divider label={'Not Equipped'} />
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
                                  categoryItem.name === item.category?.name
                              )
                            : item
                        )
                        .map((item: any) => item)}
                      onChange={setFeatureState}
                    />
                    <Dropdown
                      multiSelect={true}
                      name={`requirement.notEquipped.type`}
                      label='Item type'
                      value={featureState?.requirement?.notEquipped?.type}
                      options={items
                        ?.filter((item: any) =>
                          featureState.requirement.notEquipped?.category
                            ?.length > 0
                            ? featureState.requirement.notEquipped?.category?.some(
                                (categoryItem: any) =>
                                  categoryItem.name === item.category?.name
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
        {featureState?.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'selectCountByLevel'
        ) && (
          <Collapse
            title='Select Count By Level Table'
            className={sprinkles({ mt: 'size-3' })}
          >
            <Table
              rows={{
                inputs: [
                  {
                    name: 'level',
                    errorMsg: 'Must not be blank and contain only numbers',
                    validation: 'num',
                  },
                  {
                    name: 'selectionCount',
                    errorMsg: 'Must not be blank and contain only numbers',
                    validation: 'num',
                  },
                ],
                headers: [
                  {
                    value: 'Level',
                  },
                  {
                    value: 'Count',
                  },
                ],
              }}
              name={`selectCountByLevel`}
              value={featureState?.selectCountByLevel}
              onChange={setFeatureState}
              addRow={true}
            />
          </Collapse>
        )}
        {featureState?.limitUse?.limitBy?.name === 'level' &&
          featureState.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'limitUse'
          ) && (
            <>
              <Collapse
                title={'Limit Use Table'}
                className={sprinkles({ mt: 'size-3' })}
              >
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
              </Collapse>
            </>
          )}
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
              {featureState?.damage?.damageAttribute?.some(
                (attributeItem: any) => attributeItem.name === 'primaryDamage'
              ) && (
                <Dropdown
                  name={`damage.primaryType`}
                  multiSelect={true}
                  label='Damage Type'
                  value={featureState?.damage?.primaryType}
                  options={[
                    ...builders.damage,
                    {
                      id: undefined,
                      _id: undefined,
                      name: 'matchWeapon',
                      value: 'Match Weapon',
                    },
                  ]}
                  required={true}
                  onChange={setFeatureState}
                />
              )}
              {featureState?.damage?.damageAttribute?.some(
                (attributeItem: any) => attributeItem.name === 'bonusDamage'
              ) && (
                <>
                  <Dropdown
                    name={`damage.bonusType`}
                    multiSelect={true}
                    label='Damage Type'
                    value={featureState?.damage?.bonusType}
                    options={[
                      ...builders.damage,
                      {
                        id: undefined,
                        _id: undefined,
                        name: 'matchWeapon',
                        value: 'Match Weapon',
                      },
                    ]}
                    required={true}
                    onChange={setFeatureState}
                  />
                  <Dropdown
                    name={`damage.bonus.bonusAttribute`}
                    label='Bonus Type'
                    value={featureState?.damage?.bonus?.bonusAttribute}
                    options={builders.feature.bonusAttribute}
                    required={true}
                    onChange={setFeatureState}
                  />
                </>
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
              {featureState?.damage?.bonus?.bonusAttribute?.name !==
                'diePerLevel' &&
                featureState?.damage?.bonus?.bonusAttribute?.name !==
                  'setPerLevel' && (
                  <>
                    {featureState?.damage?.bonusAttribute?.name ===
                      'setValue' && (
                      <Input
                        name={`damage.bonus.setValue`}
                        value={featureState?.damage?.bonus?.setValue}
                        label='Set Value'
                        onChange={setFeatureState}
                        required={true}
                        validation='num'
                        errorMsg={'Must contain only numbers'}
                      />
                    )}
                    <Input
                      name={`damage.bonus.minValue`}
                      value={featureState?.damage?.bonus?.minValue}
                      label='Min. Value'
                      onChange={setFeatureState}
                      validation='num'
                      errorMsg={'Must contain only numbers'}
                    />
                    <Input
                      name={`damage.bonus.maxValue`}
                      value={featureState?.damage?.bonus?.maxValue}
                      label='Max Value'
                      onChange={setFeatureState}
                      validation='num'
                      errorMsg={'Must contain only numbers'}
                    />
                  </>
                )}
              {featureState?.damage?.damageAttribute?.some(
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
                  ) : featureState.damage?.pool?.option?.name === 'ability' ? (
                    <Dropdown
                      name={`damage.pool.ability`}
                      label='Pool Abilty'
                      value={featureState?.damage?.pool?.ability}
                      options={builders.ability}
                      required={true}
                      onChange={setFeatureState}
                    />
                  ) : (
                    featureState.damage?.pool?.option?.name === 'setValue' && (
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
                  {featureState?.damage?.damageAttribute.some(
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
            {featureState.damage?.damageAttribute?.some(
              (attributeItem: any) => attributeItem.name === 'damageByLevel'
            ) && (
              <>
                <Collapse
                  title={'Damage Table'}
                  className={sprinkles({ mt: 'size-3' })}
                >
                  <div className='section-content'>
                    <Table
                      rows={{
                        inputs: damageTableColumns(featureState.damage).inputs,
                        headers: damageTableColumns(featureState.damage)
                          .headers,
                      }}
                      name={`damage.damageByLevel`}
                      value={featureState?.damage?.damageByLevel}
                      onChange={setFeatureState}
                      addRow={true}
                      scrollable='horizontal'
                    />
                  </div>
                </Collapse>
              </>
            )}
          </>
        )}
        {featureState?.damage?.bonus?.bonusAttribute?.name ===
          'diePerLevel' && (
          <Collapse
            title='Bonus Damage Die By Level'
            className={sprinkles({ mt: 'size-3' })}
          >
            <Table
              name='damage.bonus.diePerLevel'
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
              value={featureState?.damage?.bonus?.diePerLevel}
              addRow={true}
              onChange={setSectionState}
            />
          </Collapse>
        )}
        {featureState?.damage?.bonus?.bonusAttribute?.name ===
          'setPerLevel' && (
          <Collapse
            title='Bonus Damage By Level'
            className={sprinkles({ mt: 'size-3' })}
          >
            <Table
              name='damage.bonus.setPerLevel'
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
              value={featureState?.damage?.bonus?.setPerLevel}
              addRow={true}
              onChange={setSectionState}
            />
          </Collapse>
        )}
        <div className={feature_list}>
          {sectionNames.map(
            (sectionName: SectionName, sectionNameIndex: number) => {
              return (
                featureState[sectionName]?.length > 0 && (
                  <Accordion
                    key={sectionNameIndex}
                    dataArray={featureState[sectionName]}
                    setState={setFeatureState}
                    name={sectionName}
                    disableSort={
                      sectionName !== 'option' && sectionName !== 'feature'
                    }
                  >
                    {featureState[sectionName]?.map(
                      (sectionItem: any, sectionIndex: number) => {
                        return (
                          <Accordion.Container
                            key={sectionIndex}
                            itemId={String(sectionIndex)}
                          >
                            <Accordion.Header
                              key={sectionIndex}
                              handleRemove={() =>
                                handleRemove(sectionName, sectionIndex)
                              }
                              handleClick={() =>
                                (sectionName === 'option' ||
                                  sectionName === 'feature') &&
                                toggle(sectionIndex)
                              }
                              handleEdit={() =>
                                handleEdit(sectionName, sectionIndex)
                              }
                              active={
                                sectionName === 'option' ||
                                sectionName === 'feature'
                                  ? activeIndex === sectionIndex
                                  : null
                              }
                            >
                              {sectionName !== 'feature' &&
                                `${startCase(sectionName)} ${sectionIndex + 1}`}
                              {sectionItem?.value != null &&
                              sectionItem?.value !== '' &&
                              sectionName === 'option'
                                ? ` (${sectionItem?.value})`
                                : sectionItem?.value}
                            </Accordion.Header>
                            {(sectionName === 'option' ||
                              sectionName === 'feature') && (
                              <>
                                <Accordion.Content
                                  active={activeIndex === sectionIndex}
                                >
                                  <div className={feature_description}>
                                    {sectionItem?.desc &&
                                      parse(sectionItem?.desc)}
                                  </div>
                                </Accordion.Content>
                                <Accordion.Footer>
                                  <Group justifyContentVariant='start'>
                                    {sectionNames.map(
                                      (
                                        footerSectionName: string,
                                        footerSectionIndex: number
                                      ) => {
                                        return (
                                          <span
                                            key={footerSectionIndex}
                                            className={sprinkles({
                                              me: 'size-2',
                                            })}
                                          >
                                            {sectionItem[footerSectionName]
                                              ?.length > 0 ? (
                                              <strong key={footerSectionIndex}>
                                                {startCase(
                                                  footerSectionName.charAt(0)
                                                )}
                                                :
                                                {
                                                  sectionItem[footerSectionName]
                                                    ?.length
                                                }
                                              </strong>
                                            ) : (
                                              `${startCase(
                                                footerSectionName.charAt(0)
                                              )}: 0`
                                            )}
                                          </span>
                                        )
                                      }
                                    )}
                                  </Group>
                                </Accordion.Footer>
                              </>
                            )}
                          </Accordion.Container>
                        )
                      }
                    )}
                  </Accordion>
                )
              )
            }
          )}
        </div>
      </ScrollArea>
    </>
  )
}

export default FeatureContent
