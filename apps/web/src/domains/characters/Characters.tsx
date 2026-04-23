import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { ArrowRight, Shield, Sparkles, Swords } from 'lucide-react'

import { useGetCharacterList } from '../../data/characters'

const heroStyle = {
  background: 'linear-gradient(135deg, rgba(29, 28, 43, 0.96), rgba(82, 48, 39, 0.88))',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: 'white'
} as const

const cardStyle = {
  background: 'linear-gradient(180deg, rgba(248, 244, 235, 0.98), rgba(239, 229, 214, 0.98))',
  border: '1px solid rgba(78, 55, 36, 0.14)'
} as const

const statusColor = {
  ACTIVE: 'green',
  DRAFT: 'orange'
} as const

const Characters = () => {
  const { data } = useGetCharacterList()
  const characters = data.items
  const activeCount = characters.filter((character) => character.status === 'ACTIVE').length
  const draftCount = characters.length - activeCount

  return (
    <Stack gap='xl'>
      <Card radius='xl' p='xl' style={heroStyle}>
        <Stack gap='lg'>
          <Group justify='space-between' align='flex-start'>
            <Stack gap={6}>
              <Group gap='xs'>
                <Sparkles size={18} />
                <Text fw={700} tt='uppercase' size='xs' c='rgba(255,255,255,0.72)'>
                  Character Studio
                </Text>
              </Group>
              <Title order={1} fz='clamp(2rem, 3vw, 3.25rem)' maw={720}>
                Build new heroes in the builder, then run them from the sheet.
              </Title>
              <Text size='lg' c='rgba(255,255,255,0.78)' maw={700}>
                Structural choices stay in the character builder. Play-state tracking, inventory, and
                spell use belong on the character sheet.
              </Text>
            </Stack>

            <Button
              component='a'
              href='/characters/new'
              size='md'
              radius='xl'
              rightSection={<ArrowRight size={16} />}
              styles={{
                root: {
                  background: 'linear-gradient(135deg, #f1c27d, #d26c4d)',
                  color: '#241510'
                }
              }}
            >
              Create Character
            </Button>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing='md'>
            <Card radius='lg' p='lg' style={{ background: 'rgba(255,255,255,0.08)' }}>
              <Group gap='sm' mb='xs'>
                <Swords size={18} />
                <Text fw={700}>Roster</Text>
              </Group>
              <Text fz={30} fw={800}>{characters.length}</Text>
              <Text c='rgba(255,255,255,0.72)' size='sm'>Total characters across draft and active states.</Text>
            </Card>

            <Card radius='lg' p='lg' style={{ background: 'rgba(255,255,255,0.08)' }}>
              <Group gap='sm' mb='xs'>
                <Shield size={18} />
                <Text fw={700}>Ready for Play</Text>
              </Group>
              <Text fz={30} fw={800}>{activeCount}</Text>
              <Text c='rgba(255,255,255,0.72)' size='sm'>Active characters with a playable sheet surface.</Text>
            </Card>

            <Card radius='lg' p='lg' style={{ background: 'rgba(255,255,255,0.08)' }}>
              <Group gap='sm' mb='xs'>
                <Sparkles size={18} />
                <Text fw={700}>In Progress</Text>
              </Group>
              <Text fz={30} fw={800}>{draftCount}</Text>
              <Text c='rgba(255,255,255,0.72)' size='sm'>Draft builds still moving through the builder flow.</Text>
            </Card>
          </SimpleGrid>
        </Stack>
      </Card>

      {characters.length === 0 ? (
        <Card radius='xl' p='xl' style={cardStyle}>
          <Stack gap='md'>
            <Text fw={700} size='lg'>No characters yet.</Text>
            <Text c='dimmed'>
              Start a new build to choose a race, set class structure, and turn it into a playable
              sheet once the build is ready.
            </Text>
            <Group>
              <Button component='a' href='/characters/new' radius='xl'>
                Start Your First Character
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing='lg'>
          {characters.map((character) => (
            <Card key={character.id} radius='xl' p='xl' style={cardStyle}>
              <Stack gap='lg'>
                <Group justify='space-between' align='flex-start'>
                  <Stack gap={6}>
                    <Group gap='xs'>
                      <Text fw={800} size='lg'>
                        {character.label || 'Untitled character'}
                      </Text>
                      <Badge color={statusColor[character.status]} variant='light'>
                        {character.status === 'ACTIVE' ? 'Playable' : 'Draft'}
                      </Badge>
                    </Group>
                    <Text c='dimmed' size='sm'>
                      System: {character.systemId}
                    </Text>
                  </Stack>

                  <Badge variant='outline'>
                    Stream {character.streamVersion}
                  </Badge>
                </Group>

                <Text size='sm' c='dimmed'>
                  {character.status === 'ACTIVE'
                    ? 'Open the sheet for play-state actions, then use Edit Character for structural changes.'
                    : 'Continue the builder to finish race, classes, background, and other structural decisions.'}
                </Text>

                <Group>
                  <Button component='a' href={`/characters/${character.id}`} radius='xl' variant='default'>
                    {character.status === 'ACTIVE' ? 'Open Sheet' : 'Review Sheet'}
                  </Button>
                  <Button
                    component='a'
                    href={character.status === 'ACTIVE' ? `/characters/edit/${character.id}` : `/characters/new/${character.id}`}
                    radius='xl'
                    rightSection={<ArrowRight size={16} />}
                  >
                    {character.status === 'ACTIVE' ? 'Edit Character' : 'Continue Builder'}
                  </Button>
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}

export default Characters
