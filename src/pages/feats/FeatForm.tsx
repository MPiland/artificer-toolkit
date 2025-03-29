import { useEffect, use } from 'react'
import Form from '../../components/Form/Form'
import { useAddNewFeatMutation, useUpdateFeatMutation } from '../../apis/featsApi'
import { Step } from '../../types/form'
import { FormContext } from '../../components/Form/FormContext'
import { isEqual } from 'lodash'

const FeatForm = () => {
  const { setSteps, steps } = use(FormContext)

  const stepsArray = [{ id: 'features', label: 'Features' }] satisfies Step[]

  useEffect(() => {
    if (!isEqual(steps, stepsArray)) {
      setSteps(stepsArray)
    }
  }, [setSteps, stepsArray, steps])

  return <Form useAddNewItemMutation={useAddNewFeatMutation} useUpdateItemMutation={useUpdateFeatMutation} />
}

export default FeatForm
