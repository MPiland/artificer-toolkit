import Input from '../../Input/Input'
import Dropdown from '../../Dropdown/Dropdown'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { SectionName } from '../../../types/form'
import Select from '../../Select/Select'
import SectionsList from './Sections/SectionsList'
import Requirements from '../Subforms/Prerequisites'
import Damage from '../Subforms/Damage'
import LimitUse from '../Subforms/LimitUse'
import { FeatureEnum, FeatureOption } from '../../../../amplify/gql/types'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { Categories, Ranges, Shapes } from '../../../types/enums'
import { FeatureContext } from './FeatureContext'
import { useEnumChecks } from '../../../hooks/useEnumChecks'
import Grid from '../../Grid/Grid'
import SelectOptionsByLevel from '../Subforms/SelectOptionsByLevel'
import useSystemData from '../../../hooks/useSystemData'
import { FeatureStore } from '../../../store/featureStore'
import { OptionStore } from '../../../store/optionStore'

const Base = ({ featureStore, valueLabel }: { featureStore: FeatureStore | OptionStore; valueLabel: string }) => {
  const { formStore, steps, stepIndex } = use(FormContext)

  const { sectionStore, optionStore, sectionSteps } = use(FeatureContext)

  const {
    hasPrerequisites,
    limitUse,
    doesDamage,
    hasRange,
    isAction,
    requiresSave,
    addAbilityModifier,
    limitTargets,
    selectCountByLevel,
  } = useEnumChecks({
    data: featureStore.data,
  })

  const { attributes, abilities, categories, spells, actions, rules } = useSystemData()

  const selectSection = (sectionStep: SectionName | 'options') => {
    if (sectionStep === 'options' && featureStore.data.__typename !== 'FeatureOption') {
      // Add Option content
      optionStore.reinitState()
      const optionIndex = featureStore.data?.options?.length || 0
      const newOption = {
        __typename: 'FeatureOption',
      } as FeatureOption
      optionStore.reinitState(newOption)
      optionStore.setIndex({ value: optionIndex })
      return featureStore.setStep('option')
    } else if (sectionStep !== 'options') {
      // Add Section
      sectionStore.reinitState()
      sectionStore.setIndex({ value: 0 })
      return sectionStore.setStep(sectionStep)
    }
  }

  const hasAnySections =
    sectionSteps.some((step) => {
      return featureStore.data[step]?.length
    }) ||
    (featureStore.data.__typename !== 'FeatureOption' && featureStore.data?.options?.length)

  return (
    <>
      <Grid>
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Input
            name='label'
            autoComplete='off'
            label={`${valueLabel} Name`}
            required={true}
            value={featureStore.data?.label}
            errorMsg='Name must not be blank'
            onChange={featureStore}
          />
        </Grid.Item>
        {featureStore.data.__typename !== 'AncestryFeature' && featureStore.data.__typename !== 'FeatureOption' && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name={`category`}
              options={categories.filter((category) => category.features)}
              label='Feature Category'
              value={featureStore.data?.category}
              onChange={featureStore}
              required={true}
            />
          </Grid.Item>
        )}
        {(featureStore.data?.category === Categories.feature ||
          featureStore.data.__typename === 'AncestryFeature' ||
          featureStore.data.__typename === 'FeatureOption') && (
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
        {featureStore.data?.category === Categories.subclass && (
          <Grid.Item>
            <RichTextEditor
              label='Feature detail'
              value={featureStore.data?.detail}
              name={`detail`}
              onChange={featureStore}
            />
          </Grid.Item>
        )}
        <Grid.Item>
          <RichTextEditor
            label='Feature description'
            value={featureStore.data?.desc}
            name={`desc`}
            onChange={featureStore}
          />
        </Grid.Item>
        <Grid.Item>
          <Grid>
            {formStore.data.__typename !== 'Equipment' &&
              formStore.data.__typename !== 'Background' &&
              !(steps[stepIndex].id === 'ancestry' && featureStore.data.__typename === 'FeatureOption') &&
              !selectCountByLevel && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name={`levelAvailable`}
                    autoComplete='off'
                    label='Level(s) Available'
                    required={
                      formStore.data.__typename === 'Race' || featureStore.data.__typename === 'FeatureOption' ?
                        false
                      : true
                    }
                    value={featureStore.data?.levelAvailable}
                    validation='num'
                    errorMsg='Must contain whole numbers and commas only'
                    onChange={featureStore}
                  />
                </Grid.Item>
              )}
            {featureStore.data?.category !== Categories.subclass && (
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  multiSelect={true}
                  name='attributes'
                  options={attributes.filter(
                    (attribute) =>
                      (attribute?.features?.length &&
                        ((formStore.data.__typename === 'Equipment' &&
                          attribute?.features?.includes(FeatureEnum.equipment)) ||
                          ((featureStore.data.__typename === 'FeatureOption' ||
                            featureStore.data.__typename === 'AncestryFeature') &&
                            attribute?.features?.includes(FeatureEnum.options)))) ||
                      attribute?.features?.includes(FeatureEnum.all)
                  )}
                  label='Feature Attribute'
                  value={featureStore.data?.attributes}
                  onChange={featureStore}
                />
              </Grid.Item>
            )}
            {isAction && (
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='actions.primary.id'
                  label='Action Type'
                  value={featureStore.data?.actions?.primary?.id}
                  options={actions}
                  required={true}
                  onChange={featureStore}
                />
              </Grid.Item>
            )}
          </Grid>
        </Grid.Item>
        {hasRange && (
          <Grid.Item>
            <Grid>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='range.id'
                  label='Range'
                  value={featureStore.data?.range?.id}
                  options={spells.ranges}
                  required={true}
                  onChange={featureStore}
                />
              </Grid.Item>
              {featureStore.data?.range?.id !== Ranges.touch &&
                featureStore.data.range?.id !== Ranges.sight &&
                featureStore.data.range?.id !== Ranges.unlimited && (
                  <>
                    {featureStore.data?.range?.id !== Ranges.self && (
                      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                        <Input
                          validation='num'
                          name='range.minRange'
                          errorMsg='Please enter a valid number greater than 0'
                          label='Min. Range'
                          autoComplete='off'
                          required={featureStore.data?.range?.id === Ranges.distance || false}
                          value={featureStore.data?.range?.minRange}
                          onChange={featureStore}
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
                        required={featureStore.data?.range?.id === Ranges.distance || false}
                        value={featureStore.data?.range?.maxRange}
                        onChange={featureStore}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='range.unit'
                        label='UoM'
                        value={featureStore.data?.range?.unit}
                        options={rules.measurements.imperial.length}
                        required={featureStore.data?.range?.id === Ranges.distance || false}
                        onChange={featureStore}
                      />
                    </Grid.Item>
                  </>
                )}
              {limitTargets && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='targets'
                    value={featureStore.data?.targets}
                    label='No. of Targets'
                    validation='num'
                    errorMsg='Must contain only numbers'
                    onChange={featureStore}
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
                  options={spells.shapes}
                  value={featureStore.data?.shape?.id}
                  required={true}
                  onChange={featureStore}
                />
              </Grid.Item>
              {featureStore.data?.shape?.id !== Shapes.none &&
                featureStore.data.shape?.id !== Shapes.weapon &&
                featureStore.data.shape?.id !== Shapes.cone && (
                  <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        validation='cur'
                        name='shape.size'
                        errorMsg='Please enter a valid number (can inlude decimals)'
                        label='Shape Size'
                        autoComplete='off'
                        required={true}
                        value={featureStore.data?.shape?.size}
                        onChange={featureStore}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='shape.unit'
                        label='UoM'
                        value={featureStore.data?.shape?.unit}
                        options={rules.measurements.imperial.length}
                        required={true}
                        onChange={featureStore}
                      />
                    </Grid.Item>
                  </>
                )}
            </Grid>
          </Grid.Item>
        )}
        {requiresSave && (
          <Grid.Item>
            <Grid>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='saveAbility.attributes'
                  multiSelect={true}
                  label='Save Attribute'
                  value={featureStore.data?.saveAbility?.attributes}
                  options={attributes.filter(
                    (attribute) =>
                      attribute?.features?.length && attribute?.features?.includes(FeatureEnum.saveAbilities)
                  )}
                  onChange={featureStore}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='saveAbility.id'
                  label='DC Ability'
                  value={featureStore.data?.saveAbility?.id}
                  options={abilities}
                  required={true}
                  onChange={featureStore}
                />
              </Grid.Item>
              {addAbilityModifier && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='saveAbility.abilityModifier'
                    label='Modifier Ability'
                    value={featureStore.data?.saveAbility?.abilityModifier}
                    options={abilities}
                    required={true}
                    onChange={featureStore}
                  />
                </Grid.Item>
              )}
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Input
                  validation='num'
                  name={`saveAbility.minAmount`}
                  autoComplete='off'
                  label='Base Value'
                  required={formStore.data.__typename !== 'Class' && true}
                  errorMsg='Must contain only numbers'
                  value={featureStore.data?.saveAbility?.minAmount}
                  onChange={featureStore}
                />
              </Grid.Item>
            </Grid>
          </Grid.Item>
        )}
        {hasPrerequisites && <Requirements formStore={featureStore} />}
        {limitUse && <LimitUse formStore={featureStore} />}
        {doesDamage && <Damage formStore={featureStore} />}
        {selectCountByLevel && <SelectOptionsByLevel />}
        {hasAnySections && <SectionsList featureStore={featureStore} />}
      </Grid>
    </>
  )
}

export default Base
