import Input from '@/components/Input'
import Dropdown from '@/components/Dropdown'
import RichTextEditor from '@/components/RichTextEditor'
import type { SectionName, OnChange, FeatureOption } from '@/types'
import Select from '@/components/Select'
import SectionsList from './Sections/SectionsList'
import Requirements from '../Substeps/Prerequisites'
import Damage from '../Substeps/Damage'
import LimitUse from '../Substeps/LimitUse'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { Categories, Ranges, Shapes, Features } from '@/enums'
import { FeatureContext } from './FeatureContext'
import { useEnumChecks, useSystemData } from '@/hooks'
import type { FeatureStore, OptionStore } from '@/store'
import Grid from '@/components/Grid'
import SelectOptionsByLevel from '../Substeps/SelectOptionsByLevel'

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

  const { updateField, removeField } = featureStore

  const { attributes, abilities, categories, spells, actions, rules } = useSystemData()

  function isFeatureStore(store: FeatureStore | OptionStore): store is FeatureStore {
    return store.data.__typename !== 'FeatureOption'
  }

  const selectSection = (sectionStep: SectionName | 'options') => {
    if (sectionStep === 'options' && featureStore.data.__typename !== 'FeatureOption' && isFeatureStore(featureStore)) {
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
            onChange={{ updateField: updateField as OnChange<typeof featureStore.data>['updateField'] }}
          />
        </Grid.Item>
        {featureStore.data.__typename !== 'AncestryFeature' && featureStore.data.__typename !== 'FeatureOption' && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name={'category'}
              options={categories.filter((category) => category.features)}
              label='Feature Category'
              value={featureStore.data?.category}
              required={true}
              onChange={{
                updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                removeField: removeField as OnChange<typeof featureStore.data>['removeField'],
              }}
            />
          </Grid.Item>
        )}
        {(featureStore.data?.category === Categories.FEATURE ||
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
        {featureStore.data?.category === Categories.SUBCLASS && (
          <Grid.Item>
            <RichTextEditor
              label='Feature detail'
              value={featureStore.data?.detail}
              name={`detail`}
              onChange={{
                updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
              }}
            />
          </Grid.Item>
        )}
        <Grid.Item>
          <RichTextEditor
            label='Feature description'
            value={featureStore.data?.desc}
            name={`desc`}
            onChange={{
              updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
            }}
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
                    onChange={{
                      updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                    }}
                  />
                </Grid.Item>
              )}
            {featureStore.data?.category !== Categories.SUBCLASS && (
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  multiSelect={true}
                  name='attributes'
                  options={attributes.filter(
                    (attribute) =>
                      (attribute?.features?.length &&
                        ((formStore.data.__typename === 'Equipment' &&
                          attribute?.features?.includes(Features.EQUIPMENT)) ||
                          ((featureStore.data.__typename === 'FeatureOption' ||
                            featureStore.data.__typename === 'AncestryFeature') &&
                            attribute?.features?.includes(Features.OPTION)))) ||
                      attribute?.features?.includes(Features.ALL)
                  )}
                  label='Feature Attribute'
                  value={featureStore.data?.attributes}
                  onChange={{
                    updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                    removeField: removeField as OnChange<typeof featureStore.data>['removeField'],
                  }}
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
                  onChange={{
                    updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                    removeField: removeField as OnChange<typeof featureStore.data>['removeField'],
                  }}
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
                  onChange={{
                    updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                    removeField: removeField as OnChange<typeof featureStore.data>['removeField'],
                  }}
                />
              </Grid.Item>
              {featureStore.data?.range?.id !== Ranges.TOUCH &&
                featureStore.data.range?.id !== Ranges.SIGHT &&
                featureStore.data.range?.id !== Ranges.UNLIMITED && (
                  <>
                    {featureStore.data?.range?.id !== Ranges.SELF && (
                      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                        <Input
                          validation='num'
                          name='range.minRange'
                          errorMsg='Please enter a valid number greater than 0'
                          label='Min. Range'
                          autoComplete='off'
                          required={featureStore.data?.range?.id === Ranges.DISTANCE || false}
                          value={featureStore.data?.range?.minRange}
                          onChange={{
                            updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                          }}
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
                        required={featureStore.data?.range?.id === Ranges.DISTANCE || false}
                        value={featureStore.data?.range?.maxRange}
                        onChange={{
                          updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                        }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='range.unit'
                        label='UoM'
                        value={featureStore.data?.range?.unit}
                        options={rules.measurements.imperial.length}
                        required={featureStore.data?.range?.id === Ranges.DISTANCE || false}
                        onChange={{
                          updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                          removeField: removeField as OnChange<typeof featureStore.data>['removeField'],
                        }}
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
                    placeholder='1'
                    onChange={{
                      updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                    }}
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
                  onChange={{
                    updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                    removeField: removeField as OnChange<typeof featureStore.data>['removeField'],
                  }}
                />
              </Grid.Item>
              {featureStore.data?.shape?.id !== Shapes.NONE &&
                featureStore.data.shape?.id !== Shapes.WEAPON &&
                featureStore.data.shape?.id !== Shapes.CONE && (
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
                        onChange={{
                          updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                        }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='shape.unit'
                        label='UoM'
                        value={featureStore.data?.shape?.unit}
                        options={rules.measurements.imperial.length}
                        required={true}
                        onChange={{
                          updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                          removeField: removeField as OnChange<typeof featureStore.data>['removeField'],
                        }}
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
                    (attribute) => attribute?.features?.length && attribute?.features?.includes(Features.SAVE_ABILITY)
                  )}
                  onChange={{
                    updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                    removeField: removeField as OnChange<typeof featureStore.data>['removeField'],
                  }}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='saveAbility.id'
                  label='DC Ability'
                  value={featureStore.data?.saveAbility?.id}
                  options={abilities}
                  required={true}
                  onChange={{
                    updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                    removeField: removeField as OnChange<typeof featureStore.data>['removeField'],
                  }}
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
                    onChange={{
                      updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                      removeField: removeField as OnChange<typeof featureStore.data>['removeField'],
                    }}
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
                  onChange={{
                    updateField: updateField as OnChange<typeof featureStore.data>['updateField'],
                  }}
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
