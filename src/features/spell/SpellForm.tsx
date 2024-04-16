import Form from '../../components/Form/Form'
import { useLocation, useParams } from 'react-router-dom'
import {
  useAddNewSpellMutation,
  useUpdateSpellMutation,
} from './spellApiSlice'
import { FormContext, Step } from '../../utils/types'

const SpellForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const steps: Step[] = ['Details', 'Attributes']

  return (
    <Form
      context={{ type: context, title: 'spell' } as FormContext}
      steps={steps}
      item={location.state.data}
      location={location}
      useAddNewItem={useAddNewSpellMutation}
      useUpdateItem={useUpdateSpellMutation}
    />
  )
}
export default SpellForm
