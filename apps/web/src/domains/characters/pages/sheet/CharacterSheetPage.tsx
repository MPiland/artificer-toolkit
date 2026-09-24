import { Alert, Button, Stack } from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { getCharacterDraft, getCharacterSheet } from '#app/data/characters/queries'
import { CharacterSheetDraftOnlyState } from '../../sheet/core/CharacterSheetDraftOnlyState'
import { CharacterSheetView } from '../../sheet/core/CharacterSheetView'

export function CharacterSheetPage() {
  const route = getRouteApi('/_authed/characters/$characterPublicId/$characterSlug/')
  const { characterPublicId } = route.useLoaderData()
  const { user } = route.useRouteContext()
  const navigate = useNavigate()
  const { data: sheet } = useSuspenseQuery(getCharacterSheet(characterPublicId))
  const { data: draft } = useSuspenseQuery(getCharacterDraft(characterPublicId))

  if (!sheet && draft) {
    return <CharacterSheetDraftOnlyState characterPublicId={draft.publicId} label={draft.label} />
  }

  if (!sheet) {
    return (
      <Stack>
        <Alert color='yellow'>That character could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/characters' })}>Back to characters</Button>
      </Stack>
    )
  }

  const characterPublicIdForView = sheet.publicId ?? characterPublicId
  const hasDraftForView = Boolean(draft ?? sheet.meta.hasBuilderDraft)
  return (
    <CharacterSheetView
      key={sheet.meta.characterId}
      characterPublicId={characterPublicIdForView}
      currentUserId={user?.userId}
      hasDraft={hasDraftForView}
      rollerName={sheet.identity.label}
      sheet={sheet}
    />
  )
}
