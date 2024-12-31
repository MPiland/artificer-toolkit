import { useEffect, use } from 'react'
import Form from '../../components/Form/Form'
import { Step } from '../../types/form'
import { useAddNewCharacterMutation, useUpdateCharacterMutation } from './charactersApi'
import { Outlet } from 'react-router-dom'
import { FormContext } from '../../components/Form/FormContext'

const stepsArray = [
  { id: 'details', label: 'Details' },
  { id: 'race', label: 'Race' },
  { id: 'class', label: 'Class' },
  { id: 'abilities', label: 'Abilities' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'background', label: 'Background' },
] satisfies Step[]

const CharacterForm = () => {
  const { setSteps } = use(FormContext)

  useEffect(() => {
    setSteps(stepsArray)
  }, [setSteps])

  return (
    <>
      <Form useUpdateItemMutation={useUpdateCharacterMutation} useAddNewItemMutation={useAddNewCharacterMutation} />
      <Outlet />
    </>
  )
}

export default CharacterForm
