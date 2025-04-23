import { createFileRoute } from '@tanstack/react-router'
import Background from '@/pages/backgrounds/Background'
import { fetchBackground } from '@/apis/backgroundsApi'
import Loading from '@/components/Loading/Loading'

export const Route = createFileRoute('/_protected/backgrounds/$backgroundId')({
  beforeLoad: () => {
    return { form: { type: 'backgrounds' } }
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(fetchBackground(params.backgroundId)),
  pendingComponent: Loading,
  component: Background,
})
