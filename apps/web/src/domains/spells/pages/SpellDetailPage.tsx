import { Alert, Button, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { type AuthoredDraftDto, type SpellResponseDto } from '@artificer-toolkit/schema/api/content'
import { type SpellAuthoredDto } from '@artificer-toolkit/schema/subjects/spell'
import {
  AuthoredDetailLayout,
  AuthoredDetailPillList,
  AuthoredDetailProse,
  buildAuthoredDetailNotice,
  buildDetailStatusLabels,
  compactAuthoredDetailActions,
  resolveAuthoredDetailState,
  useAuthoredDetailActions,
  useAuthoredExportAction,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { queryKeys } from '#app/lib/queryKeys'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'
import { buildSpellDetailModel } from './SpellDetail.model'

export function SpellDetailPage({
  draft,
  response,
  spellId,
  view
}: {
  draft: AuthoredDraftDto | null
  response: SpellResponseDto
  spellId: string
  view: 'active' | 'draft'
}) {
  const navigate = useNavigate()
  const operations = createAuthoredOperations('SPELL', useConvex())
  const viewActive = view === 'active'
  const detailState = resolveAuthoredDetailState({
    draft,
    response,
    schema: spellAuthoredDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    deleteActive: operations.deleteActive,
    discard: operations.discardDraft,
    detailSubjectQueryKey: queryKeys.content.spells.detailRoot(spellId),
    domainLabel: 'Spell',
    domainQueryKey: queryKeys.content.spells.all(),
    draftQueryKey: queryKeys.content.spells.draft(spellId),
    duplicate: operations.duplicate,
    hasActiveContent: detailState.hasActiveContent,
    id: spellId,
    navigateEdit: async (subject) =>
      navigate({
        params: buildSpellRouteParams(subject.publicId, subject.label),
        to: '/spells/$spellPublicId/$spellSlug/edit'
      }),
    navigateList: async () => navigate({ to: '/spells' })
  })
  const exportAction = useAuthoredExportAction({
    canExport: detailState.provenance.kind === 'OWNED' && detailState.permissions.canEdit,
    id: spellId,
    label: detailState.item?.label ?? 'Spell',
    subjectKind: 'SPELL',
    view: detailState.mode === 'draft' ? 'draft' : 'active'
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <>
        <Stack>
          <Alert color='yellow'>
            This spell draft cannot be previewed. Delete it to return to the spell list.
          </Alert>
          <Button
            color='red'
            loading={actions.isDeleting}
            onClick={() =>
              actions.deleteContent({
                id: spellId,
                kind: 'draft',
                label: detailState.draft?.label ?? 'spell draft'
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
        <Alert color='yellow'>That spell could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/spells' })}>Back to spells</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const spellModel = buildSpellDetailModel(item, {
    classes: response?.meta?.classes ?? [],
    conditionTypes: response?.meta?.conditionTypes ?? [],
    damageTypes: response?.meta?.damageTypes ?? [],
    magicSchools: response?.meta?.magicSchools ?? []
  })
  const spellParams = buildSpellRouteParams(
    draft?.publicId ?? response?.publicId ?? spellId,
    item.label
  )
  const pageActions = compactAuthoredDetailActions([
    detailState.mode === 'draft'
      ? {
          label: 'Resume Draft',
          tone: 'primary',
          onClick: () =>
            navigate({ to: '/spells/$spellPublicId/$spellSlug/edit', params: spellParams })
        }
      : detailState.permissions.canEdit
        ? {
            label: 'Edit',
            tone: 'primary',
            onClick: () =>
              navigate({ to: '/spells/$spellPublicId/$spellSlug/edit', params: spellParams })
          }
        : null,
    detailState.mode === 'active' && detailState.draft
      ? {
          label: 'View Draft',
          tone: 'secondary',
          onClick: () =>
            navigate({
              to: '/spells/$spellPublicId/$spellSlug',
              params: spellParams,
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
              id: spellId,
              kind: detailState.mode === 'draft' ? 'draft' : 'active',
              label: item.label
            })
        }
      : null,
    exportAction,
    { label: 'Create New', tone: 'quiet', onClick: () => navigate({ to: '/spells/new' }) }
  ])

  return (
    <>
      <AuthoredDetailLayout
        actions={pageActions}
        actionsDisabled={actions.isDetailOperationPending}
        artworkTarget={{
          lookup: {
            type: 'AUTHORED_IMAGE',
            subjectKind: 'SPELL',
            subjectId: spellId,
            scope: detailState.mode === 'draft' ? 'DRAFT' : 'ACTIVE'
          },
          attach: { type: 'AUTHORED_IMAGE', subjectKind: 'SPELL', subjectId: spellId }
        }}
        afterFacts={<AuthoredDetailPillList label='Available For' items={spellModel.classLabels} />}
        facts={spellModel.facts}
        notice={buildAuthoredDetailNotice({
          canViewActive: detailState.canViewActive,
          domainLabel: 'Spell',
          hasInvalidDraft: detailState.hasInvalidDraft,
          isViewingActive: viewActive,
          mode: detailState.mode,
          onDiscard: () => void actions.discardDraft(),
          onViewActive: () =>
            navigate({ to: '/spells/$spellPublicId/$spellSlug', params: spellParams }),
          onViewDraft: () =>
            navigate({
              to: '/spells/$spellPublicId/$spellSlug',
              params: spellParams,
              search: { view: 'draft' }
            })
        })}
        pendingOperation={actions.pendingOperation}
        sections={getSpellSections(item)}
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

function getSpellSections(spell: SpellAuthoredDto): AuthoredDetailSectionModel[] {
  const sections: AuthoredDetailSectionModel[] = [
    {
      id: 'description',
      title: 'Description',
      content: <AuthoredDetailProse html={spell.description} />
    }
  ]

  if (spell.materialDescription) {
    sections.push({
      id: 'material-components',
      title: 'Material Components',
      content: <AuthoredDetailProse html={spell.materialDescription} />
    })
  }

  return sections
}
