import {
  Alert,
  Badge,
  Button,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Title
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { useState } from 'react'
import { definitionReferences } from '@artificer-toolkit/apis/convex/definition-references'
import { reusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { getSystemDefinition } from '#app/data/systems/queries'
import { SenseDefinitionEditor } from './SenseDefinitionEditor'
import {
  createDefinitionEditorState,
  definitionErrorMessage,
  formatDefinitionFamily,
  parseSenseDocument
} from './systemDefinitionModel'

export function SystemDefinitionEditor({ definitionId }: { definitionId: string }) {
  const queryClient = useQueryClient()
  const workspaceQuery = getSystemDefinition(definitionId)
  const workspace = useQuery(workspaceQuery)
  const saveDraft = useConvexMutation(definitionReferences.saveDraft)
  const publishDraft = useConvexMutation(definitionReferences.publish)
  const [mode, setMode] = useState<'GUIDED' | 'ADVANCED'>('GUIDED')
  const [editor, setEditor] = useState<ReturnType<typeof createDefinitionEditorState> | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // Subscription updates must not replace local edits or advance their version
  // preconditions. A newly selected definition mounts a fresh keyed editor.
  if (!editor && workspace.data) setEditor(createDefinitionEditorState(workspace.data))

  const save = useMutation({
    mutationFn: async () => {
      if (!editor) throw new Error('Definition is unavailable.')
      return saveDraft({
        definitionId,
        expectedDefinitionVersion: editor.definitionVersion,
        expectedDraftVersion: editor.draftVersion,
        document: reusableDefinitionDocumentDtoSchema.parse(JSON.parse(editor.documentText))
      })
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(workspaceQuery.queryKey, updated)
      setEditor(createDefinitionEditorState(updated))
      setLocalError(null)
    },
    onError: (error) => setLocalError(definitionErrorMessage(error))
  })
  const publish = useMutation({
    mutationFn: () => {
      if (!editor || editor.draftVersion === null)
        throw new Error('Save a draft before publishing.')
      return publishDraft({
        definitionId,
        expectedDefinitionVersion: editor.definitionVersion,
        expectedDraftVersion: editor.draftVersion
      })
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(workspaceQuery.queryKey, updated)
      setEditor(createDefinitionEditorState(updated))
      setLocalError(null)
    },
    onError: (error) => setLocalError(definitionErrorMessage(error))
  })

  if (workspace.isError || (!workspace.isPending && !workspace.data))
    return <Alert color='red'>Definition details are unavailable.</Alert>
  if (!workspace.data || !editor) return <Text c='dimmed'>Loading definition…</Text>

  const currentWorkspace = workspace.data
  const busy = save.isPending || publish.isPending
  const stale =
    editor.definitionVersion !== currentWorkspace.version ||
    editor.draftVersion !== currentWorkspace.draftVersion
  const dirty = editor.documentText !== editor.savedDocumentText
  const senseDocument = parseSenseDocument(editor.documentText)

  return (
    <Stack gap='md'>
      <Group justify='space-between' align='flex-start'>
        <div>
          <Title order={3}>{currentWorkspace.label}</Title>
          <Group gap='xs' mt='xs'>
            <Badge variant='light'>
              {formatDefinitionFamily(currentWorkspace.definitionFamilyKey)}
            </Badge>
            <Badge color={currentWorkspace.editable ? 'blue' : 'gray'} variant='light'>
              {currentWorkspace.editable ? 'Homebrew' : 'Platform'}
            </Badge>
          </Group>
        </div>
        <SegmentedControl
          disabled={busy}
          data={[
            { value: 'GUIDED', label: 'Guided' },
            { value: 'ADVANCED', label: 'Advanced' }
          ]}
          value={mode}
          onChange={(value) => setMode(value === 'ADVANCED' ? 'ADVANCED' : 'GUIDED')}
        />
      </Group>
      {stale ? (
        <Alert color='yellow'>
          <Stack gap='xs'>
            <Text size='sm'>
              This definition changed elsewhere. Your local edits have been kept.
            </Text>
            <Button
              disabled={busy}
              variant='light'
              onClick={() => {
                setEditor(createDefinitionEditorState(currentWorkspace))
                setLocalError(null)
              }}
            >
              Discard local edits and reload
            </Button>
          </Stack>
        </Alert>
      ) : null}
      {!currentWorkspace.editable ? (
        <Alert color='blue'>Platform definitions are readable here but cannot be edited.</Alert>
      ) : mode === 'GUIDED' && senseDocument ? (
        <SenseDefinitionEditor
          document={senseDocument}
          disabled={busy}
          onChange={(document) =>
            setEditor({ ...editor, documentText: JSON.stringify(document, null, 2) })
          }
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
          disabled={!currentWorkspace.editable || busy}
          minRows={18}
          styles={{ input: { fontFamily: 'monospace' } }}
          value={editor.documentText}
          onChange={(event) => setEditor({ ...editor, documentText: event.currentTarget.value })}
        />
      ) : null}
      {localError ? <Alert color='red'>{localError}</Alert> : null}
      {currentWorkspace.editable ? (
        <Group>
          <Button disabled={stale || busy} loading={save.isPending} onClick={() => save.mutate()}>
            Save draft
          </Button>
          <Button
            disabled={editor.draftVersion === null || dirty || stale || busy}
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
