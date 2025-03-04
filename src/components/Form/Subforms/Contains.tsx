import { useEffect, use } from 'react'
import { useListEquipmentQuery } from '../../../features/equipment/equipmentApi'
import { Equipment } from '../../../../amplify/gql/types'
import { UpdateState } from '../../../types/form'
import { FormContext } from '../FormContext'
import Input from '../../Input/Input'
import Dropdown from '../../Dropdown/Dropdown'
import Grid from '../../Grid/Grid'

const ContainsForm = () => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Equipment
    updateFormData: (state: UpdateState<Equipment>) => void
  }

  const { data: equipment } = useListEquipmentQuery()

  //Create contains formData for table
  useEffect(() => {
    if (!formData.contains) {
      updateFormData({ type: 'add', path: 'contains' })
    }
  }, [updateFormData, formData.contains])

  return (
    <Grid>
      <Grid.Item>
        <Grid>
          <Grid.Item colSpan={'auto'}>Equipment</Grid.Item>
          <Grid.Item colSpan={'auto'}>Quantity</Grid.Item>
        </Grid>
      </Grid.Item>
      {formData.contains?.map((contain, index) => (
        <Grid.Item key={index}>
          <Grid>
            <Grid.Item colSpan={'auto'}>
              <Dropdown
                name={`contains.${index}.equipment`}
                value={contain.equipment}
                required={true}
                options={equipment}
                errorMsg='Please enter a whole number'
                onChange={updateFormData}
              />
            </Grid.Item>
            <Grid.Item colSpan={'auto'}>
              <Input
                name={`contains.${index}.quantity`}
                value={contain.quantity}
                validation='num'
                errorMsg='Please enter a whole number'
                required={true}
                onChange={updateFormData}
              />
            </Grid.Item>
          </Grid>
        </Grid.Item>
      ))}
    </Grid>
  )
}

export default ContainsForm
