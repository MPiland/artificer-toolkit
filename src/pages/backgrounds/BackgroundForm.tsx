import { z } from 'zod/v4'
import { useEffect, useState, useMemo } from 'react'
import { useAddBackground, useUpdateBackground } from '@/apis/backgrounds.api'
import type { BackgroundInput } from '@/types'
import { Route } from '@/routes/_protected/backgrounds/$action/$_backgroundId'
import { useBackgroundData } from '@/hooks'
import { BackgroundInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import { useFormStore } from '@/store'
import Form, { BackgroundDetails, Features } from '@/components/Form'
import { isEqual } from 'lodash'

const BackgroundForm = () => {
  const { _backgroundId: backgroundId, action } = Route.useParams()
  const {
    backgrounds: { findBackground },
  } = useBackgroundData()
  const background = findBackground(backgroundId)
  const formStore = useFormStore((state) => state)

  const data: z.input<typeof BackgroundInputSchema> = useMemo(
    () =>
      background ?
        action === 'new' ?
          BackgroundInputSchema.parse({
            ...background,
            id: uuidv4(),
            label: '',
            masterId: undefined,
          })
        : BackgroundInputSchema.parse(background)
      : BackgroundInputSchema.parse({
          __kind: 'BaCkgroundInput',
          id: uuidv4(),
        }),
    [background, action]
  )

  useEffect(() => {
    formStore.setCurrent(data as BackgroundInput)
  }, [formStore, data])

  const [steps] = useState([
    { id: 'details', label: 'Details' },
    { id: 'features', label: 'Features' },
  ])

  useEffect(() => {
    if (!isEqual(formStore.steps, steps)) formStore.setSteps(steps)
  }, [formStore, steps])

  const stepComponentMap = {
    details: <BackgroundDetails />,
    features: <Features />,
  }

  return (
    <Form useAddNewItemMutation={useAddBackground} useUpdateItemMutation={useUpdateBackground}>
      {stepComponentMap[formStore.steps[formStore.stepIndex].id as keyof typeof stepComponentMap] || null}
    </Form>
  )
}

export default BackgroundForm
