import Form from '../../components/Form/Form'
import { useAddNewClassMutation, useUpdateClassMutation } from './classesApi'
import { StepType } from '../../utils/types'
import { useCallback, useEffect, useMemo } from 'react'
import { useForm } from '../../hooks/UseForm'

const ClassForm = () => {
  const { setSteps, formState } = useForm()

  const createStepsArray = useCallback((): StepType[] => {
    if (formState?.category?.name === 'subclass') {
      return [
        { id: 'details', name: 'Details' },
        { id: 'proficiencies', name: 'Proficiencies' },
        { id: 'attributes', name: 'Attributes' },
        { id: 'features', name: 'Features' },
      ]
    } else {
      return [
        { id: 'details', name: 'Details' },
        { id: 'proficiencies', name: 'Proficiencies' },
        { id: 'startingEquipment', name: 'Starting Equipment' },
        { id: 'attributes', name: 'Attributes' },
        { id: 'features', name: 'Features' },
      ]
    }
  }, [formState?.category?.name])

  const stepsArray: StepType[] = useMemo(() => createStepsArray(), [createStepsArray])

  useEffect(() => {
    setSteps(stepsArray)
  }, [setSteps, stepsArray])

  return <Form useAddNewItem={useAddNewClassMutation} useUpdateItem={useUpdateClassMutation} />
}
export default ClassForm
