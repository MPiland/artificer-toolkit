import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import Input from '../../Input/Input'
import Dropdown from '../../Dropdown/Dropdown'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { FeatureDataType, SectionName, UpdateState } from '../../../types/form'
import Row from '../../Row/Row'
import Select from '../../Select/Select'
import { feature_list } from '../Form.css'
import { sprinkles } from '../../../css/sprinkles.css'
import SectionsList from './Sections/SectionsList'
import Requirements from '../Generic/Requirements'
import Damage from '../Generic/Damage'
import LimitUse from '../Generic/LimitUse'
import { FeatureEnum, FeatureOption } from '../../../../amplify/gql/types'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { Categories, Ranges, Shapes } from '../../../types/enums'
import { FeatureContext } from './FeatureContext'
import { useEnumChecks } from '../../../hooks/useEnumChecks'

const Base = ({
  featureData,
  updateFeatureData,
  valueLabel,
}: {
  featureData: FeatureDataType
  updateFeatureData: (arg: UpdateState<FeatureDataType>) => void
  valueLabel: string
}) => {
  const { formData, steps, stepIndex } = use(FormContext)

  const {
    setFeatureStep,
    resetOption,
    resetSection,
    setSectionStep,
    resetSubfeature,
    updateSectionData,
    updateOptionData,
    updateSubfeatureData,
    sectionSteps,
  } = use(FeatureContext)

  const { hasPrerequisites, limitUse, doesDamage, hasRange, isAction, requiresSave, addAbilityModifier, limitTargets } =
    useEnumChecks({
      data: featureData,
    })

  const { data: system } = useGetSystemQuery()

  const selectSection = (sectionStep: SectionName) => {
    if (
      sectionStep === 'options' &&
      featureData.__typename !== 'FeatureOption' &&
      featureData.__typename !== 'FeatureSubfeature'
    ) {
      // Add Option content
      resetOption()
      const optionIndex = featureData?.options?.length || 0
      const newOption: FeatureOption = {
        __typename: 'FeatureOption',
        id: '',
      }
      updateOptionData({ type: 'reset', value: newOption })
      updateOptionData({ type: 'initialReset', value: optionIndex })
      updateOptionData({ type: 'index', value: optionIndex })
      return setFeatureStep('option')
    }
    if (sectionStep === 'subfeatures' && featureData.__typename === 'FeatureOption') {
      // Add Subfeature content
      resetSubfeature()
      const subfeatureIndex = featureData.subfeatures?.length > 0 ? featureData.subfeatures.length : 0
      updateSubfeatureData({ type: 'index', value: subfeatureIndex })
      return setFeatureStep('subfeature')
    }
    if (sectionStep === 'ancestries' && featureData.__typename !== 'AncestryFeature') {
      updateSectionData({ type: 'index', value: featureData[sectionStep]?.length })
    } else {
      updateSectionData({ type: 'index', value: 0 })
    }
    // Add Section
    resetSection()
    setSectionStep(sectionStep)
  }

  const hasAnySections = sectionSteps.some((step) => {
    if (step === 'ancestries') return featureData.__typename !== 'AncestryFeature' && featureData[step]?.length > 0

    if (step === 'options') {
      return (
        featureData.__typename !== 'FeatureOption' &&
        featureData.__typename !== 'FeatureSubfeature' &&
        featureData[step]?.length > 0
      )
    }

    if (step === 'subfeatures') {
      return featureData.__typename === 'FeatureOption' && featureData[step]?.length > 0
    }

    return featureData[step]?.length > 0
  })

  console.log({ featureData })

  return (
    <>
      <Row>
        <Input
          name='label'
          autoComplete='off'
          label={`${valueLabel} Name`}
          required={true}
          value={featureData?.label}
          errorMsg='Name must not be blank'
          onChange={updateFeatureData}
        />
        {featureData.__typename !== 'AncestryFeature' && featureData.__typename !== 'FeatureOption' && (
          <Dropdown
            name={`category`}
            options={system.categories.filter((category) => category.features)}
            label='Feature Category'
            value={featureData?.category}
            onChange={updateFeatureData}
            required={true}
          />
        )}
        {(featureData?.category === Categories.feature ||
          featureData.__typename === 'AncestryFeature' ||
          featureData.__typename === 'FeatureOption') && (
          <Select
            name='section'
            handleChange={selectSection}
            placeholder='Add...'
            label={'Add Section'}
            options={sectionSteps}
          />
        )}
      </Row>
      <>
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
          {formData.__typename !== 'Equipment' &&
            formData.__typename !== 'Background' &&
            !(steps[stepIndex].id === 'ancestry' && featureData.__typename === 'FeatureOption') && (
              <Input
                name={`levelAvailable`}
                autoComplete='off'
                label='Level(s) Available'
                required={formData.__typename === 'Race' || featureData.__typename === 'FeatureOption' ? false : true}
                value={featureData?.levelAvailable}
                validation='num'
                errorMsg='Must contain whole numbers and commas only'
                onChange={updateFeatureData}
              />
            )}
          {(featureData?.category === Categories.feature || featureData.__typename === 'AncestryFeature') && (
            <Dropdown
              multiSelect={true}
              name='attributes'
              options={system.attributes.filter(
                (attribute) =>
                  attribute?.features?.length > 0 &&
                  ((formData.__typename === 'Equipment' && attribute?.features?.includes(FeatureEnum.equipment)) ||
                    ((featureData.__typename === 'FeatureOption' || featureData.__typename === 'AncestryFeature') &&
                      attribute?.features?.includes(FeatureEnum.options))) &&
                  attribute?.features?.includes(FeatureEnum.all)
              )}
              label='Feature Attribute'
              value={featureData?.attributes}
              onChange={updateFeatureData}
            />
          )}
          {isAction && (
            <>
              <Dropdown
                name='actions.primary.id'
                label='Action Type'
                value={featureData?.actions?.primary.id}
                options={system.actions}
                required={true}
                onChange={updateFeatureData}
              />
            </>
          )}
        </Row>
        {hasRange && (
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
                    {featureData?.range?.id !== Ranges.self && (
                      <Input
                        validation='num'
                        name='range.minRange'
                        errorMsg='Please enter a valid number greater than 0'
                        label='Min. Range'
                        autoComplete='off'
                        required={featureData?.range?.id === Ranges.distance || false}
                        value={featureData?.range?.minRange}
                        onChange={updateFeatureData}
                      />
                    )}
                    <Input
                      validation='num'
                      name='range.maxRange'
                      errorMsg='Must contain only numbers'
                      label='Max Range'
                      autoComplete='off'
                      required={featureData?.range?.id === Ranges.distance || false}
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
                      required={featureData?.range?.id === Ranges.distance || false}
                      onChange={updateFeatureData}
                    />
                  </>
                )}
              {limitTargets && (
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
                required={true}
                onChange={updateFeatureData}
              />
              {featureData?.shape?.id !== Shapes.none &&
                featureData.shape?.id !== Shapes.weapon &&
                featureData.shape?.id !== Shapes.cone && (
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
                      options={system.rules.measurements.imperial.length}
                      required={true}
                      onChange={updateFeatureData}
                    />
                  </>
                )}
            </Row>
          </>
        )}
        {requiresSave && (
          <Row className={sprinkles({ mb: 'space-3' })}>
            <Dropdown
              name='saveAbility.attributes'
              multiSelect={true}
              label='Save Attribute'
              value={featureData?.saveAbility?.attributes}
              options={system.attributes.filter(
                (attribute) =>
                  attribute?.features?.length > 0 && attribute?.features?.includes(FeatureEnum.saveAbilities)
              )}
              onChange={updateFeatureData}
            />
            <Dropdown
              name='saveAbility.id'
              label='DC Ability'
              value={featureData?.saveAbility?.id}
              options={system.abilities}
              required={true}
              onChange={updateFeatureData}
            />
            {addAbilityModifier && (
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
              required={formData.__typename !== 'Class' && true}
              errorMsg='Must contain only numbers'
              value={featureData?.saveAbility?.minAmount}
              onChange={updateFeatureData}
            />
          </Row>
        )}
        {hasPrerequisites && <Requirements formData={featureData} updateFormData={updateFeatureData} />}
        {limitUse && <LimitUse formData={featureData} updateFormData={updateFeatureData} />}
        {doesDamage && <Damage formData={featureData} updateFormData={updateFeatureData} />}
        {hasAnySections && (
          <div className={feature_list}>
            <SectionsList featureData={featureData} updateFeatureData={updateFeatureData} />
          </div>
        )}
      </>
    </>
  )
}

export default Base
