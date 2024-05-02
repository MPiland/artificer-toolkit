import Form from '../../components/Form/Form'
import { useAddNewItemMutation, useUpdateItemMutation } from './itemApiSlice'
import { Step } from '../../utils/types'
import FormStepsProvider from '../../components/Form/FormStepsProvider'

const ItemForm = () => {
  const steps: Step[] = ['Details', 'Attributes', 'Features']

  return (
    <FormStepsProvider steps={steps}>
      <Form useUpdateItem={useUpdateItemMutation} useAddNewItem={useAddNewItemMutation} />
    </FormStepsProvider>
  )
}
export default ItemForm
