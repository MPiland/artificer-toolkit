import Accordion from '@/components/Accordion'
import { Button } from '@mantine/core'
import { sprinkles } from '@/css/sprinkles.css'
import { Grid } from '@mantine/core'
import { BackgroundInputSchema, DetailInputSchema } from '@/schemas'
import { useFormStore } from '@/store'
import { useEffect } from 'react'
import { useFieldUpdates } from '@/hooks'
import { z } from 'zod/v4'
import { withForm } from '@/components/Form'
import type { DetailInput } from 'gql/types'

const DetailsStep = withForm({
  defaultValues: {} as z.input<typeof BackgroundInputSchema>,
  render: function Render({ form }) {
    const updateField = useFormStore((state) => state.updateField)
    const removeField = useFormStore((state) => state.removeField)
    const steps = useFormStore((state) => state.steps)
    const stepIndex = useFormStore((state) => state.stepIndex)
    const registerForm = useFormStore((state) => state.registerForm)

    const { AppField } = form

    const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form', stepIndex })

    useEffect(() => {
      if (!steps[stepIndex].reset) {
        registerForm(form.reset)
      }
    }, [form.reset, steps, stepIndex, registerForm])

    return (
      <Grid>
        <AppField
          name='label'
          validators={fieldValidators({
            onBlur: 'Please enter a name',
          })}
          listeners={fieldListeners}
        >
          {({ TextField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <TextField label='Name' required={true} />
            </Grid.Col>
          )}
        </AppField>
        <>
          <AppField name='details' mode='array'>
            {(details) => (
              <>
                <Grid.Col span={2} className={sprinkles({ alignContent: 'flex-end' })}>
                  <Button
                    type='button'
                    onClick={() => {
                      const detailObject = DetailInputSchema.parse({})
                      updateField({ path: `details[${details.state.value?.length}]`, value: detailObject })
                      details.pushValue(detailObject)
                    }}
                  >
                    Add Detail
                  </Button>
                </Grid.Col>
                {details.state.value?.length && (
                  <Grid.Col>
                    <Accordion
                      dataArray={details.state.value}
                      onChange={(dataArray) => details.handleChange(dataArray as DetailInput[])}
                    >
                      {details.state.value?.map((detail, i) => (
                        <Accordion.Item key={`${i}-details`} itemId={String(i)} value={detail.label ?? ''}>
                          <Accordion.Trigger
                            removeFn={() => {
                              removeField({ path: `details[${i}]` })
                              details.removeValue(i)
                            }}
                          >
                            {detail.label != null && detail.label !== '' ? detail.label : `Detail ${i + 1}`}
                          </Accordion.Trigger>
                          <Accordion.Content>
                            <Grid>
                              <AppField name={`details[${i}].label`} listeners={fieldListeners}>
                                {({ TextField }) => (
                                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                    <TextField label='Detail Name' />
                                  </Grid.Col>
                                )}
                              </AppField>

                              <AppField name={`details[${i}].desc`} listeners={fieldListeners}>
                                {({ RichTextField }) => (
                                  <Grid.Col>
                                    <RichTextField label='Section Description' />
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
              </>
            )}
          </AppField>
        </>
      </Grid>
    )
  },
})

export default DetailsStep
