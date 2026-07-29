import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'

export function CharacterSheetDraftOnlyState({
  characterPublicId,
  label
}: {
  characterPublicId: string
  label?: string
}) {
  const navigate = useNavigate()
  const displayLabel = label?.trim() || 'Untitled character'
  const characterParams = buildCharacterRouteParams(characterPublicId, displayLabel)

  return (
    <Stack>
      <Alert color='yellow' title='Builder draft in progress'>
        <Text>
          {displayLabel} is still a builder draft. Finish or resume the builder before opening the
          interactive sheet.
        </Text>
      </Alert>
      <Group>
        <Button
          onClick={() =>
            navigate({
              to: '/characters/$characterPublicId/$characterSlug/edit',
              params: characterParams
            })
          }
        >
          Resume Builder
        </Button>
        <Button variant='default' onClick={() => navigate({ to: '/characters' })}>
          Back to characters
        </Button>
      </Group>
    </Stack>
  )
}
