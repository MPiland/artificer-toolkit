import { useEffect, use } from 'react'
import Form, { FormContext } from '@/components/Form'
import { useAddClass, useUpdateClass } from '@/apis/classes.api'
import { Step, type ClassInput } from '@/types'
import { isEqual } from 'lodash'
import { Categories } from '@/enums'
import { Route } from '@/routes/_protected/classes/$action/$_classId'
import { useClassData } from '@/hooks'
import { ClassInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'

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
    if (formStore.data.__kind === 'ClassInput') {
      if (formStore.data.category === Categories.SUBCLASS) {
        if (!isEqual(steps, subclassStepArray)) {
          return formStore.setSteps(subclassStepArray)
        }
      } else if (!isEqual(steps, baseStepArray)) {
        return formStore.setSteps(baseStepArray)
      }
    }
    if (action === 'new') {
      let dataObj: ClassInput
      if (classData) {
        dataObj = ClassInputSchema.parse({
          ...classData,
          id: uuidv4(),
          label: '',
          masterId: undefined,
        })
      } else {
        dataObj = ClassInputSchema.parse({
          __kind: 'ClassInput',
          id: uuidv4()
        })
      }
      formStore.reinitState(dataObj)
    }
    if (action === 'edit' && classData) {
      const dataObj = ClassInputSchema.parse(classData)
      formStore.reinitState(dataObj)
    }
  }, [formStore, baseStepArray, subclassStepArray, steps, classData, action])

  return <Form useAddNewItemMutation={useAddClass} useUpdateItemMutation={useUpdateClass} />
}
export default ClassForm
