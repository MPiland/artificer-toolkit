import Accordion from '@/components/Accordion'
import { Button } from '@mantine/core'
import { sprinkles } from '@/css/sprinkles.css'
import { Categories } from '@/enums'
import { useSystemData, useClassData, useFieldUpdates } from '@/hooks'
import { Grid, Divider } from '@mantine/core'
import { useAppForm } from '@/components/Form'
import { ClassInputSchema, DetailInputSchema } from '@/schemas'
import { useFormStore } from '@/store'
import { useEffect } from 'react'
import { useStore } from '@tanstack/react-form'

const DetailsStep = () => {
  const formStore = useFormStore()

  const form = useAppForm({
    defaultValues: ClassInputSchema.parse(formStore.current),
  })

  const { AppField, Subscribe } = form

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form' })

  const { categories, currencies, abilities } = useSystemData()
  const { baseClasses } = useClassData()

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
              onBlur: 'Please enter a class name',
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
            validators={fieldValidators({ onBlur: 'Please select a class category' })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <DropdownField
                  label='Category'
                  options={categories.filter((category) => category?.classes)}
                  required={true}
                />
              </Grid.Col>
            )}
          </AppField>
          {category === Categories.SUBCLASS ?
            <AppField
              name='parentClass'
              validators={fieldValidators({ onBlur: 'Please select a parent class' })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField label='Parent Class' options={baseClasses} required={true} />
                </Grid.Col>
              )}
            </AppField>
          : <>
              <AppField
                name='hitpoint.dieConfig'
                validators={fieldValidators({
                  onBlur: 'Please enter a hitpoint die configuration',
                  onChange: { type: 'die', name: 'Hitpoint die configuration' },
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <TextField label='HP Die Value' required={true} />
                  </Grid.Col>
                )}
              </AppField>
              <AppField
                name='hitpoint.ability'
                validators={fieldValidators({
                  onBlur: 'Please select a hitpoint ability',
                })}
                listeners={fieldListeners}
              >
                {({ DropdownField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <DropdownField label='HP Modifier Ability' options={abilities} required={true} />
                  </Grid.Col>
                )}
              </AppField>
            </>
          }
          {category === Categories.BASE && (
            <Grid.Col>
              <Divider label='Starting Gold' />
              <Grid>
                <AppField
                  name='startingGold.dieConfig'
                  validators={fieldValidators({
                    onBlur: 'Please enter a gold die configuration',
                    onChange: { type: 'die', name: 'Gold die configuration' },
                  })}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => (
                    <Grid.Col>
                      <TextField label='Gold Die Config.' required={true} />
                    </Grid.Col>
                  )}
                </AppField>
                <AppField
                  name='startingGold.multiplier'
                  validators={fieldValidators({
                    onBlur: 'Please enter a gold multiplier',
                    onChange: { type: 'number', name: 'Gold multiplier', min: 1 },
                  })}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => (
                    <Grid.Col>
                      <TextField label='Gold Multiplier' required={true} />
                    </Grid.Col>
                  )}
                </AppField>
                <AppField
                  name='startingGold.currency'
                  validators={fieldValidators({
                    onBlur: 'Please select a currency',
                  })}
                  listeners={fieldListeners}
                >
                  {({ DropdownField }) => (
                    <Grid.Col>
                      <DropdownField label='Currency' options={currencies} required={true} />
                    </Grid.Col>
                  )}
                </AppField>
              </Grid>
            </Grid.Col>
          )}
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
                      {state.value.map((detail, i) => (
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
        </Grid>
      )}
    </Subscribe>
  )
}

export default DetailsStep
