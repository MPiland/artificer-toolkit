import Form from '../../components/Form/Form'
import { useAddNewFeatMutation, useUpdateFeatMutation } from './featApiSlice'
import { Step } from '../../utils/types'
import FormStepsProvider from '../../components/Form/FormStepsProvider'

const FeatForm = () => {
  const steps: Step[] = ['Features']

  return (
    <FormStepsProvider steps={steps}>
      <Form useAddNewItem={useAddNewFeatMutation} useUpdateItem={useUpdateFeatMutation} />
    </FormStepsProvider>
  )
}
export default FeatForm
