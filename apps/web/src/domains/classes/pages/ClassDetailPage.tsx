import { Alert, Button, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { classAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { type AuthoredDraftDto, type ClassResponseDto } from '@artificer-toolkit/schema/api/content'
import { type ClassAuthoringInputDto } from '@artificer-toolkit/schema/subjects/class'
import {
  AuthoredDetailItemList,
  AuthoredDetailLayout,
  AuthoredDetailProse,
  buildAuthoredDetailNotice,
  buildDetailStatusLabels,
  compactAuthoredDetailActions,
  compactAuthoredDetailSections,
  hasDetailText,
  resolveAuthoredDetailState,
  useAuthoredDetailActions,
  useAuthoredExportAction,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildClassRouteParams } from '#app/routing/authoredRouteParams'
import {
  buildClassDetailModel,
  getClassParentLabel,
  type ClassDetailModel
} from './ClassDetail.model'

export function ClassDetailPage({
  classId,
  draft,
  references,
  response,
  view
}: {
  classId: string
  draft: AuthoredDraftDto | null
  references: Pick<
    AuthoredContentReferenceData,
    'currencies' | 'equipment' | 'languages' | 'skills'
  >
  response: ClassResponseDto
  view: 'active' | 'draft'
}) {
  const navigate = useNavigate()
  const viewActive = view === 'active'
  const detailState = resolveAuthoredDetailState<ClassAuthoringInputDto>({
    draft,
    response,
    schema: classAuthoringInputDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    deleteActive: api.content.classes.deleteActive,
    discard: api.content.classes.discardDraft,
    detailSubjectQueryKey: queryKeys.content.classes.detailRoot(classId),
    domainLabel: 'Class',
    domainQueryKey: queryKeys.content.classes.all(),
    draftQueryKey: queryKeys.content.classes.draft(classId),
    duplicate: api.content.classes.duplicate,
    hasActiveContent: detailState.hasActiveContent,
    id: classId,
    navigateEdit: async (subject) =>
      navigate({
        params: buildClassRouteParams(subject.publicId, subject.label),
        to: '/classes/$classPublicId/$classSlug/edit'
      }),
    navigateList: async () => navigate({ to: '/classes' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <>
        <Stack>
          <Alert color='yellow'>
            This class draft cannot be previewed. Delete it to return to the class list.
          </Alert>
          <Button
            color='red'
            loading={actions.isDeleting}
            onClick={() =>
              actions.deleteContent({
                id: classId,
                kind: 'draft',
                label: detailState.draft?.label ?? 'class draft'
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
        <Alert color='yellow'>That class could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/classes' })}>Back to classes</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const classParams = buildClassRouteParams(
    draft?.publicId ?? response?.publicId ?? classId,
    item.label
  )
  const exportAction = useAuthoredExportAction({
    canExport: detailState.provenance.kind === 'OWNED' && detailState.permissions.canEdit,
    id: classId,
    label: item.label,
    subjectKind: 'CLASS',
    view: detailState.mode === 'draft' ? 'draft' : 'active'
  })
  const parentClassLabel = getClassParentLabel(item, response)
  const classModel = buildClassDetailModel(item, references)
  const pageActions = compactAuthoredDetailActions([
    detailState.mode === 'draft'
      ? {
          label: 'Resume Draft',
          tone: 'primary',
          onClick: () =>
            navigate({ to: '/classes/$classPublicId/$classSlug/edit', params: classParams })
        }
      : detailState.permissions.canEdit
        ? {
            label: 'Edit',
            tone: 'primary',
            onClick: () =>
              navigate({ to: '/classes/$classPublicId/$classSlug/edit', params: classParams })
          }
        : null,
    detailState.mode === 'active' && detailState.draft
      ? {
          label: 'View Draft',
          tone: 'secondary',
          onClick: () =>
            navigate({
              to: '/classes/$classPublicId/$classSlug',
              params: classParams,
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
              id: classId,
              kind: detailState.mode === 'draft' ? 'draft' : 'active',
              label: item.label
            })
        }
      : null,
    exportAction,
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/classes/new' }) }
  ])

  return (
    <>
      <AuthoredDetailLayout
        actions={pageActions}
        actionsDisabled={actions.isDetailOperationPending}
        artworkTarget={{
          lookup: {
            type: 'AUTHORED_IMAGE',
            subjectKind: 'CLASS',
            subjectId: classId,
            scope: detailState.mode === 'draft' ? 'DRAFT' : 'ACTIVE'
          },
          attach: { type: 'AUTHORED_IMAGE', subjectKind: 'CLASS', subjectId: classId }
        }}
        eyebrow={item.category === 'SUBCLASS' ? 'Subclass' : 'Class'}
        facts={[]}
        notice={buildAuthoredDetailNotice({
          canViewActive: detailState.canViewActive,
          domainLabel: 'Class',
          hasInvalidDraft: detailState.hasInvalidDraft,
          isViewingActive: viewActive,
          mode: detailState.mode,
          onDiscard: () => void actions.discardDraft(),
          onViewActive: () =>
            navigate({ to: '/classes/$classPublicId/$classSlug', params: classParams }),
          onViewDraft: () =>
            navigate({
              to: '/classes/$classPublicId/$classSlug',
              params: classParams,
              search: { view: 'draft' }
            })
        })}
        pendingOperation={actions.pendingOperation}
        sections={getClassSections(classModel)}
        status={buildDetailStatusLabels({
          draft: detailState.draft,
          mode: detailState.mode,
          provenance: detailState.provenance,
          status: item.status
        }).concat(parentClassLabel ? [`${parentClassLabel} subclass`] : [])}
        title={item.label}
      />
      {actions.deleteConfirmation}
    </>
  )
}

function getClassSections(model: ClassDetailModel): AuthoredDetailSectionModel[] {
  return compactAuthoredDetailSections([
    hasDetailText(model.description)
      ? {
          id: 'description',
          title: 'Description',
          content: <AuthoredDetailProse html={model.description} />
        }
      : null,
    model.detailItems.length
      ? {
          id: 'details',
          title: 'Details',
          content: (
            <AuthoredDetailItemList
              empty='No class details have been added.'
              items={model.detailItems}
            />
          )
        }
      : null,
    hasDetailText(model.hitPointHtml)
      ? {
          id: 'hit-points',
          title: 'Hit Points',
          content: <AuthoredDetailProse html={model.hitPointHtml} />
        }
      : null,
    hasDetailText(model.proficienciesHtml)
      ? {
          id: 'proficiencies',
          title: 'Proficiencies',
          content: (
            <AuthoredDetailProse
              html={model.proficienciesHtml}
              fallback='No proficiencies have been added.'
            />
          )
        }
      : null,
    hasDetailText(model.equipmentHtml)
      ? {
          id: 'equipment',
          title: 'Equipment',
          content: (
            <AuthoredDetailProse
              html={model.equipmentHtml}
              fallback='No starting equipment has been added.'
            />
          )
        }
      : null,
    hasDetailText(model.progressionHtml)
      ? {
          id: 'progression',
          title: 'Progression',
          content: <AuthoredDetailProse html={model.progressionHtml} />
        }
      : null,
    model.spellcastingItems.length
      ? {
          id: 'spellcasting',
          title: model.spellcastingTitle,
          content: (
            <AuthoredDetailItemList
              empty='No spellcasting rules have been added.'
              items={model.spellcastingItems}
            />
          )
        }
      : null,
    model.resourceItems.length
      ? {
          id: 'resources',
          title: 'Resources',
          content: (
            <AuthoredDetailItemList
              empty='No resources have been added.'
              items={model.resourceItems}
            />
          )
        }
      : null,
    model.featureItems.length
      ? {
          id: 'features',
          title: 'Features',
          content: (
            <AuthoredDetailItemList
              empty='No features have been added.'
              items={model.featureItems}
            />
          )
        }
      : null,
    hasDetailText(model.multiclassHtml)
      ? {
          id: 'multiclass',
          title: 'Multiclass',
          content: <AuthoredDetailProse html={model.multiclassHtml} />
        }
      : null
  ])
}
