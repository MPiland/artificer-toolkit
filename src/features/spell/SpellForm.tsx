import Form from '../../components/Form/Form'
import { useAddNewSpellMutation, useUpdateSpellMutation } from './spellApiSlice'
import { Step } from '../../utils/types'

const SpellForm = () => {
  const steps: Step[] = ['Details', 'Attributes']

  return (
    <Form context='spell' steps={steps} useAddNewItem={useAddNewSpellMutation} useUpdateItem={useUpdateSpellMutation} />
  )
}
export default SpellForm
