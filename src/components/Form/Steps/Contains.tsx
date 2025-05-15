import { useEffect, use } from 'react'
import { FormContext } from '../FormContext'
import Input from '@/components/Input'
import Dropdown from '@/components/Dropdown'
import { useEquipmentData } from '@/hooks'
import type { OnChange, Equipment } from '@/types'
import { Grid } from '@mantine/core'

const ContainsStep = () => {
  const {
    formStore: { data, updateField, addField, removeField },
  } = use(FormContext) as {
    formStore: {
      data: Equipment
      updateField: OnChange<Equipment>['updateField']
      removeField: OnChange<Equipment>['removeField']
      addField: OnChange<Equipment>['addField']
    }
  }

  const { equipment } = useEquipmentData()

  //Create contains formData for table
  useEffect(() => {
    if (!data.contains) {
      addField({ path: 'contains' })
    }
  }, [addField, data.contains])

  return (
    <>
      <Grid.Col>
        <Grid>
          <Grid.Col >Equipment</Grid.Col>
          <Grid.Col >Quantity</Grid.Col>
        </Grid>
      </Grid.Col>
      {data.contains?.map((contain, index) => (
        <Grid.Col key={index}>
          <Grid>
            <Grid.Col >
              <Dropdown
                name={`contains.${index}.id`}
                value={contain.id}
                required={true}
                options={equipment}
                errorMsg='Please enter a whole number'
                onChange={{ updateField, removeField }}
              />
            </Grid.Col>
            <Grid.Col >
              <Input
                name={`contains.${index}.quantity`}
                value={contain.quantity}
                validation='num'
                errorMsg='Please enter a whole number'
                required={true}
                onChange={{ updateField }}
              />
            </Grid.Col>
          </Grid>
        </Grid.Col>
      ))}
    </>
  )
}

export default ContainsStep
