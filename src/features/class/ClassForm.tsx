import Form from '../../components/Form/Form'
import { useAddNewClassMutation, useUpdateClassMutation } from './classApiSlice'
import { Step } from '../../utils/types'

const ClassForm = () => {
  const steps: Step[] = ['Details', 'Proficiencies', 'Equipment', 'Attributes', 'Features']

  return (
    <Form
      context='class'
      steps={steps}
      stepFilter={{
        name: 'category.name',
        value: 'subclass',
        filter: 'Equipment',
      }}
      useUpdateItem={useUpdateClassMutation}
      useAddNewItem={useAddNewClassMutation}
    />
  )
}
export default ClassForm
