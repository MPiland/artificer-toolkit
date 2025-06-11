import { createFileRoute } from '@tanstack/react-router'
import Classes from '@/pages/classes/Classes'
import { fetchClasses } from '@/apis/classes.api'
import Loading from '@/components/Loading/Loading'

export const Route = createFileRoute('/_protected/classes/')({
  beforeLoad: () => {
    return { form: { type: 'classes' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(fetchClasses(context.systemPref)),
  pendingComponent: Loading,
  component: Classes,
})
