import { createFileRoute } from '@tanstack/react-router'
import Spells from '../../../pages/spells/Spells'
import { fetchSpells } from '../../../apis/spellsApi'
import Loading from '../../../components/Loading/Loading'

export const Route = createFileRoute('/_protected/spells/')({
  beforeLoad: () => {
    return { form: { type: 'spells' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(fetchSpells(context.systemPref)),
  pendingComponent: Loading,
  component: Spells,
})
