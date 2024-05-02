import Form from '../../components/Form/Form'
import { useAddNewBackgroundMutation, useUpdateBackgroundMutation } from './backgroundApiSlice'
import { Step } from '../../utils/types'
import FormStepsProvider from '../../components/Form/FormStepsProvider'

const BackgroundForm = () => {
  const steps: Step[] = ['Details', 'Proficiencies', 'Equipment', 'Features']

  return (
    <FormStepsProvider steps={steps}>
      <Form useAddNewItem={useAddNewBackgroundMutation} useUpdateItem={useUpdateBackgroundMutation} />
    </FormStepsProvider>
  )
}
export default BackgroundForm
