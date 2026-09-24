import { Alert, Button, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import {
  type AuthoredDraftDto,
  type BackgroundResponseDto
} from '@artificer-toolkit/schema/api/content'
import { type BackgroundAuthoredDto } from '@artificer-toolkit/schema/subjects/background'
import {
  AuthoredDetailItemList,
  AuthoredDetailLayout,
  AuthoredDetailProse,
  buildAuthoredDetailNotice,
  buildDetailStatusLabels,
  compactAuthoredDetailActions,
  compactAuthoredDetailSections,
  formatGrantDetailLinesHtml,
  formatProficiencyGrantLines,
  formatStartingEquipmentLine,
  hasDetailText,
  resolveAuthoredDetailState,
  toDetailItems,
  useAuthoredDetailActions,
  useAuthoredExportAction,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { queryKeys } from '#app/lib/queryKeys'
import { buildBackgroundRouteParams } from '#app/routing/authoredRouteParams'

export function BackgroundDetailPage({
  backgroundId,
  draft,
  references,
  response,
  view
}: {
  backgroundId: string
  draft: AuthoredDraftDto | null
  references: Pick<
    AuthoredContentReferenceData,
    'currencies' | 'equipment' | 'languages' | 'skills'
  >
  response: BackgroundResponseDto
  view: 'active' | 'draft'
}) {
  const navigate = useNavigate()
  const operations = createAuthoredOperations('BACKGROUND', useConvex())
  const viewActive = view === 'active'
  const detailState = resolveAuthoredDetailState({
    draft,
    response,
    schema: backgroundAuthoredDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    deleteActive: operations.deleteActive,
    discard: operations.discardDraft,
    detailSubjectQueryKey: queryKeys.content.backgrounds.detailRoot(backgroundId),
    domainLabel: 'Background',
    domainQueryKey: queryKeys.content.backgrounds.all(),
    draftQueryKey: queryKeys.content.backgrounds.draft(backgroundId),
    duplicate: operations.duplicate,
    hasActiveContent: detailState.hasActiveContent,
    id: backgroundId,
    navigateEdit: async (subject) =>
      navigate({
        params: buildBackgroundRouteParams(subject.publicId, subject.label),
        to: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
      }),
    navigateList: async () => navigate({ to: '/backgrounds' })
  })

  const exportAction = useAuthoredExportAction({
    canExport: detailState.provenance.kind === 'OWNED' && detailState.permissions.canEdit,
    id: backgroundId,
    label: detailState.item?.label ?? 'Background',
    subjectKind: 'BACKGROUND',
    view: detailState.mode === 'draft' ? 'draft' : 'active'
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <>
        <Stack>
          <Alert color='yellow'>
            This background draft cannot be previewed. Delete it to return to the background list.
          </Alert>
          <Button
            color='red'
            loading={actions.isDeleting}
            onClick={() =>
              actions.deleteContent({
                id: backgroundId,
                kind: 'draft',
                label: detailState.draft?.label ?? 'background draft'
              })
            }
          >
            Delete
          </Button>
        </Stack>
        {actions.deleteConfirmation}
      </>
    )
  }

  if (!detailState.item) {
    return (
      <Stack>
        <Alert color='yellow'>That background could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/backgrounds' })}>Back to backgrounds</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const backgroundParams = buildBackgroundRouteParams(
    draft?.publicId ?? response?.publicId ?? backgroundId,
    item.label
  )
  const pageActions = compactAuthoredDetailActions([
    detailState.mode === 'draft'
      ? {
          label: 'Resume Draft',
          tone: 'primary',
          onClick: () =>
            navigate({
              to: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit',
              params: backgroundParams
            })
        }
      : detailState.permissions.canEdit
        ? {
            label: 'Edit',
            tone: 'primary',
            onClick: () =>
              navigate({
                to: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit',
                params: backgroundParams
              })
          }
        : null,
    detailState.mode === 'active' && detailState.draft
      ? {
          label: 'View Draft',
          tone: 'secondary',
          onClick: () =>
            navigate({
              to: '/backgrounds/$backgroundPublicId/$backgroundSlug',
              params: backgroundParams,
              search: { view: 'draft' }
            })
        }
      : null,
    detailState.mode === 'active' && !detailState.draft && detailState.permissions.canCopy
      ? {
          label: 'Duplicate',
          tone: 'secondary',
          disabled: actions.isDuplicating,
          loading: actions.isDuplicating,
          onClick: () => void actions.duplicateToDraft()
        }
      : null,
    detailState.permissions.canDelete
      ? {
          label: 'Delete',
          tone: 'danger',
          disabled: actions.isDeleting,
          loading: actions.isDeleting,
          onClick: () =>
            actions.deleteContent({
              id: backgroundId,
              kind: detailState.mode === 'draft' ? 'draft' : 'active',
              label: item.label
            })
        }
      : null,
    exportAction,
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/backgrounds/new' }) }
  ])

  return (
    <>
      <AuthoredDetailLayout
        actions={pageActions}
        actionsDisabled={actions.isDetailOperationPending}
        artworkTarget={{
          lookup: {
            type: 'AUTHORED_IMAGE',
            subjectKind: 'BACKGROUND',
            subjectId: backgroundId,
            scope: detailState.mode === 'draft' ? 'DRAFT' : 'ACTIVE'
          },
          attach: { type: 'AUTHORED_IMAGE', subjectKind: 'BACKGROUND', subjectId: backgroundId }
        }}
        eyebrow='Background'
        facts={[]}
        notice={buildAuthoredDetailNotice({
          canViewActive: detailState.canViewActive,
          domainLabel: 'Background',
          hasInvalidDraft: detailState.hasInvalidDraft,
          isViewingActive: viewActive,
          mode: detailState.mode,
          onDiscard: () => void actions.discardDraft(),
          onViewActive: () =>
            navigate({
              to: '/backgrounds/$backgroundPublicId/$backgroundSlug',
              params: backgroundParams
            }),
          onViewDraft: () =>
            navigate({
              to: '/backgrounds/$backgroundPublicId/$backgroundSlug',
              params: backgroundParams,
              search: { view: 'draft' }
            })
        })}
        pendingOperation={actions.pendingOperation}
        sections={getBackgroundSections(item, references)}
        status={buildDetailStatusLabels({
          draft: detailState.draft,
          mode: detailState.mode,
          provenance: detailState.provenance,
          status: item.status
        })}
        title={item.label}
      />
      {actions.deleteConfirmation}
    </>
  )
}

function getBackgroundSections(
  background: BackgroundAuthoredDto,
  references: Pick<
    AuthoredContentReferenceData,
    'currencies' | 'equipment' | 'languages' | 'skills'
  >
): AuthoredDetailSectionModel[] {
  const detailGroups = getCharacteristicDetailGroups(background.details ?? [])
  const otherDetails = getOtherDetails(background.details ?? [])
  const characteristicTablesHtml = buildCharacteristicTablesHtml(detailGroups)
  const startingEquipmentLine = formatStartingEquipmentLine(
    background.startingEquipment,
    references
  )
  const proficiencyEquipmentHtml = formatGrantDetailLinesHtml([
    ...formatProficiencyGrantLines(background.proficiencies, references, {
      skillLabel: 'Skill Proficiencies'
    }),
    ...(startingEquipmentLine ? [startingEquipmentLine] : [])
  ])
  const featureItems = (background.features ?? []).map((feature) => ({
    id: feature.id,
    title: feature.label,
    description: formatFeatureHtml(feature.description, feature.details)
  }))

  return compactAuthoredDetailSections([
    hasDetailText(background.description)
      ? {
          id: 'description',
          title: 'Description',
          content: <AuthoredDetailProse html={background.description} />
        }
      : null,
    characteristicTablesHtml || otherDetails.length
      ? {
          id: 'characteristics',
          title: 'Suggested Characteristics',
          content: (
            <Stack gap='md'>
              {characteristicTablesHtml ? (
                <AuthoredDetailProse
                  html={characteristicTablesHtml}
                  fallback='No background details have been added.'
                />
              ) : null}
              {otherDetails.length || !characteristicTablesHtml ? (
                <AuthoredDetailItemList
                  empty='No background details have been added.'
                  items={toDetailItems(otherDetails)}
                />
              ) : null}
            </Stack>
          )
        }
      : null,
    hasDetailText(proficiencyEquipmentHtml)
      ? {
          id: 'proficiencies-equipment',
          title: 'Proficiencies & Equipment',
          content: (
            <AuthoredDetailProse
              html={proficiencyEquipmentHtml}
              fallback='No proficiencies or equipment have been added.'
            />
          )
        }
      : null,
    featureItems.length
      ? {
          id: 'features',
          title: 'Features',
          content: (
            <AuthoredDetailItemList
              empty='No background features have been added.'
              items={featureItems}
            />
          )
        }
      : null
  ])
}

type BackgroundDetail = NonNullable<BackgroundAuthoredDto['details']>[number]
type CharacteristicKind = 'personalityTrait' | 'ideal' | 'bond' | 'flaw'

type CharacteristicGroup = {
  die: 'd6' | 'd8'
  kind: CharacteristicKind
  title: string
  details: BackgroundDetail[]
}

const CHARACTERISTIC_GROUPS: CharacteristicGroup[] = [
  { kind: 'personalityTrait', title: 'Personality Traits', die: 'd8', details: [] },
  { kind: 'ideal', title: 'Ideals', die: 'd6', details: [] },
  { kind: 'bond', title: 'Bonds', die: 'd6', details: [] },
  { kind: 'flaw', title: 'Flaws', die: 'd6', details: [] }
]

function getCharacteristicKind(label: string): CharacteristicKind | null {
  if (/^personality trait\s+\d+$/i.test(label)) return 'personalityTrait'
  if (/^ideal:/i.test(label)) return 'ideal'
  if (/^bond\s+\d+$/i.test(label)) return 'bond'
  if (/^flaw\s+\d+$/i.test(label)) return 'flaw'
  return null
}

function getCharacteristicDetailGroups(details: BackgroundDetail[]): CharacteristicGroup[] {
  return CHARACTERISTIC_GROUPS.map((group) => ({
    ...group,
    details: details
      .filter((detail) => getCharacteristicKind(detail.label) === group.kind)
      .sort((a, b) => a.order - b.order)
  })).filter((group) => group.details.length)
}

function getOtherDetails(details: BackgroundDetail[]): BackgroundDetail[] {
  return details
    .filter((detail) => !getCharacteristicKind(detail.label))
    .sort((a, b) => a.order - b.order)
}

function buildCharacteristicTablesHtml(groups: CharacteristicGroup[]): string {
  if (!groups.length) return ''

  return groups
    .map(
      (group) => `
    <h3>${escapeHtml(group.title)}</h3>
    <table style="width: 100%">
      <colgroup>
        <col style="width: 4.5rem" />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">${group.die}</th>
          <th scope="col">${group.kind === 'ideal' ? 'Ideal' : 'Description'}</th>
        </tr>
      </thead>
      <tbody>
        ${group.details
          .map(
            (detail, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${formatCharacteristicDescription(detail)}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `
    )
    .join('')
}

function formatCharacteristicDescription(detail: BackgroundDetail): string {
  if (!detail.label.toLowerCase().startsWith('ideal:')) {
    return escapeHtml(detail.description)
  }

  const idealLabel = detail.label.slice(detail.label.indexOf(':') + 1).trim()
  return `<strong>${escapeHtml(idealLabel)}.</strong> ${escapeHtml(detail.description)}`
}

function formatFeatureHtml(
  description: string | undefined,
  details: NonNullable<BackgroundAuthoredDto['features']>[number]['details']
): string | undefined {
  const parts = [
    description,
    ...[...(details ?? [])]
      .sort((left, right) => left.order - right.order)
      .map((detail) => detail.description)
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) =>
      part.trim().startsWith('<') ? part.trim() : `<p>${escapeHtml(part.trim())}</p>`
    )

  return parts.length ? parts.join('') : undefined
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
