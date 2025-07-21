import Accordion from '@/components/Accordion'
import { Button } from '@mantine/core'
import { sprinkles } from '@/css/sprinkles.css'
import { Categories } from '@/enums'
import { useSystemData, useRaceData, useFieldUpdates } from '@/hooks'
import { Grid } from '@mantine/core'
import { withForm } from '@/components/Form'
import { RaceInputSchema, DetailInputSchema } from '@/schemas'
import { useTypedFormStore } from '@/store'
import type { RaceInput, DetailInput } from '@/types'
import { z } from 'zod/v4'

const DetailsStep = withForm({
  defaultValues: {} as z.input<typeof RaceInputSchema>,
  render: function Render({ form }) {
    const { AppField } = form

    const store = useTypedFormStore<RaceInput>()
    const category = store((state) => state.current?.category)
    const updateField = store((state) => state.updateField)
    const removeField = store((state) => state.removeField)

    const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form' })

    const { categories } = useSystemData()
    const { races } = useRaceData()

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
            {(details) => (
              <>
                <Grid.Col span={2} className={sprinkles({ alignContent: 'flex-end' })}>
                  <Button
                    type='button'
                    onClick={() => {
                      const detailInputObj = DetailInputSchema.parse({})
                      details.pushValue(detailInputObj)
                      updateField({
                        path: `details[${details.state.value?.length}]`,
                        value: detailInputObj,
                      })
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
                              details.removeValue(i)
                              removeField({ path: `details[${i}]` })
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
