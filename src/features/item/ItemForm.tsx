import Form from '../../components/Form/Form'
import {
  useAddNewItemMutation,
  useUpdateItemMutation,
} from './itemApiSlice'
import { useLocation, useParams } from 'react-router-dom'
import { FormContext, Step } from '../../utils/types'

const ItemForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const steps: Step[] = ['Details', 'Attributes', 'Features']

  return (
    <Form
      context={{ type: context, title: 'item' } as FormContext}
      steps={steps}
      item={location.state.data}
      location={location}
      useUpdateItem={useUpdateItemMutation}
      useAddNewItem={useAddNewItemMutation}
    />
  )
}
export default ItemForm
