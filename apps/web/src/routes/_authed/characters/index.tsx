import { createFileRoute } from '@tanstack/react-router'
import { getCharacterList } from '#app/data/characters/queries'
import { createServerApi } from '#app/lib/api'
import { CharacterListPage } from '#domains/characters'

export const Route = createFileRoute('/_authed/characters/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getCharacterList(createServerApi())),
  component: CharacterListPage
})
