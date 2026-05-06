import {
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text
} from '@mantine/core'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { PageHeader } from '#app/shell'

export function SystemListPage() {
  const route = getRouteApi('/_authed/systems/')
  const systems = route.useLoaderData()
  const navigate = useNavigate()

  return (
    <Stack gap='xl'>
      <PageHeader
        eyebrow='Reference'
        title='Systems'
        description='Read-only ruleset foundations used by authored content, character builder choices, and sheet references.'
      />
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing='lg'>
        {systems.map((system) => (
          <Card key={system.id} withBorder radius='lg' padding='lg'>
            <Stack gap='md'>
              <Group justify='space-between' align='flex-start'>
                <Stack gap={4}>
                  <Text fw={700}>{system.label}</Text>
                  <Text size='sm' c='dimmed'>{system.description || 'No description has been provided.'}</Text>
                </Stack>
                <Badge variant='light'>Read only</Badge>
              </Group>
              <Button
                variant='default'
                onClick={() => navigate({ to: '/systems/$systemId', params: { systemId: system.id } })}
              >
                View system
              </Button>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  )
}
