import { sprinkles } from '@/css/sprinkles.css'
import Accordion from '@/components/Accordion'
import { Categories } from '@/enums'
import { useSystemData, useFieldUpdates } from '@/hooks'
import { Grid, Button } from '@mantine/core'
import { withForm } from '@/components/Form'
import { DetailInputSchema, RaceInputSchema } from '@/schemas'
import { useTypedFormStore } from '@/store'
import { useEffect } from 'react'
import { z } from 'zod/v4'
import type { RaceInput, DetailInput } from '@/types'

const TraitsStep = withForm({
  defaultValues: {} as z.input<typeof RaceInputSchema>,
  render: function Render({ form }) {
    const { AppField, Subscribe } = form

    const store = useTypedFormStore<RaceInput>()
    const steps = store((state) => state.steps)
    const stepIndex = store((state) => state.stepIndex)
    const registerForm = store((state) => state.registerForm)
    const updateField = store((state) => state.updateField)
    const removeField = store((state) => state.removeField)

    const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form' })

    const { sizes } = useSystemData()

    useEffect(() => {
      if (!steps[stepIndex].reset) {
        registerForm(form.reset)
      }
    }, [form.reset, steps, stepIndex, registerForm])

    const handleRemove = () => {
      form.setFieldValue('traits.details', undefined)
      removeField({ path: 'traits.details' })
    }

    return (
      <>
        <AppField name='traits.details' mode='array'>
          {(details) => (
            <Grid>
              <Grid.Col>
                <Button
                  onClick={() => {
                    details.pushValue(DetailInputSchema.parse({}))
                    updateField({
                      path: `traits.details[${details.state.value?.length}]`,
                      value: DetailInputSchema.parse({}),
                    })
                  }}
                  variant='outline'
                  className={sprinkles({ mb: 'space-3' })}
                >
                  Add Trait
                </Button>
              </Grid.Col>
              {details.state.value?.length && (
                <Grid.Col>
                  <Accordion
                    dataArray={details.state.value}
                    onChange={(dataAray) => details.handleChange(dataAray as DetailInput[])}
                  >
                    {details.state.value.map((detail, i) => (
                      <Accordion.Item key={`${i}-traits-details`} itemId={String(i)} value={String(i)}>
                        <Accordion.Trigger
                          removeFn={() => {
                            if (details.state.value?.length) {
                              if (details.state.value?.length > 1) {
                                details.removeValue(i)
                                removeField({ path: `traits.details[${i}]` })
                              } else {
                                handleRemove()
                              }
                            }
                          }}
                        >
                          {detail.label ?? `Trait ${i}`}
                        </Accordion.Trigger>
                        <Accordion.Content>
                          <Grid>
                            <AppField name={`traits.details[${i}].label`} listeners={fieldListeners}>
                              {({ TextField }) => (
                                <Grid.Col>
                                  <TextField label='Trait Name' />
                                </Grid.Col>
                              )}
                            </AppField>
                            <AppField name={`traits.details[${i}].desc`} listeners={fieldListeners}>
                              {({ RichTextField }) => (
                                <Grid.Col>
                                  <RichTextField label='Trait Description' />
                                </Grid.Col>
                              )}
                            </AppField>
                          </Grid>
                        </Accordion.Content>
                      </Accordion.Item>
                    ))}
                  </Accordion>
                </Grid.Col>
              )}
            </Grid>
          )}
        </AppField>
        <Grid>
          <Subscribe selector={(state) => state.values.category}>
            {(category) =>
              category === Categories.BASE && (
                <>
                  <AppField
                    name='traits.size'
                    validators={fieldValidators({
                      onBlur: 'Please select a size',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                        <DropdownField label='Size' options={sizes} required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='traits.speeds.walking'
                    validators={fieldValidators({
                      onBlur: 'Please enter a walking speed',
                      onChange: { type: 'integer', min: 1, name: 'Walking speed' },
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                        <TextField label='Walking Speed' placeholder='0' />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='traits.speeds.climbing'
                    validators={fieldValidators({
                      onBlur: 'Please enter a climbing speed',
                      onChange: { type: 'integer', min: 1, name: 'Climbing speed' },
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                        <TextField label='Climbing Speed' placeholder='0' />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='traits.speeds.swimming'
                    validators={fieldValidators({
                      onBlur: 'Please enter a swimming speed',
                      onChange: { type: 'integer', min: 1, name: 'Swimming speed' },
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                        <TextField label='Swimming Speed' placeholder='0' />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name='traits.speeds.flying'
                    validators={fieldValidators({
                      onBlur: 'Please enter a flying speed',
                      onChange: { type: 'integer', min: 1, name: 'Flying speed' },
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                        <TextField label='Flying Speed' placeholder='0' />
                      </Grid.Col>
                    )}
                  </AppField>
                </>
              )
            }
          </Subscribe>
        </Grid>
      </>
    )
  },
})

export default TraitsStep
