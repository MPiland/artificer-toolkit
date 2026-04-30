import { useEffect } from 'react'
import { Grid, Button } from '@mantine/core'
import { EquipmentGroup } from '@components/Form'
import { EquipmentOptionItemInputSchema } from '@artificer-toolkit/shared/schemas'
import { useOptimizedSelector, useTypedFormStore } from '@store'
import Accordion from '@components/Accordion'
import type { EquipmentOptionItemInput, ClassInput } from '@types'
import { useFormField } from '@hooks'

const StartingEquipmentStep = () => {
  const store = useTypedFormStore<ClassInput>()

  const { AppField } = useFormField({ store })

  const { equipment, updateField } = useOptimizedSelector(store, (state) => ({
    equipment: state.current?.equipment,
    updateField: state.updateField
  }))

  useEffect(() => {
    if (equipment?.length) {
      equipment?.forEach((o, i) => {
        if (!o?.length) {
          updateField({ path: `equipment[${i}]`, value: [[]] })
        }
      })
    }
  }, [updateField, equipment])

  return (
    <Grid>
      <AppField name="equipment" mode="array">
        {(eGroups) => (
          <>
            <Grid.Col>
              <Grid>
                <Grid.Col span={2}>
                  <Button
                    variant="outline"
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
                      <AppField name={`equipment[${i}]`} mode="array">
                        {(eGroup) => (
                          <>
                            <Accordion.Trigger
                              removeFn={() => {
                                if (eGroups.state.value?.length === 1) {
                                  updateField({ path: 'equipment', value: undefined })
                                  eGroups.setValue(null)
                                } else {
                                  updateField({ path: `equipment[${i}]`, value: undefined })
                                  eGroups.removeValue(i)
                                }
                              }}
                              title={`Equipment Group ${i + 1}`}
                            />
                            <Accordion.Content>
                              <EquipmentGroup
                                key={`equipment-group-${i}`}
                                index={i}
                                removeFn={() => {
                                  if (eGroups.state.value?.length === 1) {
                                    updateField({ path: 'equipment', value: undefined })
                                    eGroups.setValue(null)
                                  } else {
                                    updateField({ path: `equipment[${i}]`, value: undefined })
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
}

export default StartingEquipmentStep
