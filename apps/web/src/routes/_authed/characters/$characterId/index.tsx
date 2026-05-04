import { createFileRoute } from '@tanstack/react-router'
import { getCharacterDraft, getCharacterSheet } from '#app/data/characters/queries'
import { createServerApi } from '#app/lib/api'
import { CharacterSheetPage } from '#domains/characters'

export const Route = createFileRoute('/_authed/characters/$characterId/')({
  loader: async ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    const [response, draft] = await Promise.all([
      context.queryClient.ensureQueryData(getCharacterSheet(params.characterId, client)),
      context.queryClient.ensureQueryData(getCharacterDraft(params.characterId, client))
    ])

    return {
      draft,
      response
    }
  },
  component: CharacterSheetPage
})
