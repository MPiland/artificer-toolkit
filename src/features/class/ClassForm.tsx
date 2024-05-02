import Form from '../../components/Form/Form'
import { useAddNewClassMutation, useUpdateClassMutation } from './classApiSlice'
import { Step } from '../../utils/types'
import FormStepsProvider from '../../components/Form/FormStepsProvider'

const ClassForm = () => {
  const steps: Step[] = ['Details', 'Proficiencies', 'Equipment', 'Attributes', 'Features']

  return (
    <FormStepsProvider
      steps={steps}
      stepFilter={{
        name: 'category.name',
        value: 'subclass',
        filter: 'Equipment',
      }}
    >
      <Form useUpdateItem={useUpdateClassMutation} useAddNewItem={useAddNewClassMutation} />
    </FormStepsProvider>
  )
}
export default ClassForm
