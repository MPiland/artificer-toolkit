import Accordion from '@/components/Accordion'
import Input from '@/components/Input'
import Button from '@/components/Button'
import { use } from 'react'
import { FormContext } from '../FormContext'
import Collapse from '@/components/Collapse'
import RichTextEditor from '@/components/RichTextEditor'
import { sprinkles } from '@/css/sprinkles.css'
import { useMemo } from 'react'
import { feature_description } from '../Form.css'
import parse from 'html-react-parser'
import { FeatureContext } from '../Features'
import Grid from '@/components/Grid'
import type { OnChange, Race } from '@/types'

const AncestryList = () => {
  const {
    formStore: { data, updateField, removeField },
  } = use(FormContext) as {
    formStore: {
      data: Race
      updateField: OnChange<Race>['updateField']
      removeField: OnChange<Race>['removeField']
    }
  }

  const { ancestryStore, featureStore } = use(FeatureContext)

  const handleAddAncestry = () => {
    updateField({ path: 'ancestry', value: {} })
  }

  const handleRemoveAncestry = () => {
    removeField({ path: 'ancestry' })
  }

  const optionArray = useMemo(() => data?.ancestry?.options, [data?.ancestry?.options])

  // Add feature
  const handleAddOption = () => {
    const optionIndex = optionArray?.length || 0
    ancestryStore.setIndex({ value: optionIndex })
    ancestryStore.reinitState()
    featureStore.setStep('ancestryOption')
  }

  // Delete feature
  const handleRemoveOption = (optionIndex: number) => {
    removeField({ path: `ancestry.options.${optionIndex}` })
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
      {!data?.ancestry && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Button color='primary' style='outline' onClick={handleAddAncestry} className={sprinkles({ mb: 'space-3' })}>
            Add Ancestry
          </Button>
        </Grid.Item>
      )}
      {data?.ancestry && (
        <>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Input
              name='ancestry.label'
              autoComplete='off'
              label='Ancestry Name'
              required={data?.ancestry?.desc !== '' && data?.ancestry?.desc != null}
              value={data?.ancestry?.label}
              errorMsg='Name must not be blank'
              onChange={{ updateField }}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }} align='end'>
            <Button width='size-full' color='danger' style='outline' onClick={handleRemoveAncestry}>
              Remove Ancestry
            </Button>
          </Grid.Item>
          <Grid.Item>
            <Collapse className={sprinkles({ width: 'size-full' })}>
              <Collapse.Header title='Ancestry Description' startOpened={data.id == null} />
              <Collapse.Body>
                <RichTextEditor name='ancestry.desc' onChange={{ updateField }} value={data?.ancestry?.desc} />
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
          <Accordion dataArray={optionArray} onChange={{ updateField }} name='ancestry.options'>
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
