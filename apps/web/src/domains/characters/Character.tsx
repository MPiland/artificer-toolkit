import { Alert, Badge, Button, Card, Group, Loader, ScrollArea, Stack, Table, Text, Title } from '@mantine/core'

import { Route } from '#routes/_authed/characters/$characterId'
import { useGetCharacterBuilder } from '../../data/characters'

const Character = () => {
  const characterId = Route.useParams({ select: (r) => r.characterId })
  const builderQuery = useGetCharacterBuilder(characterId)

  if (builderQuery.isLoading) {
    return (
      <Group justify='center' py='xl'>
        <Loader />
      </Group>
    )
  }

  if (!builderQuery.data) {
    return (
      <Alert color='red' title='Character Not Found'>
        We could not load this character.
      </Alert>
    )
  }

  const { character, resolution } = builderQuery.data

  return (
    <Stack gap='lg'>
      <Group justify='space-between' align='flex-start'>
        <div>
          <Title order={2}>{character.label || 'Untitled character'}</Title>
          <Text c='dimmed'>{character.description || 'No concept description yet.'}</Text>
        </div>

        <Group gap='sm'>
          <Badge color={character.status === 'ACTIVE' ? 'green' : 'yellow'}>
            {character.status === 'ACTIVE' ? 'Active' : 'Draft'}
          </Badge>
          <Badge variant='light'>Level {resolution.summary.totalLevel || 0}</Badge>
          <Badge color={resolution.readiness.ready ? 'green' : 'yellow'}>
            {resolution.readiness.ready ? 'Ready' : 'Needs Attention'}
          </Badge>
          <Button component='a' href={character.status === 'ACTIVE' ? `/characters/edit/${character.id}` : `/characters/new/${character.id}`}>
            {character.status === 'ACTIVE' ? 'Edit Character' : 'Continue Draft'}
          </Button>
        </Group>
      </Group>

      {character.status === 'DRAFT' ? (
        <Alert color='yellow' title='Draft Character'>
          <Stack gap={4}>
            <Text size='sm'>
              This character is still in draft. You can review the sheet here, but structural build changes should continue in the builder.
            </Text>
            <Text size='sm'>
              Blocking issues: {resolution.readiness.blockingIssues.length} | Required outstanding choices: {resolution.readiness.outstandingRequiredChoices.length}
            </Text>
          </Stack>
        </Alert>
      ) : null}

      <Group grow align='stretch'>
        <Card withBorder>
          <Text fw={600} mb='xs'>Species</Text>
          <Stack gap={4}>
            <Text size='sm'>Race: {resolution.summary.selectedRace?.raceLabel ?? 'Not selected'}</Text>
            {resolution.summary.selectedRace?.subraceLabel ? (
              <Text size='sm'>Subrace: {resolution.summary.selectedRace.subraceLabel}</Text>
            ) : null}
            {resolution.summary.selectedRace?.ancestryOptionLabel ? (
              <Text size='sm'>
                {resolution.summary.selectedRace.ancestryLabel}: {resolution.summary.selectedRace.ancestryOptionLabel}
              </Text>
            ) : null}
          </Stack>
        </Card>

        <Card withBorder>
          <Text fw={600} mb='xs'>Background</Text>
          <Text size='sm'>{resolution.summary.selectedBackground?.label ?? 'Not selected'}</Text>
        </Card>
      </Group>

      <Card withBorder>
        <Text fw={600} mb='xs'>Classes</Text>
        {resolution.summary.classes.length === 0 ? (
          <Text c='dimmed' size='sm'>No class rows selected yet.</Text>
        ) : (
          <Stack gap='sm'>
            {resolution.summary.classes.map((entry) => (
              <div key={`${entry.classId}:${entry.classLevel}:${entry.subclassId ?? 'base'}`}>
                <Text fw={500} size='sm'>
                  {entry.classLabel}
                  {entry.subclassLabel ? ` / ${entry.subclassLabel}` : ''}
                  {entry.specializationLabel ? ` / ${entry.specializationLabel}` : ''}
                  {` (Level ${entry.classLevel})`}
                </Text>
                <Text size='sm' c='dimmed'>
                  Features: {entry.featureLabels.join(', ') || 'None'} | Resources: {entry.resourceLabels.join(', ') || 'None'} | Spellcasting: {entry.spellcastingLabels.join(', ') || 'None'}
                </Text>
              </div>
            ))}
          </Stack>
        )}
      </Card>

      {resolution.validations.length > 0 ? (
        <Alert color='yellow' title='Validations'>
          <Stack gap={4}>
            {resolution.validations.map((validation) => (
              <Text key={`${validation.code}:${validation.message}`} size='sm'>
                {validation.message}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}

      <Card withBorder>
        <Text fw={600} mb='xs'>Outstanding Choices</Text>
        {resolution.outstandingChoices.length === 0 ? (
          <Text c='dimmed' size='sm'>No unresolved builder choices right now.</Text>
        ) : (
          <Stack gap='xs'>
            {resolution.outstandingChoices.map((choice) => (
              <Alert key={`${choice.code}:${choice.message}`} color={choice.required ? 'yellow' : 'blue'}>
                <Text fw={500}>{choice.sourceLabel}</Text>
                <Text size='sm'>{choice.message}</Text>
              </Alert>
            ))}
          </Stack>
        )}
      </Card>

      <Card withBorder>
        <Text fw={600} mb='xs'>Granted Content</Text>
        <ScrollArea.Autosize mah={280}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Type</Table.Th>
                <Table.Th>Label</Table.Th>
                <Table.Th>Source</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {resolution.grants.features.map((item) => (
                <Table.Tr key={`feature:${item.id}:${item.sourceLabel}`}>
                  <Table.Td>Feature</Table.Td>
                  <Table.Td>{item.label}</Table.Td>
                  <Table.Td>{item.sourceLabel}</Table.Td>
                </Table.Tr>
              ))}
              {resolution.grants.resources.map((item) => (
                <Table.Tr key={`resource:${item.id}:${item.sourceLabel}`}>
                  <Table.Td>Resource</Table.Td>
                  <Table.Td>{item.label}</Table.Td>
                  <Table.Td>{item.sourceLabel}</Table.Td>
                </Table.Tr>
              ))}
              {resolution.grants.spellcasting.map((item) => (
                <Table.Tr key={`spellcasting:${item.id}:${item.sourceLabel}`}>
                  <Table.Td>Spellcasting</Table.Td>
                  <Table.Td>{item.label}</Table.Td>
                  <Table.Td>{item.sourceLabel}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      </Card>
    </Stack>
  )
}

export default Character
