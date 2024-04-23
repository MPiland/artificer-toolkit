import Form from '../../components/Form/Form'
import { useAddNewFeatMutation, useUpdateFeatMutation } from './featApiSlice'
import { Step } from '../../utils/types'

const FeatForm = () => {
  const steps: Step[] = ['Features']

  return (
    <Form context='feat' steps={steps} useAddNewItem={useAddNewFeatMutation} useUpdateItem={useUpdateFeatMutation} />
  )
}
export default FeatForm
