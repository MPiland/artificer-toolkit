import { createFileRoute } from '@tanstack/react-router'
import { getCharacterDraft, getCharacterSheetPlaceholder } from '#app/data/characters/queries'
import { createServerApi } from '#app/lib/api'
import { CharacterSheetPlaceholderPage } from '#domains/characters'

export const Route = createFileRoute('/_authed/characters/$characterId/')({
  loader: async ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    const [response, draft] = await Promise.all([
      context.queryClient.ensureQueryData(getCharacterSheetPlaceholder(params.characterId, client)),
      context.queryClient.ensureQueryData(getCharacterDraft(params.characterId, client))
    ])

    return {
      draft,
      response
    }
  },
  component: CharacterSheetPlaceholderPage
})
