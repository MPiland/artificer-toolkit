import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  SegmentedControl,
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
import { useEffect, useMemo, useState } from 'react'
import { reusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { senseReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/combatPerception'
import { getSystemDefinition, getSystemDefinitions } from '#app/data/systems/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function SystemDefinitionWorkspace({
  gameSystemId,
  definitionFamilyKeys
}: {
  gameSystemId: string
  definitionFamilyKeys: readonly string[]
}) {
  const queryClient = useQueryClient()
  const definitions = useQuery(getSystemDefinitions(gameSystemId))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [opened, modal] = useDisclosure(false)
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [familyKey, setFamilyKey] = useState(definitionFamilyKeys[0] ?? '')

  useEffect(() => {
    if (!selectedId && definitions.data?.[0]) setSelectedId(definitions.data[0].id)
  }, [definitions.data, selectedId])

  const create = useMutation({
    mutationFn: () =>
      api.systems.definitions.create({
        gameSystemId,
        definitionFamilyKey: familyKey,
        label,
        description: description.trim() || null
      }),
    onSuccess: async (workspace) => {
      queryClient.setQueryData(queryKeys.systems.definition(workspace.id), workspace)
      await queryClient.invalidateQueries({ queryKey: queryKeys.systems.definitions(gameSystemId) })
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
            {(definitions.data ?? []).map((definition) => (
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
            {!definitions.isPending && definitions.data?.length === 0 ? (
              <Text c='dimmed' size='sm'>
                No reusable definitions are available yet.
              </Text>
            ) : null}
          </Stack>
          {selectedId ? (
            <div style={{ gridColumn: 'span 2' }}>
              <DefinitionEditor definitionId={selectedId} gameSystemId={gameSystemId} />
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
          {create.error ? <Alert color='red'>{errorMessage(create.error)}</Alert> : null}
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

function DefinitionEditor({
  definitionId,
  gameSystemId
}: {
  definitionId: string
  gameSystemId: string
}) {
  const queryClient = useQueryClient()
  const workspace = useQuery(getSystemDefinition(definitionId))
  const [mode, setMode] = useState<'GUIDED' | 'ADVANCED'>('GUIDED')
  const [documentText, setDocumentText] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const loadedDocument = useMemo(
    () =>
      workspace.data?.draft?.document ??
      workspace.data?.current?.document ??
      (workspace.data ? createStarterDocument(workspace.data) : null),
    [workspace.data]
  )

  useEffect(() => {
    if (loadedDocument) setDocumentText(JSON.stringify(loadedDocument, null, 2))
    setLocalError(null)
  }, [definitionId, loadedDocument])

  const save = useMutation({
    mutationFn: async () => {
      if (!workspace.data) throw new Error('Definition is unavailable.')
      const document = reusableDefinitionDocumentDtoSchema.parse(JSON.parse(documentText))
      return api.systems.definitions.saveDraft({
        definitionId,
        expectedDefinitionVersion: workspace.data.version,
        expectedDraftVersion: workspace.data.draft?.version ?? null,
        document
      })
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.systems.definition(definitionId), updated)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.systems.definitions(gameSystemId)
      })
      setLocalError(null)
    },
    onError: (error) => setLocalError(errorMessage(error))
  })

  const publish = useMutation({
    mutationFn: () => {
      if (!workspace.data?.draft) throw new Error('Save a draft before publishing.')
      return api.systems.definitions.publish({
        definitionId,
        expectedDefinitionVersion: workspace.data.version,
        expectedDraftVersion: workspace.data.draft.version
      })
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.systems.definition(definitionId), updated)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.systems.definitions(gameSystemId)
      })
      setLocalError(null)
    },
    onError: (error) => setLocalError(errorMessage(error))
  })

  if (workspace.isPending) return <Text c='dimmed'>Loading definition…</Text>
  if (workspace.isError || !workspace.data)
    return <Alert color='red'>Definition details are unavailable.</Alert>

  const senseDocument = parseSenseDocument(documentText)

  return (
    <Stack gap='md'>
      <Group justify='space-between' align='flex-start'>
        <div>
          <Title order={3}>{workspace.data.label}</Title>
          <Group gap='xs' mt='xs'>
            <Badge variant='light'>
              {formatDefinitionFamily(workspace.data.definitionFamilyKey)}
            </Badge>
            <Badge color={workspace.data.editable ? 'blue' : 'gray'} variant='light'>
              {workspace.data.editable ? 'Homebrew' : 'Platform'}
            </Badge>
          </Group>
        </div>
        <SegmentedControl
          data={[
            { value: 'GUIDED', label: 'Guided' },
            { value: 'ADVANCED', label: 'Advanced' }
          ]}
          value={mode}
          onChange={(value) => setMode(value === 'ADVANCED' ? 'ADVANCED' : 'GUIDED')}
        />
      </Group>

      {!workspace.data.editable ? (
        <Alert color='blue'>Platform definitions are readable here but cannot be edited.</Alert>
      ) : mode === 'GUIDED' && senseDocument ? (
        <SenseDefinitionEditor
          document={senseDocument}
          onChange={(document) => setDocumentText(JSON.stringify(document, null, 2))}
        />
      ) : mode === 'GUIDED' ? (
        <Alert color='blue'>
          This family currently uses the Advanced typed document editor. Server validation still
          enforces its exact closed contract before save or publish.
        </Alert>
      ) : null}

      {mode === 'ADVANCED' ? (
        <Textarea
          autosize
          aria-label='Reusable definition document'
          disabled={!workspace.data.editable}
          minRows={18}
          styles={{ input: { fontFamily: 'monospace' } }}
          value={documentText}
          onChange={(event) => setDocumentText(event.currentTarget.value)}
        />
      ) : null}

      {localError ? <Alert color='red'>{localError}</Alert> : null}
      {workspace.data.editable ? (
        <Group>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save draft
          </Button>
          <Button
            disabled={!workspace.data.draft}
            loading={publish.isPending}
            variant='light'
            onClick={() => publish.mutate()}
          >
            Publish
          </Button>
        </Group>
      ) : null}
    </Stack>
  )
}

type SenseDocument = ReturnType<typeof senseReusableDefinitionDocumentDtoSchema.parse>

function SenseDefinitionEditor({
  document,
  onChange
}: {
  document: SenseDocument
  onChange: (document: SenseDocument) => void
}) {
  const capability = document.capabilities[0]!
  const update = (next: Partial<typeof capability>) =>
    onChange({ ...document, capabilities: [{ ...capability, ...next }] })

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <Select
        data={['VISUAL', 'AUDITORY', 'VIBRATION', 'NONVISUAL']}
        label='Channel'
        value={capability.channel}
        onChange={(value) => {
          if (value) update({ channel: value as typeof capability.channel })
        }}
      />
      <Select
        data={['DETECTED', 'LOCATED', 'PRECISE']}
        label='Access grade'
        value={capability.accessGrade}
        onChange={(value) => {
          if (value) update({ accessGrade: value as typeof capability.accessGrade })
        }}
      />
      <MultiSelect
        data={['DETECT', 'LOCATE', 'PRECISE', 'SEE']}
        label='Requirements satisfied'
        value={capability.satisfies}
        onChange={(satisfies) => update({ satisfies: satisfies as typeof capability.satisfies })}
      />
      <Select
        data={['BRIGHT_ONLY', 'DIM', 'ORDINARY_DARKNESS', 'MAGICAL_DARKNESS', 'IGNORE']}
        label='Illumination access'
        value={capability.illuminationAccess}
        onChange={(value) => {
          if (value) update({ illuminationAccess: value as typeof capability.illuminationAccess })
        }}
      />
      <Select
        data={['NONE', 'LIGHT', 'HEAVY', 'IGNORE']}
        label='Obscurement access'
        value={capability.obscurementAccess}
        onChange={(value) => {
          if (value) update({ obscurementAccess: value as typeof capability.obscurementAccess })
        }}
      />
      <MultiSelect
        data={['LINE_OF_EFFECT', 'SHARED_SURFACE']}
        label='Physical constraints'
        value={capability.physicalConstraints}
        onChange={(physicalConstraints) =>
          update({
            physicalConstraints: physicalConstraints as typeof capability.physicalConstraints
          })
        }
      />
      <Checkbox
        checked={capability.perceivesInvisible}
        label='Perceives invisible subjects'
        onChange={(event) => update({ perceivesInvisible: event.currentTarget.checked })}
      />
    </SimpleGrid>
  )
}

function createStarterDocument(workspace: {
  id: string
  gameSystemId: string
  definitionFamilyKey: string
}): unknown {
  if (workspace.definitionFamilyKey === 'sense') {
    return {
      schemaVersion: 1,
      kind: 'SENSE',
      id: workspace.id,
      gameSystemId: workspace.gameSystemId,
      capabilities: [
        {
          channel: 'VISUAL',
          accessGrade: 'PRECISE',
          satisfies: ['DETECT', 'LOCATE', 'PRECISE', 'SEE'],
          illuminationAccess: 'DIM',
          obscurementAccess: 'NONE',
          perceivesInvisible: false,
          physicalConstraints: ['LINE_OF_EFFECT']
        }
      ]
    }
  }
  return {
    schemaVersion: 1,
    id: workspace.id,
    gameSystemId: workspace.gameSystemId,
    definitionFamilyKey: workspace.definitionFamilyKey
  }
}

function parseSenseDocument(value: string): SenseDocument | null {
  try {
    const parsed = senseReusableDefinitionDocumentDtoSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function formatDefinitionFamily(value: string) {
  return value
    .split(/[.-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The definition could not be saved.'
}
