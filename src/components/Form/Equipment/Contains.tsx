import { useEffect } from 'react'
import Table from '../../Table/Table'
import { useGetEquipmentQuery } from '../../../features/equipment/equipmentApi'
import { useForm } from '../../../hooks/UseForm'

const ContainsForm = () => {
  const { formState, setFormState } = useForm()

  const { data: items } = useGetEquipmentQuery() as { data: any[] }

  //Create contains data for table
  useEffect(() => {
    if (!formState.contains) {
      setFormState({ type: 'added', target: { name: 'contains' } })
    }
  }, [setFormState, formState.contains])

  return (
    <>
      <Table
        name='contains'
        rows={{
          inputs: [
            {
              name: 'item',
              type: 'select',
              options: items?.filter((item: any) =>
                formState.containsFilter?.length > 0
                  ? formState.containsFilter?.some((categoryItem: any) => categoryItem.name === item.categoryItem.name)
                  : item
              ),
            },
            {
              name: 'quantity',
              validation: 'num',
              errorMsg: 'Must be whole numbers only',
            },
          ],
          headers: [
            {
              value: 'Item',
            },
            {
              value: 'Quantity',
            },
          ],
        }}
        value={formState.contains}
        addRow={true}
        onChange={setFormState}
      />
    </>
  )
}

export default ContainsForm
