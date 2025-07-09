import { useEffect } from 'react'
import { Grid, Button } from '@mantine/core'
import { ClassInputSchema } from '@/schemas'
import { EquipmentGroup, useAppForm } from '@/components/Form'
import { useStore } from '@tanstack/react-form'
import { EquipmentOptionItemInputSchema } from '@/schemas'
import { useFormStore } from '@/store'

const StartingEquipmentStep = () => {
  const formStore = useFormStore()

  const form = useAppForm({
    defaultValues: ClassInputSchema.parse(formStore.current),
  })

  const { AppField } = form

  const equipmentGroups = useStore(form.store, (state) => state.values.equipment)

  useEffect(() => {
    if (equipmentGroups?.length) {
      equipmentGroups?.forEach((o, i) => {
        if (!o?.length) {
          form.setFieldValue(`equipment[${i}]`, [[]])
          formStore.updateField({ path: `equipment[${i}]`, value: [[]] })
        }
      })
    }
  }, [equipmentGroups, form, formStore])

  return (
    <Grid>
      <AppField name='equipment' mode='array'>
        {(field) => (
          <>
            <Grid.Col>
              <Grid>
                <Grid.Col span={2}>
                  <Button
                    variant='outline'
                    fullWidth
                    onClick={() => {
                      const equipmentObject = [[EquipmentOptionItemInputSchema.parse({ equipment: [] })]]
                      formStore.updateField({ path: 'equipment', value: equipmentObject })
                      field.pushValue(equipmentObject)
                    }}
                  >
                    Add Equipment Group
                  </Button>
                </Grid.Col>
              </Grid>
            </Grid.Col>
            {field.state.value?.length && (
              <Grid.Col>
                <field.AccordionField name='equipment'>
                  {field.state.value?.map((_, i) => (
                    <AppField name={`equipment[${i}]`} mode='array'>
                      {(subfield) =>
                        subfield.state.value?.length && (
                          <EquipmentGroup
                            key={`${i}-equipment-group`}
                            fields={`equipment[${i}]`}
                            form={form}
                            index={i}
                            removeFn={() => {
                              if (field.state.value?.length === 1) {
                                formStore.removeField({ path: 'equipment' })
                                field.removeValue(0)
                              } else {
                                formStore.removeField({ path: `equipment[${i}]` })
                                subfield.removeValue(i)
                              }
                            }}
                            updateFn={() => {
                              const equipmentObject = [EquipmentOptionItemInputSchema.parse({})]
                              formStore.updateField({ path: `equipment[${i}]`, value: equipmentObject })
                              subfield.pushValue(equipmentObject)
                            }}
                            __kind={'ClassInput'}
                          />
                        )
                      }
                    </AppField>
                  ))}
                </field.AccordionField>
              </Grid.Col>
            )}
          </>
        )}
      </AppField>
    </Grid>
  )
}

export default StartingEquipmentStep
