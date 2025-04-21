import { createFileRoute } from '@tanstack/react-router'
import Feats from '../../../pages/feats/Feats'
import { fetchFeats } from '../../../apis/featsApi'
import Loading from '../../../components/Loading/Loading'

export const Route = createFileRoute('/_protected/feats/')({
  beforeLoad: () => {
    return { form: { type: 'feats' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(fetchFeats(context.systemPref)),
  pendingComponent: Loading,
  component: Feats,
})
