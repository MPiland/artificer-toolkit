import { createFileRoute } from '@tanstack/react-router'
import FeatForm from '@/pages/feats/FeatForm'
import { fetchFeat } from '@/apis/featsApi'

export const Route = createFileRoute('/_protected/feats/$action/$_featId')({
  beforeLoad: () => {
    return { form: { type: 'feats' } }
  },
  loader: async ({ params, context }) => {
    const { _featId: featId } = params
    if (featId) {
      return context.queryClient.ensureQueryData(fetchFeat(featId))
    }
  },
  component: FeatForm,
})
