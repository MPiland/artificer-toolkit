import Form from '../../components/Form/Form'
import {
  useAddNewItemMutation,
  useUpdateItemMutation,
  useGetItemsQuery,
  selectItemById,
} from './itemApiSlice'
import { useLocation, useParams } from 'react-router-dom'
import { FormContext, Step } from '../../utils/types'

const ItemForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const { item } = useGetItemsQuery('itemsList', {
    selectFromResult: ({ data }) => ({
      item: data && selectItemById(data, location?.state?.data?._id),
    }),
  })

  const steps: Step[] = ['Details', 'Attributes', 'Features']

  return (
    <Form
      context={{ type: context, title: 'item' } as FormContext}
      steps={steps}
      item={item}
      location={location}
      useUpdateItem={useUpdateItemMutation}
      useAddNewItem={useAddNewItemMutation}
    />
  )
}
export default ItemForm
