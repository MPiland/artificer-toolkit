import { useEffect, use } from 'react'
import Form from '../../components/Form/Form'
import { useAddNewClassMutation, useUpdateClassMutation } from './classesApi'
import { useGetSystemQuery } from '../systems/systemsApi'
import { Step } from '../../types/form'
import { FormContext } from '../../components/Form/FormContext'
import { isEqual } from 'lodash'
import { Categories } from '../../types/enums'

const ClassForm = () => {
  const { setSteps, formData, steps } = use(FormContext)
  const { data: system } = useGetSystemQuery()

  const baseStepArray = [
    { id: 'details', label: 'Details' },
    { id: 'proficiencies', label: 'Proficiencies' },
    { id: 'startingEquipment', label: 'Starting Equipment' },
    { id: 'attributes', label: 'Attributes' },
    { id: 'features', label: 'Features' },
  ] satisfies Step[]

  const subclassStepArray = [
    { id: 'details', label: 'Details' },
    { id: 'proficiencies', label: 'Proficiencies' },
    { id: 'attributes', label: 'Attributes' },
    { id: 'features', label: 'Features' },
  ] satisfies Step[]

  useEffect(() => {
    if (formData.__typename === 'Class') {
      if (formData.category === Categories.subclass) {
        if (!isEqual(steps, subclassStepArray)) {
          return setSteps(subclassStepArray)
        }
      } else if (!isEqual(steps, baseStepArray)) {
        return setSteps(baseStepArray)
      }
    }
  }, [setSteps, formData, system.categories, baseStepArray, subclassStepArray, steps])

  return <Form useAddNewItemMutation={useAddNewClassMutation} useUpdateItemMutation={useUpdateClassMutation} />
}
export default ClassForm
