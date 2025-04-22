import { useMemo, use } from 'react'
import parse from 'html-react-parser'
import Button from '../../Button/Button'
import { feature_description } from '../Form.css'
import Accordion from '../../Accordion/Accordion'
import Group from '../../Group/Group'
import { get, startCase } from 'lodash'
import { sprinkles } from '../../../css/sprinkles.css'
import { Outlet } from '@tanstack/react-router'
import { FormContext } from '../FormContext'
import { FeatureContext } from './FeatureContext'
import Grid from '../../Grid/Grid'
import { ModalContext } from '../../Modal/ModalContext'
import { Feature } from '../../../../amplify/gql/types'
import useRaceData from '../../../hooks/useRaceData'
import useClassData from '../../../hooks/useClassData'
import useEquipmentData from '../../../hooks/useEquipmentData'
import useFeatData from '../../../hooks/useFeatData'
import useBackgroundData from '../../../hooks/useBackgroundData'
import type { FormStore } from '../../../store/formStore'
import type { FormDataType, Step } from '../../../types/form'

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
  const { equipment, metaData: equipmentMetaData } = useEquipmentData()
  const { metaData: backgroundMetaData } = useBackgroundData()
  const { metaData: featMetaData } = useFeatData()

  const arrayName = useMemo(() => (formStore.data.__typename === 'Feat' ? '' : 'features'), [formStore.data])

  const featureArray = useMemo(() => get(formStore.data, arrayName) ?? [], [arrayName, formStore.data])

  const createFeatures = (): Feature[] => {
    const racesFeatures = raceMetaData.features.map(
      (feature) =>
        ({
          id: feature.id,
          label: feature.label,
          value: feature.id,
        }) as Feature
    )
    const classesFeatures = classMetaData.features.map(
      (feature) =>
        ({
          id: feature.id,
          label: feature.label,
          value: feature.id,
        }) as Feature
    )
    const equipmentFeatures = equipmentMetaData.features.map(
      (feature) =>
        ({
          id: feature.id,
          label: feature.label,
          value: feature.id,
        }) as Feature
    )
    const backgroundFeatures = backgroundMetaData.features.map(
      (feature) =>
        ({
          id: feature.id,
          label: feature.label,
          value: feature.id,
        }) as Feature
    )
    const featFeatures = featMetaData.features.map(
      (feature) =>
        ({
          id: feature.id,
          label: feature.label,
          value: feature.id,
        }) as Feature
    )

    return { ...racesFeatures, ...classesFeatures, ...equipmentFeatures, ...backgroundFeatures, ...featFeatures }
  }

  const features = createFeatures()

  // Add feature
  const handleAddFeature = () => {
    featureStore.setIndex({ value: featureArray?.length || 0 })
    featureStore.reinitState()
    featureStore.setStep('feature')
  }

  // Delete feature
  const handleRemoveFeature = (featureIndex: number) => {
    if (formStore.data.__typename !== 'Feat') {
      formStore.removeField<FormDataType>({ path: `features.${featureIndex}` })
    }
  }

  // Edit feature
  const handleEditFeature = (featureIndex: number) => {
    featureStore.setIndex({ value: featureIndex })
    featureStore.reinitState(featureArray[featureIndex] as Feature)
    featureStore.setStep('feature')
  }

  const onCopyConfirm = (selectedFeature: Feature) => {
    if (formStore.data.__typename !== 'Spell' && formStore.data.__typename !== 'Character') {
      const featureIndex = formStore.data.features?.length ?? 0
      formStore.updateField<FormDataType>({ path: `features.${featureIndex}`, value: selectedFeature })
      featureStore.setIndex({ value: featureIndex })
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
        data: features,
        filters: {
          races: races,
          classes: classes,
          equipment: equipment,
        },
        onCopy: onCopyConfirm,
      },
    })
  }

  return (
    <>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Button
          color='primary'
          style='outline'
          width='size-full'
          onClick={handleAddFeature}
          className={sprinkles({ me: 'space-4' })}
        >
          Add Feature
        </Button>
      </Grid.Item>
      {steps[stepIndex].id === 'features' && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Button color='primary' style='outline' width='size-full' onClick={handleCopyFeature}>
            Copy Feature
          </Button>
        </Grid.Item>
      )}
      {featureArray.length > 0 && (
        <Grid.Item>
          <Accordion<typeof formStore.data> dataArray={featureArray} onChange={formStore} name='features'>
            {featureArray?.map((featureItem: any, featureIndex: number) => (
              <Accordion.Wrapper key={featureIndex} itemId={String(featureIndex)}>
                <Accordion.Header
                  handleRemove={() => handleRemoveFeature(featureIndex)}
                  handleEdit={() => handleEditFeature(featureIndex)}
                >
                  {featureItem.label != null && featureItem.label !== '' ?
                    featureItem.label
                  : `feature ${featureIndex + 1}`}
                </Accordion.Header>
                {featureItem.desc && (
                  <Accordion.Content>
                    <div className={feature_description}>
                      <div>
                        {featureItem?.desc && parse(featureItem.desc)}
                        {featureItem.options &&
                          featureItem.options?.length > 0 &&
                          featureItem.options?.map((option: any, index: number) => (
                            <div key={index}>
                              {option?.value && <strong>{option.value}</strong>}
                              {option?.desc && parse(option.desc)}
                            </div>
                          ))}
                      </div>
                    </div>
                  </Accordion.Content>
                )}
                <Accordion.Footer>
                  <Group justifyContentVariant='start'>
                    {sectionSteps.map((sectionStep, sectionIndex) => {
                      return (
                        <span key={sectionIndex} className={sprinkles({ me: 'space-2' })}>
                          {featureItem[sectionStep]?.length > 0 ?
                            <strong>
                              {startCase(sectionStep.charAt(0))}: {featureItem[sectionStep]?.length}
                            </strong>
                          : `${startCase(sectionStep.charAt(0))}: 0`}
                        </span>
                      )
                    })}
                  </Group>
                </Accordion.Footer>
              </Accordion.Wrapper>
            ))}
          </Accordion>
        </Grid.Item>
      )}
      <Outlet />
    </>
  )
}

export default FeaturesList
