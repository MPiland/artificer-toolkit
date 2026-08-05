import { Alert, Button, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import type { FacetDto } from '@artificer-toolkit/schema/shared/facet'
import { type AuthoredDraftDto, type FeatResponseDto } from '@artificer-toolkit/schema/api/content'
import { type FeatAuthoredDto } from '@artificer-toolkit/schema/subjects/feat'
import {
  AuthoredDetailItemList,
  AuthoredDetailLayout,
  AuthoredDetailProse,
  buildAuthoredDetailNotice,
  buildDetailStatusLabels,
  compactAuthoredDetailActions,
  compactAuthoredDetailSections,
  escapeHtml,
  formatEnumLabel,
  hasDetailText,
  resolveAuthoredDetailState,
  toDetailItems,
  useAuthoredDetailActions,
  useAuthoredExportAction,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildFeatRouteParams } from '#app/routing/authoredRouteParams'

export function FeatDetailPage({
  draft,
  featId,
  response,
  view
}: {
  draft: AuthoredDraftDto | null
  featId: string
  response: FeatResponseDto
  view: 'active' | 'draft'
}) {
  const navigate = useNavigate()
  const viewActive = view === 'active'
  const detailState = resolveAuthoredDetailState({
    draft,
    response,
    schema: featAuthoredDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    deleteActive: api.content.feats.deleteActive,
    discard: api.content.feats.discardDraft,
    detailSubjectQueryKey: queryKeys.content.feats.detailRoot(featId),
    domainLabel: 'Feat',
    domainQueryKey: queryKeys.content.feats.all(),
    draftQueryKey: queryKeys.content.feats.draft(featId),
    duplicate: api.content.feats.duplicate,
    hasActiveContent: detailState.hasActiveContent,
    id: featId,
    navigateEdit: async (subject) =>
      navigate({
        params: buildFeatRouteParams(subject.publicId, subject.label),
        to: '/feats/$featPublicId/$featSlug/edit'
      }),
    navigateList: async () => navigate({ to: '/feats' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <>
        <Stack>
          <Alert color='yellow'>
            This feat draft cannot be previewed. Delete it to return to the feat list.
          </Alert>
          <Button
            color='red'
            loading={actions.isDeleting}
            onClick={() =>
              actions.deleteContent({
                id: featId,
                kind: 'draft',
                label: detailState.draft?.label ?? 'feat draft'
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
        <Alert color='yellow'>That feat could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/feats' })}>Back to feats</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const featParams = buildFeatRouteParams(
    draft?.publicId ?? response?.publicId ?? featId,
    item.label
  )
  const exportAction = useAuthoredExportAction({
    canExport: detailState.provenance.kind === 'OWNED' && detailState.permissions.canEdit,
    id: featId,
    label: item.label,
    subjectKind: 'FEAT',
    view: detailState.mode === 'draft' ? 'draft' : 'active'
  })
  const pageActions = compactAuthoredDetailActions([
    detailState.mode === 'draft'
      ? {
          label: 'Resume Draft',
          tone: 'primary',
          onClick: () => navigate({ to: '/feats/$featPublicId/$featSlug/edit', params: featParams })
        }
      : detailState.permissions.canEdit
        ? {
            label: 'Edit',
            tone: 'primary',
            onClick: () =>
              navigate({ to: '/feats/$featPublicId/$featSlug/edit', params: featParams })
          }
        : null,
    detailState.mode === 'active' && detailState.draft
      ? {
          label: 'View Draft',
          tone: 'secondary',
          onClick: () =>
            navigate({
              to: '/feats/$featPublicId/$featSlug',
              params: featParams,
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
              id: featId,
              kind: detailState.mode === 'draft' ? 'draft' : 'active',
              label: item.label
            })
        }
      : null,
    exportAction,
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/feats/new' }) }
  ])

  return (
    <>
      <AuthoredDetailLayout
        actions={pageActions}
        actionsDisabled={actions.isDetailOperationPending}
        eyebrow='Feat'
        facts={[]}
        notice={buildAuthoredDetailNotice({
          canViewActive: detailState.canViewActive,
          domainLabel: 'Feat',
          hasInvalidDraft: detailState.hasInvalidDraft,
          isViewingActive: viewActive,
          mode: detailState.mode,
          onDiscard: () => void actions.discardDraft(),
          onViewActive: () =>
            navigate({ to: '/feats/$featPublicId/$featSlug', params: featParams }),
          onViewDraft: () =>
            navigate({
              to: '/feats/$featPublicId/$featSlug',
              params: featParams,
              search: { view: 'draft' }
            })
        })}
        pendingOperation={actions.pendingOperation}
        sections={getFeatSections(item)}
        showSectionNav={false}
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

function getFeatSections(feat: FeatAuthoredDto): AuthoredDetailSectionModel[] {
  const prerequisiteHtml = formatPrerequisiteHtml(feat.prerequisites)
  const detailItems = toDetailItems(feat.details)
  const featureItems = toDetailItems(feat.features).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description
  }))

  return compactAuthoredDetailSections([
    hasDetailText(feat.description)
      ? {
          id: 'description',
          title: 'Description',
          content: <AuthoredDetailProse html={feat.description} />
        }
      : null,
    prerequisiteHtml
      ? {
          id: 'requirements',
          title: 'Prerequisites',
          content: <AuthoredDetailProse html={prerequisiteHtml} />
        }
      : null,
    detailItems.length
      ? {
          id: 'details',
          title: 'Details',
          content: (
            <AuthoredDetailItemList empty='No feat details have been added.' items={detailItems} />
          )
        }
      : null,
    featureItems.length
      ? {
          id: 'features',
          title: 'Features',
          content: (
            <AuthoredDetailItemList
              empty='No feat features have been added.'
              items={featureItems}
            />
          )
        }
      : null
  ])
}

function formatPrerequisiteHtml(prerequisites: FacetDto | undefined): string {
  const groups = readArray(prerequisites, 'groups')
    .map((group) =>
      readArray(group, 'contexts')
        .flatMap((context) => readArray(context, 'conditions').map(formatPrerequisiteCondition))
        .filter((line): line is string => Boolean(line))
    )
    .filter((lines) => lines.length)
    .map((lines) => lines.join(' and '))

  if (!groups.length) return ''

  return `<ul>${groups.map((group) => `<li>${escapeHtml(group)}</li>`).join('')}</ul>`
}

function formatPrerequisiteCondition(condition: unknown): string | null {
  if (!isRecord(condition) || condition.kind !== 'PREDICATE') return null

  const predicateCode = readString(condition, 'predicateCode')
  const min = readNumber(condition, 'min')

  switch (predicateCode) {
    case 'ABILITY_SCORE': {
      const abilities = readStringList(condition, 'abilities').map(formatEnumLabel)
      if (!abilities.length || min == null) return null
      return `${formatOrList(abilities)} ${min} or higher`
    }
    case 'CHARACTER_LEVEL':
      return min == null ? null : `Character level ${min} or higher`
    case 'CLASS_LEVEL':
      return min == null ? null : `Class level ${min} or higher`
    default:
      return null
  }
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

function readArray(value: unknown, key: string): unknown[] {
  if (!isRecord(value)) return []
  const arrayValue = value[key]
  return Array.isArray(arrayValue) ? arrayValue : []
}

function readStringList(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (typeof value === 'string') return [value]
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' ? value : null
}

function formatOrList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? ''
  if (values.length === 2) return `${values[0]} or ${values[1]}`
  return `${values.slice(0, -1).join(', ')}, or ${values[values.length - 1]}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
