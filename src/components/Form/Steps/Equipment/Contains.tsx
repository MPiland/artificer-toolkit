import { useEquipmentData, useFieldUpdates } from '@/hooks'
import { Grid } from '@mantine/core'
import { withForm } from '@/components/Form'
import { EquipmentInputSchema } from '@/schemas'
import { z } from 'zod/v4'

const ContainsStep = withForm({
  defaultValues: {} as z.input<typeof EquipmentInputSchema>,
  render: function Render({ form }) {
    const { AppField } = form

    const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form' })

    const { equipment } = useEquipmentData()

    return (
      <>
        <Grid.Col>
          <Grid>
            <Grid.Col>Equipment</Grid.Col>
            <Grid.Col>Quantity</Grid.Col>
          </Grid>
        </Grid.Col>
        <AppField name='contains' mode='array'>
          {(field) =>
            field.state.value?.map((_, i) => (
              <Grid.Col key={`${i}-contains`}>
                <Grid>
                  <AppField
                    name={`contains[${i}].id`}
                    validators={fieldValidators({
                      onBlur: 'Please select an equipment',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col>
                        <DropdownField required={true} options={equipment} />
                      </Grid.Col>
                    )}
                  </AppField>
                  <AppField
                    name={`contains[${i}].quantity`}
                    validators={fieldValidators({
                      onBlur: 'Please enter a quantity',
                      onChange: { type: 'integer', min: 1, name: 'Quantity' },
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col>
                        <TextField required={true} />
                      </Grid.Col>
                    )}
                  </AppField>
                </Grid>
              </Grid.Col>
            ))
          }
        </AppField>
      </>
    )
  },
})

export default ContainsStep
