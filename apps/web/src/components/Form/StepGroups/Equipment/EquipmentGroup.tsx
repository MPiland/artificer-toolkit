import { Grid, Button, Divider } from '@mantine/core'
import EquipmentOption from './EquipmentOption'
import { Fragment, useEffect } from 'react'
import { useOptimizedSelector, useTypedFormStore } from '~store'
import type { BackgroundInput, ClassInput } from '~types'
import { EquipmentOptionItemInputSchema } from '~schemas'
import { sprinkles } from '~css/sprinkles.css'
import { useFormField } from '~hooks'

const EquipmentGroup = ({ index, removeFn }: { index: number; removeFn: () => void }) => {
  const store = useTypedFormStore<ClassInput | BackgroundInput>()

  const { AppField } = useFormField({ store })

  const { equipment, updateField } = useOptimizedSelector(store, (state) => ({
    equipment: state.current?.equipment,
    updateField: state.updateField,
  }))

  useEffect(() => {
    if (!equipment?.[index]?.length) {
      updateField({ path: `equipment[${index}][0]`, value: [] })
    }
  }, [updateField, equipment, index])

  return (
    <AppField name={`equipment[${index}]`} mode='array'>
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
                <AppField key={`equipment-option-${oI}`} name={`equipment[${index}][${oI}]`} mode='array'>
                  {() => (
                    <Fragment key={`equipment-option-fragment-${oI}`}>
                      <EquipmentOption
                        groupIndex={index}
                        index={oI}
                        key={`equipment-option-${oI}`}
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
}

export default EquipmentGroup
