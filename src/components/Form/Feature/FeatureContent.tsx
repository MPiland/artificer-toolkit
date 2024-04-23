import { useState, useEffect } from 'react'
import { useGetBuildersQuery } from '../../../features/builder/builderApiSlice'
import { selectAllItems, useGetItemsQuery } from '../../../features/item/itemApiSlice'
import { getSectionNames } from '../../../utils/formUtils'
import Input from '../../Input/Input'
import Dropdown from '../../Dropdown/Dropdown'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import Table from '../../Table/Table'
import Divider from '../../Divider/Divider'
import Collapse from '../../Collapse/Collapse'
import Spinner from '../../Spinner/Spinner'
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
} from '../../../utils/types'
import Grid from '../../Grid/Grid'
import Select from '../../Select/Select'
import { isEqual, startCase } from 'lodash'
import {
  feature_content_header,
  feature_list,
  form_content,
  form_add_button,
  form_remove_button,
  equipment_sub_group_button,
} from '../Form.css'
import { feature_description } from '../Form.css'
import Accordion from '../../Accordion/Accordion'
import parse from 'html-react-parser'
import { sprinkles } from '../../../css/sprinkles.css'
import useIsLoading from '../../../hooks/useIsLoading'
import ScrollArea from '../../ScrollArea/ScrollArea'
import Group from '../../Group/Group'
import { selectAllSpells, useGetSpellsQuery } from '../../../features/spell/spellApiSlice'
import Button from '../../Button/Button'
import { TbPlus, TbX } from 'react-icons/tb'
import clsx from 'clsx'

interface FeatureContentProps {
  formState?: any
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
  formState,
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
    | 'Feat'
    | 'Background'
    | 'Option'
    | 'Feature'
    | 'Ancestry'
    | 'Sub-Feature'
    | 'Ancestry Feature'
    | 'Ancestry Sub-Feature'
  >()
  const [damageTypes, setDamageTypes] = useState<Array<string>>(['primary'])

  const { data: builders } = useGetBuildersQuery(undefined)

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({ items: data && selectAllItems(data) }),
  })

  const { spells } = useGetSpellsQuery(undefined, {
    selectFromResult: ({ data }) => ({ spells: data && selectAllSpells(data) }),
  })

  // Handle Secondary or Bonus Damage
  useEffect(() => {
    let types = [...damageTypes] // Create a copy of damageTypes array

    // Handle secondary
    if (featureState?.damage?.attribute?.some((attributeItem: any) => attributeItem?.name === 'secondaryDamage')) {
      if (!types.includes('secondary')) {
        types.push('secondary')

        setDamageTypes(types)
      }
    } else if (types.includes('secondary')) {
      types = types.filter((type) => type !== 'secondary')

      setDamageTypes(types)
    }

    // Handle bonus damage
    if (featureState?.damage?.attribute?.some((attributeItem: any) => attributeItem?.name === 'bonusDamage')) {
      if (!types.includes('bonus')) {
        types.push('bonus')

        setDamageTypes(types)
      }
    } else if (types.includes('bonus')) {
      types = types.filter((type) => type !== 'bonus')

      setDamageTypes(types)
    }
  }, [featureState?.damage?.attribute, damageTypes])

  // Add/remove Die Per Level table
  useEffect(() => {
    const diePerLevel =
      featureState?.damage?.primary?.attribute?.name === 'diePerLevel' ||
      featureState?.damage?.secondary?.attribute?.name === 'diePerLevel' ||
      featureState?.damage?.bonus?.attribute?.name === 'diePerLevel'

    if (diePerLevel && !featureState.damage?.diePerLevel) {
      setFeatureState({
        type: 'added',
        target: {
          name: `damage.diePerLevel`,
        },
      })
    }
    if (!diePerLevel && featureState.damage?.diePerLevel) {
      setFeatureState({
        type: 'removed',
        target: {
          name: `damage.diePerLevel`,
        },
      })
    }
    if (!damageTypes.includes('secondary') && featureState.damage?.secondary) {
      setFeatureState({ type: 'removed', target: { name: 'damage.secondary' } })
    }
    if (!damageTypes.includes('bonus') && featureState.damage?.bonus) {
      setFeatureState({ type: 'removed', target: { name: 'damage.bonus' } })
    }
    if (
      !featureState.attribute?.some((attributeItem: any) => attributeItem?.name === 'doesDamage') &&
      featureState.damage
    ) {
      setFeatureState({
        type: 'removed',
        target: {
          name: `damage`,
        },
      })
    }
  }, [setFeatureState, featureState.attribute, featureState.damage, damageTypes])

  // Add/remove Set Per Level table
  useEffect(() => {
    const setPerLevel =
      featureState?.damage?.primary?.attribute?.name === 'setPerLevel' ||
      featureState?.damage?.secondary?.attribute?.name === 'setPerLevel' ||
      featureState?.damage?.bonus?.attribute?.name === 'setPerLevel'

    if (setPerLevel && !featureState.damage?.setPerLevel) {
      setFeatureState({
        type: 'added',
        target: {
          name: `damage.setPerLevel`,
        },
      })
    }
    if (!setPerLevel && featureState.damage?.setPerLevel) {
      setFeatureState({
        type: 'removed',
        target: {
          name: `damage.setPerLevel`,
        },
      })
    }
  }, [setFeatureState, featureState.attribute, featureState.damage])

  // Add/Remove replace at level table
  useEffect(() => {
    if (
      featureState.attribute?.some((attributeItem: any) => attributeItem?.name === 'selectCountByLevel') &&
      (!featureState.selectCountByLevel || !(featureState.selectCountByLevel?.length > 0))
    ) {
      setFeatureState({
        type: 'added',
        target: { name: 'selectCountByLevel' },
      })
    }
    if (
      featureState.selectCountByLevel &&
      !featureState.attribute?.some((attributeItem: any) => attributeItem?.name === 'selectCountByLevel')
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
      !featureState.charge?.level &&
      featureState?.charge?.limit?.name === 'level' &&
      featureState.attribute?.some((attributeItem: any) => attributeItem?.name === 'limitUse')
    ) {
      setFeatureState({
        type: 'added',
        target: {
          name: `charge.level`,
        },
      })
    }
    if (featureState.charge?.level && !(featureState?.charge?.limit?.name === 'level')) {
      setFeatureState({
        type: 'removed',
        target: {
          name: `charge.level`,
        },
      })
    }
    if (
      !featureState.attribute?.some((attributeItem: any) => attributeItem?.name === 'limitUse') &&
      featureState.charge
    ) {
      setFeatureState({
        type: 'removed',
        target: {
          name: `charge`,
        },
      })
    }
  }, [
    featureState.charge?.limit?.name,
    featureState.attribute,
    setFeatureState,
    featureState.charge?.level,
    featureState.charge,
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
        setValueLabel('Ancestry Feature')
      } else if (featureContext === 'OptionFeatureContent') {
        setValueLabel('Ancestry Sub-Feature')
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

  // Add/Remove requirements array
  useEffect(() => {
    if (
      !(featureState.attribute?.length > 0) ||
      (!featureState.attribute?.some((attributeItem: any) => attributeItem.name === 'hasRequirements') &&
        featureState.requirement)
    ) {
      setFeatureState({
        type: 'removed',
        target: { name: 'requirement' },
      })
    }

    if (featureState.attribute?.some((attributeItem: any) => attributeItem.name === 'hasRequirements')) {
      if (
        featureState.requirement?.option?.some((optionItem: any) => optionItem.name === 'itemProficiency') &&
        !(featureState.requirement?.itemProficiency?.length > 0)
      ) {
        setFeatureState({
          type: 'added',
          target: { name: 'requirement.itemProficiency' },
        })
      }

      if (
        !featureState.requirement?.option?.some((optionItem: any) => optionItem.name === 'itemProficiency') &&
        featureState.requirement?.itemProficiency?.length > 0
      ) {
        setFeatureState({
          type: 'removed',
          target: { name: 'requirement.itemProficiency' },
        })
      }

      if (
        featureState.requirement?.option?.some((optionItem: any) => optionItem.name === 'equipped') &&
        !(featureState.requirement?.equipped?.length > 0)
      ) {
        setFeatureState({
          type: 'added',
          target: { name: 'requirement.equipped' },
        })
      }

      if (
        !featureState.requirement?.option?.some((optionItem: any) => optionItem.name === 'equipped') &&
        featureState.requirement?.equipped?.length > 0
      ) {
        setFeatureState({
          type: 'removed',
          target: { name: 'requirement.equipped' },
        })
      }

      if (
        featureState.requirement?.option?.some((optionItem: any) => optionItem.name === 'notEquipped') &&
        !(featureState.requirement?.notEquipped?.length > 0)
      ) {
        setFeatureState({
          type: 'added',
          target: { name: 'requirement.notEquipped' },
        })
      }

      if (
        !featureState.requirement?.option?.some((optionItem: any) => optionItem.name === 'notEquipped') &&
        featureState.requirement?.notEquipped?.length > 0
      ) {
        setFeatureState({
          type: 'removed',
          target: { name: 'requirement.notEquipped' },
        })
      }
    }
  }, [featureState.attribute, setFeatureState, featureState.requirement])

  // Remove empty arrays
  useEffect(() => {
    const featureItem = JSON.parse(JSON.stringify(featureState))
    Object.keys(featureItem).forEach((keyItem) => {
      if (Array.isArray(featureItem[keyItem])) {
        if (!(featureItem[keyItem]?.length > 0)) {
          delete featureItem[keyItem]
        }
      }
    })

    if (!isEqual(featureItem, featureState)) {
      setFeatureState({
        type: 'reset',
        target: { value: featureItem },
      })
    }
  }, [setFeatureState, featureState])

  const diePerLevelTableColumns = () => {
    const inputArray: RowInput[] = [
      {
        name: 'level',
        value: 'Level',
        errorMsg: 'Must not be blank and contain only numbers',
        validation: 'num',
      },
    ]

    if (featureState?.damage?.primary?.attribute?.name === 'diePerLevel') {
      inputArray.push(
        {
          name: 'primary.diceCount',
          value: 'Main Dice Count',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
        {
          name: 'primary.diceValue',
          value: 'Main Dice Value',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        }
      )
    }

    if (featureState?.damage?.secondary?.attribute?.name === 'diePerLevel') {
      inputArray.push(
        {
          name: 'secondary.diceCount',
          value: 'Sec. Dice Count',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
        {
          name: 'secondary.diceValue',
          value: 'Sec. Dice Value',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        }
      )
    }

    if (featureState?.damage?.bonus?.attribute?.name === 'diePerLevel') {
      inputArray.push(
        {
          name: 'bonus.diceCount',
          value: 'Bonus Dice Count',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
        {
          name: 'bonus.diceValue',
          value: 'Bonus Dice Value',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        }
      )
    }

    const headerArray: RowHeader[] = inputArray.map((inputItem) => ({
      value: inputItem.value,
      required: true,
    }))

    return { inputs: inputArray, headers: headerArray }
  }

  const setPerLevelTableColumns = () => {
    const inputArray: RowInput[] = [
      {
        name: 'level',
        value: 'Level',
        errorMsg: 'Must not be blank and contain only numbers',
        validation: 'num',
      },
    ]

    if (featureState?.damage?.primary?.attribute?.name === 'setPerLevel') {
      inputArray.push({
        name: 'primary',
        value: 'Main Dmg. Value',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      })
    }

    if (featureState?.damage?.secondary?.attribute?.name === 'setPerLevel') {
      inputArray.push({
        name: 'secondary',
        value: 'Sec. Dmg. Value',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      })
    }

    if (featureState?.damage?.bonus?.attribute?.name === 'setPerLevel') {
      inputArray.push({
        name: 'bonus',
        value: 'Bonus Dmg. Value',
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

  const sectionNames = getSectionNames().sort((a: any, b: any) => a.localeCompare(b))

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
          setSubFeatureState && setSubFeatureState({ type: 'reset', target: { value: {} } })
          setOldSubFeatureState && setOldSubFeatureState({})
          const optionIndex = featureState[sectionName]?.length > 0 ? featureState[sectionName].length : 0
          setSubFeatureIndex && setSubFeatureIndex(optionIndex)
          return setFeatureContext('OptionFeatureContent')
        }
        // Add Option content
        setOptionState && setOptionState({ type: 'reset', target: { value: {} } })
        setOldOptionState && setOldOptionState({})
        const optionIndex = featureState[sectionName]?.length > 0 ? featureState[sectionName].length : 0
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

  return !featureState || !formState || isLoading || !builders ? (
    <Spinner />
  ) : (
    <>
      <Grid className={feature_content_header}>
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
              (featureContext === 'OptionContent' ? sectionName !== 'option' : sectionName) &&
              (stepName === 'Ancestry' ? sectionName !== 'option' : sectionName) &&
              (context.title !== 'class' ? sectionName !== 'ancestry' : sectionName) &&
              (stepName !== 'Ancestry' && featureContext !== 'OptionContent'
                ? sectionName !== 'feature'
                : sectionName) &&
              (featureContext === 'OptionFeatureContent'
                ? sectionName !== 'option' && sectionName !== 'feature'
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
        <Grid className={sprinkles({ mb: 'size-3' })}>
          {context.title !== 'item' &&
            context.title !== 'background' &&
            !(stepName === 'Ancestry' && featureContext !== 'OptionContent') && (
              <Input
                name={`levelAvailable`}
                autoComplete='off'
                label='Level(s) Available'
                required={context.title === 'race' ? false : true}
                value={featureState?.levelAvailable}
                validation='num'
                errorMsg='Must contain whole numbers and commas only'
                onChange={setFeatureState}
              />
            )}
          {(stepName !== 'Ancestry' || (stepName === 'Ancestry' && featureContext === 'OptionContent')) && (
            <Dropdown
              multiSelect={true}
              name={`attribute`}
              options={[]
                .concat(
                  builders.feature.attribute,
                  context.title &&
                    builders.feature[context.title]?.attribute?.length > 0 &&
                    builders.feature[context.title]?.attribute,
                  featureState.option && featureState.option.length > 0 && builders.feature.option.attribute
                )
                .filter((attributeItem: any) =>
                  context.title === 'item'
                    ? attributeItem?.name !== 'providesOptions' && attributeItem?.name !== 'optionGroups'
                    : attributeItem
                )}
              label='Feature Attribute'
              value={featureState?.attribute}
              onChange={setFeatureState}
            />
          )}
          {featureState[subArray]?.length > 0 &&
            featureState?.attribute?.some((attributeItem: any) => attributeItem?.name === 'replaceAtLevel') && (
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
          {featureState?.attribute?.some((attributeItem: any) => attributeItem?.name === 'isAction') && (
            <>
              <Dropdown
                name={`action.type`}
                label='Action Type'
                value={featureState?.action?.type}
                options={builders.action.type}
                required={true}
                onChange={setFeatureState}
              />
            </>
          )}
        </Grid>
        {featureState?.attribute?.some((attributeItem: any) => attributeItem?.name === 'limitUse') && (
          <Grid className={sprinkles({ mb: 'size-3' })}>
            <Dropdown
              name={`charge.limit`}
              label='Limit Option'
              value={featureState?.charge?.limit}
              options={[].concat(
                builders.feature.charge.limit,
                context.title && builders.feature[context.title]?.charge?.limit
              )}
              required={true}
              onChange={setFeatureState}
            />
            {featureState?.charge?.limit?.name === 'ability' ? (
              <>
                <Dropdown
                  name={`charge.ability.type`}
                  label='Ability'
                  value={featureState?.charge?.ability?.type}
                  options={builders.ability.type}
                  required={true}
                  onChange={setFeatureState}
                />
              </>
            ) : featureState.charge?.limit?.name === 'skill' ? (
              <Dropdown
                name={`charge.skill.type`}
                label='Skill'
                value={featureState?.charge?.skill?.type}
                options={builders.skill.type}
                required={true}
                onChange={setFeatureState}
              />
            ) : featureState.charge?.limit?.name === 'setValue' ? (
              <Input
                validation='num'
                type='text'
                name={`charge.setValue`}
                errorMsg='Must contain only numbers'
                label='Use Amount'
                value={featureState?.charge?.setValue}
                required={true}
                onChange={setFeatureState}
              />
            ) : (
              featureState.charge?.limit?.name === 'resourcePoints' && (
                <Input
                  validation='num'
                  type='text'
                  name={`charge.resourcePoints`}
                  errorMsg='Must contain only numbers'
                  label='Use Amount'
                  value={featureState?.charge?.resourcePoints}
                  required={true}
                  onChange={setFeatureState}
                />
              )
            )}
            {featureState?.charge?.limit &&
              featureState.charge?.limit?.name !== 'setValue' &&
              featureState.charge?.limit?.name !== 'level' &&
              featureState?.charge?.limit?.name !== 'resourcePoints' && (
                <>
                  <Input
                    name={`charge.multiplier`}
                    autoComplete='off'
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    label='Multiplier'
                    value={featureState?.charge?.multiplier}
                    onChange={setFeatureState}
                  />
                  <>
                    <Input
                      name={`charge.addValue`}
                      autoComplete='off'
                      label='Additional Amount'
                      value={featureState?.charge?.addValue}
                      onChange={setFeatureState}
                    />
                    <Input
                      name={`charge.minValue`}
                      autoComplete='off'
                      label='Min. Value'
                      value={featureState?.charge?.minValue}
                      onChange={setFeatureState}
                    />
                  </>
                </>
              )}
            {featureState?.charge?.limit?.name !== 'resourcePoints' && (
              <Dropdown
                name={`charge.reset`}
                label='Reset Option'
                value={featureState?.charge?.reset}
                options={builders.feature.charge.reset}
                required={true}
                onChange={setFeatureState}
              />
            )}
          </Grid>
        )}
        {featureState?.attribute?.some((attributeItem: any) => attributeItem?.name === 'hasRange') && (
          <>
            <Grid className={sprinkles({ mb: 'size-3' })}>
              <Dropdown
                name='range.type'
                label='Range'
                value={featureState?.range?.type}
                options={builders.spell.range.type}
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
                      required={featureState.range?.type?.name === 'distance' ? true : false}
                      value={featureState?.range?.minRange}
                      onChange={setFeatureState}
                    />
                    <Input
                      validation={'num'}
                      name='range.maxRange'
                      errorMsg='Must contain only numbers'
                      label='Max Range'
                      autoComplete='off'
                      required={featureState.range?.type?.name === 'distance' ? true : false}
                      value={featureState?.range?.maxRange}
                      onChange={setFeatureState}
                    />
                    <Dropdown
                      name='range.unit'
                      label='UoM'
                      value={featureState?.range?.unit}
                      options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOption[]}
                      required={featureState.range?.type?.name === 'distance' ? true : false}
                      optionalKey='short'
                      onChange={setFeatureState}
                    />
                  </>
                )}
              {featureState.attribute?.some((attributeItem: any) => attributeItem?.name === 'limitedTargets') && (
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
                options={builders.spell.shape.type}
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
                      options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOption[]}
                      required={true}
                      optionalKey='short'
                      onChange={setFeatureState}
                    />
                  </>
                )}
            </Grid>
          </>
        )}
        {featureState?.attribute?.some((attributeItem: any) => attributeItem?.name === 'requireSave') && (
          <Grid className={sprinkles({ mb: 'size-3' })}>
            <Dropdown
              name={`saveAbility.attribute`}
              multiSelect={true}
              label='Save Attribute'
              value={featureState?.saveAbility?.attribute}
              options={builders.feature.saveAbility.attribute}
              onChange={setFeatureState}
            />
            <Dropdown
              name={`saveAbility.type`}
              label='DC Ability'
              value={featureState?.saveAbility?.type}
              options={builders.ability.type}
              required={true}
              onChange={setFeatureState}
            />
            {featureState?.saveAbility?.attribute?.some(
              (attributeItem: any) => attributeItem?.name === 'addAbilityModifier'
            ) && (
              <Dropdown
                name={`saveAbility.abilityModifier.type`}
                label='Modifier Ability'
                value={featureState?.saveAbility?.abilityModifier?.type}
                options={builders.ability.type}
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
        {featureState?.attribute?.some((attributeItem: any) => attributeItem?.name === 'hasRequirements') && (
          <Grid className={sprinkles({ mb: 'size-3' })}>
            <Dropdown
              multiSelect={true}
              name={`requirement.option`}
              label='Requirement'
              options={[].concat(
                builders.feature.requirement,
                context.title &&
                  builders.feature[context.title]?.requirement?.length > 0 &&
                  builders.feature[context.title]?.requirement,
                featureContext === 'OptionContent' && builders.feature.option.requirement
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
                  options={formState.feature as unknown as DropdownOption[]}
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
                      (featureItem: any) => featureItem.option?.length > 0 && featureItem.option
                    )}
                    onChange={setFeatureState}
                  />
                )}
              </>
            )}
          </Grid>
        )}
        {featureState?.attribute?.some((attributeItem: any) => attributeItem?.name === 'hasRequirements') &&
          !featureState.requirement?.option?.every(
            (featureState: any) =>
              featureState.name === 'notProficient' ||
              featureState.name === 'spellKnown' ||
              featureState.name === 'featureKnown' ||
              featureState.name === 'optionNotAcquired'
          ) &&
          featureState.requirement?.option?.length > 0 && (
            <>
              <Divider label={'Requirements'} />
              <Grid>
                {featureState?.requirement?.option?.some(
                  (featureState: any) => featureState.name === 'skillProficiency'
                ) && (
                  <Dropdown
                    multiSelect={true}
                    name={`requirement.skillProficiency.type`}
                    label='Skill Proficiency'
                    value={featureState?.requirement?.skillProficiency?.type}
                    options={builders.skill.type}
                    onChange={setFeatureState}
                  />
                )}
                {featureState?.requirement?.option?.some(
                  (featureState: any) => featureState.name === 'abilityScore'
                ) && (
                  <>
                    <Dropdown
                      multiSelect={true}
                      name={`requirement.abilityScore.type`}
                      value={featureState?.requirement?.abilityScore?.type}
                      label='Ability'
                      options={builders.ability.type}
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
                (requirementItem: any) => requirementItem.name === 'itemProficiency'
              ) && (
                <>
                  <Divider label='Item Proficiency' />
                  {featureState?.requirement?.itemProficiency?.map((requirementItem: any, requirementIndex: number) => (
                    <Grid className={sprinkles({ mb: 'size-3' })} key={requirementIndex}>
                      <Dropdown
                        name={`requirement.itemProficiency.${requirementIndex}.category`}
                        value={requirementItem?.category}
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setFeatureState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.itemProficiency.${requirementIndex}.property.type`}
                        value={requirementItem?.property?.type}
                        label='Item Property'
                        options={items
                          ?.filter((item: any) =>
                            requirementItem?.category?._id
                              ? requirementItem?.category?._id === item.category?._id
                              : item
                          )
                          .flatMap((item: any) => item.property?.type)}
                        onChange={setFeatureState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.itemProficiency.${requirementIndex}.item.type`}
                        label='Item type'
                        value={requirementItem?.item?.type}
                        options={items
                          ?.filter((item: any) =>
                            requirementItem?.category?._id
                              ? requirementItem?.category?._id === item.category?._id
                              : item
                          )
                          .filter((item: any) =>
                            requirementItem?.property?.type?.length > 0
                              ? item.property?.type?.length > 0 &&
                                requirementItem?.property?.type.every((requirementProperty: any) =>
                                  item?.property?.type?.some(
                                    (itemProperty: any) => itemProperty._id === requirementProperty._id
                                  )
                                )
                              : item
                          )
                          .map((item: any) => item)}
                        onChange={setFeatureState}
                      />
                      <Group
                        className={sprinkles({ height: 'full' })}
                        alignItemsVariant='center'
                        justifyContentVariant='start'
                      >
                        <Button
                          variant='unstyled'
                          className={clsx(form_add_button, equipment_sub_group_button)}
                          onClick={() =>
                            setFeatureState({
                              type: 'added',
                              target: {
                                name: `requirement.itemProficiency`,
                              },
                            })
                          }
                        >
                          <TbPlus />
                        </Button>
                        {requirementIndex !== 0 && (
                          <Button
                            variant='unstyled'
                            className={clsx(form_remove_button, equipment_sub_group_button)}
                            onClick={() => {
                              setFeatureState({
                                type: 'removed',
                                target: {
                                  name: `requirement.itemProficiency.${requirementIndex}`,
                                },
                              })
                            }}
                          >
                            <TbX />
                          </Button>
                        )}
                      </Group>
                    </Grid>
                  ))}
                </>
              )}
              {featureState?.requirement?.option?.some(
                (requirementItem: any) => requirementItem.name === 'equipped'
              ) && (
                <>
                  <Divider label='Equipped' />
                  {featureState?.requirement?.equipped?.map((requirementItem: any, requirementIndex: number) => (
                    <Grid className={sprinkles({ mb: 'size-3' })} key={requirementIndex}>
                      <Dropdown
                        name={`requirement.equipped.${requirementIndex}.category`}
                        value={requirementItem?.category}
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setFeatureState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.equipped.${requirementIndex}.property.type`}
                        value={requirementItem?.property?.type}
                        label='Item Property'
                        options={items
                          ?.filter((item: any) =>
                            requirementItem?.category?._id
                              ? requirementItem?.category?._id === item.category?._id
                              : item
                          )
                          .flatMap((item: any) => item.property?.type)}
                        onChange={setFeatureState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.equipped.${requirementIndex}.item.type`}
                        label='Item type'
                        value={requirementItem?.item?.type}
                        options={items
                          ?.filter((item: any) =>
                            requirementItem?.category?._id
                              ? requirementItem?.category?._id === item.category?._id
                              : item
                          )
                          .filter((item: any) =>
                            requirementItem?.property?.type?.length > 0
                              ? item.property?.type?.length > 0 &&
                                requirementItem?.property?.type.every((requirementProperty: any) =>
                                  item?.property?.type?.some(
                                    (itemProperty: any) => itemProperty._id === requirementProperty._id
                                  )
                                )
                              : item
                          )
                          .map((item: any) => item)}
                        onChange={setFeatureState}
                      />
                      <Input
                        name={`requirement.equipped.${requirementIndex}.numberEquipped`}
                        label='Number Equipped'
                        value={requirementItem?.numberEquipped}
                        onChange={setFeatureState}
                      />
                      <Group
                        className={sprinkles({ height: 'full' })}
                        alignItemsVariant='center'
                        justifyContentVariant='start'
                      >
                        <Button
                          variant='unstyled'
                          className={clsx(form_add_button, equipment_sub_group_button)}
                          onClick={() =>
                            setFeatureState({
                              type: 'added',
                              target: {
                                name: `requirement.equipped`,
                              },
                            })
                          }
                        >
                          <TbPlus />
                        </Button>
                        {requirementIndex !== 0 && (
                          <Button
                            variant='unstyled'
                            className={clsx(form_remove_button, equipment_sub_group_button)}
                            onClick={() => {
                              setFeatureState({
                                type: 'removed',
                                target: {
                                  name: `requirement.equipped.${requirementIndex}`,
                                },
                              })
                            }}
                          >
                            <TbX />
                          </Button>
                        )}
                      </Group>
                    </Grid>
                  ))}
                </>
              )}
              {featureState?.requirement?.option?.some(
                (requirementItem: any) => requirementItem.name === 'notEquipped'
              ) && (
                <>
                  <Divider label={'Not Equipped'} />
                  {featureState?.requirement?.notEquipped?.map((requirementItem: any, requirementIndex: number) => (
                    <Grid className={sprinkles({ mb: 'size-3' })} key={requirementIndex}>
                      <Dropdown
                        name={`requirement.notEquipped.${requirementIndex}.category`}
                        value={requirementItem?.category}
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setFeatureState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.notEquipped.${requirementIndex}.property.type`}
                        value={requirementItem?.property?.type}
                        label='Item Property'
                        options={items
                          ?.filter((item: any) =>
                            requirementItem?.category?._id
                              ? requirementItem?.category?._id === item.category?._id
                              : item
                          )
                          .flatMap((item: any) => item.property?.type)}
                        onChange={setFeatureState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name={`requirement.notEquipped.${requirementIndex}.item.type`}
                        label='Item type'
                        value={requirementItem?.item?.type}
                        options={items
                          ?.filter((item: any) =>
                            requirementItem?.category?._id
                              ? requirementItem?.category?._id === item.category?._id
                              : item
                          )
                          .filter((item: any) =>
                            requirementItem?.property?.type?.length > 0
                              ? item.property?.type?.length > 0 &&
                                requirementItem?.property?.type.every((requirementProperty: any) =>
                                  item?.property?.type?.some(
                                    (itemProperty: any) => itemProperty._id === requirementProperty._id
                                  )
                                )
                              : item
                          )
                          .map((item: any) => item)}
                        onChange={setFeatureState}
                      />
                      <Group
                        className={sprinkles({ height: 'full' })}
                        alignItemsVariant='center'
                        justifyContentVariant='start'
                      >
                        <Button
                          variant='unstyled'
                          className={clsx(form_add_button, equipment_sub_group_button)}
                          onClick={() =>
                            setFeatureState({
                              type: 'added',
                              target: {
                                name: `requirement.notEquipped`,
                              },
                            })
                          }
                        >
                          <TbPlus />
                        </Button>
                        {requirementIndex !== 0 && (
                          <Button
                            variant='unstyled'
                            className={clsx(form_remove_button, equipment_sub_group_button)}
                            onClick={() => {
                              setFeatureState({
                                type: 'removed',
                                target: {
                                  name: `requirement.notEquipped.${requirementIndex}`,
                                },
                              })
                            }}
                          >
                            <TbX />
                          </Button>
                        )}
                      </Group>
                    </Grid>
                  ))}
                </>
              )}
            </>
          )}
        {featureState?.attribute?.some((attributeItem: any) => attributeItem?.name === 'selectCountByLevel') && (
          <Collapse title='Select Count By Level Table' className={sprinkles({ mt: 'size-3' })}>
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
        {featureState?.charge?.limit?.name === 'level' &&
          featureState.attribute?.some((attributeItem: any) => attributeItem?.name === 'limitUse') && (
            <>
              <Collapse title={'Limit Use Table'} className={sprinkles({ mt: 'size-3' })}>
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
                    name={`charge.level`}
                    value={featureState?.charge?.level}
                    onChange={setFeatureState}
                    addRow={true}
                  />
                </div>
              </Collapse>
            </>
          )}
        {featureState?.attribute?.some((attributeItem: any) => attributeItem?.name === 'doesDamage') && (
          <>
            <Grid className={sprinkles({ my: 'size-3' })}>
              <Dropdown
                multiSelect={true}
                name={`damage.attribute`}
                label={`Damage Attribute`}
                value={featureState?.damage?.attribute}
                options={builders.damage.attribute}
                onChange={setFeatureState}
              />
            </Grid>
            {damageTypes.map((type: string, index: number) => {
              return (
                <Grid key={index}>
                  <Dropdown
                    name={`damage.${type}.attribute`}
                    label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Dmg. Attribute`}
                    value={featureState?.damage?.[type]?.attribute}
                    options={[].concat(
                      builders.damage.main.attribute,
                      type === 'bonus' && builders.damage.bonus.attribute
                    )}
                    onChange={setFeatureState}
                  />
                  <Dropdown
                    name={`damage.${type}.type`}
                    label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Dmg. Type`}
                    value={featureState?.damage?.[type]?.type}
                    options={[
                      ...builders.damage.type,
                      {
                        id: null,
                        _id: null,
                        name: 'matchWeapon',
                        value: 'Match Weapon',
                      },
                    ]}
                    required={true}
                    onChange={setFeatureState}
                  />
                  {featureState?.damage?.[type]?.attribute?.name !== 'diePerLevel' &&
                    featureState?.damage?.[type]?.attribute?.name !== 'setPerLevel' &&
                    (featureState?.damage?.[type]?.attribute?.name === 'setValue' ? (
                      <Input
                        name={`damage.${type}.setValue`}
                        value={featureState?.damage?.[type]?.setValue}
                        label={`Set ${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Value`}
                        onChange={setFeatureState}
                        required={true}
                        validation='num'
                        errorMsg={'Must contain only numbers'}
                      />
                    ) : featureState?.damage?.[type]?.attribute?.name === 'ability' ||
                      featureState?.damage?.[type]?.attribute?.name === 'spellcastingAbility' ||
                      featureState?.damage?.[type]?.attribute?.name === 'proficiency' ? (
                      <>
                        {featureState?.damage?.[type]?.attribute?.name === 'ability' && (
                          <Dropdown
                            name={`damage.${type}.ability.type`}
                            label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Ability`}
                            value={featureState?.damage?.[type]?.ability?.type}
                            options={builders.ability.type}
                            required={true}
                            onChange={setFeatureState}
                          />
                        )}
                        <Input
                          name={`damage.${type}.minValue`}
                          value={featureState?.damage?.[type]?.minValue}
                          label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Min. Value`}
                          onChange={setFeatureState}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                        <Input
                          name={`damage.${type}.maxValue`}
                          value={featureState?.damage?.[type]?.maxValue}
                          label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Max Value`}
                          onChange={setFeatureState}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                        <Input
                          name={`damage.${type}.multiplier`}
                          value={featureState?.damage?.[type]?.multiplier}
                          label={`${
                            type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'
                          } Dmg. Multiplier`}
                          onChange={setFeatureState}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                      </>
                    ) : featureState?.damage?.[type]?.attribute?.name === 'damagePool' ? (
                      <>
                        <Dropdown
                          name={`damage.${type}.pool.attribute`}
                          label={`${
                            type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'
                          } Dmg. Pool Attribute`}
                          value={featureState?.damage?.[type]?.pool?.attribute}
                          options={[].concat(
                            builders.damage.pool.attribute,
                            type === 'bonus' && builders.damage.bonus.attribute
                          )}
                          required={true}
                          onChange={setFeatureState}
                        />
                        {featureState?.damage?.[type]?.pool?.attribute?.name === 'level' ||
                        featureState.damage?.[type]?.pool?.attribute?.name === 'ability' ||
                        featureState?.damage?.[type]?.pool?.attribute?.name === 'spellcastingAbility' ||
                        featureState.damage?.[type]?.pool?.attribute?.name === 'proficiency' ? (
                          <>
                            {(featureState.damage?.[type]?.pool?.attribute?.name === 'ability' ||
                              featureState?.damage?.[type]?.pool?.attribute?.name === 'spellcastingAbility') && (
                              <>
                                {featureState.damage?.[type]?.pool?.attribute?.name === 'ability' && (
                                  <Dropdown
                                    name={`damage.${type}.pool.ability.type`}
                                    label='Pool Abilty'
                                    value={featureState?.damage?.[type]?.pool?.ability?.type}
                                    options={builders.ability.type}
                                    required={true}
                                    onChange={setFeatureState}
                                  />
                                )}
                                <Input
                                  name={`damage.${type}.pool.minValue`}
                                  value={featureState?.damage?.[type]?.pool?.minValue}
                                  label={`${
                                    type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'
                                  } Dmg. Min. Value`}
                                  onChange={setFeatureState}
                                  validation='num'
                                  errorMsg={'Must contain only numbers'}
                                />
                              </>
                            )}
                            <Input
                              name={`damage.${type}.pool.maxValue`}
                              value={featureState?.damage?.[type].pool?.maxValue}
                              label={`${
                                type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'
                              } Dmg. Max Value`}
                              onChange={setFeatureState}
                              validation='num'
                              errorMsg={'Must contain only numbers'}
                            />
                            <Input
                              name={`damage.${type}.pool.multiplier`}
                              value={featureState?.damage?.[type]?.pool?.multiplier}
                              label={`${
                                type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'
                              } Dmg. Multiplier`}
                              onChange={setFeatureState}
                              validation='num'
                              errorMsg={'Must contain only numbers'}
                            />
                          </>
                        ) : (
                          featureState.damage?.[type]?.pool?.attribute?.name === 'setValue' && (
                            <Input
                              name={`damage.${type}.pool.setValue`}
                              value={featureState?.damage?.[type]?.pool?.setValue}
                              label='Pool Total'
                              onChange={setFeatureState}
                              validation='num'
                              required={true}
                              errorMsg={'Must contain only numbers'}
                            />
                          )
                        )}
                      </>
                    ) : (
                      <>
                        <Input
                          name={`damage.${type}.diceCount`}
                          value={featureState?.damage?.[type]?.diceCount}
                          label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Dice Count`}
                          onChange={setFeatureState}
                          required={true}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                        <Input
                          name={`damage.${type}.diceValue`}
                          value={featureState?.damage?.[type]?.diceValue}
                          label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Dice Value`}
                          onChange={setFeatureState}
                          required={true}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                      </>
                    ))}
                </Grid>
              )
            })}
            {(featureState?.damage?.primary?.attribute?.name === 'diePerLevel' ||
              featureState?.damage?.secondary?.attribute?.name === 'diePerLevel' ||
              featureState?.damage?.bonus?.attribute?.name === 'diePerLevel') && (
              <Collapse title={`Damage Die By Level`} className={sprinkles({ my: 'size-3' })}>
                <Table
                  name={`damage.diePerLevel`}
                  rows={{
                    inputs: diePerLevelTableColumns().inputs,
                    headers: diePerLevelTableColumns().headers,
                  }}
                  value={featureState?.damage?.diePerLevel}
                  addRow={true}
                  onChange={setFeatureState}
                />
              </Collapse>
            )}
            {(featureState?.damage?.primary?.attribute?.name === 'setPerLevel' ||
              featureState?.damage?.secondary?.attribute?.name === 'setPerLevel' ||
              featureState?.damage?.bonus?.attribute?.name === 'setPerLevel') && (
              <Collapse title={`Set By Level`} className={sprinkles({ my: 'size-3' })}>
                <Table
                  name={`damage.setPerLevel`}
                  rows={{
                    inputs: setPerLevelTableColumns().inputs,
                    headers: setPerLevelTableColumns().headers,
                  }}
                  value={featureState?.damage?.setPerLevel}
                  addRow={true}
                  onChange={setFeatureState}
                />
              </Collapse>
            )}
          </>
        )}
        <div className={feature_list}>
          {sectionNames.map((sectionName: SectionName, sectionNameIndex: number) => {
            return (
              featureState[sectionName]?.length > 0 && (
                <Accordion
                  key={sectionNameIndex}
                  dataArray={featureState[sectionName]}
                  setState={setFeatureState}
                  name={sectionName}
                  disableSort={sectionName !== 'option' && sectionName !== 'feature'}
                >
                  {featureState[sectionName]?.map((sectionItem: any, sectionIndex: number) => {
                    return (
                      <Accordion.Container key={sectionIndex} itemId={String(sectionIndex)}>
                        <Accordion.Header
                          key={sectionIndex}
                          handleRemove={() => handleRemove(sectionName, sectionIndex)}
                          handleClick={() =>
                            (sectionName === 'option' || sectionName === 'feature') && toggle(sectionIndex)
                          }
                          handleEdit={() => handleEdit(sectionName, sectionIndex)}
                          active={
                            sectionName === 'option' || sectionName === 'feature' ? activeIndex === sectionIndex : null
                          }
                        >
                          {sectionName !== 'feature' && `${startCase(sectionName)} ${sectionIndex + 1}`}
                          {sectionItem?.value != null && sectionItem?.value !== '' && sectionName === 'option'
                            ? ` (${sectionItem?.value})`
                            : sectionItem?.value}
                        </Accordion.Header>
                        {(sectionName === 'option' || sectionName === 'feature') && (
                          <>
                            <Accordion.Content active={activeIndex === sectionIndex}>
                              <div className={feature_description}>{sectionItem?.desc && parse(sectionItem?.desc)}</div>
                            </Accordion.Content>
                            <Accordion.Footer>
                              <Group justifyContentVariant='start'>
                                {sectionNames.map((footerSectionName: string, footerSectionIndex: number) => {
                                  return (
                                    <span
                                      key={footerSectionIndex}
                                      className={sprinkles({
                                        me: 'size-3',
                                      })}
                                    >
                                      {sectionItem[footerSectionName]?.length > 0 ? (
                                        <strong key={footerSectionIndex}>
                                          {startCase(footerSectionName.charAt(0))}:
                                          {sectionItem[footerSectionName]?.length}
                                        </strong>
                                      ) : (
                                        `${startCase(footerSectionName.charAt(0))}: 0`
                                      )}
                                    </span>
                                  )
                                })}
                              </Group>
                            </Accordion.Footer>
                          </>
                        )}
                      </Accordion.Container>
                    )
                  })}
                </Accordion>
              )
            )
          })}
        </div>
      </ScrollArea>
    </>
  )
}

export default FeatureContent
