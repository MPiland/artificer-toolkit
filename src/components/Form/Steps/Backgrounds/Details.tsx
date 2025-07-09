import Accordion from '@/components/Accordion'
import { Button } from '@mantine/core'
import { sprinkles } from '@/css/sprinkles.css'
import { Grid } from '@mantine/core'
import { useAppForm } from '@/components/Form'
import { BackgroundInputSchema, DetailInputSchema } from '@/schemas'
import { useFormStore } from '@/store'
import { useEffect } from 'react'
import { useFieldUpdates } from '@/hooks'
import { useStore } from '@tanstack/react-form'

const DetailsStep = () => {
  const formStore = useFormStore()

  const form = useAppForm({
    defaultValues: BackgroundInputSchema.parse(formStore.current),
  })

  const { AppField } = form

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form' })

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
          {({ pushValue, removeValue, AccordionField, state }) => (
            <>
              <Grid.Col span={2} className={sprinkles({ alignContent: 'flex-end' })}>
                <Button
                  type='button'
                  onClick={() => {
                    const detailObject = DetailInputSchema.parse({})
                    formStore.updateField({ path: `details[${state.value?.length}]`, value: detailObject })
                    pushValue(detailObject)
                  }}
                >
                  Add Detail
                </Button>
              </Grid.Col>
              {state.value?.length && (
                <Grid.Col>
                  <AccordionField name='details'>
                    {state.value?.map((detail, i) => (
                      <Accordion.Item key={`${i}-details`} itemId={String(i)} value={detail.label ?? ''}>
                        <Accordion.Trigger
                          removeFn={() => {
                            formStore.removeField({ path: `details[${i}]` })
                            removeValue(i)
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
                  </AccordionField>
                </Grid.Col>
              )}
            </>
          )}
        </AppField>
      </>
    </Grid>
  )
}

export default DetailsStep
