import { createFileRoute } from '@tanstack/react-router'
import Backgrounds from '@/pages/backgrounds/Backgrounds'
import { fetchBackgrounds } from '@/apis/backgroundsApi'
import Loading from '@/components/Loading/Loading'

export const Route = createFileRoute('/_protected/backgrounds/')({
  beforeLoad: () => {
    return { form: { type: 'backgrounds' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(fetchBackgrounds(context.systemPref)),
  pendingComponent: Loading,
  component: Backgrounds,
})
