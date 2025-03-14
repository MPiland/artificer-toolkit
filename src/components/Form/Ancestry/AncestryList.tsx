import Accordion from '../../Accordion/Accordion'
import Input from '../../Input/Input'
import Button from '../../Button/Button'
import { use } from 'react'
import { FormContext } from '../FormContext'
import Collapse from '../../Collapse/Collapse'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { sprinkles } from '../../../css/sprinkles.css'
import { useMemo } from 'react'
import { feature_description } from '../Form.css'
import parse from 'html-react-parser'
import { Race } from '../../../../amplify/gql/types'
import { UpdateState } from '../../../types/form'
import { FeatureContext } from '../Features/FeatureContext'
import Grid from '../../Grid/Grid'

const AncestryList = () => {
  const { updateFormData, formData } = use(FormContext) as {
    formData: Race
    updateFormData: (state: UpdateState<Race>) => void
  }

  const { updateAncestryData, setFeatureStep } = use(FeatureContext)

  const handleAddAncestry = () => {
    updateFormData({
      type: 'update',
      path: 'ancestry',
      value: {},
    })
  }

  const handleRemoveAncestry = () => {
    updateFormData({
      type: 'remove',
      path: 'ancestry',
    })
  }

  const optionArray = useMemo(() => formData?.ancestry?.options, [formData])

  console.log({ formData })

  // Add feature
  const handleAddOption = () => {
    const optionIndex = optionArray?.length || 0
    updateAncestryData({ type: 'index', value: optionIndex })
    updateAncestryData({ type: 'reset', value: {} })
    updateAncestryData({ type: 'initialReset', value: {} })
    setFeatureStep('ancestryOption')
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
      setFeatureStep('ancestryOption')
    }
  }

  return (
    <>
      {!formData?.ancestry && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Button color='primary' style='outline' onClick={handleAddAncestry} className={sprinkles({ mb: 'space-3' })}>
            Add Ancestry
          </Button>
        </Grid.Item>
      )}
      {formData?.ancestry && (
        <>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Input
              name='label'
              autoComplete='off'
              label='Ancestry Name'
              required={formData?.ancestry?.desc !== '' && formData?.ancestry?.desc != null}
              value={formData?.ancestry?.label}
              errorMsg='Name must not be blank'
              onChange={updateAncestryData}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }} align='end'>
            <Button width='size-full' color='danger' style='outline' onClick={handleRemoveAncestry}>
              Remove Ancestry
            </Button>
          </Grid.Item>
          <Grid.Item>
            <Collapse className={sprinkles({ width: 'size-full' })}>
              <Collapse.Header title='Ancestry Description' startOpened={formData.id == null} />
              <Collapse.Body>
                <RichTextEditor name='ancestry.desc' onChange={updateFormData} value={formData?.ancestry?.desc} />
              </Collapse.Body>
            </Collapse>
          </Grid.Item>
          <Grid.Item>
            <Button color='primary' style='outline' onClick={handleAddOption}>
              Add Option
            </Button>
          </Grid.Item>
        </>
      )}
      {optionArray && optionArray.length > 0 && (
        <Grid.Item>
          <Accordion dataArray={optionArray} onChange={updateFormData} name='ancestry.options'>
            {optionArray?.map((option, optionIndex) => (
              <Accordion.Wrapper key={optionIndex} itemId={String(optionIndex)}>
                <Accordion.Header
                  handleRemove={() => handleRemoveOption(optionIndex)}
                  handleEdit={() => handleEditOption(optionIndex)}
                >
                  {option.label != null && option.label !== '' ? option.label : `Option ${optionIndex + 1}`}
                </Accordion.Header>
                {option.desc && (
                  <Accordion.Content>
                    <div className={feature_description}>
                      <div>{option?.desc && parse(option.desc)}</div>
                    </div>
                  </Accordion.Content>
                )}
              </Accordion.Wrapper>
            ))}
          </Accordion>
        </Grid.Item>
      )}
    </>
  )
}

export default AncestryList
