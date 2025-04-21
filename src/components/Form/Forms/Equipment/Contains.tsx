import { useEffect, use } from 'react'
import { Equipment } from '../../../../../amplify/gql/types'
import { FormContext } from '../../FormContext'
import Input from '../../../Input/Input'
import Dropdown from '../../../Dropdown/Dropdown'
import Grid from '../../../Grid/Grid'
import useEquipmentData from '../../../../hooks/useEquipmentData'
import { OnChange } from '../../../../types/form'

const ContainsForm = () => {
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
  }, [addField, data])

  return (
    <>
      <Grid.Item>
        <Grid>
          <Grid.Item colSpan={'auto'}>Equipment</Grid.Item>
          <Grid.Item colSpan={'auto'}>Quantity</Grid.Item>
        </Grid>
      </Grid.Item>
      {data.contains?.map((contain, index) => (
        <Grid.Item key={index}>
          <Grid>
            <Grid.Item colSpan={'auto'}>
              <Dropdown
                name={`contains.${index}.id`}
                value={contain.id}
                required={true}
                options={equipment}
                errorMsg='Please enter a whole number'
                onChange={{ updateField, removeField }}
              />
            </Grid.Item>
            <Grid.Item colSpan={'auto'}>
              <Input
                name={`contains.${index}.quantity`}
                value={contain.quantity}
                validation='num'
                errorMsg='Please enter a whole number'
                required={true}
                onChange={{ updateField }}
              />
            </Grid.Item>
          </Grid>
        </Grid.Item>
      ))}
    </>
  )
}

export default ContainsForm
