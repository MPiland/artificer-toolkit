import Form from '../../components/Form/Form'
import { useAddNewItemMutation, useUpdateItemMutation } from './itemApiSlice'
import { Step } from '../../utils/types'

const ItemForm = () => {
  const steps: Step[] = ['Details', 'Attributes', 'Features']

  return (
    <Form context='item' steps={steps} useUpdateItem={useUpdateItemMutation} useAddNewItem={useAddNewItemMutation} />
  )
}
export default ItemForm
