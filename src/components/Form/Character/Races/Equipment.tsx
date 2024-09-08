import { useGetBuildersQuery } from '../../../../features/builders/buildersApi'
import { useForm } from '../../../../hooks/UseForm'
import Dropdown from '../../../Dropdown/Dropdown'

const Equipment = () => {
  const { formState, setFormState } = useForm()

  const { data: builders } = useGetBuildersQuery()

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
