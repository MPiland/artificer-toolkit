import { useEffect, use } from 'react'
import { useAddNewSpellMutation, useUpdateSpellMutation } from './spellsApi'
import { Step } from '../../types/form'
import Form from '../../components/Form/Form'
import { FormContext } from '../../components/Form/FormContext'

const SpellForm = () => {
  const { setSteps } = use(FormContext)

  const stepsArray = [
    { id: 'details', label: 'Details' },
    { id: 'attributes', label: 'Attributes' },
  ] satisfies Step[]

  useEffect(() => {
    setSteps(stepsArray)
  }, [setSteps, stepsArray])

  return <Form useAddNewItemMutation={useAddNewSpellMutation} useUpdateItemMutation={useUpdateSpellMutation} />
}
export default SpellForm
