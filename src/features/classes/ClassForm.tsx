import { useEffect, use } from 'react'
import Form from '../../components/Form/Form'
import { useAddNewClassMutation, useUpdateClassMutation } from './classesApi'
import { useGetSystemQuery } from '../systems/systemsApi'
import { Step } from '../../types/form'
import FormContext from '../../components/Form/FormContext'

const ClassForm = () => {
  const { setSteps, formData } = use(FormContext)
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
      if (system.categories.find((sCategory) => sCategory.id === formData.category).value === 'subclass') {
        return setSteps(subclassStepArray)
      }
      return setSteps(baseStepArray)
    }
  }, [setSteps, formData, system.categories, baseStepArray, subclassStepArray])

  return <Form useAddNewItemMutation={useAddNewClassMutation} useUpdateItemMutation={useUpdateClassMutation} />
}
export default ClassForm
