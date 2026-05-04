import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import * as styles from '../characterBuilder.css'

export function CharacterSheetPlaceholderPage() {
  const route = getRouteApi('/_authed/characters/$characterId/')
  const { draft, response } = route.useLoaderData()
  const { characterId } = route.useParams()
  const navigate = useNavigate()

  if (!response && !draft) {
    return (
      <Stack>
        <Alert color='yellow'>That character could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/characters' })}>Back to characters</Button>
      </Stack>
    )
  }

  const label = draft?.label ?? response?.character.label ?? 'Untitled Character'

  return (
    <Stack className={styles.builderShell}>
      <div>
        <Text className={styles.eyebrow}>Character Sheet</Text>
        <Title order={1}>{label}</Title>
      </div>
      <Alert color='blue'>
        The interactive character sheet is the next tranche. For now, use the builder to continue structural edits.
      </Alert>
      {draft
        ? (
            <Alert color='yellow'>
              This character has draft builder work. The active sheet will stay unchanged until that draft is finalized.
            </Alert>
          )
        : null}
      <Group>
        <Button onClick={() => navigate({ to: '/characters/$characterId/edit', params: { characterId } })}>
          {draft ? 'Resume Builder' : 'Edit Builder'}
        </Button>
        <Button variant='default' onClick={() => navigate({ to: '/characters' })}>Back to characters</Button>
      </Group>
    </Stack>
  )
}
