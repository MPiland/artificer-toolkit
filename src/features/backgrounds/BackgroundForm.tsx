import Form from '../../components/Form/Form'
import { useAddNewBackgroundMutation, useUpdateBackgroundMutation } from './backgroundsApi'
import { StepType } from '../../utils/types'
import { useEffect, useMemo } from 'react'
import { isEqual } from 'lodash'
import { useForm } from '../../hooks/UseForm'

const BackgroundForm = () => {
  const { steps, setSteps } = useForm()

  const stepsArray: StepType[] = useMemo(
    () => [
      { id: 'details', name: 'Details' },
      { id: 'proficiencies', name: 'Proficiencies' },
      { id: 'equipment', name: 'Equipment' },
      { id: 'features', name: 'Features' },
    ],
    []
  )

  useEffect(() => {
    if (!isEqual(stepsArray, steps)) {
      setSteps(stepsArray)
    }
  }, [setSteps, steps, stepsArray])

  return <Form useAddNewItem={useAddNewBackgroundMutation} useUpdateItem={useUpdateBackgroundMutation} />
}
export default BackgroundForm
