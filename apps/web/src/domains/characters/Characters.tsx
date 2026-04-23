import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core'

import { useGetCharacterList } from '../../data/characters'

const Characters = () => {
  const { data: characters } = useGetCharacterList()

  return (
    <Stack gap='lg'>
      <Group justify='space-between' align='flex-start'>
        <div>
          <Title order={2}>Characters</Title>
          <Text c='dimmed'>Shared authored builders now drive both creation and editing.</Text>
        </div>

        <Button component='a' href='/characters/new'>
          Create Character
        </Button>
      </Group>

      {characters.length === 0 ? (
        <Card withBorder>
          <Text c='dimmed'>No characters yet. Create one to start building from the new authored flow.</Text>
        </Card>
      ) : (
        <Stack gap='sm'>
          {characters.map((character) => (
            <Card key={character.id} withBorder>
              <Group justify='space-between' align='center'>
                <div>
                  <Group gap='xs' mb={4}>
                    <Text fw={600}>{character.label || 'Untitled character'}</Text>
                    <Badge color={character.status === 'ACTIVE' ? 'green' : 'yellow'}>
                      {character.status === 'ACTIVE' ? 'Active' : 'Draft'}
                    </Badge>
                  </Group>
                  <Text size='sm' c='dimmed'>
                    System: {character.systemId} | Stream Version: {character.streamVersion}
                  </Text>
                </div>

                <Group gap='sm'>
                  {character.status === 'ACTIVE' ? (
                    <>
                      <Button component='a' href={`/characters/${character.id}`} variant='default'>
                        Open
                      </Button>
                      <Button component='a' href={`/characters/edit/${character.id}`} variant='light'>
                        Edit Character
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button component='a' href={`/characters/new/${character.id}`}>
                        Continue Draft
                      </Button>
                      <Button component='a' href={`/characters/${character.id}`} variant='default'>
                        Open Sheet
                      </Button>
                    </>
                  )}
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

export default Characters
