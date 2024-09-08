import Form from '../../components/Form/Form'
import { StepType } from '../../utils/types'
import { useAddNewCharacterMutation, useUpdateCharacterMutation } from './charactersApi'
import { useEffect, useMemo } from 'react'
import { useForm } from '../../hooks/UseForm'
import { Outlet } from 'react-router-dom'

const CharacterForm = () => {
  const { setSteps } = useForm()

  const stepsArray: StepType[] = useMemo(
    () => [
      { id: 'details', name: 'Details' },
      { id: 'race', name: 'Race' },
      { id: 'class', name: 'Class' },
      { id: 'abilities', name: 'Abilities' },
      { id: 'equipment', name: 'Equipment' },
      { id: 'background', name: 'Background' },
    ],
    []
  )

  useEffect(() => {
    setSteps(stepsArray)
  }, [setSteps, stepsArray])

  return (
    <>
      <Form useUpdateItem={useUpdateCharacterMutation} useAddNewItem={useAddNewCharacterMutation} />
      <Outlet />
    </>
  )
}
export default CharacterForm
