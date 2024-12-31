import { Character } from '../../../../amplify/API'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { UpdateState } from '../../../types/form'
import Dropdown from '../../Dropdown/Dropdown'
import { use } from 'react'
import { FormContext } from '../FormContext'

const Equipment = () => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const { data: system } = useGetSystemQuery()

  return (
    <>
      <Dropdown
        name='startingEquipment.option'
        value={formData?.startingEquipment.option}
        label='Equipment or Gold'
        onChange={updateFormData}
        options={system.characters.startingEquipmentOptions}
      />
    </>
  )
}

export default Equipment
