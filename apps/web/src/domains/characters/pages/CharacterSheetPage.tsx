import { Alert, Button, Stack } from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { getCharacterSheet } from '#app/data/characters/queries'
import { CharacterSheetDraftOnlyState } from '../components/sheet/CharacterSheetDraftOnlyState'
import { CharacterSheetView } from '../components/sheet/CharacterSheetView'

export function CharacterSheetPage() {
  const route = getRouteApi('/_authed/characters/$characterPublicId/$characterSlug/')
  const { characterId, characterPublicId, draft, fallbackCharacter } = route.useLoaderData()
  const navigate = useNavigate()
  const { data: sheet } = useSuspenseQuery(getCharacterSheet(characterId))

  if (!sheet && (draft || fallbackCharacter)) {
    return (
      <CharacterSheetDraftOnlyState
        characterId={characterId}
        characterPublicId={draft?.publicId ?? fallbackCharacter?.publicId ?? characterPublicId}
        label={draft?.label ?? fallbackCharacter?.character.label}
      />
    )
  }

  if (!sheet) {
    return (
      <Stack>
        <Alert color='yellow'>That character could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/characters' })}>Back to characters</Button>
      </Stack>
    )
  }

  return (
    <CharacterSheetView
      characterPublicId={sheet.publicId ?? characterPublicId}
      hasDraft={Boolean(draft ?? sheet.meta.hasBuilderDraft)}
      sheet={sheet}
    />
  )
}
