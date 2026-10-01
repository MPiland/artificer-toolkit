import { Alert, Button, Stack } from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { getCharacterDraft, getCharacterSheetSlice } from '#app/data/characters/queries'
import { CharacterSheetDraftOnlyState } from '../../sheet/core/CharacterSheetDraftOnlyState'
import { CharacterSheetView } from '../../sheet/core/CharacterSheetView'

export function CharacterSheetPage() {
  const route = getRouteApi('/_authed/characters/$characterPublicId/$characterSlug/')
  const { characterPublicId } = route.useLoaderData()
  const { user } = route.useRouteContext()
  const { data: sheet } = useSuspenseQuery(getCharacterSheetSlice(characterPublicId, 'COMMON'))
  if (!sheet) return <CharacterSheetUnavailable characterPublicId={characterPublicId} />

  const characterPublicIdForView = sheet.publicId ?? characterPublicId
  const hasDraftForView = Boolean(sheet.meta.hasBuilderDraft)
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

function CharacterSheetUnavailable({ characterPublicId }: { characterPublicId: string }) {
  const navigate = useNavigate()
  const { data: draft } = useSuspenseQuery(getCharacterDraft(characterPublicId))
  if (draft)
    return <CharacterSheetDraftOnlyState characterPublicId={draft.publicId} label={draft.label} />
  return (
    <Stack>
      <Alert color='yellow'>That character could not be found.</Alert>
      <Button onClick={() => navigate({ to: '/characters' })}>Back to characters</Button>
    </Stack>
  )
}
