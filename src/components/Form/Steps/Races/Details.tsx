import Accordion from '@/components/Accordion'
import { Button } from '@mantine/core'
import { sprinkles } from '@/css/sprinkles.css'
import { Categories } from '@/enums'
import { useSystemData, useRaceData, useFieldUpdates } from '@/hooks'
import { Grid } from '@mantine/core'
import { useAppForm } from '@/components/Form'
import { RaceInputSchema, DetailInputSchema } from '@/schemas'
import { useFormStore } from '@/store'
import { useEffect } from 'react'
import { useStore } from '@tanstack/react-form'

const DetailsStep = () => {
  const formStore = useFormStore()

  const form = useAppForm({
    defaultValues: RaceInputSchema.parse(formStore.current),
  })

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form' })

  const { AppField, Subscribe } = form
  
  const { categories } = useSystemData()
  const { races } = useRaceData()

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
        category: state.values.category,
      })}
    >
      {({ category }) => (
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
          <AppField
            name='category'
            validators={fieldValidators({
              onBlur: 'Please select a category',
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <DropdownField
                  label='Category'
                  options={categories.filter((category) => category?.races)}
                  required={true}
                />
              </Grid.Col>
            )}
          </AppField>
          {category === Categories.BASE ?
            <AppField
              name='playable'
              validators={fieldValidators({
                onBlur: 'Choose whether this race is playable or not',
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField
                    label='Playable'
                    options={[
                      {
                        value: 'true',
                        label: 'Yes',
                        id: 'true',
                      },
                      {
                        value: 'false',
                        label: 'No',
                        id: 'false',
                      },
                    ]}
                    required={true}
                  />
                </Grid.Col>
              )}
            </AppField>
          : (category === Categories.SUBRACE || category === Categories.VARIANT) && (
              <AppField
                name='lineages'
                validators={fieldValidators({
                  onBlur: 'Please select a race lineage',
                })}
                listeners={fieldListeners}
              >
                {({ DropdownField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <DropdownField label='Race Linage' options={races} required={true} multiselect={true} />
                  </Grid.Col>
                )}
              </AppField>
            )
          }
          <>
            <AppField name='details' mode='array'>
              {({ pushValue, removeValue, AccordionField, state }) => (
                <>
                  <Grid.Col span={2} className={sprinkles({ alignContent: 'flex-end' })}>
                    <Button
                      type='button'
                      onClick={() => {
                        const detailInputObj = DetailInputSchema.parse({})
                        pushValue(detailInputObj)
                        formStore.updateField({
                          path: `details[${state.value?.length}]`,
                          value: detailInputObj,
                        })
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
                                removeValue(i)
                                formStore.removeField({ path: `details[${i}]` })
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
      )}
    </Subscribe>
  )
}

export default DetailsStep
