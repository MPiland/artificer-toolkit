import { useContext, useEffect } from 'react'
import Table from '../../Table/Table'
import { useGetItemsQuery, selectAllItems } from '../../../features/item/itemApiSlice'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { form_content } from '../Form.css'
import { FormStepsContext } from '../FormStepsContext'

const ContainsFormTest = () => {
  const { formState, setFormState } = useContext(FormStepsContext)

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: data && selectAllItems(data),
    }),
  })

  //Create contains data for table
  useEffect(() => {
    if (!formState.contains) {
      setFormState({ type: 'added', target: { name: 'contains' } })
    }
  }, [setFormState, formState.contains])

  return (
    <ScrollArea scrollDirection='vertical' className={form_content}>
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
    </ScrollArea>
  )
}

export default ContainsFormTest
