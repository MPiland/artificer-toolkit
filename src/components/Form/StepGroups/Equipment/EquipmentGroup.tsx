import { Grid, Button, Divider } from '@mantine/core'
import EquipmentOption from './EquipmentOption'
import { withFieldGroup } from '@/components/Form'
import { Fragment, useEffect } from 'react'
import { useTypedFormStore } from '@/store'
import type { ClassInput, EquipmentOptionItemInput } from '@/types'
import { EquipmentOptionItemInputSchema } from '@/schemas'
import { sprinkles } from '@/css/sprinkles.css'

const EquipmentGroup = withFieldGroup({
  defaultValues: {
    equipmentOptions: [[]] as EquipmentOptionItemInput[][] | null | undefined,
  },
  props: {
    index: 0,
    __kind: '' as 'ClassInput' | 'BackgroundInput',
    removeFn: (() => {}) as () => void,
  },
  render: function Render({ group, index, __kind, removeFn }) {
    const store = useTypedFormStore<ClassInput>()
    const equipment = store((state) => state.current?.equipment)
    const updateField = store((state) => state.updateField)

    const { AppField } = group

    useEffect(() => {
      if (!equipment?.[index]?.length) {
        group.setFieldValue(`equipmentOptions[0]`, [])
        updateField({ path: `equipment[${index}][0]`, value: [] })
      }
    }, [group, updateField, equipment, index])

    return (
      <AppField name='equipmentOptions' mode='array'>
        {(eOptions) => (
          <Grid>
            <Grid.Col span={2}>
              <Button
                variant='outline'
                onClick={() => {
                  const newIndex = eOptions.state.value?.length ?? 0
                  const equipGroupInputObj = EquipmentOptionItemInputSchema.parse({
                    __kind: 'EquipmentOptionItemInput',
                  })
                  eOptions.pushValue([equipGroupInputObj])
                  updateField({
                    path: `equipment[${index}][${newIndex}]`,
                    value: [equipGroupInputObj],
                  })
                }}
              >
                Add Option
              </Button>
            </Grid.Col>
            <Grid.Col>
              {eOptions.state.value?.length &&
                eOptions.state.value?.map((_, oI) => (
                  <AppField key={`equipment-option-${oI}`} name={`equipmentOptions[${oI}]`} mode='array'>
                    {() => (
                      <Fragment key={`equipment-option-fragment-${oI}`}>
                        <EquipmentOption
                          fields={{
                            equipmentItems: `equipmentOptions[${oI}]`,
                          }}
                          groupIndex={index}
                          index={oI}
                          key={`equipment-option-${oI}`}
                          form={group}
                          __kind={__kind}
                          removeFn={() => {
                            if (eOptions.state.value?.length === 1) {
                              removeFn()
                            } else {
                              eOptions.removeValue(oI)
                            }
                          }}
                        />
                        {oI !== (eOptions.state.value?.length as number) - 1 && (
                          <Divider label={'OR'} className={sprinkles({ my: 'space-4' })} />
                        )}
                      </Fragment>
                    )}
                  </AppField>
                ))}
            </Grid.Col>
          </Grid>
        )}
      </AppField>
    )
  },
})

export default EquipmentGroup
