import { createFileRoute } from '@tanstack/react-router'
import Feat from '@/pages/feats/Feat'
import { fetchFeat } from '@/apis/featsApi'
import Loading from '@/components/Loading/Loading'

export const Route = createFileRoute('/_protected/feats/$featId')({
  beforeLoad: () => {
    return { form: { type: 'feats' } }
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(fetchFeat(params.featId)),
  pendingComponent: Loading,
  component: Feat,
})
