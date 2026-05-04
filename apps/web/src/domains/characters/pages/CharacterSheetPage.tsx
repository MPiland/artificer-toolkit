import { Alert, Button, Stack } from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { getCharacterSheet } from '#app/data/characters/queries'
import { CharacterSheetView } from '../components/sheet/CharacterSheetView'

export function CharacterSheetPage() {
  const route = getRouteApi('/_authed/characters/$characterId/')
  const { draft } = route.useLoaderData()
  const { characterId } = route.useParams()
  const navigate = useNavigate()
  const { data: sheet } = useSuspenseQuery(getCharacterSheet(characterId))

  if (!sheet) {
    return (
      <Stack>
        <Alert color='yellow'>That character could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/characters' })}>Back to characters</Button>
      </Stack>
    )
  }

  return <CharacterSheetView hasDraft={Boolean(draft ?? sheet.meta.hasBuilderDraft)} sheet={sheet} />
}
