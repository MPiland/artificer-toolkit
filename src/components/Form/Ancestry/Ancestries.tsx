import Accordion from '@/components/Accordion'
import Collapsible from '@/components/Collapse'
import { sprinkles } from '@/css/sprinkles.css'
import parse from 'html-react-parser'
import { Grid, Button } from '@mantine/core'
import { AncestryInputSchema, AncestryOptionInputSchema, RaceInputSchema } from '@/schemas'
import { useAncestryOptionStore, useFeatureStore, useTypedFormStore } from '@/store'
import { AncestryOption, Feature, withForm, description } from '@/components/Form'
import { useStore } from '@tanstack/react-form'
import { v4 as uuidv4 } from 'uuid'
import { useFeatureData, useFieldUpdates } from '@/hooks'
import { useEffect } from 'react'
import { z } from 'zod/v4'
import { RaceInput } from '@/types'

const Ancestries = withForm({
  defaultValues: {} as z.input<typeof RaceInputSchema>,
  render: function Render({ form }) {
    const { AppField, Subscribe } = form

    const { fieldListeners } = useFieldUpdates({ data: 'form' })

    const store = useTypedFormStore<RaceInput>()
    const steps = store((state) => state.steps)
    const stepIndex = store((state) => state.stepIndex)
    const registerForm = store((state) => state.registerForm)
    const updateField = store((state) => state.updateField)
    const removeField = store((state) => state.removeField)

    const featureStore = useFeatureStore()
    const ancestryStore = useAncestryOptionStore()

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
      updateField({ path: 'ancestry', value: {} })
    }

    const handleRemoveAncestry = () => {
      form.setFieldValue('ancestry', undefined)
      removeField({ path: 'ancestry' })
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
      if (!steps[stepIndex].reset) {
        registerForm(form.reset)
      }
    }, [form.reset, steps, stepIndex, registerForm])

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
                      <Collapsible
                        props={{
                          trigger: {
                            title: 'Ancestry Description',
                          },
                        }}
                      >
                        <AppField name='ancestry.desc' listeners={fieldListeners}>
                          {({ RichTextField }) => <RichTextField />}
                        </AppField>
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
                      {(options) =>
                        options.state.value?.length && (
                          <Accordion
                            dataArray={options.state.value}
                            onChange={(dataArray) => options.handleChange(dataArray as string[])}
                          >
                            {optionArray?.map((o, i) => {
                              const option = findAncestryOption(o)
                              if (option) {
                                return (
                                  <Accordion.Item
                                    key={`${i}-ancestry-options`}
                                    itemId={String(i)}
                                    value={option?.label}
                                  >
                                    <Accordion.Trigger
                                      removeFn={() => {
                                        options.removeValue(i)
                                        removeField({ path: `ancestry.options.${i}` })
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
                                        <div className={description}>
                                          <div>{option?.desc && parse(option.desc)}</div>
                                        </div>
                                      </Accordion.Content>
                                    )}
                                  </Accordion.Item>
                                )
                              }
                            })}
                          </Accordion>
                        )
                      }
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
  },
})

export default Ancestries
