import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import Input from '../../Input/Input'
import Dropdown from '../../Dropdown/Dropdown'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { FeatureDataType, SectionName, UpdateState } from '../../../types/form'
import Row from '../../Row/Row'
import Select from '../../Select/Select'
import { feature_content_header, feature_list, form_content } from '../Form.css'
import { sprinkles } from '../../../css/sprinkles.css'
import ScrollArea from '../../ScrollArea/ScrollArea'
import SectionsList from './Sections/SectionsList'
import Requirements from '../Generic/Requirements'
import Damage from '../Generic/Damage'
import LimitUse from '../Generic/LimitUse'
import { FeatureEnum } from '../../../../amplify/API'
import { use } from 'react'
import FormContext from '../FormContext'
import { Attributes, Categories, Ranges, Shapes } from '../../../types/enums'
import FeatureContext from './FeatureContext'
import Loading from '../../Loading/Loading'

const Base = ({
  featureData,
  updateFeatureData,
  valueLabel,
}: {
  featureData: FeatureDataType
  updateFeatureData: (arg: UpdateState<FeatureDataType>) => void
  valueLabel: string
}) => {
  const { context, steps, stepIndex } = use(FormContext)

  const {
    featureStep,
    setFeatureStep,
    optionDataReset,
    sectionDataReset,
    setSectionStep,
    updateSectionData,
    updateOptionData,
    updateSubfeatureData,
    sectionSteps,
  } = use(FeatureContext)

  const { data: system } = useGetSystemQuery()

  const selectSection = (sectionStep: SectionName) => {
    if (featureData.__typename !== 'AncestryFeature' && featureData[sectionStep]?.length > 0) {
      updateSectionData({ type: 'index', value: featureData[sectionStep]?.length })
    } else {
      updateSectionData({ type: 'index', value: 0 })
    }

    if (
      featureStep === 'option' &&
      featureData.__typename !== 'FeatureOption' &&
      featureData.__typename !== 'Subfeature'
    ) {
      // Add Option content
      optionDataReset()
      const optionIndex = featureData.options?.length > 0 ? featureData.options.length : 0
      updateOptionData({ type: 'index', value: optionIndex })
      return setFeatureStep('option')
    }
    if (
      featureStep === 'subfeature' &&
      featureData.__typename !== 'Subfeature' &&
      featureData.__typename !== 'AncestryFeature'
    ) {
      // Add Option content
      optionDataReset()
      const subfeatureIndex = featureData[sectionStep]?.length > 0 ? featureData.subfeatures.length : 0
      updateSubfeatureData({ type: 'index', value: subfeatureIndex })
      return setFeatureStep('subfeature')
    }
    // Add Section
    sectionDataReset()
    setSectionStep(sectionStep)
  }

  return !featureData || !system ? (
    <Loading />
  ) : (
    <>
      <Row className={feature_content_header}>
        <Input
          name={`value`}
          autoComplete='off'
          label={`${valueLabel} Name`}
          required={true}
          value={featureData?.value}
          errorMsg='Name must not be blank'
          onChange={updateFeatureData}
        />
        <Dropdown
          name={`category`}
          options={system.categories.filter((category) => category.features)}
          label='Feature Category'
          value={featureData?.category}
          onChange={updateFeatureData}
          required={true}
        />
        {featureData?.category === Categories.base && (
          <Select
            handleChange={selectSection as (arg: string) => void}
            placeholder='Add...'
            label={'Add Section'}
            options={sectionSteps}
          />
        )}
      </Row>
      <ScrollArea scrollDirection='vertical' className={form_content}>
        {featureData?.category === Categories.subclass && (
          <RichTextEditor
            label='Feature detail'
            value={featureData?.detail}
            name={`detail`}
            onChange={updateFeatureData}
            className={sprinkles({ mb: 'space-3' })}
          />
        )}
        <RichTextEditor
          label='Feature description'
          value={featureData?.desc}
          name={`desc`}
          onChange={updateFeatureData}
          className={sprinkles({ mb: 'space-3' })}
        />
        <Row className={sprinkles({ mb: 'space-3' })}>
          {context.title !== 'equipment' &&
            context.title !== 'backgrounds' &&
            !(steps[stepIndex].id === 'ancestry' && featureStep !== 'option') && (
              <Input
                name={`levelAvailable`}
                autoComplete='off'
                label='Level(s) Available'
                required={context.title === 'races' || featureStep === 'option' ? false : true}
                value={featureData?.levelAvailable}
                validation='num'
                errorMsg='Must contain whole numbers and commas only'
                onChange={updateFeatureData}
              />
            )}
          {(steps[stepIndex].id !== 'ancestry' || (steps[stepIndex].id === 'ancestry' && featureStep === 'option')) &&
            featureData?.category === Categories.feature && (
              <Dropdown
                multiSelect={true}
                name='attributes'
                options={system.attributes.filter(
                  (attribute) =>
                    attribute.features.includes(FeatureEnum.all) ||
                    (context.title === 'equipment' && attribute.features.includes(FeatureEnum.equipment)) ||
                    (featureData.__typename !== 'FeatureOption' &&
                      featureData.__typename !== 'Subfeature' &&
                      featureData?.options?.length > 0 &&
                      attribute.features.includes(FeatureEnum.options))
                )}
                label='Feature Attribute'
                value={featureData?.attributes}
                onChange={updateFeatureData}
              />
            )}
          {featureData?.attributes?.some((attribute) => attribute === Attributes.isAction) && (
            <>
              <Dropdown
                name='actions.primary.id'
                label='Action Type'
                value={featureData?.actions.primary.id}
                options={system.actions}
                required={true}
                onChange={updateFeatureData}
              />
            </>
          )}
        </Row>
        {featureData?.attributes?.some((attribute) => attribute === Attributes.hasRange) && (
          <>
            <Row className={sprinkles({ mb: 'space-3' })}>
              <Dropdown
                name='range.id'
                label='Range'
                value={featureData?.range?.id}
                options={system.spells.ranges}
                required={true}
                onChange={updateFeatureData}
              />
              {featureData?.range?.id !== Ranges.touch &&
                featureData.range?.id !== Ranges.sight &&
                featureData.range?.id !== Ranges.unlimited && (
                  <>
                    <Input
                      validation='num'
                      name='range.minRange'
                      errorMsg='Please enter a valid number greater than 0'
                      label='Min. Range'
                      autoComplete='off'
                      required={featureData.range?.id === Ranges.distance ? true : false}
                      value={featureData?.range?.minRange}
                      onChange={updateFeatureData}
                    />
                    <Input
                      validation='num'
                      name='range.maxRange'
                      errorMsg='Must contain only numbers'
                      label='Max Range'
                      autoComplete='off'
                      required={featureData.range?.id === Ranges.distance ? true : false}
                      value={featureData?.range?.maxRange}
                      onChange={updateFeatureData}
                    />
                    <Dropdown
                      name='range.unit'
                      label='UoM'
                      value={featureData?.range?.unit}
                      options={Object.values(system.rules.measurements.imperial).flatMap(
                        (rule) => Array.isArray(rule) && rule
                      )}
                      required={featureData.range?.id === Ranges.distance ? true : false}
                      onChange={updateFeatureData}
                    />
                  </>
                )}
              {featureData.attributes?.some((attribute) => attribute === Attributes.limitTargets) && (
                <Input
                  name='targets'
                  value={featureData?.targets}
                  label='No. of Targets'
                  validation='num'
                  errorMsg='Must contain only numbers'
                  onChange={updateFeatureData}
                  placeholder='1'
                />
              )}
            </Row>
            <Row>
              <Dropdown
                name='shape.id'
                label='Shape'
                options={system.spells.shapes}
                value={featureData?.shape?.id}
                onChange={updateFeatureData}
              />
              {featureData?.shape?.id !== Shapes.none && featureData.shape?.id !== Shapes.weapon && (
                <>
                  <Input
                    validation='cur'
                    name='shape.size'
                    errorMsg='Please enter a valid number (can inlude decimals)'
                    label='Shape Size'
                    autoComplete='off'
                    required={true}
                    value={featureData?.shape?.size}
                    onChange={updateFeatureData}
                  />
                  <Dropdown
                    name='shape.unit'
                    label='UoM'
                    value={featureData?.shape?.unit}
                    options={Object.values(system.rules.measurements.imperial).flatMap(
                      (rule) => Array.isArray(rule) && rule
                    )}
                    required={true}
                    onChange={updateFeatureData}
                  />
                </>
              )}
            </Row>
          </>
        )}
        {featureData?.attributes?.some((attribute) => attribute === Attributes.requiresSave) && (
          <Row className={sprinkles({ mb: 'space-3' })}>
            <Dropdown
              name='saveAbility.attributes'
              multiSelect={true}
              label='Save Attribute'
              value={featureData?.saveAbility?.attributes}
              options={system.attributes.filter((attribute) => attribute.features.includes(FeatureEnum.saveAbilities))}
              onChange={updateFeatureData}
            />
            <Dropdown
              name='saveAbility.id'
              label='DC Ability'
              value={featureData?.saveAbility.id}
              options={system.abilities}
              required={true}
              onChange={updateFeatureData}
            />
            {featureData?.saveAbility?.attributes?.some((attribute) => attribute === Attributes.addAbilityModifier) && (
              <Dropdown
                name='saveAbility.abilityModifier'
                label='Modifier Ability'
                value={featureData?.saveAbility?.abilityModifier}
                options={system.abilities}
                required={true}
                onChange={updateFeatureData}
              />
            )}
            <Input
              validation='num'
              name={`saveAbility.minAmount`}
              autoComplete='off'
              label='Base Value'
              required={context.title !== 'classes' && true}
              errorMsg='Must contain only numbers'
              value={featureData?.saveAbility?.minAmount}
              onChange={updateFeatureData}
            />
          </Row>
        )}
        <Requirements formData={featureData} updateFormData={updateFeatureData} />
        <LimitUse formData={featureData} updateFormData={updateFeatureData} />
        <Damage formData={featureData} updateFormData={updateFeatureData} />
        <div className={feature_list}>
          <SectionsList featureData={featureData} updateFeatureData={updateFeatureData} />
        </div>
      </ScrollArea>
    </>
  )
}

export default Base
