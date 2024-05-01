import Form from '../../components/Form/Form'
import { useAddNewItemMutation, useUpdateItemMutation } from './itemApiSlice'
import { Step } from '../../utils/types'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const ItemForm = () => {
  const location = useLocation()

  const formItem = location.state?.item

  const steps: Step[] = ['Details', 'Attributes', 'Features']

  // Inject form step based on attribute
  useEffect(() => {
    if (formItem?.attribute?.some((attributeItem: any) => attributeItem.name === 'containsItems')) {
      steps.push('Contains')
    }
  })

  return (
    <Form context='item' steps={steps} useUpdateItem={useUpdateItemMutation} useAddNewItem={useAddNewItemMutation} />
  )
}
export default ItemForm
