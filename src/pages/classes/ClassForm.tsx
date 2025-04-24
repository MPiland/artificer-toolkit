import { useEffect, use } from 'react'
import Form, { FormContext } from '@/components/Form'
import { useAddClass, useUpdateClass } from '@/apis/classesApi'
import { Step } from '@/types'
import { isEqual } from 'lodash'
import { Categories } from 'enums/enums'
import { Route } from '@/routes/_protected/classes/$action/$_classId'
import { useClassData } from '@/hooks'

const ClassForm = () => {
  const { _classId: classId, action } = Route.useParams()
  const {
    classes: { findClass },
  } = useClassData()
  const classData = findClass(classId)
  const { steps, formStore } = use(FormContext)

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
    if (formStore.data.__typename === 'Class') {
      if (formStore.data.category === Categories.SUBCLASS) {
        if (!isEqual(steps, subclassStepArray)) {
          return formStore.setSteps(subclassStepArray)
        }
      } else if (!isEqual(steps, baseStepArray)) {
        return formStore.setSteps(baseStepArray)
      }
    }
    if (action === 'new' && classData) {
      if (Object.keys(formStore.data).length === 0) {
        formStore.reinitState(classData)
      }
    }
    if (action === 'edit' && classData) {
      if (formStore.data?.id !== classData.id) {
        formStore.reinitState(classData)
      }
    }
  }, [formStore, baseStepArray, subclassStepArray, steps, classData, action])

  return <Form useAddNewItemMutation={useAddClass} useUpdateItemMutation={useUpdateClass} />
}
export default ClassForm
