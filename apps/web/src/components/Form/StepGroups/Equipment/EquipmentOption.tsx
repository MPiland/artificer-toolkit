import { Grid } from '@mantine/core'
import EquipmentOptionItem from './EquipmentOptionItem'
import type { BackgroundInput, ClassInput } from '~types'
import { EquipmentOptionItemInputSchema } from '~schemas'
import {  useTypedFormStore } from '~store'
import { useFormField } from '~hooks'

const EquipmentOption = ({
  index,
  groupIndex,
  removeFn,
}: {
  index: number
  groupIndex: number
  removeFn: () => void
}) => {
  const store = useTypedFormStore<ClassInput | BackgroundInput>()

  const { AppField } = useFormField({ store })
  return (
    <AppField name={`equipment[${groupIndex}][${index}]`} mode='array'>
      {(eItems) =>
        eItems.state.value?.length && (
          <Grid align='center'>
            {eItems.state.value?.map(
              (item, i) =>
                item && (
                  <EquipmentOptionItem
                    key={`equipment-option-item-${i}`}
                    index={i}
                    optionIndex={index}
                    groupIndex={groupIndex}
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
}

export default EquipmentOption
