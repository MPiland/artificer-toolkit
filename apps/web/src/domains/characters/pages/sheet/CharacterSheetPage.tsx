import { Alert, Button, Stack } from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { getCharacterSheet } from '#app/data/characters/queries'
import { getAccountProfileQuery } from '#app/settings/accountQueries'
import { CharacterSheetDraftOnlyState } from '../../sheet/core/CharacterSheetDraftOnlyState'
import { CharacterSheetView } from '../../sheet/core/CharacterSheetView'

export function CharacterSheetPage() {
  const route = getRouteApi('/_authed/characters/$characterPublicId/$characterSlug/')
  const { characterId, characterPublicId, draft, fallbackCharacter } = route.useLoaderData()
  const { user } = route.useRouteContext()
  const navigate = useNavigate()
  const { data: sheet } = useSuspenseQuery(getCharacterSheet(characterId))
  const { data: profile } = useSuspenseQuery(getAccountProfileQuery(user!.id))

  if (!sheet && (draft || fallbackCharacter)) {
    return (
      <CharacterSheetDraftOnlyState
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
      rollerName={profile?.name ?? profile?.username ?? 'You'}
      sheet={sheet}
    />
  )
}
