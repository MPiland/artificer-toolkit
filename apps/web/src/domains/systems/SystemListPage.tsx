import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title
} from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { getSystemList } from '#app/data/systems/queries'
import { PageHeader } from '#app/shell'

export function SystemListPage() {
  const { data: systems } = useSuspenseQuery(getSystemList())
  const navigate = useNavigate()

  return (
    <Container size='xl' py='xl'>
      <Stack gap='xl'>
        <PageHeader
          eyebrow='Rules workspace'
          title='Game Systems'
          description='Browse each System’s vocabulary, Rules Catalogues, and installed rules capabilities.'
        />
        {systems.length === 0 ? (
          <Card withBorder>
            <Text c='dimmed'>No Game Systems are available.</Text>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
            {systems.map((system) => (
              <Card key={system.id} padding='lg' radius='md' withBorder>
                <Stack gap='md'>
                  <div>
                    <Group justify='space-between' wrap='nowrap'>
                      <Title order={2} size='h3'>
                        {system.label}
                      </Title>
                      <Badge variant='light'>{system.rulesetVersion}</Badge>
                    </Group>
                    <Text c='dimmed' mt='xs' size='sm'>
                      {system.description ?? system.rulesetCode}
                    </Text>
                  </div>
                  <Text size='sm'>
                    {system.rulesCatalogues.length}{' '}
                    {system.rulesCatalogues.length === 1 ? 'Rules Catalogue' : 'Rules Catalogues'}
                  </Text>
                  <Button
                    variant='light'
                    onClick={() =>
                      void navigate({ to: '/systems/$systemId', params: { systemId: system.id } })
                    }
                  >
                    Open System
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  )
}
