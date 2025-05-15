import { useMemo, use } from 'react'
import parse from 'html-react-parser'
import Button from '@/components/Button'
import { feature_description } from '../Form.css'
import Accordion from '@/components/Accordion'
import { get, startCase } from 'lodash'
import { sprinkles } from '@/css/sprinkles.css'
import { Outlet } from '@tanstack/react-router'
import { FormContext } from '../FormContext'
import { FeatureContext } from './FeatureContext'
import { ModalContext } from '@/components/Modal'
import { useBackgroundData, useFeatData, useEquipmentData, useClassData, useRaceData } from '@/hooks'
import type { FormStore } from '@/store'
import type { FormDataType, Step, Feature } from '@/types'
import { Group, Grid } from '@mantine/core'

const FeaturesList = () => {
  const { formStore, stepIndex, steps } = use(FormContext) as {
    formStore: FormStore<FormDataType>
    stepIndex: number
    steps: Step[]
  }
  const { featureStore, sectionSteps } = use(FeatureContext)
  const { showModal } = use(ModalContext)

  const { races, metaData: raceMetaData } = useRaceData()
  const { classes, metaData: classMetaData } = useClassData()
  const { equipment, metaData: EquipmentMeta } = useEquipmentData()
  const { backgrounds, metaData: backgroundMetaData } = useBackgroundData()
  const { feats, metaData: featMetaData } = useFeatData()

  const arrayName = useMemo(() => (formStore.data.__typename === 'Feat' ? '' : 'features'), [formStore.data])

  const featureArray = useMemo(() => get(formStore.data, arrayName) ?? [], [arrayName, formStore.data]) as Feature[]
  // Add feature
  const handleAddFeature = () => {
    featureStore.setIndex({ value: featureArray?.length || 0 })
    featureStore.reinitState()
    featureStore.setStep('feature')
  }

  // Delete feature
  const handleRemoveFeature = (index: number) => {
    if (formStore.data.__typename !== 'Feat') {
      formStore.removeField<FormDataType>({ path: `features.${index}` })
    }
  }

  // Edit feature
  const handleEditFeature = (index: number) => {
    featureStore.setIndex({ value: index })
    featureStore.reinitState(featureArray[index] as Feature)
    featureStore.setStep('feature')
  }

  const onCopyConfirm = (selectedFeature: Feature) => {
    if (formStore.data.__typename !== 'Spell' && formStore.data.__typename !== 'Character') {
      const index = formStore.data.features?.length ?? 0
      formStore.updateField<FormDataType>({ path: `features.${index}`, value: selectedFeature })
      featureStore.setIndex({ value: index })
      featureStore.reinitState(selectedFeature)
      featureStore.setStep('feature')
    }
  }

  // Copy feature
  const handleCopyFeature = () => {
    showModal({
      type: 'copy',
      props: {
        form: 'feature',
        data: {
          ...raceMetaData.features.map((feature) => ({ ...feature, value: feature.label })),
          ...classMetaData.features.map((feature) => ({ ...feature, value: feature.label })),
          ...featMetaData.features.map((feature) => ({ ...feature, value: feature.label })),
          ...EquipmentMeta.features.map((feature) => ({ ...feature, value: feature?.label })).filter(Boolean),
          ...backgroundMetaData.features.map((feature) => ({ ...feature, value: feature.label })),
        },
        filters: {
          races: races,
          classes: classes,
          equipment: equipment,
          backgrounds: backgrounds,
          feats: feats,
        },
        onCopy: onCopyConfirm,
      },
    })
  }

  return (
    <>
      <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
        <Button
          color='primary'
          style='outline'
          width='size-full'
          onClick={handleAddFeature}
          className={sprinkles({ me: 'space-4' })}
        >
          Add Feature
        </Button>
      </Grid.Col>
      {steps[stepIndex].id === 'features' && (
        <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
          <Button color='primary' style='outline' width='size-full' onClick={handleCopyFeature}>
            Copy Feature
          </Button>
        </Grid.Col>
      )}
      {featureArray.length > 0 && (
        <Grid.Col>
          <Accordion<typeof formStore.data> dataArray={featureArray} updateFn={formStore} name='features'>
            {featureArray?.map((feature, index) => (
              <Accordion.Item key={index} itemId={String(index)} value={feature.label!}>
                <Accordion.Trigger removeFn={() => handleRemoveFeature(index)} editFn={() => handleEditFeature(index)}>
                  {feature.label != null && feature.label !== '' ? feature.label : `feature ${index + 1}`}
                  <Group justify='flex-start' wrap='nowrap'>
                    {sectionSteps.map((sectionStep, sectionIndex) => {
                      return (
                        <span key={sectionIndex} className={sprinkles({ me: 'space-2' })}>
                          {feature[sectionStep] && feature[sectionStep]?.length ?
                            <strong>
                              {startCase(sectionStep.charAt(0))}: {feature[sectionStep]?.length}
                            </strong>
                          : `${startCase(sectionStep.charAt(0))}: 0`}
                        </span>
                      )
                    })}
                  </Group>
                </Accordion.Trigger>
                {feature.desc && (
                  <Accordion.Content>
                    <div className={feature_description}>
                      <div>
                        {feature?.desc && parse(feature.desc)}
                        {feature.options &&
                          feature.options?.length > 0 &&
                          feature.options?.map((option: any, index: number) => (
                            <div key={index}>
                              {option?.value && <strong>{option.value}</strong>}
                              {option?.desc && parse(option.desc)}
                            </div>
                          ))}
                      </div>
                    </div>
                  </Accordion.Content>
                )}
              </Accordion.Item>
            ))}
          </Accordion>
        </Grid.Col>
      )}
      <Outlet />
    </>
  )
}

export default FeaturesList
