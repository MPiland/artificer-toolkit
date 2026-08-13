import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
  Title
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DecisionGraphType } from '@gorules/jdm-editor'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ruleQueries } from '#app/data/rules/queries'
import { api, type RulePackDocumentDto, type RulePackRevisionDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { RuleFixturePanel } from './RuleFixturePanel'
import { RuleImportExportActions } from './RuleImportExportActions'
import { RuleModelToolbar } from './RuleModelToolbar'
import { RulePackNavigator } from './RulePackNavigator'
import {
  addRuleModel,
  createDefaultRuleDocument,
  errorMessage,
  parseRuleDocument,
  removeRuleModel,
  renameRuleModel
} from './ruleDocument'
import * as styles from './RuleStudioPage.css'

const RuleGraphEditor = lazy(() =>
  import('./RuleGraphEditor').then((module) => ({ default: module.RuleGraphEditor }))
)

const defaultFixtureExpected = {
  eligibility: { allowed: true, reasonCode: 'ALLOWED' },
  outcomes: [],
  rollRequests: []
}

export function RuleStudioPage() {
  const queryClient = useQueryClient()
  const packsQuery = useQuery(ruleQueries.packs())
  const [packId, setPackId] = useState<string | null>(null)
  const revisionsQuery = useQuery({
    ...ruleQueries.revisions(packId ?? ''),
    enabled: Boolean(packId)
  })
  const [revisionId, setRevisionId] = useState<string | null>(null)
  const revisionQuery = useQuery({
    ...ruleQueries.revision(revisionId ?? ''),
    enabled: Boolean(revisionId)
  })
  const [document, setDocument] = useState<RulePackDocumentDto>(createDefaultRuleDocument)
  const [newRulesetCode, setNewRulesetCode] = useState('')
  const [newRulesetVersion, setNewRulesetVersion] = useState('')
  const [modelKey, setModelKey] = useState('main')
  const [fixtureId, setFixtureId] = useState<string | null>(null)
  const [copyingRevision, setCopyingRevision] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedRevisionKey = useRef<string | null>(null)

  const packs = packsQuery.data ?? []
  const revisions = revisionsQuery.data ?? []
  const selectedRevision = revisionQuery.data
  const selectedPack = useMemo(
    () => packs.find((pack) => pack.id === (selectedRevision?.packId ?? packId)),
    [packId, packs, selectedRevision?.packId]
  )
  const editable = !selectedRevision || selectedRevision.lifecycle === 'DRAFT' || copyingRevision
  const rulesetCode = selectedPack?.rulesetCode ?? newRulesetCode.trim()
  const rulesetVersion = selectedPack?.rulesetVersion ?? newRulesetVersion.trim()

  useEffect(() => {
    if (!packId || revisionId || !revisionsQuery.data?.length) return
    const firstRevision =
      revisionsQuery.data.find((revision) => revision.lifecycle === 'DRAFT') ??
      revisionsQuery.data[0]
    setRevisionId(firstRevision?.id ?? null)
  }, [packId, revisionId, revisionsQuery.data])

  useEffect(() => {
    if (!selectedRevision || copyingRevision) return
    const key = `${selectedRevision.id}:${selectedRevision.updatedAt}`
    if (loadedRevisionKey.current === key) return
    loadedRevisionKey.current = key
    setDocument(selectedRevision.document)
    setModelKey(Object.keys(selectedRevision.document.models)[0] ?? 'main')
    setFixtureId(selectedRevision.document.fixtures[0]?.id ?? null)
    setDirty(false)
    setError(null)
  }, [copyingRevision, selectedRevision])

  useEffect(() => {
    if (!dirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    globalThis.addEventListener('beforeunload', warnBeforeUnload)
    return () => globalThis.removeEventListener('beforeunload', warnBeforeUnload)
  }, [dirty])

  const refreshRules = () => queryClient.invalidateQueries({ queryKey: queryKeys.rules.all() })

  const saveDraft = useMutation({
    mutationFn: () =>
      api.rules.saveDraft({
        rulesetCode,
        rulesetVersion,
        document,
        ...(selectedRevision?.lifecycle === 'DRAFT' && !copyingRevision
          ? { expectedUpdatedAt: selectedRevision.updatedAt }
          : {})
      }),
    onSuccess: async (saved) => {
      loadedRevisionKey.current = `${saved.id}:${saved.updatedAt}`
      setPackId(saved.packId)
      setRevisionId(saved.id)
      setDocument(saved.document)
      setCopyingRevision(false)
      setDirty(false)
      setError(null)
      await refreshRules()
    },
    onError: (cause) => setError(errorMessage(cause, 'Unable to save the rule pack draft.'))
  })

  const simulateFixture = useMutation({
    mutationFn: ({
      revision,
      fixture
    }: {
      revision: RulePackDocumentDto
      fixture: RulePackDocumentDto['fixtures'][number]
    }) =>
      api.rules.simulate({ document: revision, modelKey: fixture.modelKey, input: fixture.input }),
    onError: (cause) => setError(errorMessage(cause, 'Unable to simulate the fixture.'))
  })

  const activateRevision = useMutation({
    mutationFn: (revision: RulePackRevisionDto) =>
      api.rules.activate({ revisionId: revision.id, expectedChecksum: revision.checksum }),
    onSuccess: async (activated) => {
      loadedRevisionKey.current = `${activated.id}:${activated.updatedAt}`
      setRevisionId(activated.id)
      setDirty(false)
      setError(null)
      await refreshRules()
    },
    onError: (cause) => setError(errorMessage(cause, 'Unable to activate the rule pack revision.'))
  })

  const retirePack = useMutation({
    mutationFn: (revision: RulePackRevisionDto) =>
      api.rules.retire({ packId: revision.packId, expectedRevisionId: revision.id }),
    onSuccess: async () => {
      setError(null)
      await refreshRules()
    },
    onError: (cause) => setError(errorMessage(cause, 'Unable to retire the active rule pack.'))
  })

  const confirmDiscard = () =>
    !dirty || globalThis.confirm('Discard the unsaved Rule Studio changes?')

  const markDocumentChanged = (nextDocument: RulePackDocumentDto) => {
    setDocument(nextDocument)
    setDirty(true)
    setError(null)
    simulateFixture.reset()
  }

  const startNewPack = () => {
    if (!confirmDiscard()) return
    loadedRevisionKey.current = null
    setPackId(null)
    setRevisionId(null)
    setDocument(createDefaultRuleDocument())
    setNewRulesetCode('')
    setNewRulesetVersion('')
    setModelKey('main')
    setFixtureId(null)
    setCopyingRevision(false)
    setDirty(false)
    setError(null)
    simulateFixture.reset()
  }

  const selectPack = (nextPackId: string | null) => {
    if (!confirmDiscard()) return
    loadedRevisionKey.current = null
    setPackId(nextPackId)
    setRevisionId(null)
    setCopyingRevision(false)
    setDirty(false)
    setError(null)
    simulateFixture.reset()
  }

  const selectRevision = (nextRevisionId: string | null) => {
    if (!confirmDiscard()) return
    loadedRevisionKey.current = null
    setRevisionId(nextRevisionId)
    setCopyingRevision(false)
    setDirty(false)
    setError(null)
    simulateFixture.reset()
  }

  const copyToDraft = () => {
    const existingDraft = revisions.find((revision) => revision.lifecycle === 'DRAFT')
    if (existingDraft) {
      selectRevision(existingDraft.id)
      return
    }
    setCopyingRevision(true)
    setDirty(true)
    setError(null)
  }

  const updateModel = (graph: DecisionGraphType) => {
    markDocumentChanged({
      ...document,
      models: {
        ...document.models,
        [modelKey]: graph as unknown as RulePackDocumentDto['models'][string]
      }
    })
  }

  const addModel = () => {
    const nextKey = globalThis.prompt('Model key (lowercase letters, numbers, and hyphens)')?.trim()
    if (!nextKey) return
    try {
      markDocumentChanged(addRuleModel(document, nextKey))
      setModelKey(nextKey)
    } catch (cause) {
      setError(errorMessage(cause, 'Unable to add the model.'))
    }
  }

  const renameModel = () => {
    const nextKey = globalThis.prompt('New model key', modelKey)?.trim()
    if (!nextKey || nextKey === modelKey) return
    try {
      markDocumentChanged(renameRuleModel(document, modelKey, nextKey))
      setModelKey(nextKey)
    } catch (cause) {
      setError(errorMessage(cause, 'Unable to rename the model.'))
    }
  }

  const removeModel = () => {
    if (!globalThis.confirm(`Remove the ${modelKey} model and its fixtures?`)) return
    try {
      const nextDocument = removeRuleModel(document, modelKey)
      markDocumentChanged(nextDocument)
      setModelKey(Object.keys(nextDocument.models)[0] ?? 'main')
      setFixtureId(nextDocument.fixtures[0]?.id ?? null)
    } catch (cause) {
      setError(errorMessage(cause, 'Unable to remove the model.'))
    }
  }

  const addFixture = () => {
    const nextFixture = {
      id: globalThis.crypto.randomUUID(),
      label: `Fixture ${document.fixtures.length + 1}`,
      modelKey,
      input: {},
      expected: defaultFixtureExpected
    }
    markDocumentChanged({ ...document, fixtures: [...document.fixtures, nextFixture] })
    setFixtureId(nextFixture.id)
  }

  const changeFixture = (field: 'label' | 'modelKey' | 'input' | 'expected', value: string) => {
    if (!fixtureId) return
    try {
      const parsedValue = field === 'input' || field === 'expected' ? JSON.parse(value) : value
      markDocumentChanged({
        ...document,
        fixtures: document.fixtures.map((fixture) =>
          fixture.id === fixtureId ? { ...fixture, [field]: parsedValue } : fixture
        )
      })
    } catch {
      setError(`${field === 'input' ? 'Input' : 'Expected'} must be valid JSON.`)
    }
  }

  const removeFixture = () => {
    if (!fixtureId) return
    const nextFixtures = document.fixtures.filter((fixture) => fixture.id !== fixtureId)
    markDocumentChanged({ ...document, fixtures: nextFixtures })
    setFixtureId(nextFixtures[0]?.id ?? null)
  }

  const runFixture = () => {
    const fixture = document.fixtures.find((item) => item.id === fixtureId)
    if (!fixture) return
    setError(null)
    simulateFixture.mutate({ revision: document, fixture })
  }

  const importDocument = async (file: File | null) => {
    if (!file) return
    if (file.size > 1024 * 1024) {
      setError('Imports must be 1 MiB or smaller.')
      return
    }
    try {
      const nextDocument = parseRuleDocument(await file.text())
      markDocumentChanged(nextDocument)
      setModelKey(Object.keys(nextDocument.models)[0] ?? 'main')
      setFixtureId(nextDocument.fixtures[0]?.id ?? null)
    } catch (cause) {
      setError(errorMessage(cause, 'Import is not a valid rule pack document.'))
    }
  }

  if (packsQuery.isPending) return <Loader aria-label='Loading rule packs' />
  if (packsQuery.isError) return <Alert color='red'>Unable to load rule packs.</Alert>

  const currentModel = document.models[modelKey]
  const mutationPending = saveDraft.isPending || activateRevision.isPending || retirePack.isPending
  const canSave = editable && dirty && Boolean(rulesetCode) && Boolean(rulesetVersion)

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <Group gap='sm'>
            <Title order={1}>Rule Studio</Title>
            {selectedRevision ? <Badge variant='light'>{selectedRevision.lifecycle}</Badge> : null}
            {dirty ? <Badge color='yellow'>Unsaved</Badge> : null}
          </Group>
          <Text c='dimmed' size='sm'>
            Build deterministic rules, prove them with fixtures, then activate an immutable
            revision.
          </Text>
        </div>
        <Group gap='xs' justify='flex-end'>
          <RuleImportExportActions
            disabled={!editable || mutationPending}
            document={document}
            onImport={importDocument}
          />
          {selectedRevision && selectedRevision.lifecycle !== 'DRAFT' && !copyingRevision ? (
            <Button disabled={mutationPending} variant='default' onClick={copyToDraft}>
              Edit as draft
            </Button>
          ) : null}
          {selectedRevision?.lifecycle === 'ACTIVE' && !copyingRevision ? (
            <Button
              color='red'
              disabled={mutationPending}
              variant='default'
              onClick={() => retirePack.mutate(selectedRevision)}
            >
              Retire
            </Button>
          ) : null}
          <Button disabled={!canSave || mutationPending} onClick={() => saveDraft.mutate()}>
            Save draft
          </Button>
          <Button
            color='teal'
            disabled={
              mutationPending || dirty || copyingRevision || selectedRevision?.lifecycle !== 'DRAFT'
            }
            onClick={() => selectedRevision && activateRevision.mutate(selectedRevision)}
          >
            Activate
          </Button>
        </Group>
      </header>

      {error ? (
        <Alert
          className={styles.pageAlert}
          color='red'
          onClose={() => setError(null)}
          withCloseButton
        >
          {error}
        </Alert>
      ) : null}

      <div className={styles.workspace}>
        <Paper className={styles.sidebar} p='md' radius='md' withBorder>
          <Stack gap='md'>
            <Button variant='default' onClick={startNewPack}>
              New rule pack
            </Button>
            <RulePackNavigator
              packId={packId}
              packs={packs}
              revisionId={revisionId}
              revisions={revisions}
              onPackChange={selectPack}
              onRevisionChange={selectRevision}
            />
            {selectedPack ? (
              <Stack gap={2}>
                <Text fw={600}>{selectedPack.rulesetCode}</Text>
                <Text c='dimmed' size='sm'>
                  Version {selectedPack.rulesetVersion}
                </Text>
              </Stack>
            ) : (
              <>
                <TextInput
                  disabled={!editable}
                  label='Ruleset code'
                  maxLength={80}
                  placeholder='dnd5e'
                  value={newRulesetCode}
                  onChange={(event) => {
                    setNewRulesetCode(event.currentTarget.value)
                    setDirty(true)
                  }}
                />
                <TextInput
                  disabled={!editable}
                  label='Ruleset version'
                  maxLength={80}
                  placeholder='2014'
                  value={newRulesetVersion}
                  onChange={(event) => {
                    setNewRulesetVersion(event.currentTarget.value)
                    setDirty(true)
                  }}
                />
              </>
            )}
          </Stack>
        </Paper>

        <Paper className={styles.editorPanel} radius='md' withBorder>
          <div className={styles.editorToolbar}>
            <RuleModelToolbar
              editable={editable}
              keys={Object.keys(document.models)}
              value={modelKey}
              onAdd={addModel}
              onRemove={removeModel}
              onRename={renameModel}
              onSelect={(value) => value && setModelKey(value)}
            />
          </div>
          <div className={styles.graph}>
            {currentModel ? (
              <Suspense fallback={<Loader aria-label='Loading rule editor' />}>
                <RuleGraphEditor
                  disabled={!editable}
                  value={currentModel as unknown as DecisionGraphType}
                  onChange={updateModel}
                />
              </Suspense>
            ) : (
              <Alert color='red'>The selected model is missing.</Alert>
            )}
          </div>
        </Paper>

        <Paper className={styles.fixturePanel} p='md' radius='md' withBorder>
          <RuleFixturePanel
            document={document}
            editable={editable}
            error={null}
            result={simulateFixture.data ?? null}
            running={simulateFixture.isPending}
            selectedId={fixtureId}
            onAdd={addFixture}
            onChange={changeFixture}
            onRemove={removeFixture}
            onRun={runFixture}
            onSelect={setFixtureId}
          />
        </Paper>
      </div>
    </div>
  )
}
