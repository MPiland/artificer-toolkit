import { useGetBuildersQuery } from '../../../features/systems/systemsApi'
import Input from '../../Input/Input'
import Dropdown from '../../Dropdown/Dropdown'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import Spinner from '../../Spinner/Spinner'
import { DropdownOptionType, ReducerActionType, SectionNameType } from '../../../utils/types'
import Row from '../../Row/Row'
import Select from '../../Select/Select'
import { feature_content_header, feature_list, form_content } from '../Form.css'
import { sprinkles } from '../../../css/sprinkles.css'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { useForm } from '../../../hooks/UseForm'
import SectionsList from './Sections/SectionsList'
import Requirements from '../Generic/Requirements'
import Damage from '../Generic/Damage'
import LimitUse from '../Generic/LimitUse'
import { useFeature } from '../../../hooks/UseFeature'
import { useIsFetching } from '@tanstack/react-query'

const Base = ({
  state,
  setState,
  valueLabel,
  filteredSectionNames,
}: {
  state: any
  setState: (arg: ReducerActionType) => void
  valueLabel: string
  filteredSectionNames: SectionNameType[]
}) => {
  const isLoading = useIsFetching() > 0

  const { context, steps, stepIndex } = useForm()

  const {
    subContext,
    setSubContext,
    optionStateReset,
    setOptionIndex,
    sectionStateReset,
    setSectionIndex,
    setSectionName,
    setSubfeatureIndex,
  } = useFeature()

  const { data: builders } = useGetBuildersQuery()

  const selectSection = (sectionName: SectionNameType) => {
    if (state[sectionName]?.length > 0) {
      setSectionIndex(state[sectionName]?.length)
    } else {
      setSectionIndex(0)
    }

    if (sectionName === 'options') {
      // Add Option content
      optionStateReset()
      const optionIndex = state[sectionName]?.length > 0 ? state[sectionName].length : 0
      setOptionIndex(optionIndex)
      return setSubContext('option')
    }
    if (sectionName === 'features') {
      // Add Option content
      optionStateReset()
      const subfeatureIndex = state[sectionName]?.length > 0 ? state[sectionName].length : 0
      setSubfeatureIndex(subfeatureIndex)
      return setSubContext('subfeature')
    }
    // Add Section
    sectionStateReset()
    setSectionName(sectionName)
  }

  return !state || isLoading || !builders ? (
    <Spinner />
  ) : (
    <>
      <Row className={feature_content_header}>
        <Input
          name={`value`}
          autoComplete='off'
          label={`${valueLabel} Name`}
          required={true}
          value={state?.value}
          errorMsg='Name must not be blank'
          onChange={setState}
        />
        <Dropdown
          name={`type`}
          options={builders.features.type}
          label='Feature Type'
          value={state?.type}
          onChange={setState}
          required={true}
        />
        {state?.type?.name === 'feature' && (
          <Select
            handleChange={selectSection as (arg: string) => void}
            placeholder='Add...'
            label={'Add Section'}
            options={filteredSectionNames}
          />
        )}
      </Row>
      <ScrollArea scrollDirection='vertical' className={form_content}>
        {state?.type?.name === 'subclass' && (
          <RichTextEditor
            label='Feature detail'
            value={state?.detail}
            name={`detail`}
            onChange={setState}
            className={sprinkles({ mb: 'space-3' })}
          />
        )}
        <RichTextEditor
          label='Feature description'
          value={state?.desc}
          name={`desc`}
          onChange={setState}
          className={sprinkles({ mb: 'space-3' })}
        />
        <Row className={sprinkles({ mb: 'space-3' })}>
          {context.title !== 'items' &&
            context.title !== 'backgrounds' &&
            !(steps[stepIndex].id === 'ancestry' && subContext !== 'option') && (
              <Input
                name={`levelAvailable`}
                autoComplete='off'
                label='Level(s) Available'
                required={context.title === 'races' || subContext === 'option' ? false : true}
                value={state?.levelAvailable}
                validation='num'
                errorMsg='Must contain whole numbers and commas only'
                onChange={setState}
              />
            )}
          {(steps[stepIndex].id !== 'ancestry' || (steps[stepIndex].id === 'ancestry' && subContext === 'option')) &&
            state?.type?.name === 'feature' && (
              <Dropdown
                multiSelect={true}
                name={`attribute`}
                options={[].concat(
                  builders.features.attribute,
                  context.title &&
                    builders.features[context.title]?.attribute?.length > 0 &&
                    builders.features[context.title]?.attribute,
                  state.options && state.options.length > 0 && builders.features.options.attribute
                )}
                label='Feature Attribute'
                value={state?.attribute}
                onChange={setState}
              />
            )}
          {state?.attribute?.some((attributeItem: any) => attributeItem?.name === 'isAction') && (
            <>
              <Dropdown
                name={`action.type`}
                label='Action Type'
                value={state?.action?.type}
                options={builders.action.type}
                required={true}
                onChange={setState}
              />
            </>
          )}
        </Row>
        {state?.attribute?.some((attributeItem: any) => attributeItem?.name === 'hasRange') && (
          <>
            <Row className={sprinkles({ mb: 'space-3' })}>
              <Dropdown
                name='range.type'
                label='Range'
                value={state?.range?.type}
                options={builders.spells.range.type}
                required={true}
                onChange={setState}
              />
              {state?.range?.type?.name !== 'touch' &&
                state.range?.type?.name !== 'sight' &&
                state.range?.type?.name !== 'unlimited' &&
                state.range?.type && (
                  <>
                    <Input
                      validation={'num'}
                      name='range.minRange'
                      errorMsg='Please enter a valid number greater than 0'
                      label='Min. Range'
                      autoComplete='off'
                      required={state.range?.type?.name === 'distance' ? true : false}
                      value={state?.range?.minRange}
                      onChange={setState}
                    />
                    <Input
                      validation={'num'}
                      name='range.maxRange'
                      errorMsg='Must contain only numbers'
                      label='Max Range'
                      autoComplete='off'
                      required={state.range?.type?.name === 'distance' ? true : false}
                      value={state?.range?.maxRange}
                      onChange={setState}
                    />
                    <Dropdown
                      name='range.unit'
                      label='UoM'
                      value={state?.range?.unit}
                      options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOptionType[]}
                      required={state.range?.type?.name === 'distance' ? true : false}
                      onChange={setState}
                    />
                  </>
                )}
              {state.attribute?.some((attributeItem: any) => attributeItem?.name === 'limitedTargets') && (
                <Input
                  name='targets'
                  value={state?.targets}
                  label='No. of Targets'
                  validation='num'
                  errorMsg='Must contain only numbers'
                  onChange={setState}
                  placeholder='1'
                />
              )}
            </Row>
            <Row>
              <Dropdown
                name='shape.type'
                label='Shape'
                options={builders.spells.shape.type}
                value={state?.shape?.type}
                onChange={setState}
              />
              {state?.shape?.type?.name &&
                state.shape?.type?.name !== 'none' &&
                state.shape?.type?.name !== 'weapon' && (
                  <>
                    <Input
                      validation={'cur'}
                      name='shape.size'
                      errorMsg='Please enter a valid number (can inlude decimals)'
                      label='Shape Size'
                      autoComplete='off'
                      required={true}
                      value={state?.shape?.size}
                      onChange={setState}
                    />
                    <Dropdown
                      name='shape.unit'
                      label='UoM'
                      value={state?.shape?.unit}
                      options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOptionType[]}
                      required={true}
                      onChange={setState}
                    />
                  </>
                )}
            </Row>
          </>
        )}
        {state?.attribute?.some((attributeItem: any) => attributeItem?.name === 'requireSave') && (
          <Row className={sprinkles({ mb: 'space-3' })}>
            <Dropdown
              name={`saveAbility.attribute`}
              multiSelect={true}
              label='Save Attribute'
              value={state?.saveAbility?.attribute}
              options={builders.features.saveAbility.attribute}
              onChange={setState}
            />
            <Dropdown
              name={`saveAbility.type`}
              label='DC Ability'
              value={state?.saveAbility?.type}
              options={builders.abilities.type}
              required={true}
              onChange={setState}
            />
            {state?.saveAbility?.attribute?.some(
              (attributeItem: any) => attributeItem?.name === 'addAbilityModifier'
            ) && (
              <Dropdown
                name={`saveAbility.abilityModifier.type`}
                label='Modifier Ability'
                value={state?.saveAbility?.abilityModifier?.type}
                options={builders.abilities.type}
                required={true}
                onChange={setState}
              />
            )}
            <Input
              validation='num'
              name={`saveAbility.minValue`}
              autoComplete='off'
              label='Base Value'
              required={context.title !== 'classes' && true}
              errorMsg='Must contain only numbers'
              value={state?.saveAbility?.minValue}
              onChange={setState}
            />
          </Row>
        )}
        <Requirements state={state} setState={setState} />
        <LimitUse state={state} setState={setState} />
        <Damage state={state} setState={setState} />
        <div className={feature_list}>
          <SectionsList state={state} setState={setState} />
        </div>
      </ScrollArea>
    </>
  )
}

export default Base
