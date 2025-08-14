import { sprinkles } from '~/css/sprinkles.css'
import Accordion from '~/components/Accordion'
import { Categories } from '~/enums'
import { useSystemData, useFieldUpdates, useFormField } from '~/hooks'
import { Grid, Button } from '@mantine/core'
import { DetailInputSchema } from '~/schemas'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import type { RaceInput, DetailInput } from '~/types'

const TraitsStep = () => {
  const store = useTypedFormStore<RaceInput>()
  const { AppField } = useFormField({ store })

  const { updateField, category } = useOptimizedSelector(store, (state) => ({
    updateField: state.updateField,
    category: state.current?.category,
  }))

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const { sizes } = useSystemData()

  const handleRemove = () => {
    updateField({ path: 'traits.details', value: undefined })
  }

  return (
    <>
      <AppField name='traits.details' mode='array'>
        {(details) => (
          <Grid>
            <Grid.Col>
              <Button
                onClick={() => {
                  const detailInputObj = DetailInputSchema.parse({ __kind: 'DetailInput' })
                  details.pushValue(detailInputObj)
                  updateField({
                    path: `traits.details[${details.state.value?.length}]`,
                    value: detailInputObj,
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
                    <Accordion.Item key={`traits-details-${i}`} itemId={String(i)} value={String(i)}>
                      <Accordion.Trigger
                        removeFn={() => {
                          if (details.state.value?.length) {
                            if (details.state.value?.length > 1) {
                              details.removeValue(i)
                              updateField({ path: `traits.details[${i}]`, value: undefined })
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
                          <AppField name={`details[${i}].label`} listeners={fieldListeners}>
                            {({ TextField }) => (
                              <Grid.Col>
                                <TextField label='Trait Name' />
                              </Grid.Col>
                            )}
                          </AppField>
                          <AppField name={`details[${i}].desc`} listeners={fieldListeners}>
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
        {category === Categories.BASE && (
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
        )}
      </Grid>
    </>
  )
}

export default TraitsStep
