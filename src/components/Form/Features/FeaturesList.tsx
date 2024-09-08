import { useMemo } from 'react'
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
import { useForm } from '../../../hooks/UseForm'
import { useFeature } from '../../../hooks/UseFeature'

const FeaturesList = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { formState, setFormState, context, stepIndex, steps } = useForm()

  const { setSubContext, setOldFeatureState, setFeatureIndex, setFeatureState, sectionNames, sectionName } =
    useFeature()

  const arrayName = useMemo(
    () => (context.title === 'feats' ? '' : steps[stepIndex].id === 'ancestry' ? ['ancestry', 'options'] : 'features'),
    [context.title, steps, stepIndex]
  )

  const featureArray = useMemo(() => get(formState, arrayName) ?? [], [arrayName, formState])

  // Add feature
  const handleAdd = () => {
    if (featureArray.length > 0) {
      setFeatureIndex(featureArray?.length)
    } else {
      setFeatureIndex(0)
    }
    setFeatureState({ type: 'reset', target: { value: {} } })
    setOldFeatureState({})
    setSubContext('feature')
  }

  // Delete feature
  const handleRemove = (featureIndex: number) => {
    setFormState({
      type: 'removed',
      target: { name: `${arrayName}.${featureIndex}` },
    })
  }

  // Edit feature
  const handleEdit = (featureIndex: number) => {
    setFeatureIndex(featureIndex)
    setFeatureState({
      type: 'reset',
      target: { value: featureArray[featureIndex] },
    })
    setOldFeatureState(featureArray[featureIndex])
    setSubContext('feature')
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
        {steps[stepIndex].id === 'ancestry' && sectionName === '' && formState?.ancestry && (
          <>
            <Row className={sprinkles({ mb: 'space-3' })}>
              <Input
                name='ancestry.value'
                autoComplete='off'
                label='Ancestry Name'
                required={formState?.ancestry?.desc !== '' && formState?.ancestry?.desc != null}
                value={formState?.ancestry?.value}
                errorMsg='Name must not be blank'
                onChange={setFormState}
              />
            </Row>
            <Collapse className={sprinkles({ width: 'size-full' })}>
              <Collapse.Header title='Ancestry Description' startOpened={context.type === 'new'} />
              <Collapse.Body>
                <RichTextEditor name='ancestry.desc' onChange={setFormState} value={formState?.ancestry?.desc} />
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
            <Accordion dataArray={featureArray} setState={setFormState} name='features'>
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
                      {sectionNames.map((sectionName, sectionIndex: number) => {
                        return (
                          <span key={sectionIndex} className={sprinkles({ me: 'space-2' })}>
                            {featureItem[sectionName]?.length > 0 ? (
                              <strong>
                                {startCase(sectionName.charAt(0))}: {featureItem[sectionName]?.length}
                              </strong>
                            ) : (
                              `${startCase(sectionName.charAt(0))}: 0`
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
