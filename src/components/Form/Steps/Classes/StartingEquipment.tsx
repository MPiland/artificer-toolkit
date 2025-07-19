import { useEffect } from 'react'
import { Grid, Button } from '@mantine/core'
import { EquipmentGroup, withForm } from '@/components/Form'
import { EquipmentOptionItemInputSchema, ClassInputSchema } from '@/schemas'
import { z } from 'zod/v4'
import { useTypedFormStore } from '@/store'
import Accordion from '@/components/Accordion'
import type { EquipmentOptionItemInput, ClassInput } from '@/types'

const StartingEquipmentStep = withForm({
  defaultValues: {} as z.input<typeof ClassInputSchema>,
  render: function Render({ form }) {
    const { AppField } = form

    const store = useTypedFormStore<ClassInput>()
    const equipment = store((state) => state.current?.equipment)
    const updateField = store((state) => state.updateField)
    const removeField = store((state) => state.removeField)

    useEffect(() => {
      if (equipment?.length) {
        equipment?.forEach((o, i) => {
          if (!o?.length) {
            form.setFieldValue(`equipment[${i}]`, [[]])
            updateField({ path: `equipment[${i}]`, value: [[]] })
          }
        })
      }
    }, [form, updateField, equipment])

    return (
      <Grid>
        <AppField name='equipment' mode='array'>
          {(eGroups) => (
            <>
              <Grid.Col>
                <Grid>
                  <Grid.Col span={2}>
                    <Button
                      variant='outline'
                      fullWidth
                      onClick={() => {
                        const equipmentObject = EquipmentOptionItemInputSchema.parse({ equipment: [] })
                        updateField({ path: 'equipment', value: equipmentObject })
                        eGroups.pushValue([[equipmentObject]])
                      }}
                    >
                      Add Equipment Group
                    </Button>
                  </Grid.Col>
                </Grid>
              </Grid.Col>
              {eGroups.state.value?.length && (
                <Grid.Col>
                  <Accordion
                    dataArray={eGroups.state.value}
                    onChange={(dataArray) => eGroups.handleChange(dataArray as EquipmentOptionItemInput[][][])}
                  >
                    {eGroups.state.value?.map((_, i) => (
                      <Accordion.Item
                        key={`equipment-group-${i}`}
                        itemId={`equipment-group-${i}`}
                        value={`equipment-group-${i}`}
                      >
                        <AppField name={`equipment[${i}]`} mode='array'>
                          {(eGroup) => (
                            <>
                              <Accordion.Trigger
                                removeFn={() => {
                                  if (eGroups.state.value?.length === 1) {
                                    removeField({ path: 'equipment' })
                                    eGroups.setValue(null)
                                  } else {
                                    removeField({ path: `equipment[${i}]` })
                                    eGroups.removeValue(i)
                                  }
                                }}
                                title={`Equipment Group ${i + 1}`}
                              />
                              <Accordion.Content>
                                <EquipmentGroup
                                  key={`equipment-group-${i}`}
                                  fields={{
                                    equipmentOptions: `equipment[${i}]`,
                                  }}
                                  form={form}
                                  index={i}
                                  __kind={'ClassInput'}
                                  removeFn={() => {
                                    if (eGroups.state.value?.length === 1) {
                                      removeField({ path: 'equipment' })
                                      eGroups.setValue(null)
                                    } else {
                                      removeField({ path: `equipment[${i}]` })
                                      eGroup.removeValue(i)
                                    }
                                  }}
                                />
                              </Accordion.Content>
                            </>
                          )}
                        </AppField>
                      </Accordion.Item>
                    ))}
                  </Accordion>
                </Grid.Col>
              )}
            </>
          )}
        </AppField>
      </Grid>
    )
  },
})

export default StartingEquipmentStep
