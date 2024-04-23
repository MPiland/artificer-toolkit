import Form from '../../components/Form/Form'
import { Step } from '../../utils/types'
import { useAddNewCharacterMutation, useUpdateCharacterMutation } from './charactersApiSlice'

const CharacterForm = () => {
  const steps: Step[] = ['Details', 'Race', 'Class', 'Abilities', 'Equipment', 'Background']

  return (
    <Form
      context='character'
      steps={steps}
      useUpdateItem={useUpdateCharacterMutation}
      useAddNewItem={useAddNewCharacterMutation}
    />
  )
}
export default CharacterForm
