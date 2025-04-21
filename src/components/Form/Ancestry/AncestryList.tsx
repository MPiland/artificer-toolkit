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
import { FeatureContext } from '../Features/FeatureContext'
import Grid from '../../Grid/Grid'
import { FormStore } from '../../../store/formStore'

const AncestryList = () => {
  const { formStore } = use(FormContext) as {
    formStore: FormStore<Race>
  }

  const { ancestryStore, featureStore } = use(FeatureContext)

  const handleAddAncestry = () => {
    formStore.updateField({ path: 'ancestry', value: {} })
  }

  const handleRemoveAncestry = () => {
    formStore.removeField({ path: 'ancestry' })
  }

  const optionArray = useMemo(() => formStore.data?.ancestry?.options, [formStore.data])

  console.log({ formStore.data })

  // Add feature
  const handleAddOption = () => {
    const optionIndex = optionArray?.length || 0
    ancestryStore.setIndex({ value: optionIndex })
    ancestryStore.reinitState()
    featureStore.setStep('ancestryOption')
  }

  // Delete feature
  const handleRemoveOption = (optionIndex: number) => {
    formStore.removeField({ path: `ancestry.options.${optionIndex}` })
  }

  // Edit feature
  const handleEditOption = (optionIndex: number) => {
    if (optionArray) {
      ancestryStore.setIndex({ value: optionIndex })
      ancestryStore.reinitState(optionArray[optionIndex])
      featureStore.setStep('ancestryOption')
    }
  }

  return (
    <>
      {!formStore.data?.ancestry && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Button color='primary' style='outline' onClick={handleAddAncestry} className={sprinkles({ mb: 'space-3' })}>
            Add Ancestry
          </Button>
        </Grid.Item>
      )}
      {formStore.data?.ancestry && (
        <>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Input
              name='label'
              autoComplete='off'
              label='Ancestry Name'
              required={formStore.data?.ancestry?.desc !== '' && formStore.data?.ancestry?.desc != null}
              value={formStore.data?.ancestry?.label}
              errorMsg='Name must not be blank'
              onChange={ancestryStore}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }} align='end'>
            <Button width='size-full' color='danger' style='outline' onClick={handleRemoveAncestry}>
              Remove Ancestry
            </Button>
          </Grid.Item>
          <Grid.Item>
            <Collapse className={sprinkles({ width: 'size-full' })}>
              <Collapse.Header title='Ancestry Description' startOpened={formStore.data.id == null} />
              <Collapse.Body>
                <RichTextEditor name='ancestry.desc' onChange={formStore} value={formStore.data?.ancestry?.desc} />
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
          <Accordion dataArray={optionArray} onChange={formStore} name='ancestry.options'>
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
