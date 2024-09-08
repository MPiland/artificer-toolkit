import { useAddNewSpellMutation, useUpdateSpellMutation } from './spellsApi'
import { StepType } from '../../utils/types'
import { useEffect, useMemo } from 'react'
import { useForm } from '../../hooks/UseForm'
import Form from '../../components/Form/Form'

const SpellForm = () => {
  const { setSteps } = useForm()

  const stepsArray: StepType[] = useMemo(
    () => [
      { id: 'details', name: 'Details' },
      { id: 'attributes', name: 'Attributes' },
    ],
    []
  )

  useEffect(() => {
    setSteps(stepsArray)
  }, [setSteps, stepsArray])

  return <Form useAddNewItem={useAddNewSpellMutation} useUpdateItem={useUpdateSpellMutation} />
}
export default SpellForm
