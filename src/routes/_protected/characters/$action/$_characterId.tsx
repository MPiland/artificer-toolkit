import { createFileRoute } from '@tanstack/react-router'
import CharacterForm from '@/pages/characters/CharacterForm'
import { fetchCharacter } from '@/apis/characters.api'

export const Route = createFileRoute('/_protected/characters/$action/$_characterId')({
  beforeLoad: async () => {
    return { form: { type: 'characters' } }
  },
  loader: async ({ params, context }) => {
    const { _characterId: characterId } = params
    if (characterId) {
      return context.queryClient.ensureQueryData(fetchCharacter(characterId))
    }
  },
  component: CharacterForm,
})
