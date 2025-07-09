import Accordion from '@/components/Accordion'
import Collapsible from '@/components/Collapsible'
import { sprinkles } from '@/css/sprinkles.css'
import { feature_description } from '../Form.css'
import parse from 'html-react-parser'
import { Grid, Button } from '@mantine/core'
import { AncestryInputSchema, AncestryOptionInputSchema, RaceInputSchema } from '@/schemas'
import { useAncestryStore, useFeatureStore, useFormStore } from '@/store'
import { AncestryOption, Feature, useAppForm } from '@/components/Form'
import { useStore } from '@tanstack/react-form'
import { v4 as uuidv4 } from 'uuid'
import { useFeatureData, useFieldUpdates } from '@/hooks'
import { useEffect } from 'react'

const Ancestries = () => {
  const formStore = useFormStore()

  const form = useAppForm({
    defaultValues: RaceInputSchema.parse(formStore.current),
  })

  const { fieldListeners } = useFieldUpdates({ data: 'form' })

  const { AppField, Subscribe } = form

  const featureStore = useFeatureStore()
  const ancestryStore = useAncestryStore()

  const {
    ancestryOptions: { findAncestryOption },
  } = useFeatureData()

  const handleAddAncestry = () => {
    form.setFieldValue(
      'ancestry',
      AncestryInputSchema.parse({
        id: uuidv4(),
      })
    )
    formStore.updateField({ path: 'ancestry', value: {} })
  }

  const handleRemoveAncestry = () => {
    form.setFieldValue('ancestry', undefined)
    formStore.removeField({ path: 'ancestry' })
  }

  const { optionArray } = useStore(form.store, (state) => ({
    optionArray: state.values.ancestry?.options,
  }))

  // Add feature
  const handleAddOption = () => {
    ancestryStore.setCurrent(AncestryOptionInputSchema.parse({}))
    ancestryStore.setOptionIndex(optionArray?.length || 0)
    ancestryStore.setStep('ancestryOption')
  }

  useEffect(() => {
    formStore.registerForm(form.reset)
  }, [form.reset, formStore])

  const { isValid } = useStore(form.store, (state) => ({
    isValid: state.isValid,
  }))

  useEffect(() => {
    formStore.setValidForm(isValid)
  }, [formStore, isValid])

  return (
    <Subscribe
      selector={(state) => ({
        ancestry: state.values.ancestry,
        options: state.values.ancestry?.options,
      })}
    >
      {({ ancestry, options }) => {
        if (ancestryStore.step == null) {
          return (
            <>
              {!ancestry && (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <Button variant='outline' onClick={handleAddAncestry} className={sprinkles({ mb: 'space-3' })}>
                    Add Ancestry
                  </Button>
                </Grid.Col>
              )}
              {ancestry && (
                <>
                  <AppField
                    name='ancestry.label'
                    validators={{
                      onBlur: ({ value }) =>
                        ancestry?.desc !== '' && ancestry?.desc != null && !value && 'Ancestry name is required',
                    }}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='Ancestry Name' required={ancestry?.desc !== '' && ancestry?.desc != null} />
                      </Grid.Col>
                    )}
                  </AppField>
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <Button fullWidth color='red' variant='outline' onClick={handleRemoveAncestry}>
                      Remove Ancestry
                    </Button>
                  </Grid.Col>
                  <Grid.Col>
                    <Collapsible className={sprinkles({ width: 'size-full' })}>
                      <Collapsible.Trigger title='Ancestry Description' />
                      <Collapsible.Content>
                        <AppField name='ancestry.desc' listeners={fieldListeners}>
                          {({ RichTextField }) => <RichTextField />}
                        </AppField>
                      </Collapsible.Content>
                    </Collapsible>
                  </Grid.Col>
                  <Grid.Col>
                    <Button variant='outline' onClick={handleAddOption}>
                      Add Option
                    </Button>
                  </Grid.Col>
                </>
              )}
              {options && options.length && (
                <Grid.Col>
                  <AppField name='ancestry.options' mode='array'>
                    {({ AccordionField, removeValue }) => (
                      <AccordionField>
                        {optionArray?.map((o, i) => {
                          const option = findAncestryOption(o)
                          if (option) {
                            return (
                              <Accordion.Item key={`${i}-ancestry-options`} itemId={String(i)} value={option?.label}>
                                <Accordion.Trigger
                                  removeFn={() => {
                                    removeValue(i)
                                    formStore.removeField({ path: `ancestry.options.${i}` })
                                  }}
                                  editFn={() => {
                                    ancestryStore.setCurrent(AncestryOptionInputSchema.parse(optionArray[i]))
                                    ancestryStore.setOptionIndex(i)
                                    ancestryStore.setStep('ancestryOption')
                                  }}
                                >
                                  {option.label != null && option.label !== '' ? option.label : `Option ${i + 1}`}
                                </Accordion.Trigger>
                                {option.desc && (
                                  <Accordion.Content>
                                    <div className={feature_description}>
                                      <div>{option?.desc && parse(option.desc)}</div>
                                    </div>
                                  </Accordion.Content>
                                )}
                              </Accordion.Item>
                            )
                          }
                        })}
                      </AccordionField>
                    )}
                  </AppField>
                </Grid.Col>
              )}
            </>
          )
        } else if (featureStore.step == null) {
          return <AncestryOption />
        } else {
          return <Feature />
        }
      }}
    </Subscribe>
  )
}

export default Ancestries
