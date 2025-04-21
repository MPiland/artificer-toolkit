import { createFileRoute } from '@tanstack/react-router'
import Characters from '../../../pages/characters/Characters'
import { fetchCharacters } from '../../../apis/charactersApi'
import Loading from '../../../components/Loading/Loading'

export const Route = createFileRoute('/_protected/characters/')({
  beforeLoad: async () => {
    return { form: { type: 'characters' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(fetchCharacters(context.systemPref)),
  pendingComponent: Loading,
  component: Characters,
})
