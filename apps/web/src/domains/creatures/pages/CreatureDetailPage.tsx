import { Alert, Button, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import {
  type AuthoredDraftDto,
  type CreatureResponseDto
} from '@artificer-toolkit/schema/api/content'
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
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { queryKeys } from '#app/lib/queryKeys'
import { buildCreatureRouteParams } from '#app/routing/authoredRouteParams'
import { buildCreatureDetailModel, type CreatureDetailModel } from './CreatureDetail.model'
import { CreatureStats, LegendaryActionsContent } from './CreatureDetailSections'

export function CreatureDetailPage({
  creatureId,
  draft,
  response,
  view
}: {
  creatureId: string
  draft: AuthoredDraftDto | null
  response: CreatureResponseDto
  view: 'active' | 'draft'
}) {
  const navigate = useNavigate()
  const operations = createAuthoredOperations('CREATURE', useConvex())
  const viewActive = view === 'active'
  const detailState = resolveAuthoredDetailState({
    draft,
    response,
    schema: creatureAuthoredDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    deleteActive: operations.deleteActive,
    discard: operations.discardDraft,
    detailSubjectQueryKey: queryKeys.content.creatures.detailRoot(creatureId),
    domainLabel: 'Creature',
    domainQueryKey: queryKeys.content.creatures.all(),
    draftQueryKey: queryKeys.content.creatures.draft(creatureId),
    duplicate: operations.duplicate,
    hasActiveContent: detailState.hasActiveContent,
    id: creatureId,
    navigateEdit: async (subject) =>
      navigate({
        params: buildCreatureRouteParams(subject.publicId, subject.label),
        to: '/creatures/$creaturePublicId/$creatureSlug/edit'
      }),
    navigateList: async () => navigate({ to: '/creatures' })
  })
  const exportAction = useAuthoredExportAction({
    canExport: detailState.provenance.kind === 'OWNED' && detailState.permissions.canEdit,
    id: creatureId,
    label: detailState.item?.label ?? 'Creature',
    subjectKind: 'CREATURE',
    view: detailState.mode === 'draft' ? 'draft' : 'active'
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <>
        <Stack>
          <Alert color='yellow'>
            This creature draft cannot be previewed. Delete it to return to the creature list.
          </Alert>
          <Button
            color='red'
            loading={actions.isDeleting}
            onClick={() =>
              actions.deleteContent({
                id: creatureId,
                kind: 'draft',
                label: detailState.draft?.label ?? 'creature draft'
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
        <Alert color='yellow'>That creature could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/creatures' })}>Back to creatures</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const creatureModel = buildCreatureDetailModel(
    item,
    {
      abilities: response?.meta?.abilities ?? [],
      challengeRatings: response?.meta?.challengeRatings ?? [],
      conditionTypes: response?.meta?.conditionTypes ?? [],
      creatureTypes: response?.meta?.creatureTypes ?? [],
      damageTypes: response?.meta?.damageTypes ?? [],
      equipment: response?.meta?.equipment ?? [],
      speeds: response?.meta?.speeds ?? []
    },
    response?.armorClass
  )
  const creatureParams = buildCreatureRouteParams(
    draft?.publicId ?? response?.publicId ?? creatureId,
    item.label
  )
  const pageActions = compactAuthoredDetailActions([
    detailState.mode === 'draft'
      ? {
          label: 'Resume Draft',
          tone: 'primary',
          onClick: () =>
            navigate({
              to: '/creatures/$creaturePublicId/$creatureSlug/edit',
              params: creatureParams
            })
        }
      : detailState.permissions.canEdit
        ? {
            label: 'Edit',
            tone: 'primary',
            onClick: () =>
              navigate({
                to: '/creatures/$creaturePublicId/$creatureSlug/edit',
                params: creatureParams
              })
          }
        : null,
    detailState.mode === 'active' && detailState.draft
      ? {
          label: 'View Draft',
          tone: 'secondary',
          onClick: () =>
            navigate({
              to: '/creatures/$creaturePublicId/$creatureSlug',
              params: creatureParams,
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
              id: creatureId,
              kind: detailState.mode === 'draft' ? 'draft' : 'active',
              label: item.label
            })
        }
      : null,
    exportAction,
    {
      label: 'Create New',
      tone: 'secondary',
      onClick: () => navigate({ to: '/creatures/new' })
    }
  ])

  return (
    <>
      <AuthoredDetailLayout
        actions={pageActions}
        actionsDisabled={actions.isDetailOperationPending}
        artworkTarget={{
          lookup: {
            type: 'AUTHORED_IMAGE',
            subjectKind: 'CREATURE',
            subjectId: creatureId,
            scope: detailState.mode === 'draft' ? 'DRAFT' : 'ACTIVE'
          },
          attach: {
            type: 'AUTHORED_IMAGE',
            subjectKind: 'CREATURE',
            subjectId: creatureId
          }
        }}
        eyebrow='Creature'
        facts={creatureModel.facts}
        notice={buildAuthoredDetailNotice({
          canViewActive: detailState.canViewActive,
          domainLabel: 'Creature',
          hasInvalidDraft: detailState.hasInvalidDraft,
          isViewingActive: viewActive,
          mode: detailState.mode,
          onDiscard: () => void actions.discardDraft(),
          onViewActive: () =>
            navigate({
              to: '/creatures/$creaturePublicId/$creatureSlug',
              params: creatureParams
            }),
          onViewDraft: () =>
            navigate({
              to: '/creatures/$creaturePublicId/$creatureSlug',
              params: creatureParams,
              search: { view: 'draft' }
            })
        })}
        pendingOperation={actions.pendingOperation}
        sections={getCreatureSections(creatureModel)}
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

function getCreatureSections(model: CreatureDetailModel): AuthoredDetailSectionModel[] {
  const legendaryActions = model.legendaryActions

  return compactAuthoredDetailSections([
    hasDetailText(model.description)
      ? {
          id: 'description',
          title: 'Description',
          content: <AuthoredDetailProse html={model.description} />
        }
      : null,
    {
      id: 'stats',
      title: 'Stats',
      content: <CreatureStats stats={model.stats} />
    },
    model.defenseItems.length
      ? {
          id: 'defenses',
          title: 'Defenses',
          content: (
            <AuthoredDetailItemList
              empty='No defenses have been added.'
              items={model.defenseItems}
            />
          )
        }
      : null,
    model.actionItems.length
      ? {
          id: 'actions',
          title: 'Actions',
          content: (
            <AuthoredDetailItemList empty='No actions have been added.' items={model.actionItems} />
          )
        }
      : null,
    model.bonusActionItems.length
      ? {
          id: 'bonus-actions',
          title: 'Bonus Actions',
          content: (
            <AuthoredDetailItemList
              empty='No bonus actions have been added.'
              items={model.bonusActionItems}
            />
          )
        }
      : null,
    model.reactionItems.length
      ? {
          id: 'reactions',
          title: 'Reactions',
          content: (
            <AuthoredDetailItemList
              empty='No reactions have been added.'
              items={model.reactionItems}
            />
          )
        }
      : null,
    model.lairActionItems.length
      ? {
          id: 'lair-actions',
          title: 'Lair Actions',
          content: (
            <AuthoredDetailItemList
              empty='No lair actions have been added.'
              items={model.lairActionItems}
            />
          )
        }
      : null,
    legendaryActions
      ? {
          id: 'legendary-actions',
          title: 'Legendary Actions',
          content: <LegendaryActionsContent feature={legendaryActions} />
        }
      : null,
    model.regionalEffectItems.length
      ? {
          id: 'regional-effects',
          title: 'Regional Effects',
          content: (
            <AuthoredDetailItemList
              empty='No regional effects have been added.'
              items={model.regionalEffectItems}
            />
          )
        }
      : null,
    model.profileItems.length
      ? {
          id: 'profile',
          title: 'Profile',
          content: (
            <AuthoredDetailItemList
              empty='No profile details have been added.'
              items={model.profileItems}
            />
          )
        }
      : null,
    model.traitItems.length
      ? {
          id: 'traits',
          title: 'Traits',
          content: (
            <AuthoredDetailItemList empty='No traits have been added.' items={model.traitItems} />
          )
        }
      : null
  ])
}
