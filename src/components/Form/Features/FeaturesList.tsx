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
import { useListRacesQuery } from '../../../apis/racesApi'
import { useListClassesQuery } from '../../../apis/classesApi'
import { useListEquipmentQuery } from '../../../apis/equipmentApi'

const FeaturesList = () => {
  const { formData, updateFormData, stepIndex, steps } = use(FormContext)
  const { setFeatureStep, updateFeatureData, sectionSteps } = use(FeatureContext)
  const { showModal } = use(ModalContext)

  const { data: races } = useListRacesQuery()
  const { data: classes } = useListClassesQuery()
  const { data: equipment } = useListEquipmentQuery()

  const arrayName = useMemo(() => (formData.__typename === 'Feat' ? '' : 'features'), [formData])

  const featureArray = useMemo(() => get(formData, arrayName) ?? [], [arrayName, formData])

  const createFeatures = (): Feature[] => {
    const racesFeatures = races.flatMap(
      (race) => (race.features?.length && race.features?.map((feature) => feature)) || []
    )
    const classesFeatures = classes.flatMap(
      (uClass) => (uClass.features?.length && uClass.features?.map((feature) => feature)) || []
    )
    const equipmentFeatures = equipment.flatMap((equipment) =>
      equipment.features ? equipment.features.map((feature) => feature) : []
    )

    return { ...racesFeatures, ...classesFeatures, ...equipmentFeatures }
  }

  const features = createFeatures()

  // Add feature
  const handleAddFeature = () => {
    updateFeatureData({ type: 'index', value: featureArray?.length || 0 })
    updateFeatureData({ type: 'reset', value: {} })
    updateFeatureData({ type: 'initialReset', value: {} })
    setFeatureStep('feature')
  }

  // Delete feature
  const handleRemoveFeature = (featureIndex: number) => {
    if (formData.__typename !== 'Feat') {
      updateFormData({
        type: 'remove',
        path: `features.${featureIndex}`,
      })
    }
  }

  // Edit feature
  const handleEditFeature = (featureIndex: number) => {
    updateFeatureData({ type: 'index', value: featureIndex })
    updateFeatureData({
      type: 'reset',
      value: featureArray[featureIndex],
    })
    updateFeatureData({ type: 'initialReset', value: featureArray[featureIndex] })
    setFeatureStep('feature')
  }

  const onCopyConfirm = (selectedFeature: Feature) => {
    if (formData.__typename !== 'Spell' && formData.__typename !== 'Character') {
      const featureIndex = formData.features?.length ?? 0
      updateFormData({
        type: 'update',
        path: `features.${featureIndex}`,
        value: selectedFeature,
      })
      updateFeatureData({ type: 'index', value: featureIndex })
      updateFeatureData({ type: 'reset', value: selectedFeature })
      updateFeatureData({ type: 'initialReset', value: selectedFeature })
      setFeatureStep('feature')
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
          <Accordion<typeof formData> dataArray={featureArray} onChange={updateFormData} name='features'>
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
