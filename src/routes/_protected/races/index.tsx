import { createFileRoute } from '@tanstack/react-router'
import Races from '@/pages/races/Races'
import { fetchRaces } from '@/apis/racesApi'
import Loading from '@/components/Loading/Loading'

export const Route = createFileRoute('/_protected/races/')({
  beforeLoad: () => {
    return { form: { type: 'races' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(fetchRaces(context.systemPref)),
  pendingComponent: Loading,
  component: Races,
})
