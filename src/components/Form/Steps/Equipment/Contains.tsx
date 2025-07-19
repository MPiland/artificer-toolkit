import { useEquipmentData, useFieldUpdates } from '@/hooks'
import { Grid } from '@mantine/core'
import { useAppForm } from '@/components/Form'
import { EquipmentInputSchema } from '@/schemas'
import { useFormStore } from '@/store'
import { useStore } from '@tanstack/react-form'
import { useEffect } from 'react'

const ContainsStep = () => {
  const formStore = useFormStore()

  const form = useAppForm({
    defaultValues: EquipmentInputSchema.parse(formStore.current),
  })

  const { AppField } = form

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form' })

  useEffect(() => {
    if (!formStore.steps[formStore.stepIndex].reset) {
      formStore.registerForm(form.reset)
    }
  }, [form.reset, formStore])

  const { isValid } = useStore(form.store, (state) => ({
    isValid: state.isValid,
  }))

  useEffect(() => {
    formStore.setValidForm(isValid)
  }, [formStore, isValid])

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
}

export default ContainsStep
