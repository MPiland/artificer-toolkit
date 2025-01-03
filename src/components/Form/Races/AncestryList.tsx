import Accordion from '../../Accordion/Accordion'
import Group from '../../Group/Group'
import Input from '../../Input/Input'
import Button from '../../Button/Button'
import { use } from 'react'
import { FormContext } from '../FormContext'
import Collapse from '../../Collapse/Collapse'
import Row from '../../Row/Row'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { sprinkles } from '../../../css/sprinkles.css'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { useMemo } from 'react'
import { startCase } from 'lodash'
import { feature_description, feature_list } from '../Form.css'
import parse from 'html-react-parser'
import { Race } from '../../../../amplify/API'
import { SectionName, UpdateState } from '../../../types/form'
import { FeatureContext } from '../Features/FeatureContext'

const AncestryList = () => {
  const { updateFormData, formData } = use(FormContext) as {
    formData: Race
    updateFormData: (state: UpdateState<Race>) => void
  }

  const { updateAncestryData, setFeatureStep, sectionSteps } = use(FeatureContext)

  // Add feature
  const handleAddAncestry = () => {
    updateFormData({
      type: 'update',
      path: 'ancestry',
      value: {},
    })
  }

  const optionArray = useMemo(() => formData.ancestry.options, [formData])

  // Add feature
  const handleAddOption = () => {
    if (optionArray && optionArray.length > 0) {
      updateAncestryData({ type: 'index', value: optionArray?.length })
    } else {
      updateAncestryData({ type: 'index', value: 0 })
    }
    updateAncestryData({ type: 'reset', value: {} })
    updateAncestryData({ type: 'initialReset', value: {} })
    setFeatureStep('feature')
  }

  // Delete feature
  const handleRemoveOption = (optionIndex: number) => {
    updateFormData({
      type: 'remove',
      path: `ancestry.options.${optionIndex}`,
    })
  }

  // Edit feature
  const handleEditOption = (optionIndex: number) => {
    if (optionArray) {
      updateAncestryData({ type: 'index', value: optionIndex })
      updateAncestryData({
        type: 'reset',
        value: optionArray[optionIndex],
      })
      updateAncestryData({
        type: 'initialReset',
        value: optionArray[optionIndex],
      })
      setFeatureStep('feature')
    }
  }

  return (
    <>
      <Group directionVariant='column' alignItemsVariant='start' className={sprinkles({ px: 'space-4' })}>
        {!formData?.ancestry && (
          <Button color='primary' style='outline' onClick={handleAddAncestry} className={sprinkles({ mb: 'space-3' })}>
            Add Ancestry
          </Button>
        )}
        {formData?.ancestry && (
          <>
            <Row className={sprinkles({ mb: 'space-3' })}>
              <Input
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
                <RichTextEditor name='ancestry.desc' onChange={updateFormData} value={formData?.ancestry?.desc} />
              </Collapse.Body>
            </Collapse>
            <Button color='primary' style='outline' onClick={handleAddOption} className={sprinkles({ mb: 'space-3' })}>
              Add Option
            </Button>
          </>
        )}
      </Group>
      <ScrollArea scrollDirection='vertical'>
        {optionArray && optionArray.length > 0 && (
          <div className={feature_list}>
            <Accordion dataArray={optionArray} onChange={updateFormData} name='ancestry.options'>
              {optionArray?.map((option, optionIndex) => (
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
                      {option.features.map((feature, index) =>
                        sectionSteps.map((sectionStep: Exclude<SectionName, 'ancestries'>, sectionIndex) => (
                          <span key={`${sectionIndex}` && `${index}`} className={sprinkles({ me: 'space-2' })}>
                            {feature[sectionStep]?.length > 0 ? (
                              <strong>
                                {startCase(sectionStep.charAt(0))}: {feature[sectionStep]?.length}
                              </strong>
                            ) : (
                              `${startCase(sectionStep.charAt(0))}: 0`
                            )}
                          </span>
                        ))
                      )}
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
