import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import Input from '../../Input/Input'
import Dropdown from '../../Dropdown/Dropdown'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { FeatureDataType, SectionName, UpdateState } from '../../../types/form'
import Select from '../../Select/Select'
import { feature_list } from '../Form.css'
import SectionsList from './Sections/SectionsList'
import Requirements from '../Subforms/Requirements'
import Damage from '../Subforms/Damage'
import LimitUse from '../Subforms/LimitUse'
import { FeatureEnum, FeatureOption } from '../../../../amplify/gql/types'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { Categories, Ranges, Shapes } from '../../../types/enums'
import { FeatureContext } from './FeatureContext'
import { useEnumChecks } from '../../../hooks/useEnumChecks'
import Grid from '../../Grid/Grid'

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
      // Add Section
      resetSection()
      updateSectionData({ type: 'index', value: 0 })
      setSectionStep(sectionStep)
    }
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
    <Grid>
      <Grid.Item colSpan={12}>
        <Grid>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Input
              name='label'
              autoComplete='off'
              label={`${valueLabel} Name`}
              required={true}
              value={featureData?.label}
              errorMsg='Name must not be blank'
              onChange={updateFeatureData}
            />
          </Grid.Item>
          {featureData.__typename !== 'AncestryFeature' && featureData.__typename !== 'FeatureOption' && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name={`category`}
                options={system.categories.filter((category) => category.features)}
                label='Feature Category'
                value={featureData?.category}
                onChange={updateFeatureData}
                required={true}
              />
            </Grid.Item>
          )}
          {(featureData?.category === Categories.feature ||
            featureData.__typename === 'AncestryFeature' ||
            featureData.__typename === 'FeatureOption') && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Select
                name='section'
                handleChange={selectSection}
                placeholder='Add...'
                label={'Add Section'}
                options={sectionSteps}
              />
            </Grid.Item>
          )}
        </Grid>
      </Grid.Item>
      <>
        {featureData?.category === Categories.subclass && (
          <Grid.Item colSpan={12}>
            <RichTextEditor
              label='Feature detail'
              value={featureData?.detail}
              name={`detail`}
              onChange={updateFeatureData}
            />
          </Grid.Item>
        )}
        <Grid.Item colSpan={12}>
          <RichTextEditor
            label='Feature description'
            value={featureData?.desc}
            name={`desc`}
            onChange={updateFeatureData}
          />
        </Grid.Item>
        <Grid.Item colSpan={12}>
          <Grid>
            {formData.__typename !== 'Equipment' &&
              formData.__typename !== 'Background' &&
              !(steps[stepIndex].id === 'ancestry' && featureData.__typename === 'FeatureOption') && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name={`levelAvailable`}
                    autoComplete='off'
                    label='Level(s) Available'
                    required={
                      formData.__typename === 'Race' || featureData.__typename === 'FeatureOption' ? false : true
                    }
                    value={featureData?.levelAvailable}
                    validation='num'
                    errorMsg='Must contain whole numbers and commas only'
                    onChange={updateFeatureData}
                  />
                </Grid.Item>
              )}
            {(featureData?.category === Categories.feature || featureData.__typename === 'AncestryFeature') && (
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  multiSelect={true}
                  name='attributes'
                  options={system.attributes.filter(
                    (attribute) =>
                      (attribute?.features?.length > 0 &&
                        ((formData.__typename === 'Equipment' &&
                          attribute?.features?.includes(FeatureEnum.equipment)) ||
                          ((featureData.__typename === 'FeatureOption' ||
                            featureData.__typename === 'AncestryFeature') &&
                            attribute?.features?.includes(FeatureEnum.options)))) ||
                      attribute?.features?.includes(FeatureEnum.all)
                  )}
                  label='Feature Attribute'
                  value={featureData?.attributes}
                  onChange={updateFeatureData}
                />
              </Grid.Item>
            )}
            {isAction && (
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='actions.primary.id'
                  label='Action Type'
                  value={featureData?.actions?.primary.id}
                  options={system.actions}
                  required={true}
                  onChange={updateFeatureData}
                />
              </Grid.Item>
            )}
          </Grid>
        </Grid.Item>
        {hasRange && (
          <Grid.Item colSpan={12}>
            <Grid>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='range.id'
                  label='Range'
                  value={featureData?.range?.id}
                  options={system.spells.ranges}
                  required={true}
                  onChange={updateFeatureData}
                />
              </Grid.Item>
              {featureData?.range?.id !== Ranges.touch &&
                featureData.range?.id !== Ranges.sight &&
                featureData.range?.id !== Ranges.unlimited && (
                  <>
                    {featureData?.range?.id !== Ranges.self && (
                      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                      </Grid.Item>
                    )}
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                    </Grid.Item>
                  </>
                )}
              {limitTargets && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='targets'
                    value={featureData?.targets}
                    label='No. of Targets'
                    validation='num'
                    errorMsg='Must contain only numbers'
                    onChange={updateFeatureData}
                    placeholder='1'
                  />
                </Grid.Item>
              )}
            </Grid>
            <Grid>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='shape.id'
                  label='Shape'
                  options={system.spells.shapes}
                  value={featureData?.shape?.id}
                  required={true}
                  onChange={updateFeatureData}
                />
              </Grid.Item>
              {featureData?.shape?.id !== Shapes.none &&
                featureData.shape?.id !== Shapes.weapon &&
                featureData.shape?.id !== Shapes.cone && (
                  <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='shape.unit'
                        label='UoM'
                        value={featureData?.shape?.unit}
                        options={system.rules.measurements.imperial.length}
                        required={true}
                        onChange={updateFeatureData}
                      />
                    </Grid.Item>
                  </>
                )}
            </Grid>
          </Grid.Item>
        )}
        {requiresSave && (
          <Grid.Item colSpan={12}>
            <Grid>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='saveAbility.id'
                  label='DC Ability'
                  value={featureData?.saveAbility?.id}
                  options={system.abilities}
                  required={true}
                  onChange={updateFeatureData}
                />
              </Grid.Item>
              {addAbilityModifier && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='saveAbility.abilityModifier'
                    label='Modifier Ability'
                    value={featureData?.saveAbility?.abilityModifier}
                    options={system.abilities}
                    required={true}
                    onChange={updateFeatureData}
                  />
                </Grid.Item>
              )}
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
              </Grid.Item>
            </Grid>
          </Grid.Item>
        )}
        {hasPrerequisites && (
          <Grid.Item colSpan={12}>
            <Requirements formData={featureData} updateFormData={updateFeatureData} />
          </Grid.Item>
        )}
        {limitUse && (
          <Grid.Item colSpan={12}>
            <LimitUse formData={featureData} updateFormData={updateFeatureData} />
          </Grid.Item>
        )}
        {doesDamage && (
          <Grid.Item colSpan={12}>
            <Damage formData={featureData} updateFormData={updateFeatureData} />
          </Grid.Item>
        )}
        {hasAnySections && (
          <Grid.Item colSpan={12} className={feature_list}>
            <SectionsList featureData={featureData} updateFeatureData={updateFeatureData} />
          </Grid.Item>
        )}
      </>
    </Grid>
  )
}

export default Base
