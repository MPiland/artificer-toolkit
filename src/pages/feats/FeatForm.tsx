import { useEffect, use } from 'react'
import Form, { FormContext } from '@/components/Form'
import { useAddNewFeatMutation, useUpdateFeatMutation } from '@/apis/feats.api'
import { Step, type FeatInput } from '@/types'
import { isEqual } from 'lodash'
import { Route } from '@/routes/_protected/feats/$action/$_featId'
import { useFeatData } from '@/hooks'
import { FeatInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'

const FeatForm = () => {
  const { _featId: featId, action } = Route.useParams()
  const {
    feats: { findFeat },
  } = useFeatData()
  const feat = findFeat(featId)
  const { steps, formStore } = use(FormContext)

  const stepsArray = [{ id: 'features', label: 'Features' }] satisfies Step[]

  useEffect(() => {
    if (!isEqual(steps, stepsArray)) {
      formStore.setSteps(stepsArray)
    }
    if (action === 'new') {
      let dataObj: FeatInput
      if (feat) {
        dataObj = FeatInputSchema.parse({
          ...feat,
          id: uuidv4(),
          label: '',
          masterId: undefined
        })
      } else {
        dataObj = FeatInputSchema.parse({
          __kind: 'FeatInput',
          id: uuidv4(),
        })
      }
      formStore.reinitState(dataObj)
    }
    if (action === 'edit' && feat) {
      const dataObj = FeatInputSchema.parse(feat)
      formStore.reinitState(dataObj)
    }
  }, [stepsArray, steps, formStore, feat, action])

  return <Form useAddNewItemMutation={useAddNewFeatMutation} useUpdateItemMutation={useUpdateFeatMutation} />
}

export default FeatForm
