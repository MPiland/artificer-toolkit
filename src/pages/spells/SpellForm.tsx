import { useEffect, use } from 'react'
import { useAddNewSpellMutation, useUpdateSpellMutation } from '../../apis/spellsApi'
import { Step } from '../../types/form'
import Form from '../../components/Form/Form'
import { FormContext } from '../../components/Form/FormContext'
import { isEqual } from 'lodash'

const SpellForm = () => {
  const { setSteps, steps } = use(FormContext)

  const stepsArray = [
    { id: 'details', label: 'Details' },
    { id: 'attributes', label: 'Attributes' },
  ] satisfies Step[]

  useEffect(() => {
    if (!isEqual(steps, stepsArray)) {
      setSteps(stepsArray)
    }
  }, [setSteps, stepsArray, steps])

  return <Form useAddNewItemMutation={useAddNewSpellMutation} useUpdateItemMutation={useUpdateSpellMutation} />
}

export default SpellForm
