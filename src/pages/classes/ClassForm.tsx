import { z } from 'zod/v4'
import { useEffect, useMemo } from 'react'
import { useAddNewClassMutation, useUpdateClassMutation } from '@/apis/classes.api'
import type { ClassInput } from '@/types'
import { Route } from '@/routes/_protected/classes/$action/$_classId'
import { useClassData } from '@/hooks'
import { ClassInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import { useFormStore } from '@/store'
import Form, { ClassAttributes, ClassDetails, ClassProficiencies, StartingEquipment, Features } from '@/components/Form'
import { Categories } from '@/enums'

const ClassForm = () => {
  const { _classId: classId, action } = Route.useParams()
  const {
    classes: { findClass },
  } = useClassData()
  const classData = findClass(classId)
  const formStore = useFormStore()

  const data: z.input<typeof ClassInputSchema> = useMemo(
    () =>
      classData ?
        action === 'new' ?
          ClassInputSchema.parse({
            ...classData,
            id: uuidv4(),
            label: '',
            masterId: undefined,
          })
        : ClassInputSchema.parse(classData)
      : ClassInputSchema.parse({
          __kind: 'ClassInput',
          id: uuidv4(),
        }),
    [classData, action]
  )

  useEffect(() => {
    formStore.setCurrent(data as ClassInput)
  }, [formStore, data])

  useEffect(() => {
    if ((formStore.current as ClassInput)?.category === Categories.SUBCLASS) {
      formStore.setSteps([
        { id: 'details', label: 'Details' },
        { id: 'proficiencies', label: 'Proficiencies' },
        { id: 'attributes', label: 'Attributes' },
        { id: 'features', label: 'Features' },
      ])
    } else {
      formStore.setSteps([
        { id: 'details', label: 'Details' },
        { id: 'proficiencies', label: 'Proficiencies' },
        { id: 'startingEquipment', label: 'Starting Equipment' },
        { id: 'attributes', label: 'Attributes' },
        { id: 'features', label: 'Features' },
      ])
    }
  }, [formStore])

  const stepComponentMap = {
    details: <ClassDetails />,
    proficiencies: <ClassProficiencies />,
    startingEquipment: <StartingEquipment />,
    attributes: <ClassAttributes />,
    features: <Features />,
  }

  return (
    <Form useAddNewItemMutation={useAddNewClassMutation} useUpdateItemMutation={useUpdateClassMutation}>
      {stepComponentMap[formStore.steps[formStore.stepIndex].id as keyof typeof stepComponentMap] || null}
    </Form>
  )
}
export default ClassForm
