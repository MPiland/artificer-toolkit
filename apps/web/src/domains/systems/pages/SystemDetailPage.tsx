import {
  Alert,
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

export function SystemDetailPage() {
  const route = getRouteApi('/_authed/systems/$systemId')
  const system = route.useLoaderData()
  const navigate = useNavigate()

  if (!system) {
    return (
      <Stack>
        <Alert color='yellow'>That system could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/systems' })}>Back to systems</Button>
      </Stack>
    )
  }

  const groups = [
    {
      label: 'Abilities & Skills',
      values: [
        ...system.skills,
        ...system.passives
      ]
    },
    {
      label: 'Combat',
      values: [
        ...system.damageTypes,
        ...system.conditionTypes,
        ...system.senses,
        ...system.speeds
      ]
    },
    {
      label: 'World',
      values: [
        ...system.alignments,
        ...system.languages,
        ...system.terrains,
        ...system.lifestyles
      ]
    },
    {
      label: 'Content',
      values: [
        ...system.currencies,
        ...system.heritages,
        ...system.magicSchools,
        ...system.rarities
      ]
    }
  ]

  return (
    <Stack gap='xl'>
      <PageHeader
        eyebrow='System'
        title={system.label}
        description={system.description || 'Read-only ruleset vocabulary available to authored content and characters.'}
        actions={<Button variant='default' onClick={() => navigate({ to: '/systems' })}>Back to systems</Button>}
      />
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing='lg'>
        {groups.map((group) => (
          <Card key={group.label} withBorder radius='lg' padding='lg'>
            <Stack gap='md'>
              <Group justify='space-between'>
                <Text fw={700}>{group.label}</Text>
                <Badge variant='light'>{group.values.length}</Badge>
              </Group>
              {group.values.length > 0
                ? (
                    <Group gap='xs'>
                      {group.values.map((value) => (
                        <Badge key={`${group.label}-${value.id}`} variant='default'>
                          {value.label}
                        </Badge>
                      ))}
                    </Group>
                  )
                : <Text size='sm' c='dimmed'>No values are available for this group.</Text>}
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  )
}
