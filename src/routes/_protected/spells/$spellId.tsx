import { createFileRoute } from '@tanstack/react-router'
import Spell from '@/pages/spells/Spell'
import { fetchSpell } from '@/apis/spells.api'
import Loading from '@/components/Loading/Loading'

export const Route = createFileRoute('/_protected/spells/$spellId')({
  beforeLoad: () => {
    return { form: { type: 'spells' } }
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(fetchSpell(params.spellId)),
  pendingComponent: Loading,
  component: Spell,
})
