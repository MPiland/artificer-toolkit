import { useEffect, use } from 'react'
import Form, { FormContext } from '@/components/Form'
import { useAddNewFeatMutation, useUpdateFeatMutation } from '@/apis/featsApi'
import { Step } from '@/types'
import { isEqual } from 'lodash'
import { Route } from '@/routes/_protected/feats/$action/$_featId'
import { useFeatData } from '@/hooks'

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
    if (action === 'new' && feat) {
      if (Object.keys(formStore.data).length === 0) {
        formStore.reinitState(feat)
      }
    }
    if (action === 'edit' && feat) {
      if (formStore.data?.id !== feat.id) {
        formStore.reinitState(feat)
      }
    }
  }, [stepsArray, steps, formStore, feat, action])

  return <Form useAddNewItemMutation={useAddNewFeatMutation} useUpdateItemMutation={useUpdateFeatMutation} />
}

export default FeatForm
