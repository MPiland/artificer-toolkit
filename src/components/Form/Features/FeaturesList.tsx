import { useMemo, use } from 'react'
import parse from 'html-react-parser'
import Button from '../../Button/Button'
import { feature_list, feature_description } from '../Form.css'
import Accordion from '../../Accordion/Accordion'
import ScrollArea from '../../ScrollArea/ScrollArea'
import Group from '../../Group/Group'
import { get, startCase } from 'lodash'
import { sprinkles } from '../../../css/sprinkles.css'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import Input from '../../Input/Input'
import Row from '../../Row/Row'
import Collapse from '../../Collapse/Collapse'
import { useLocation, useNavigate } from 'react-router-dom'
import { FormContext } from '../FormContext'
import { FeatureContext } from './FeatureContext'
import { Race } from '../../../../amplify/API'

const FeaturesList = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { formData, updateFormData, stepIndex, steps } = use(FormContext)

  const { setFeatureStep, updateFeatureData, sectionSteps } = use(FeatureContext)

  const arrayName = useMemo(
    () =>
      formData.__typename === 'Feat' ? '' : steps[stepIndex].id === 'ancestry' ? ['ancestry', 'options'] : 'features',
    [formData, steps, stepIndex]
  )

  const featureArray = useMemo(() => get(formData, arrayName) ?? [], [arrayName, formData])

  // Add feature
  const handleAdd = () => {
    if (featureArray.length > 0) {
      updateFeatureData({ type: 'index', value: featureArray?.length })
    } else {
      updateFeatureData({ type: 'index', value: 0 })
    }
    updateFeatureData({ type: 'reset', value: {} })
    updateFeatureData({ type: 'initialReset', value: {} })
    setFeatureStep('feature')
  }

  // Delete feature
  const handleRemove = (featureIndex: number) => {
    if (formData.__typename !== 'Feat') {
      if (steps[stepIndex].id === 'ancestry') {
        updateFormData({
          type: 'remove',
          path: `ancestry.options.${featureIndex}`,
        })
      } else {
        updateFormData({
          type: 'remove',
          path: `features.${featureIndex}`,
        })
      }
    }
  }

  // Edit feature
  const handleEdit = (featureIndex: number) => {
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
    navigate(`${location.state.previous.pathname}/copy/feature`, {
      state: {
        size: 'xs',
      },
    })
  }

  return (
    <>
      <Group directionVariant='column' alignItemsVariant='start' className={sprinkles({ px: 'space-4' })}>
        {steps[stepIndex].id === 'ancestry' && formData.__typename === 'Race' && formData?.ancestry && (
          <>
            <Row className={sprinkles({ mb: 'space-3' })}>
              <Input<Race>
                name='ancestry.value'
                autoComplete='off'
                label='Ancestry Name'
                required={formData?.ancestry?.desc !== '' && formData?.ancestry?.desc != null}
                value={formData?.ancestry?.value}
                errorMsg='Name must not be blank'
                onChange={updateFormData}
              />
            </Row>
            <Collapse className={sprinkles({ width: 'size-full' })}>
              <Collapse.Header title='Ancestry Description' startOpened={formData.id == null} />
              <Collapse.Body>
                <RichTextEditor<Race> name='ancestry.desc' onChange={updateFormData} value={formData?.ancestry?.desc} />
              </Collapse.Body>
            </Collapse>
          </>
        )}
        <Row cellSize='auto'>
          <Button color='primary' style='outline' onClick={handleAdd}>
            Add feature
          </Button>
          {steps[stepIndex].id === 'features' && (
            <Button color='primary' style='outline' onClick={handleCopy}>
              Copy feature
            </Button>
          )}
        </Row>
      </Group>
      <ScrollArea scrollDirection='vertical'>
        {featureArray.length > 0 && (
          <div className={feature_list}>
            <Accordion<typeof formData> dataArray={featureArray} onChange={updateFormData} name='features'>
              {featureArray?.map((featureItem: any, featureIndex: number) => (
                <Accordion.Wrapper key={featureIndex} itemId={String(featureIndex)}>
                  <Accordion.Header
                    handleRemove={() => handleRemove(featureIndex)}
                    handleEdit={() => handleEdit(featureIndex)}
                  >
                    {featureItem.value != null && featureItem.value !== ''
                      ? featureItem.value
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
                  <hr />
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
          </div>
        )}
      </ScrollArea>
    </>
  )
}

export default FeaturesList
