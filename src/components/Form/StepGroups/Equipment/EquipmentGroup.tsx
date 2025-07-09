import { Grid, Button } from '@mantine/core'
import Accordion from '@/components/Accordion'
import EquipmentOption from './EquipmentOption'
import { withFieldGroup } from '@/components/Form'
import { EquipmentOptionItemInputSchema } from '@/schemas'
import { useStore } from '@tanstack/react-form'
import { useEffect } from 'react'
import { useFormStore } from '@/store'
import type { EquipmentOptionItemInput } from 'gql/types'

const EquipmentGroup = withFieldGroup({
  defaultValues: [[]] as EquipmentOptionItemInput[][],
  props: {
    index: 0,
    removeFn: (() => undefined) as () => void,
    updateFn: (() => undefined) as () => void,
    __kind: '' as 'ClassInput' | 'BackgroundInput',
  },
  render: function Render({ group, index, removeFn, updateFn, __kind }) {
    const { AppField, Subscribe } = group

    const formStore = useFormStore()

    const equipmentOptions = useStore(group.store, (state) => state.values)

    useEffect(() => {
      if (!equipmentOptions?.length) {
        group.setFieldValue(`[0]`, [])
        formStore.updateField({ path: `equipment[${index}][0]`, value: [] })
      }
    }, [equipmentOptions, group, formStore, index])

    return (
      <Subscribe selector={(state) => ({ values: state.values })}>
        {({ values }) => (
          <Accordion.Item itemId={`${index}-equipment-group`} value={`${index}-equipment-group`}>
            <Accordion.Trigger removeFn={() => removeFn()}>{`Equipment Group ${index + 1}`}</Accordion.Trigger>
            <Accordion.Content>
              <Grid>
                <Grid.Col span={2}>
                  <Button variant='outline' onClick={() => updateFn()}>
                    Add Option
                  </Button>
                </Grid.Col>
                <Grid.Col>
                  {values?.length > 0 &&
                    values?.map((_, oI) => (
                      <AppField name={`[${oI}]`} key={`${oI}-equipment-option`} mode='array'>
                        {(field) =>
                          field.state.value?.length && (
                            <EquipmentOption
                              fields={`[${oI}]`}
                              form={group}
                              index={oI}
                              __kind={__kind}
                              removeFn={() => {
                                if (field.state.value.length === 1) {
                                  removeFn()
                                } else {
                                  field.removeValue(oI)
                                }
                              }}
                              updateFn={() => field.pushValue(EquipmentOptionItemInputSchema.parse({}))}
                            />
                          )
                        }
                      </AppField>
                    ))}
                </Grid.Col>
              </Grid>
            </Accordion.Content>
          </Accordion.Item>
        )}
      </Subscribe>
    )
  },
})

export default EquipmentGroup
