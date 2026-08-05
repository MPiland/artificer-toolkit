import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  FileInput,
  Group,
  List,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea
} from '@mantine/core'
import { useMemo, useState } from 'react'
import {
  IMPORT_MAX_BATCH_BYTES,
  IMPORT_MAX_ENTRIES,
  IMPORT_MAX_ENTRY_BYTES,
  type ImportBatchInputDto,
  type ImportCommitRequestDto,
  type ImportPreviewResponseDto,
  type ImportResultReportDto,
  type ImportSourceDto
} from '@artificer-toolkit/schema/api/imports'
import { commitImport, previewImport } from '#app/data/imports/importClient'
import { ImportContentOutcomeSections } from './ImportContentOutcomeSections'
import {
  getDefaultImportCustomContentChoice,
  getImportCustomContentKey,
  type ImportCustomContentChoice
} from './importCustomContentChoiceUtils'
import {
  buildBackgroundRouteParams,
  buildCharacterRouteParams,
  buildClassRouteParams,
  buildCreatureRouteParams,
  buildEquipmentRouteParams,
  buildFeatRouteParams,
  buildRaceRouteParams,
  buildSpellRouteParams,
  buildVehicleRouteParams
} from '#app/routing/authoredRouteParams'
import { PageHeader } from '#app/shell/Shell'

type ImportStage = 'input' | 'preview' | 'result'
type JsonSource = Extract<ImportSourceDto, 'FOUNDRY_DND5E' | 'ARTIFICER_JSON'>

const sourceOptions: { value: ImportSourceDto; label: string; description: string }[] = [
  {
    value: 'DND_BEYOND',
    label: 'D&D Beyond',
    description: 'Paste character-sheet links. No account details or API links needed.'
  },
  {
    value: 'FOUNDRY_DND5E',
    label: 'Foundry VTT',
    description: 'Choose exported dnd5e Actor JSON files.'
  },
  {
    value: 'ARTIFICER_JSON',
    label: 'Artificer JSON',
    description: 'Choose JSON files exported from your Artificer Library.'
  }
]

export function LibraryImportPage() {
  const [source, setSource] = useState<ImportSourceDto>('DND_BEYOND')
  const [links, setLinks] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [stage, setStage] = useState<ImportStage>('input')
  const [preview, setPreview] = useState<ImportPreviewResponseDto | null>(null)
  const [result, setResult] = useState<ImportResultReportDto | null>(null)
  const [resolutions, setResolutions] = useState<Record<string, 'COPY' | 'UPDATE_DRAFT'>>({})
  const [selectedEntryIds, setSelectedEntryIds] = useState<Record<string, boolean>>({})
  const [replacementConfirmations, setReplacementConfirmations] = useState<Record<string, boolean>>(
    {}
  )
  const [customContentChoices, setCustomContentChoices] = useState<
    Record<string, ImportCustomContentChoice>
  >({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputSummary = useMemo(
    () =>
      source === 'DND_BEYOND'
        ? `${parseLinks(links).length} link${parseLinks(links).length === 1 ? '' : 's'} selected`
        : `${files.length} file${files.length === 1 ? '' : 's'} selected`,
    [files.length, links, source]
  )

  const onPreview = async () => {
    setError(null)
    setLoading(true)
    try {
      const batch = await buildBatch(source, links, files)
      const nextPreview = await previewImport(batch)
      setPreview(nextPreview)
      setResolutions(
        Object.fromEntries(
          nextPreview.items.flatMap((item) =>
            item.collision ? [[item.entryId, item.collision.defaultChoice]] : []
          )
        )
      )
      setSelectedEntryIds(
        Object.fromEntries(
          nextPreview.items.map((item) => [item.entryId, item.status !== 'UNABLE'])
        )
      )
      setCustomContentChoices(
        Object.fromEntries(
          nextPreview.items.flatMap((item) =>
            (item.relatedContent ?? []).map((content) => [
              getImportCustomContentKey(item.entryId, content),
              getDefaultImportCustomContentChoice(content)
            ])
          )
        )
      )
      setStage('preview')
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The import preview could not be created.'
      )
    } finally {
      setLoading(false)
    }
  }

  const onCommit = async () => {
    if (!preview) return
    setError(null)
    setLoading(true)
    try {
      const batch = await buildBatch(source, links, files)
      const commit: ImportCommitRequestDto = {
        batch,
        selectedEntryIds: preview.items
          .filter((item) => selectedEntryIds[item.entryId] && item.status !== 'UNABLE')
          .map((item) => item.entryId),
        resolutions: preview.items.flatMap((item) => {
          if (!item.collision) return []
          const choice = resolutions[item.entryId] ?? item.collision.defaultChoice
          return [
            {
              entryId: item.entryId,
              choice,
              confirmDraftReplacement:
                choice === 'UPDATE_DRAFT' && replacementConfirmations[item.entryId] === true
            }
          ]
        }),
        customContentChoices: preview.items.flatMap((item) =>
          selectedEntryIds[item.entryId] && item.status !== 'UNABLE'
            ? (item.relatedContent ?? []).map((content) => ({
                entryId: item.entryId,
                externalId: content.externalId,
                subjectKind: content.subjectKind,
                choice: content.activationEligible
                  ? (customContentChoices[getImportCustomContentKey(item.entryId, content)] ??
                    getDefaultImportCustomContentChoice(content))
                  : 'DRAFT'
              }))
            : []
        )
      }
      const nextResult = await commitImport(commit)
      setResult(nextResult)
      setStage('result')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The import could not be completed.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setStage('input')
    setPreview(null)
    setResult(null)
    setResolutions({})
    setSelectedEntryIds({})
    setReplacementConfirmations({})
    setCustomContentChoices({})
    setError(null)
  }

  return (
    <Stack gap='xl'>
      <PageHeader
        title='Import'
        description='Bring in characters and authored content without rebuilding it by hand.'
      />

      {error ? <Alert color='red'>{error}</Alert> : null}

      {stage === 'input' ? (
        <ImportInput
          files={files}
          inputSummary={inputSummary}
          links={links}
          loading={loading}
          source={source}
          onFilesChange={setFiles}
          onLinksChange={setLinks}
          onPreview={() => void onPreview()}
          onSourceChange={(value) => {
            setSource(value)
            setFiles([])
            setLinks('')
          }}
        />
      ) : null}

      {stage === 'preview' && preview ? (
        <ImportPreview
          loading={loading}
          preview={preview}
          resolutions={resolutions}
          selectedEntryIds={selectedEntryIds}
          customContentChoices={customContentChoices}
          onBack={reset}
          onCommit={() => void onCommit()}
          replacementConfirmations={replacementConfirmations}
          onReplacementConfirmationChange={(entryId, confirmed) =>
            setReplacementConfirmations((current) => ({ ...current, [entryId]: confirmed }))
          }
          onResolutionChange={(entryId, choice) =>
            setResolutions((current) => ({ ...current, [entryId]: choice }))
          }
          onSelectionChange={(entryId, selected) =>
            setSelectedEntryIds((current) => ({ ...current, [entryId]: selected }))
          }
          onCustomContentChoiceChange={(key, choice) =>
            setCustomContentChoices((current) => ({ ...current, [key]: choice }))
          }
          onSetAllCustomContentChoices={(keys, choice) =>
            setCustomContentChoices((current) => ({
              ...current,
              ...Object.fromEntries(keys.map((key) => [key, choice]))
            }))
          }
        />
      ) : null}

      {stage === 'result' && result ? <ImportResult result={result} onImportMore={reset} /> : null}
    </Stack>
  )
}

function ImportInput({
  files,
  inputSummary,
  links,
  loading,
  source,
  onFilesChange,
  onLinksChange,
  onPreview,
  onSourceChange
}: {
  files: File[]
  inputSummary: string
  links: string
  loading: boolean
  source: ImportSourceDto
  onFilesChange: (files: File[]) => void
  onLinksChange: (links: string) => void
  onPreview: () => void
  onSourceChange: (source: ImportSourceDto) => void
}) {
  return (
    <Stack gap='lg'>
      <Radio.Group
        label='Choose a source'
        value={source}
        onChange={(value) => onSourceChange(value as ImportSourceDto)}
      >
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          {sourceOptions.map((option) => (
            <Card key={option.value} padding='md' withBorder>
              <Radio value={option.value} label={option.label} />
              <Text c='dimmed' mt='xs' size='sm'>
                {option.description}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      </Radio.Group>

      {source === 'DND_BEYOND' ? (
        <Textarea
          autosize
          description='One normal character-sheet link per line. Publicly accessible sheets work best.'
          label='Character-sheet links'
          minRows={5}
          placeholder='https://www.dndbeyond.com/characters/12345678'
          value={links}
          onChange={(event) => onLinksChange(event.currentTarget.value)}
        />
      ) : (
        <FileInput
          clearable
          accept='application/json,.json'
          description={`Up to ${IMPORT_MAX_ENTRIES} JSON files, 10 MiB each, 25 MiB total.`}
          label={source === 'FOUNDRY_DND5E' ? 'Foundry Actor exports' : 'Artificer exports'}
          multiple
          placeholder='Choose JSON files'
          value={files}
          onChange={(nextFiles) => onFilesChange(nextFiles ?? [])}
        />
      )}

      <Group justify='space-between'>
        <Text c='dimmed' size='sm'>
          {inputSummary}
        </Text>
        <Button
          disabled={!hasImportInput(source, links, files)}
          loading={loading}
          onClick={onPreview}
        >
          Preview import
        </Button>
      </Group>
    </Stack>
  )
}

function ImportPreview({
  loading,
  preview,
  resolutions,
  onBack,
  onCommit,
  onResolutionChange,
  onSelectionChange,
  onReplacementConfirmationChange,
  replacementConfirmations,
  selectedEntryIds,
  customContentChoices,
  onCustomContentChoiceChange,
  onSetAllCustomContentChoices
}: {
  loading: boolean
  preview: ImportPreviewResponseDto
  resolutions: Record<string, 'COPY' | 'UPDATE_DRAFT'>
  onBack: () => void
  onCommit: () => void
  onResolutionChange: (entryId: string, choice: 'COPY' | 'UPDATE_DRAFT') => void
  onSelectionChange: (entryId: string, selected: boolean) => void
  onReplacementConfirmationChange: (entryId: string, confirmed: boolean) => void
  replacementConfirmations: Record<string, boolean>
  selectedEntryIds: Record<string, boolean>
  customContentChoices: Record<string, ImportCustomContentChoice>
  onCustomContentChoiceChange: (key: string, choice: ImportCustomContentChoice) => void
  onSetAllCustomContentChoices: (keys: string[], choice: ImportCustomContentChoice) => void
}) {
  const selectableItems = preview.items.filter(
    (item) => item.status !== 'UNABLE' && selectedEntryIds[item.entryId]
  )
  const hasUnconfirmedReplacement = preview.items.some(
    (item) =>
      selectedEntryIds[item.entryId] &&
      item.collision?.hasExistingDraft &&
      resolutions[item.entryId] === 'UPDATE_DRAFT' &&
      replacementConfirmations[item.entryId] !== true
  )

  return (
    <Stack gap='lg'>
      <Alert color={preview.summary.unable ? 'yellow' : 'blue'}>
        {preview.summary.ready} ready, {preview.summary.needsReview} need review, and{' '}
        {preview.summary.unable} cannot be imported.
      </Alert>
      <Accordion
        multiple
        defaultValue={preview.items.length === 1 ? [preview.items[0]!.entryId] : []}
        variant='separated'
      >
        {preview.items.map((item) => (
          <Accordion.Item key={item.entryId} value={item.entryId}>
            <Accordion.Control>
              <Group justify='space-between' wrap='wrap'>
                <div>
                  <Text fw={600}>{item.label ?? item.name}</Text>
                  <Text c='dimmed' size='sm'>
                    {formatImportEntrySummary(item)}
                  </Text>
                </div>
                <Badge color={statusColor(item.status)}>{statusLabel(item.status)}</Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap='sm'>
                {item.label && item.label !== item.name ? (
                  <Text c='dimmed' size='sm'>
                    Source: {item.name}
                  </Text>
                ) : null}
                <Checkbox
                  checked={selectedEntryIds[item.entryId] === true}
                  disabled={item.status === 'UNABLE'}
                  label={
                    item.status === 'UNABLE' ? 'Cannot import this entry' : 'Include this entry'
                  }
                  onChange={(event) => onSelectionChange(item.entryId, event.currentTarget.checked)}
                />
                {item.destination ? (
                  <Text c='dimmed' size='sm'>
                    Destination: {formatDestination(item.destination.kind)}
                  </Text>
                ) : null}
                {item.existingMatches?.length ||
                item.relatedContent?.length ||
                item.notImported?.length ? (
                  <ImportContentOutcomeSections
                    choices={customContentChoices}
                    entryId={item.entryId}
                    existingMatches={item.existingMatches ?? []}
                    items={item.relatedContent ?? []}
                    notImported={item.notImported ?? []}
                    onChoiceChange={onCustomContentChoiceChange}
                    onSetAll={onSetAllCustomContentChoices}
                  />
                ) : null}
                {item.issues.length ? <ImportIssues issues={item.issues} /> : null}
                {item.collision && selectedEntryIds[item.entryId] ? (
                  <Stack gap='xs'>
                    <Text size='sm'>A matching owned item already exists.</Text>
                    <Select
                      data={item.collision.allowedChoices.map((choice) => ({
                        value: choice,
                        label: choice === 'UPDATE_DRAFT' ? 'Update as draft' : 'Import as copy'
                      }))}
                      label='Import choice'
                      value={resolutions[item.entryId] ?? item.collision.defaultChoice}
                      onChange={(value) =>
                        value && onResolutionChange(item.entryId, value as 'COPY' | 'UPDATE_DRAFT')
                      }
                    />
                    {item.collision.hasExistingDraft &&
                    resolutions[item.entryId] === 'UPDATE_DRAFT' ? (
                      <Stack gap='xs'>
                        <Alert color='yellow' variant='light'>
                          Updating will replace the existing edit draft. Active content stays
                          unchanged.
                        </Alert>
                        <Checkbox
                          checked={replacementConfirmations[item.entryId] === true}
                          label='Replace the existing edit draft'
                          onChange={(event) =>
                            onReplacementConfirmationChange(
                              item.entryId,
                              event.currentTarget.checked
                            )
                          }
                        />
                      </Stack>
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
      <Group justify='space-between'>
        <Button variant='default' onClick={onBack}>
          Back
        </Button>
        <Button
          disabled={!selectableItems.length || hasUnconfirmedReplacement}
          loading={loading}
          onClick={onCommit}
        >
          Confirm import
        </Button>
      </Group>
    </Stack>
  )
}

function ImportResult({
  result,
  onImportMore
}: {
  result: ImportResultReportDto
  onImportMore: () => void
}) {
  return (
    <Stack gap='lg'>
      <Alert color={result.summary.failed ? 'yellow' : 'green'}>
        {result.summary.created} created, {result.summary.updated} updated, {result.summary.skipped}{' '}
        skipped, and {result.summary.failed} failed.
      </Alert>
      {(['CREATED', 'UPDATED', 'SKIPPED', 'FAILED'] as const).map((outcome) => {
        const items = result.items.filter((item) => item.outcome === outcome)
        if (!items.length) return null
        return (
          <Stack key={outcome} gap='sm'>
            <Text fw={600}>{outcome[0] + outcome.slice(1).toLowerCase()}</Text>
            {items.map((item) => (
              <Card key={item.entryId} padding='md' withBorder>
                <Group justify='space-between'>
                  <div>
                    <Text fw={600}>{item.label ?? item.name}</Text>
                    {item.label && item.label !== item.name ? (
                      <Text c='dimmed' size='sm'>
                        Source: {item.name}
                      </Text>
                    ) : null}
                    {item.issues.length ? <ImportIssues issues={item.issues} /> : null}
                  </div>
                  <Group gap='sm'>
                    <Badge color={outcomeColor(item.outcome)}>{item.outcome.toLowerCase()}</Badge>
                    {item.publicId && item.destination ? (
                      <Button
                        component='a'
                        href={destinationHref(
                          item.destination,
                          item.publicId,
                          item.label ?? item.name
                        )}
                        size='xs'
                      >
                        Open
                      </Button>
                    ) : null}
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        )
      })}
      <Button style={{ alignSelf: 'flex-start' }} variant='default' onClick={onImportMore}>
        Import more
      </Button>
    </Stack>
  )
}

function parseLinks(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((link) => link.trim())
    .filter(Boolean)
}

async function buildBatch(
  source: ImportSourceDto,
  links: string,
  files: File[]
): Promise<ImportBatchInputDto> {
  if (source === 'DND_BEYOND') {
    const parsedLinks = parseLinks(links)
    if (!parsedLinks.length) throw new Error('Add at least one D&D Beyond character-sheet link.')
    if (parsedLinks.length > IMPORT_MAX_ENTRIES)
      throw new Error(`You can import up to ${IMPORT_MAX_ENTRIES} links at once.`)
    return {
      source,
      entries: parsedLinks.map((url, index) => ({ entryId: `link-${index + 1}`, url }))
    }
  }

  if (!files.length) throw new Error('Choose at least one JSON file.')
  if (files.length > IMPORT_MAX_ENTRIES)
    throw new Error(`You can import up to ${IMPORT_MAX_ENTRIES} files at once.`)
  const totalBytes = files.reduce((total, file) => total + file.size, 0)
  if (files.some((file) => file.size > IMPORT_MAX_ENTRY_BYTES))
    throw new Error('Import files must be 10 MiB or smaller.')
  if (totalBytes > IMPORT_MAX_BATCH_BYTES)
    throw new Error('The import batch must be 25 MiB or smaller.')
  return {
    source: source as JsonSource,
    entries: await Promise.all(
      files.map(async (file, index) => ({
        entryId: `file-${index + 1}`,
        name: file.name,
        text: await file.text()
      }))
    )
  }
}

function hasImportInput(source: ImportSourceDto, links: string, files: File[]): boolean {
  return source === 'DND_BEYOND' ? parseLinks(links).length > 0 : files.length > 0
}

function statusColor(status: ImportPreviewResponseDto['items'][number]['status']): string {
  return status === 'READY' ? 'green' : status === 'NEEDS_REVIEW' ? 'yellow' : 'red'
}

function statusLabel(status: ImportPreviewResponseDto['items'][number]['status']): string {
  return status === 'NEEDS_REVIEW' ? 'Needs review' : status === 'UNABLE' ? 'Unable' : 'Ready'
}

function outcomeColor(outcome: ImportResultReportDto['items'][number]['outcome']): string {
  return outcome === 'FAILED' ? 'red' : outcome === 'SKIPPED' ? 'yellow' : 'green'
}

function formatDestination(kind: string): string {
  return kind === 'CHARACTER_BUILDER_DRAFT'
    ? 'Character Builder draft'
    : kind === 'AUTHORED_DRAFT'
      ? 'Authored draft'
      : 'Active content'
}

function formatImportEntrySummary(item: ImportPreviewResponseDto['items'][number]): string {
  const existingMatches = (item.existingMatches ?? []).reduce(
    (total, match) => total + match.count,
    0
  )
  const readyToActivate = (item.relatedContent ?? []).filter(
    (content) => content.activationEligible
  ).length
  const draftsRequired = (item.relatedContent ?? []).length - readyToActivate
  const notImported = (item.notImported ?? []).reduce((total, content) => total + content.count, 0)
  const parts = [
    existingMatches
      ? `${existingMatches} existing ${existingMatches === 1 ? 'match' : 'matches'}`
      : '',
    readyToActivate ? `${readyToActivate} ready to activate` : '',
    draftsRequired ? `${draftsRequired} ${draftsRequired === 1 ? 'draft' : 'drafts'} required` : '',
    notImported ? `${notImported} not imported` : ''
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'No related content'
}

function ImportIssues({ issues }: { issues: ImportPreviewResponseDto['items'][number]['issues'] }) {
  const correctionCount = issues.filter((issue) => issue.correctionRequired).length
  const color = issues.some((issue) => issue.severity === 'ERROR')
    ? 'red'
    : issues.some((issue) => issue.severity === 'WARNING')
      ? 'yellow'
      : 'blue'

  return (
    <Alert
      color={color}
      title={correctionCount ? 'Needs review' : 'Import details'}
      variant='light'
    >
      <List size='sm'>
        {issues.map((issue, index) => (
          <List.Item key={`${issue.code}-${index}`}>
            <Text size='sm'>{issue.message}</Text>
            {issue.correctionRequired && issue.path.length ? (
              <Text c='dimmed' size='xs'>
                Source: {issue.path.join('.')}
              </Text>
            ) : null}
          </List.Item>
        ))}
      </List>
    </Alert>
  )
}

function destinationHref(
  destination: ImportResultReportDto['items'][number]['destination'],
  publicId: string,
  label: string
): string {
  if (!destination || destination.kind === 'CHARACTER_BUILDER_DRAFT') {
    const params = buildCharacterRouteParams(publicId, label)
    return `/characters/${params.characterPublicId}/${params.characterSlug}/edit`
  }

  const suffix = destination.kind === 'AUTHORED_DRAFT' ? '/edit' : ''

  switch (destination.subjectKind) {
    case 'BACKGROUND': {
      const params = buildBackgroundRouteParams(publicId, label)
      return `/backgrounds/${params.backgroundPublicId}/${params.backgroundSlug}${suffix}`
    }
    case 'CLASS': {
      const params = buildClassRouteParams(publicId, label)
      return `/classes/${params.classPublicId}/${params.classSlug}${suffix}`
    }
    case 'CREATURE': {
      const params = buildCreatureRouteParams(publicId, label)
      return `/creatures/${params.creaturePublicId}/${params.creatureSlug}${suffix}`
    }
    case 'EQUIPMENT': {
      const params = buildEquipmentRouteParams(publicId, label)
      return `/equipment/${params.equipmentPublicId}/${params.equipmentSlug}${suffix}`
    }
    case 'FEAT': {
      const params = buildFeatRouteParams(publicId, label)
      return `/feats/${params.featPublicId}/${params.featSlug}${suffix}`
    }
    case 'RACE': {
      const params = buildRaceRouteParams(publicId, label)
      return `/races/${params.racePublicId}/${params.raceSlug}${suffix}`
    }
    case 'SPELL': {
      const params = buildSpellRouteParams(publicId, label)
      return `/spells/${params.spellPublicId}/${params.spellSlug}${suffix}`
    }
    case 'VEHICLE': {
      const params = buildVehicleRouteParams(publicId, label)
      return `/vehicles/${params.vehiclePublicId}/${params.vehicleSlug}${suffix}`
    }
  }
}
