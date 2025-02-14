import { useEffect, use } from 'react'
import { useListEquipmentQuery } from '../../../features/equipment/equipmentApi'
import { Equipment } from '../../../../amplify/gql/types'
import { UpdateState } from '../../../types/form'
import { FormContext } from '../FormContext'
import Row from '../../Row/Row'
import Input from '../../Input/Input'
import Dropdown from '../../Dropdown/Dropdown'

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
    <>
      <Row spacing='flexStart' cellSize='auto'>
        <span>Equipment</span>
        <span>Quantity</span>
      </Row>
      {formData.contains?.map((contain, index) => (
        <Row key={index} spacing='flexStart' cellSize='auto'>
          <Dropdown
            name={`contains.${index}.equipment`}
            value={contain.equipment}
            required={true}
            options={equipment}
            errorMsg='Please enter a whole number'
            onChange={updateFormData}
          />
          <Input
            name={`contains.${index}.quantity`}
            value={contain.quantity}
            validation='num'
            errorMsg='Please enter a whole number'
            required={true}
            onChange={updateFormData}
          />
        </Row>
      ))}
    </>
  )
}

export default ContainsForm
