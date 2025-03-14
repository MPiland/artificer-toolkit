import { useEffect, use } from 'react'
import Form from '../../components/Form/Form'
import { Step } from '../../types/form'
import { useAddNewCharacterMutation, useUpdateCharacterMutation } from './charactersApi'
import { FormContext } from '../../components/Form/FormContext'
import { isEqual } from 'lodash'

const CharacterForm = () => {
  const { setSteps, steps } = use(FormContext)

  const stepsArray = [
    { id: 'details', label: 'Details' },
    { id: 'race', label: 'Race' },
    { id: 'class', label: 'Class' },
    { id: 'abilities', label: 'Abilities' },
    { id: 'background', label: 'Background' },
    { id: 'equipment', label: 'Equipment' },
  ] satisfies Step[]

  useEffect(() => {
    if (!isEqual(steps, stepsArray)) {
      setSteps(stepsArray)
    }
  }, [setSteps, stepsArray, steps])

  return <Form useUpdateItemMutation={useUpdateCharacterMutation} useAddNewItemMutation={useAddNewCharacterMutation} />
}

export default CharacterForm
