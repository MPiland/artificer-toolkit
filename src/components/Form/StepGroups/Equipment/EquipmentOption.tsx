import { Grid, Divider } from '@mantine/core'
import EquipmentOptionItem from './EquipmentOptionItem'
import { withFieldGroup } from '@/components/Form'
import type { EquipmentOptionItemInput } from 'gql/types'

const EquipmentOption = withFieldGroup({
  defaultValues: [] as EquipmentOptionItemInput[],
  props: {
    index: 0,
    __kind: '' as 'ClassInput' | 'BackgroundInput',
    removeFn: (() => undefined) as () => void,
    updateFn: (() => undefined) as () => void,
  },
  render: function Render({ group, index, __kind, updateFn, removeFn }) {
    const { Subscribe } = group
    return (
      <Subscribe selector={(state) => state.values}>
        {(values) => (
          <>
            <Grid key={`${index}-equipment-option`}>
              {values?.length > 0 &&
                values?.map(
                  (_, i) =>
                    group && (
                      <EquipmentOptionItem
                        key={`${i}-equipment-option-item`}
                        fields={`[${i}]`}
                        form={group}
                        __kind={__kind}
                        updateFn={() => updateFn()}
                        removeFn={() => removeFn()}
                      />
                    )
                )}
            </Grid>
            {index !== values?.length - 1 && <Divider label={'OR'} />}
          </>
        )}
      </Subscribe>
    )
  },
})

export default EquipmentOption
