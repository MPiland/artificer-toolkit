import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useMutation as useConvexMutation } from 'convex/react'
import { definitionReferences } from '@artificer-toolkit/apis/convex/definition-references'
import { getSystemDefinition, getSystemDefinitions } from '#app/data/systems/queries'
import { SystemDefinitionEditor } from './SystemDefinitionEditor'
import { definitionErrorMessage, formatDefinitionFamily } from './systemDefinitionModel'

export function SystemDefinitionWorkspace({
  gameSystemId,
  definitionFamilyKeys
}: {
  gameSystemId: string
  definitionFamilyKeys: readonly string[]
}) {
  const queryClient = useQueryClient()
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null])
  const cursor = cursorHistory[cursorHistory.length - 1] ?? null
  const definitions = useQuery(getSystemDefinitions(gameSystemId, cursor))
  const createDefinition = useConvexMutation(definitionReferences.create)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [opened, modal] = useDisclosure(false)
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [familyKey, setFamilyKey] = useState(definitionFamilyKeys[0] ?? '')

  if (!selectedId && definitions.data?.page[0]) setSelectedId(definitions.data.page[0].id)

  const create = useMutation({
    mutationFn: () =>
      createDefinition({
        gameSystemId,
        definitionFamilyKey: familyKey,
        label,
        description: description.trim() || null
      }),
    onSuccess: (workspace) => {
      queryClient.setQueryData(getSystemDefinition(workspace.id).queryKey, workspace)
      setCursorHistory([null])
      setSelectedId(workspace.id)
      setLabel('')
      setDescription('')
      modal.close()
    }
  })

  return (
    <Card padding='lg' radius='md' withBorder>
      <Stack gap='lg'>
        <Group justify='space-between' align='flex-start'>
          <div>
            <Title order={2} size='h3'>
              Reusable definitions
            </Title>
            <Text c='dimmed' size='sm'>
              Publish typed System mechanics once, then reference them by UUID from authored
              content.
            </Text>
          </div>
          <Button disabled={definitionFamilyKeys.length === 0} onClick={modal.open}>
            New definition
          </Button>
        </Group>
        {definitions.isError ? (
          <Alert color='red'>Reusable definitions are unavailable.</Alert>
        ) : null}
        <SimpleGrid cols={{ base: 1, md: selectedId ? 3 : 1 }}>
          <Stack gap='xs'>
            {(definitions.data?.page ?? []).map((definition) => (
              <Button
                key={definition.id}
                justify='space-between'
                variant={definition.id === selectedId ? 'light' : 'subtle'}
                onClick={() => setSelectedId(definition.id)}
              >
                <span>{definition.label}</span>
                <Badge color={definition.draftVersion === null ? 'gray' : 'orange'} size='xs'>
                  {definition.draftVersion !== null
                    ? 'Draft'
                    : definition.currentVersion !== null
                      ? 'Published'
                      : 'New'}
                </Badge>
              </Button>
            ))}
            {!definitions.isPending && definitions.data?.page.length === 0 ? (
              <Text c='dimmed' size='sm'>
                No reusable definitions are available yet.
              </Text>
            ) : null}
            <Group justify='space-between'>
              <Button
                aria-label='Previous definitions page'
                disabled={cursorHistory.length === 1 || definitions.isFetching}
                variant='default'
                onClick={() => setCursorHistory((history) => history.slice(0, -1))}
              >
                Previous page
              </Button>
              <Button
                aria-label='Next definitions page'
                disabled={!definitions.data || definitions.data.isDone || definitions.isFetching}
                onClick={() => {
                  if (definitions.data)
                    setCursorHistory((history) => [...history, definitions.data.continueCursor])
                }}
              >
                Next page
              </Button>
            </Group>
          </Stack>
          {selectedId ? (
            <div style={{ gridColumn: 'span 2' }}>
              <SystemDefinitionEditor key={selectedId} definitionId={selectedId} />
            </div>
          ) : null}
        </SimpleGrid>
      </Stack>

      <Modal opened={opened} onClose={modal.close} title='Create reusable definition'>
        <Stack>
          <TextInput
            required
            label='Label'
            maxLength={160}
            value={label}
            onChange={(event) => setLabel(event.currentTarget.value)}
          />
          <Textarea
            label='Description'
            maxLength={4000}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
          <Select
            required
            data={definitionFamilyKeys.map((value) => ({
              value,
              label: formatDefinitionFamily(value)
            }))}
            label='Definition family'
            value={familyKey}
            onChange={(value) => setFamilyKey(value ?? '')}
          />
          {create.error ? <Alert color='red'>{definitionErrorMessage(create.error)}</Alert> : null}
          <Button
            disabled={!label.trim() || !familyKey}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Create definition
          </Button>
        </Stack>
      </Modal>
    </Card>
  )
}
