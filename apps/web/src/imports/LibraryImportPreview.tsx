import {
  Accordion,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Select,
  Stack,
  Text
} from '@mantine/core'
import type { ImportPreviewResponseDto } from '@artificer-toolkit/schema/api/imports'
import { findOption } from '../forms/utils/valueGuards'
import { ImportContentOutcomeSections } from './ImportContentOutcomeSections'
import { type ImportCustomContentChoice } from './importCustomContentChoiceUtils'
import { LibraryImportIssues } from './LibraryImportIssues'

export function LibraryImportPreview({
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
                {item.issues.length ? <LibraryImportIssues issues={item.issues} /> : null}
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
                      onChange={(value) => {
                        const choice = findOption(item.collision?.allowedChoices ?? [], value)
                        if (choice) onResolutionChange(item.entryId, choice)
                      }}
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

function statusColor(status: ImportPreviewResponseDto['items'][number]['status']): string {
  return status === 'READY' ? 'green' : status === 'NEEDS_REVIEW' ? 'yellow' : 'red'
}

function statusLabel(status: ImportPreviewResponseDto['items'][number]['status']): string {
  return status === 'NEEDS_REVIEW' ? 'Needs review' : status === 'UNABLE' ? 'Unable' : 'Ready'
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
