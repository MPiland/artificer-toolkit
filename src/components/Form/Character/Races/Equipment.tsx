import { useGetSystemsQuery } from '../../../../features/systems/systemsApi'
import { useForm } from '../../../../hooks/UseForm'
import Dropdown from '../../../Dropdown/Dropdown'

const Equipment = () => {
  const { formState, setFormState } = useForm()

  const { data: builders } = useGetSystemsQuery()

  return (
    <>
      <Dropdown
        name='startingEquipment.option'
        value={formState?.startingEquipment?.option}
        label='Equipment or Gold'
        onChange={setFormState}
        options={builders.system.rules.startingEquipment}
      />
    </>
  )
}

export default Equipment
