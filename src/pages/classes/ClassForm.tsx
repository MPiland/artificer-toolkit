import { useMemo, useLayoutEffect, useEffect, useCallback } from 'react'
import { useGetClass, useAddClass, useUpdateClass } from '~/apis'
import type { ClassInput } from '~/types'
import { Route } from '~/routes/_protected/classes/$action/$_classId'
import { ClassInputSchema } from '~/schemas'
import { v4 as uuidv4 } from 'uuid'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import Form, { ClassAttributes, ClassDetails, ClassProficiencies, StartingEquipment, Features } from '~/components/Form'
import { Categories } from '~/enums'
import { convertTypenameToKindInput } from '~/utils'
import { useSystemPref } from '~/hooks'

const ClassForm = () => {
  const { _classId: classId, action } = Route.useParams()
  const [systemPref] = useSystemPref()

  const { mutateAsync: addClass } = useAddClass()
  const { mutateAsync: updateClass } = useUpdateClass()

  const classData = useGetClass(classId)

  const store = useTypedFormStore<ClassInput>()

  const { current, steps, setSteps, setCurrent, stepIndex, registerForm, formSubmit } = useOptimizedSelector(
    store,
    (state) => ({
      current: state.current,
      steps: state.meta.steps,
      setSteps: state.setSteps,
      setCurrent: state.setCurrent,
      stepIndex: state.meta.stepIndex,
      registerForm: state.registerForm,
      formSubmit: state.formSubmit,
    })
  )

  const data = useMemo(() => {
    const classInput = convertTypenameToKindInput(classData) as ClassInput
    if (action === 'new') {
      if (classInput) {
        return ClassInputSchema.parse({
          ...classInput,
          id: uuidv4(),
          label: '',
          masterId: undefined,
          category: Categories.BASE,
          systemId: systemPref,
        })
      }
      return ClassInputSchema.parse({
        __kind: 'ClassInput',
        id: uuidv4(),
        category: Categories.BASE,
        systemId: systemPref,
        label: '',
      })
    } else {
      return ClassInputSchema.parse({ ...classInput })
    }
  }, [action, systemPref, classData])

  const handleSubmit = useCallback(async () => {
    if (action === 'new') {
      try {
        const result = await addClass(data)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    } else {
      try {
        const result = await updateClass(data)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    }
  }, [action, addClass, updateClass, data])

  useLayoutEffect(() => {
    if (current === null) {
      setCurrent(data)
    }
  }, [current, data, setCurrent])

  const classSteps = useMemo(() => {
    if (data?.category === Categories.SUBCLASS) {
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
    if (!formSubmit) {
      registerForm(handleSubmit)
    }
  }, [formSubmit, registerForm, handleSubmit])

  const stepComponentMap = {
    details: <ClassDetails />,
    proficiencies: <ClassProficiencies />,
    startingEquipment: <StartingEquipment />,
    attributes: <ClassAttributes />,
    features: <Features />,
  }

  return <Form>{stepComponentMap[steps[stepIndex]?.id as keyof typeof stepComponentMap] || null}</Form>
}
export default ClassForm
