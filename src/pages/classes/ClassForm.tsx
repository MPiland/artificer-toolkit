import { useCallback, useMemo, useLayoutEffect, useEffect } from 'react'
import { useAddNewClassMutation, useUpdateClassMutation } from '@/apis/classes.api'
import type { ClassInput } from '@/types'
import { Route } from '@/routes/_protected/classes/$action/$_classId'
import { useClassData } from '@/hooks'
import { ClassInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import { useTypedFormStore } from '@/store'
import Form, {
  ClassAttributes,
  ClassDetails,
  ClassProficiencies,
  StartingEquipment,
  Features,
  useAppForm,
} from '@/components/Form'
import { Categories } from '@/enums'
import { convertTypenameToKindInput } from '@/utils'
import { useSystemPref } from '@/hooks'

const ClassForm = () => {
  const { _classId: classId, action } = Route.useParams()
  const {
    classes: { findClass },
  } = useClassData()
  const [systemPref] = useSystemPref()

  const classData = findClass(classId)

  const store = useTypedFormStore<ClassInput>()

  const current = store((state) => state.current)
  const steps = store((state) => state.steps)
  const setSteps = store((state) => state.setSteps)
  const setCurrent = store((state) => state.setCurrent)
  const stepIndex = store((state) => state.stepIndex)
  const registerForm = store((state) => state.registerForm)
  const formReset = store((state) => state.formReset)

  const createDataObject = useCallback(() => {
    if (classData) {
      const classInput = convertTypenameToKindInput(classData)
      if (classInput) {
        if (action === 'new') {
          return ClassInputSchema.parse({
            ...classInput,
            id: uuidv4(),
            label: '',
            masterId: undefined,
            category: Categories.BASE,
            systemId: systemPref,
          })
        } else {
          return ClassInputSchema.parse({ ...classInput })
        }
      }
    }
    return ClassInputSchema.parse({
      __kind: 'ClassInput',
      id: uuidv4(),
      category: Categories.BASE,
      systemId: systemPref,
      label: '',
    })
  }, [action, systemPref, classData])

  const data = useMemo(() => createDataObject(), [createDataObject])

  useLayoutEffect(() => {
    if (current === null) {
      setCurrent(data as ClassInput)
    }
  }, [current, data, setCurrent])

  const form = useAppForm({
    defaultValues: data,
  })

  const classSteps = useMemo(() => {
    if ((data as ClassInput)?.category === Categories.SUBCLASS) {
      return [
        { id: 'details', label: 'Details', fieldValidation: {}, defaultValues: {} },
        { id: 'proficiencies', label: 'Proficiencies', fieldValidation: {}, defaultValues: {} },
        { id: 'attributes', label: 'Attributes', fieldValidation: {}, defaultValues: {} },
        { id: 'features', label: 'Features', fieldValidation: {}, defaultValues: {} },
      ]
    } else {
      return [
        { id: 'details', label: 'Details', fieldValidation: {}, defaultValues: {} },
        { id: 'proficiencies', label: 'Proficiencies', fieldValidation: {}, defaultValues: {} },
        { id: 'startingEquipment', label: 'Equipment', fieldValidation: {}, defaultValues: {} },
        { id: 'attributes', label: 'Attributes', fieldValidation: {}, defaultValues: {} },
        { id: 'features', label: 'Features' },
      ]
    }
  }, [data])

  useLayoutEffect(() => {
    if (!steps.every((step) => classSteps.some((s) => s.id === step.id)) || !steps?.length) {
      setSteps(classSteps)
    }
  }, [steps, classSteps, setSteps])

  useEffect(() => {
    if (!formReset) {
      registerForm(form.reset)
    }
  }, [formReset, registerForm, form.reset])

  const stepComponentMap = {
    details: <ClassDetails form={form} />,
    proficiencies: <ClassProficiencies form={form} />,
    startingEquipment: <StartingEquipment form={form} />,
    attributes: <ClassAttributes form={form} />,
    features: <Features />,
  }

  return (
    <Form useAddNewItemMutation={useAddNewClassMutation} useUpdateItemMutation={useUpdateClassMutation}>
      {stepComponentMap[steps[stepIndex]?.id as keyof typeof stepComponentMap] || null}
    </Form>
  )
}
export default ClassForm
