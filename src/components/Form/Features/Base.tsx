import Input from '@/components/Input'
import Dropdown from '@/components/Dropdown'
import RichTextEditor from '@/components/RichTextEditor'
import type { SectionName, OnChange, FeatureOption } from '@/types'
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
import OptionsByLevel from '../Substeps/OptionsByLevel'
import { Grid } from '@mantine/core'
import Button from '@/components/Button'
import { ModalContext } from '@/components/Modal'
import Collapsible from '@/components/Collapsible'

const Base = ({ featureStore, valueLabel }: { featureStore: FeatureStore | OptionStore; valueLabel: string }) => {
  const { formStore, steps, stepIndex } = use(FormContext)

  const { sectionStore, optionStore, sectionSteps } = use(FeatureContext)

  const { showModal } = use(ModalContext)

  const { updateField, removeField, data } = featureStore

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
    replaceAtLevel,
  } = useEnumChecks({
    data,
  })

  useEffect(() => {
    if (selectCountByLevel && !data.selectCountByLevel.length) {
      updateField({ path: 'selectCountByLevel' })
    }
    if (!selectCountByLevel && data.selectCountByLevel.length) {
      remomoveField({ path: 'selectCountByLevel' })
    }
  })

  const { attributes, abilities, categories, spells, actions, rules } = useSystemData()

  function isFeatureStore(store: FeatureStore | OptionStore): store is FeatureStore {
    return store.data.__typename !== 'FeatureOption'
  }

  const selectSection = (sectionStep: SectionName | 'options') => {
    if (sectionStep === 'options' && data.__typename !== 'FeatureOption' && isFeatureStore(featureStore)) {
      // Add Option content
      optionStore.reinitState()
      const optionIndex = data?.options?.length || 0
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
      return data[step]?.length
    }) ||
    (data.__typename !== 'FeatureOption' && data?.options?.length)

  return (
    <>
      <Grid>
        <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
          <Input
            name='label'
            autoComplete='off'
            label={`${valueLabel} Name`}
            required={true}
            value={data?.label}
            errorMsg='Name must not be blank'
            onChange={{ updateField: updateField as OnChange<typeof data>['updateField'] }}
          />
        </Grid.Col>
        {data.__typename !== 'AncestryFeature' && data.__typename !== 'FeatureOption' && (
          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name={'category'}
              options={categories.filter((category) => category.features)}
              label='Feature Category'
              value={data?.category}
              required={true}
              onChange={{
                updateField: updateField as OnChange<typeof data>['updateField'],
                removeField: removeField as OnChange<typeof data>['removeField'],
              }}
            />
          </Grid.Col>
        )}
        {(data?.category === Categories.FEATURE ||
          data.__typename === 'AncestryFeature' ||
          data.__typename === 'FeatureOption') && (
          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
            <Button
              onClick={() =>
                showModal({
                  type: 'addSection',
                  props: {
                    onAddSection: selectSection,
                    featureData: data,
                  },
                })
              }
            >
              Add Section
            </Button>
          </Grid.Col>
        )}
        {data?.category === Categories.SUBCLASS && (
          <Grid.Col>
            <RichTextEditor
              label='Feature detail'
              value={data?.detail}
              name={`detail`}
              onChange={{
                updateField: updateField as OnChange<typeof data>['updateField'],
              }}
            />
          </Grid.Col>
        )}
        <Grid.Col>
          <RichTextEditor
            label='Feature description'
            value={data?.desc}
            name={`desc`}
            onChange={{
              updateField: updateField as OnChange<typeof data>['updateField'],
            }}
          />
        </Grid.Col>
        <Grid.Col>
          <Grid>
            {formStore.data.__typename !== 'Equipment' &&
              formStore.data.__typename !== 'Background' &&
              !(steps[stepIndex].id === 'ancestry' && data.__typename === 'FeatureOption') &&
              !selectCountByLevel && (
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name={`levelAvailable`}
                    autoComplete='off'
                    label='Level(s) Available'
                    required={
                      formStore.data.__typename === 'Race' || data.__typename === 'FeatureOption' ? false : true
                    }
                    value={data?.levelAvailable}
                    validation='num'
                    errorMsg='Must contain whole numbers and commas only'
                    onChange={{
                      updateField: updateField as OnChange<typeof data>['updateField'],
                    }}
                  />
                </Grid.Col>
              )}
            {data?.category !== Categories.SUBCLASS && (
              <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  multiSelect={true}
                  name='attributes'
                  options={attributes.filter(
                    (attribute) =>
                      (attribute?.features?.length &&
                        ((formStore.data.__typename === 'Equipment' &&
                          attribute?.features?.includes(Features.EQUIPMENT)) ||
                          ((data.__typename === 'FeatureOption' || data.__typename === 'AncestryFeature') &&
                            attribute?.features?.includes(Features.OPTION)))) ||
                      attribute?.features?.includes(Features.ALL)
                  )}
                  label='Feature Attribute'
                  value={data?.attributes}
                  onChange={{
                    updateField: updateField as OnChange<typeof data>['updateField'],
                    removeField: removeField as OnChange<typeof data>['removeField'],
                  }}
                />
              </Grid.Col>
            )}
            {isAction && (
              <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='actions.primary.id'
                  label='Action Type'
                  value={data?.actions?.primary?.id}
                  options={actions}
                  required={true}
                  onChange={{
                    updateField: updateField as OnChange<typeof data>['updateField'],
                    removeField: removeField as OnChange<typeof data>['removeField'],
                  }}
                />
              </Grid.Col>
            )}
          </Grid>
        </Grid.Col>
        {hasRange && (
          <Grid.Col>
            <Grid>
              <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='range.id'
                  label='Range'
                  value={data?.range?.id}
                  options={spells.ranges}
                  required={true}
                  onChange={{
                    updateField: updateField as OnChange<typeof data>['updateField'],
                    removeField: removeField as OnChange<typeof data>['removeField'],
                  }}
                />
              </Grid.Col>
              {data?.range?.id !== Ranges.TOUCH &&
                data.range?.id !== Ranges.SIGHT &&
                data.range?.id !== Ranges.UNLIMITED && (
                  <>
                    {data?.range?.id !== Ranges.SELF && (
                      <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                        <Input
                          validation='num'
                          name='range.minRange'
                          errorMsg='Please enter a valid number greater than 0'
                          label='Min. Range'
                          autoComplete='off'
                          required={data?.range?.id === Ranges.DISTANCE || false}
                          value={data?.range?.minRange}
                          onChange={{
                            updateField: updateField as OnChange<typeof data>['updateField'],
                          }}
                        />
                      </Grid.Col>
                    )}
                    <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        validation='num'
                        name='range.maxRange'
                        errorMsg='Must contain only numbers'
                        label='Max Range'
                        autoComplete='off'
                        required={data?.range?.id === Ranges.DISTANCE || false}
                        value={data?.range?.maxRange}
                        onChange={{
                          updateField: updateField as OnChange<typeof data>['updateField'],
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='range.unit'
                        label='UoM'
                        value={data?.range?.unit}
                        options={rules.measurements.imperial.length}
                        required={data?.range?.id === Ranges.DISTANCE || false}
                        onChange={{
                          updateField: updateField as OnChange<typeof data>['updateField'],
                          removeField: removeField as OnChange<typeof data>['removeField'],
                        }}
                      />
                    </Grid.Col>
                  </>
                )}
              {limitTargets && (
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='targets'
                    value={data?.targets}
                    label='No. of Targets'
                    validation='num'
                    errorMsg='Must contain only numbers'
                    placeholder='1'
                    onChange={{
                      updateField: updateField as OnChange<typeof data>['updateField'],
                    }}
                  />
                </Grid.Col>
              )}
            </Grid>
            <Grid>
              <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='shape.id'
                  label='Shape'
                  options={spells.shapes}
                  value={data?.shape?.id}
                  required={true}
                  onChange={{
                    updateField: updateField as OnChange<typeof data>['updateField'],
                    removeField: removeField as OnChange<typeof data>['removeField'],
                  }}
                />
              </Grid.Col>
              {data?.shape?.id !== Shapes.NONE &&
                data.shape?.id !== Shapes.WEAPON &&
                data.shape?.id !== Shapes.CONE && (
                  <>
                    <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        validation='cur'
                        name='shape.size'
                        errorMsg='Please enter a valid number (can inlude decimals)'
                        label='Shape Size'
                        autoComplete='off'
                        required={true}
                        value={data?.shape?.size}
                        onChange={{
                          updateField: updateField as OnChange<typeof data>['updateField'],
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='shape.unit'
                        label='UoM'
                        value={data?.shape?.unit}
                        options={rules.measurements.imperial.length}
                        required={true}
                        onChange={{
                          updateField: updateField as OnChange<typeof data>['updateField'],
                          removeField: removeField as OnChange<typeof data>['removeField'],
                        }}
                      />
                    </Grid.Col>
                  </>
                )}
            </Grid>
          </Grid.Col>
        )}
        {requiresSave && (
          <Grid.Col>
            <Grid>
              <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='saveAbility.attributes'
                  multiSelect={true}
                  label='Save Attribute'
                  value={data?.saveAbility?.attributes}
                  options={attributes.filter(
                    (attribute) => attribute?.features?.length && attribute?.features?.includes(Features.SAVE_ABILITY)
                  )}
                  onChange={{
                    updateField: updateField as OnChange<typeof data>['updateField'],
                    removeField: removeField as OnChange<typeof data>['removeField'],
                  }}
                />
              </Grid.Col>
              <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='saveAbility.id'
                  label='DC Ability'
                  value={data?.saveAbility?.id}
                  options={abilities}
                  required={true}
                  onChange={{
                    updateField: updateField as OnChange<typeof data>['updateField'],
                    removeField: removeField as OnChange<typeof data>['removeField'],
                  }}
                />
              </Grid.Col>
              {addAbilityModifier && (
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='saveAbility.abilityModifier'
                    label='Modifier Ability'
                    value={data?.saveAbility?.abilityModifier}
                    options={abilities}
                    required={true}
                    onChange={{
                      updateField: updateField as OnChange<typeof data>['updateField'],
                      removeField: removeField as OnChange<typeof data>['removeField'],
                    }}
                  />
                </Grid.Col>
              )}
              <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                <Input
                  validation='num'
                  name={`saveAbility.minAmount`}
                  autoComplete='off'
                  label='Base Value'
                  required={formStore.data.__typename !== 'Class' && true}
                  errorMsg='Must contain only numbers'
                  value={data?.saveAbility?.minAmount}
                  onChange={{
                    updateField: updateField as OnChange<typeof data>['updateField'],
                  }}
                />
              </Grid.Col>
            </Grid>
          </Grid.Col>
        )}
        {hasPrerequisites && <Requirements formStore={featureStore} />}
        {limitUse && <LimitUse formStore={featureStore} />}
        {doesDamage && <Damage formStore={featureStore} />}
        {selectCountByLevel && (
          <Grid.Col>
            <Collapsible>
              <Collapsible.Trigger title='Select Options By Level' />
              <Collapsible.Content>
                <Grid>
                  <Grid.Col>
                    <Grid>
                      <Grid.Col>Level</Grid.Col>
                      <Grid.Col>Count</Grid.Col>
                      {replaceAtLevel && <Grid.Col>Replace Count</Grid.Col>}
                    </Grid>
                  </Grid.Col>
                  <AppField name='optionsByLevel' mode='array'>
                    {(field) => field.state.value?.map((, i) => <OptionsByLevel field={`optionsByLevel[${i}]`}/>)}
                  </AppField>
                </Grid>
              </Collapsible.Content>
            </Collapsible>
          </Grid.Col>
        )}
        {hasAnySections && <SectionsList featureStore={featureStore} />}
      </Grid>
    </>
  )
}

export default Base
