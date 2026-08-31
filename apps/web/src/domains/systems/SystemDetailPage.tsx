import { Alert, Badge, Card, Container, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getSystem, getSystemList, getSystemRuleCapability } from '#app/data/systems/queries'
import { PageHeader } from '#app/shell'
import { SystemDefinitionWorkspace } from './SystemDefinitionWorkspace'

export function SystemDetailPage({ systemId }: { systemId: string }) {
  const { data: system } = useSuspenseQuery(getSystem(systemId))
  const { data: systems } = useSuspenseQuery(getSystemList())
  const { data: capability } = useSuspenseQuery(getSystemRuleCapability(systemId))
  const summary = systems.find((candidate) => candidate.id === systemId)

  if (!system || !summary) return <Alert color='red'>This Game System is unavailable.</Alert>

  return (
    <Container size='xl' py='xl'>
      <Stack gap='xl'>
        <PageHeader
          eyebrow='Game System'
          title={system.label}
          description={`${summary.rulesetCode} ${summary.rulesetVersion}`}
        />
        {!capability ? (
          <Alert color='yellow'>
            This System has no installed Rules Runtime capability. Rules-driven authoring and VTT
            automation stay unavailable.
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <CapabilityCard
              title='Authored content'
              description='Domain items this System can compile into rules entry points.'
              values={capability.authoredRootKinds}
            />
            <CapabilityCard
              title='Reusable definitions'
              description='Typed definition families available to System and homebrew content.'
              values={capability.definitionFamilyKeys}
            />
            <CapabilityCard
              title='Facts'
              description='Typed runtime facts accepted by this System contract.'
              values={capability.factContracts.map((fact) => fact.key)}
            />
            <CapabilityCard
              title='Operations'
              description='Code-owned operations available to published rule graphs.'
              values={capability.operationContracts.map((operation) => operation.key)}
            />
          </SimpleGrid>
        )}
        <Card padding='lg' radius='md' withBorder>
          <Stack gap='sm'>
            <Title order={2} size='h3'>
              Rules Catalogues
            </Title>
            {summary.rulesCatalogues.length === 0 ? (
              <Text c='dimmed'>No Rules Catalogues are available.</Text>
            ) : (
              summary.rulesCatalogues.map((catalogue) => (
                <div key={catalogue.id}>
                  <Text fw={600}>{catalogue.label}</Text>
                  {catalogue.description ? (
                    <Text c='dimmed' size='sm'>
                      {catalogue.description}
                    </Text>
                  ) : null}
                </div>
              ))
            )}
          </Stack>
        </Card>
        {capability ? (
          <SystemDefinitionWorkspace
            definitionFamilyKeys={capability.definitionFamilyKeys}
            gameSystemId={systemId}
          />
        ) : null}
      </Stack>
    </Container>
  )
}

function CapabilityCard({
  title,
  description,
  values
}: {
  title: string
  description: string
  values: readonly string[]
}) {
  return (
    <Card padding='lg' radius='md' withBorder>
      <Stack gap='md'>
        <div>
          <Title order={2} size='h3'>
            {title}
          </Title>
          <Text c='dimmed' size='sm'>
            {description}
          </Text>
        </div>
        <Group gap='xs'>
          {values.length === 0 ? (
            <Text c='dimmed' size='sm'>
              Not supported
            </Text>
          ) : (
            values.map((value) => (
              <Badge key={value} variant='light'>
                {formatCapability(value)}
              </Badge>
            ))
          )}
        </Group>
      </Stack>
    </Card>
  )
}

function formatCapability(value: string) {
  return value
    .split(/[.-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}
