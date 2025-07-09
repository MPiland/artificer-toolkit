import { z } from 'zod/v4'
import { useEffect, useMemo, useState } from 'react'
import { useAddNewFeatMutation, useUpdateFeatMutation } from '@/apis/feats.api'
import type { FeatInput } from '@/types'
import { Route } from '@/routes/_protected/feats/$action/$_featId'
import { useFeatData } from '@/hooks'
import { FeatInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import Form, { Features } from '@/components/Form'
import { useFormStore } from '@/store'
import { isEqual } from 'lodash'

const FeatForm = () => {
  const { _featId: featId, action } = Route.useParams()
  const {
    feats: { findFeat },
  } = useFeatData()
  const feat = findFeat(featId)
  const formStore = useFormStore()

  const data: z.input<typeof FeatInputSchema> = useMemo(
    () =>
      feat ?
        action === 'new' ?
          FeatInputSchema.parse({
            ...feat,
            id: uuidv4(),
            label: '',
            masterId: undefined,
          })
        : FeatInputSchema.parse(feat)
      : FeatInputSchema.parse({
          __kind: 'FeatInput',
          id: uuidv4(),
        }),
    [feat, action]
  )

  useEffect(() => {
    formStore.setCurrent(data as FeatInput)
  }, [formStore, data])

  const [steps] = useState([
    {
      id: 'features',
      label: 'Features',
    },
  ])

  useEffect(() => {
    if (!isEqual(formStore.steps, steps)) formStore.setSteps(steps)
  }, [formStore, steps])

  const stepComponentMap = {
    features: <Features />,
  }

  return (
    <Form useAddNewItemMutation={useAddNewFeatMutation} useUpdateItemMutation={useUpdateFeatMutation}>
      {stepComponentMap[formStore.steps[formStore.stepIndex].id as keyof typeof stepComponentMap] || null}
    </Form>
  )
}

export default FeatForm
