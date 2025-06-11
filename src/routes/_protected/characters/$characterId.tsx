import { createFileRoute } from '@tanstack/react-router'
import Character from '@/pages/characters/Character'
import { fetchCharacter } from '@/apis/characters.api'
import Loading from '@/components/Loading/Loading'

export const Route = createFileRoute('/_protected/characters/$characterId')({
  beforeLoad: async () => {
    return { form: { type: 'characters' } }
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(fetchCharacter(params.characterId)),
  pendingComponent: Loading,
  component: Character,
})
