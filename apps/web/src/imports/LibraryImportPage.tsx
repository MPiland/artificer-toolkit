import { Alert, Stack } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  type ImportCommitRequestDto,
  type ImportPreviewResponseDto,
  type ImportResultReportDto,
  type ImportSourceDto
} from '@artificer-toolkit/schema/api/imports'
import { commitImport, previewImport } from '#app/data/imports/importClient'
import { PageHeader } from '#app/shell/Shell'
import { getSystemList } from '#app/data/systems/queries'
import {
  getDefaultImportCustomContentChoice,
  getImportCustomContentKey,
  type ImportCustomContentChoice
} from './importCustomContentChoiceUtils'
import { LibraryImportInput } from './LibraryImportInput'
import { LibraryImportPreview } from './LibraryImportPreview'
import { LibraryImportResult } from './LibraryImportResult'
import { buildBatch, parseLinks } from './libraryImport.model'

type ImportStage = 'input' | 'preview' | 'result'

export function LibraryImportPage() {
  const systems = useQuery(getSystemList())
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
  const [gameSystemId, setGameSystemId] = useState('')
  const [primaryRulesCatalogueId, setPrimaryRulesCatalogueId] = useState('')
  const onlySystem = systems.data?.length === 1 ? systems.data[0] : undefined
  const effectiveGameSystemId = gameSystemId || onlySystem?.id || ''
  const selectedSystem = systems.data?.find((system) => system.id === effectiveGameSystemId)
  const effectivePrimaryRulesCatalogueId =
    primaryRulesCatalogueId ||
    (selectedSystem?.rulesCatalogues.length === 1 ? selectedSystem.rulesCatalogues[0]!.id : '')

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
      const batch = await buildBatch(
        source,
        links,
        files,
        source === 'ARTIFICER_JSON' || !effectiveGameSystemId || !effectivePrimaryRulesCatalogueId
          ? undefined
          : {
              systemId: effectiveGameSystemId,
              primaryRulesCatalogueId: effectivePrimaryRulesCatalogueId
            }
      )
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
      const batch = await buildBatch(
        source,
        links,
        files,
        source === 'ARTIFICER_JSON' || !effectiveGameSystemId || !effectivePrimaryRulesCatalogueId
          ? undefined
          : {
              systemId: effectiveGameSystemId,
              primaryRulesCatalogueId: effectivePrimaryRulesCatalogueId
            }
      )
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
        <LibraryImportInput
          files={files}
          inputSummary={inputSummary}
          links={links}
          loading={loading}
          source={source}
          systems={systems.data ?? []}
          gameSystemId={effectiveGameSystemId}
          primaryRulesCatalogueId={effectivePrimaryRulesCatalogueId}
          onFilesChange={setFiles}
          onLinksChange={setLinks}
          onPreview={() => void onPreview()}
          onGameSystemChange={(value) => {
            setGameSystemId(value)
            setPrimaryRulesCatalogueId('')
          }}
          onPrimaryRulesCatalogueChange={setPrimaryRulesCatalogueId}
          onSourceChange={(value) => {
            setSource(value)
            setFiles([])
            setLinks('')
          }}
        />
      ) : null}

      {stage === 'preview' && preview ? (
        <LibraryImportPreview
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

      {stage === 'result' && result ? (
        <LibraryImportResult result={result} onImportMore={reset} />
      ) : null}
    </Stack>
  )
}
