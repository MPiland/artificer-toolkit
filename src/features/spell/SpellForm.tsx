import Form from '../../components/Form/Form'
import { useAddNewSpellMutation, useUpdateSpellMutation } from './spellApiSlice'
import { Step } from '../../utils/types'
import { useLocation, useParams } from 'react-router-dom'

const SpellForm = () => {
  const { context } = useParams()
  const location = useLocation()

  console.log({ location, context })

  const steps: Step[] = ['Details', 'Attributes']

  return (
    <Form context='spell' steps={steps} useAddNewItem={useAddNewSpellMutation} useUpdateItem={useUpdateSpellMutation} />
  )
}
export default SpellForm
