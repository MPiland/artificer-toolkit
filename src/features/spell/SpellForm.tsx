import Form from '../../components/Form/Form'
import { useAddNewSpellMutation, useUpdateSpellMutation } from './spellApiSlice'
import { Step } from '../../utils/types'
import FormStepsProvider from '../../components/Form/FormStepsProvider'

const SpellForm = () => {
  const steps: Step[] = ['Details', 'Attributes']

  return (
    <FormStepsProvider steps={steps}>
      <Form useAddNewItem={useAddNewSpellMutation} useUpdateItem={useUpdateSpellMutation} />
    </FormStepsProvider>
  )
}
export default SpellForm
