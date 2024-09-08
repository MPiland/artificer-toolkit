import Accordion from '../../Accordion/Accordion'
import Group from '../../Group/Group'
import Input from '../../Input/Input'
import Button from '../../Button/Button'
import { useForm } from '../../../hooks/UseForm'
import Collapse from '../../Collapse/Collapse'
import Row from '../../Row/Row'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { sprinkles } from '../../../css/sprinkles.css'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { useMemo } from 'react'
import { get, startCase } from 'lodash'
import { feature_description, feature_list } from '../Form.css'
import parse from 'html-react-parser'
import { useFeature } from '../../../hooks/UseFeature'

const AncestryList = () => {
  const { setFormState, formState, context } = useForm()

  const { setFeatureIndex, setFeatureState, setOldFeatureState, setSubContext, sectionNames } = useFeature()

  // Add feature
  const handleAddAncestry = () => {
    setFormState({
      target: {
        name: 'ancestry',
        value: {},
      },
    })
  }

  const optionArray = useMemo(() => get(formState, 'ancestry.options'), [formState])

  // Add feature
  const handleAddOption = () => {
    if (optionArray && optionArray.length > 0) {
      setFeatureIndex(optionArray?.length)
    } else {
      setFeatureIndex(0)
    }
    setFeatureState({ type: 'reset', target: { value: {} } })
    setOldFeatureState({})
    setSubContext('feature')
  }

  // Delete feature
  const handleRemoveOption = (optionIndex: number) => {
    setFormState({
      type: 'removed',
      target: { name: `ancestry.options.${optionIndex}` },
    })
  }

  // Edit feature
  const handleEditOption = (optionIndex: number) => {
    if (optionArray) {
      setFeatureIndex(optionIndex)
      setFeatureState({
        type: 'reset',
        target: { value: optionArray[optionIndex] },
      })
      setOldFeatureState(optionArray[optionIndex])
      setSubContext('feature')
    }
  }

  return (
    <>
      <Group directionVariant='column' alignItemsVariant='start' className={sprinkles({ px: 'space-4' })}>
        {!formState?.ancestry && (
          <Button
            color='primary'
            style='outline'
            onClick={handleAddAncestry}
            className={sprinkles({ mb: 'space-3' })}
          >
            Add Ancestry
          </Button>
        )}
        {formState?.ancestry && (
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
            <Button
              color='primary'
              style='outline'
              onClick={handleAddOption}
              className={sprinkles({ mb: 'space-3' })}
            >
              Add Option
            </Button>
          </>
        )}
      </Group>
      <ScrollArea scrollDirection='vertical'>
        {optionArray && optionArray.length > 0 && (
          <div className={feature_list}>
            <Accordion dataArray={optionArray} setState={setFormState} name='options'>
              {optionArray?.map((option: any, optionIndex: number) => (
                <Accordion.Wrapper key={optionIndex} itemId={String(optionIndex)}>
                  <Accordion.Header
                    handleRemove={() => handleRemoveOption(optionIndex)}
                    handleEdit={() => handleEditOption(optionIndex)}
                  >
                    {option.value != null && option.value !== '' ? option.value : `Option ${optionIndex + 1}`}
                  </Accordion.Header>
                  {option.desc && (
                    <Accordion.Content>
                      <div className={feature_description}>
                        <div>{option?.desc && parse(option.desc)}</div>
                      </div>
                    </Accordion.Content>
                  )}
                  <hr />
                  <Accordion.Footer>
                    <Group justifyContentVariant='start'>
                      {sectionNames.map((sectionName, sectionIndex: number) => {
                        return (
                          <span key={sectionIndex} className={sprinkles({ me: 'space-2' })}>
                            {option[sectionName]?.length > 0 ? (
                              <strong>
                                {startCase(sectionName.charAt(0))}: {option[sectionName]?.length}
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

export default AncestryList
