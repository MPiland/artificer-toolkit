import { Grid } from '@mantine/core'
import EquipmentOptionItem from './EquipmentOptionItem'
import { withFieldGroup } from '@/components/Form'
import type { EquipmentOptionItemInput } from '@/types'
import { EquipmentOptionItemInputSchema } from '@/schemas'

const EquipmentOption = withFieldGroup({
  defaultValues: {
    equipmentItems: [] as EquipmentOptionItemInput[] | null | undefined,
  },
  props: {
    __kind: '' as 'ClassInput' | 'BackgroundInput',
    index: 0 as number,
    groupIndex: 0 as number,
    removeFn: (() => {}) as () => void,
  },
  render: function Render({ group, __kind, removeFn, index, groupIndex }) {
    const { AppField } = group
    return (
      <AppField name='equipmentItems' mode='array'>
        {(eItems) =>
          eItems.state.value?.length && (
            <Grid align='center'>
              {eItems.state.value?.map(
                (_, i) =>
                  group && (
                    <EquipmentOptionItem
                      key={`equipment-option-item-${i}`}
                      index={i}
                      optionIndex={index}
                      groupIndex={groupIndex}
                      fields={{
                        attributes: `equipmentItems[${i}].attributes`,
                        category: `equipmentItems[${i}].category`,
                        equipmentOptionItem: `equipmentItems[${i}]`,
                        properties: `equipmentItems[${i}].properties`,
                        selectionCount: `equipmentItems[${i}].selectionCount`,
                        quantity: `equipmentItems[${i}].quantity`,
                        currencies: `equipmentItems[${i}].currencies`,
                        equipment: `equipmentItems[${i}].equipment`,
                      }}
                      form={group}
                      __kind={__kind}
                      addFn={() => {
                        const eItemObject = EquipmentOptionItemInputSchema.parse({})
                        eItems.pushValue(eItemObject)
                      }}
                      removeFn={() => {
                        if (eItems.state.value?.length === 1) {
                          removeFn()
                        } else {
                          eItems.removeValue(i)
                        }
                      }}
                    />
                  )
              )}
            </Grid>
          )
        }
      </AppField>
    )
  },
})

export default EquipmentOption
