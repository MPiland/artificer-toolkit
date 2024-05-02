import Form from '../../components/Form/Form'
import { Step } from '../../utils/types'
import { useAddNewCharacterMutation, useUpdateCharacterMutation } from './charactersApiSlice'
import FormStepsProvider from '../../components/Form/FormStepsProvider'

const CharacterForm = () => {
  const steps: Step[] = ['Details', 'Race', 'Class', 'Abilities', 'Equipment', 'Background']

  return (
    <FormStepsProvider steps={steps}>
      <Form useUpdateItem={useUpdateCharacterMutation} useAddNewItem={useAddNewCharacterMutation} />
    </FormStepsProvider>
  )
}
export default CharacterForm
