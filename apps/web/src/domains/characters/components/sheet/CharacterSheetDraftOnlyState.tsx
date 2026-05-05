import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'

export function CharacterSheetDraftOnlyState({
  characterId,
  label
}: {
  characterId: string
  label?: string
}) {
  const navigate = useNavigate()
  const displayLabel = label?.trim() || 'Untitled character'

  return (
    <Stack>
      <Alert color='yellow' title='Builder draft in progress'>
        <Text>
          {displayLabel}
          {' '}
          is still a builder draft. Finish or resume the builder before opening the interactive sheet.
        </Text>
      </Alert>
      <Group>
        <Button onClick={() => navigate({ to: '/characters/$characterId/edit', params: { characterId } })}>
          Resume Builder
        </Button>
        <Button variant='default' onClick={() => navigate({ to: '/characters' })}>Back to characters</Button>
      </Group>
    </Stack>
  )
}
