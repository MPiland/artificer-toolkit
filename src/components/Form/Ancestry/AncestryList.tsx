import Accordion from '@/components/Accordion'
import Input from '@/components/Input'
import Button from '@/components/Button'
import { use } from 'react'
import { FormContext } from '../FormContext'
import Collapsible from '@/components/Collapsible'
import RichTextEditor from '@/components/RichTextEditor'
import { sprinkles } from '@/css/sprinkles.css'
import { useMemo } from 'react'
import { feature_description } from '../Form.css'
import parse from 'html-react-parser'
import { FeatureContext } from '../Features'
import type { OnChange, Race } from '@/types'
import { Grid } from '@mantine/core'

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
    const index = optionArray?.length || 0
    ancestryStore.setIndex({ value: index })
    ancestryStore.reinitState()
    featureStore.setStep('ancestryOption')
  }

  // Delete feature
  const handleRemoveOption = (index: number) => {
    removeField({ path: `ancestry.options.${index}` })
  }

  // Edit feature
  const handleEditOption = (index: number) => {
    if (optionArray) {
      ancestryStore.setIndex({ value: index })
      ancestryStore.reinitState(optionArray[index])
      featureStore.setStep('ancestryOption')
    }
  }

  return (
    <>
      {!data?.ancestry && (
        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
          <Button color='primary' style='outline' onClick={handleAddAncestry} className={sprinkles({ mb: 'space-3' })}>
            Add Ancestry
          </Button>
        </Grid.Col>
      )}
      {data?.ancestry && (
        <>
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <Input
              name='ancestry.label'
              autoComplete='off'
              label='Ancestry Name'
              required={data?.ancestry?.desc !== '' && data?.ancestry?.desc != null}
              value={data?.ancestry?.label}
              errorMsg='Name must not be blank'
              onChange={{ updateField }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }} align='end'>
            <Button width='size-full' color='danger' style='outline' onClick={handleRemoveAncestry}>
              Remove Ancestry
            </Button>
          </Grid.Col>
          <Grid.Col>
            <Collapsible className={sprinkles({ width: 'size-full' })}>
              <Collapsible.Trigger title='Ancestry Description' startOpened={data.id == null} />
              <Collapsible.Content>
                <RichTextEditor name='ancestry.desc' onChange={{ updateField }} value={data?.ancestry?.desc} />
              </Collapsible.Content>
            </Collapsible>
          </Grid.Col>
          <Grid.Col>
            <Button color='primary' style='outline' onClick={handleAddOption}>
              Add Option
            </Button>
          </Grid.Col>
        </>
      )}
      {optionArray && optionArray.length > 0 && (
        <Grid.Col>
          <Accordion dataArray={optionArray} updateFn={{ updateField }} name='ancestry.options' type='single'>
            {optionArray?.map((option, index) => (
              <Accordion.Item key={index} itemId={String(index)} value={option.label}>
                <Accordion.Trigger removeFn={() => handleRemoveOption(index)} editFn={() => handleEditOption(index)}>
                  {option.label != null && option.label !== '' ? option.label : `Option ${index + 1}`}
                </Accordion.Trigger>
                {option.desc && (
                  <Accordion.Content>
                    <div className={feature_description}>
                      <div>{option?.desc && parse(option.desc)}</div>
                    </div>
                  </Accordion.Content>
                )}
              </Accordion.Item>
            ))}
          </Accordion>
        </Grid.Col>
      )}
    </>
  )
}

export default AncestryList
