import { useMemo, use } from 'react'
import parse from 'html-react-parser'
import Button from '../../Button/Button'
import { feature_description } from '../Form.css'
import Accordion from '../../Accordion/Accordion'
import Group from '../../Group/Group'
import { get, startCase } from 'lodash'
import { sprinkles } from '../../../css/sprinkles.css'
import { Outlet, useNavigate } from 'react-router-dom'
import { FormContext } from '../FormContext'
import { FeatureContext } from './FeatureContext'
import Grid from '../../Grid/Grid'

const FeaturesList = () => {
  const navigate = useNavigate()

  const { formData, updateFormData, stepIndex, steps } = use(FormContext)

  const { setFeatureStep, updateFeatureData, sectionSteps } = use(FeatureContext)

  const arrayName = useMemo(() => (formData.__typename === 'Feat' ? '' : 'features'), [formData])

  const featureArray = useMemo(() => get(formData, arrayName) ?? [], [arrayName, formData])

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

  // Copy feature
  const handleCopy = () => {
    navigate('copy/feature', {
      state: {
        size: 'xs',
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
          <Button color='primary' style='outline' width='size-full' onClick={handleCopy}>
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
                  {featureItem.label != null && featureItem.label !== ''
                    ? featureItem.label
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
                          {featureItem[sectionStep]?.length > 0 ? (
                            <strong>
                              {startCase(sectionStep.charAt(0))}: {featureItem[sectionStep]?.length}
                            </strong>
                          ) : (
                            `${startCase(sectionStep.charAt(0))}: 0`
                          )}
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
