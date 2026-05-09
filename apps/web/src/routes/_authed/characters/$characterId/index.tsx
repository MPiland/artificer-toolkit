import { createFileRoute } from '@tanstack/react-router'
import { getCharacter, getCharacterDraft, getCharacterSheet } from '#app/data/characters/queries'
import { createServerApi } from '#app/lib/api'
import { CharacterSheetPage } from '#domains/characters'

export const Route = createFileRoute('/_authed/characters/$characterId/')({
  loader: async ({ context, params }) => {
    const client = createServerApi()
    const [response, draft] = await Promise.all([
      context.queryClient.ensureQueryData(getCharacterSheet(params.characterId, client)),
      context.queryClient.ensureQueryData(getCharacterDraft(params.characterId, client))
    ])
    const fallbackCharacter = !response && !draft
      ? await context.queryClient.ensureQueryData(getCharacter(params.characterId, client))
      : null

    return {
      draft,
      fallbackCharacter,
      response
    }
  },
  component: CharacterSheetPage
})
