import { Alert, Button, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { equipmentAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import {
  type AuthoredDraftDto,
  type EquipmentResponseDto
} from '@artificer-toolkit/schema/api/content'
import { type EquipmentAuthoringInputDto } from '@artificer-toolkit/schema/subjects/equipment'
import {
  AuthoredDetailItemList,
  AuthoredDetailLayout,
  AuthoredDetailProse,
  buildAuthoredDetailNotice,
  buildDetailStatusLabels,
  compactAuthoredDetailActions,
  compactAuthoredDetailSections,
  formatEnumLabel,
  formatNumber,
  formatReferenceLabel,
  formatReferenceList,
  hasDetailText,
  resolveAuthoredDetailState,
  toDetailItems,
  useAuthoredDetailActions,
  type AuthoredDetailFact,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildEquipmentRouteParams } from '#app/routing/authoredRouteParams'

export function EquipmentDetailPage({
  draft,
  equipmentId,
  references,
  response,
  view
}: {
  draft: AuthoredDraftDto | null
  equipmentId: string
  references: Pick<AuthoredContentReferenceData, 'equipment' | 'rarities'>
  response: EquipmentResponseDto
  view: 'active' | 'draft'
}) {
  const navigate = useNavigate()
  const viewActive = view === 'active'
  const detailState = resolveAuthoredDetailState<EquipmentAuthoringInputDto>({
    draft,
    response,
    schema: equipmentAuthoringInputDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    deleteActive: api.content.equipment.deleteActive,
    discard: api.content.equipment.discardDraft,
    detailSubjectQueryKey: queryKeys.content.equipment.detailRoot(equipmentId),
    domainLabel: 'Equipment',
    domainQueryKey: queryKeys.content.equipment.all(),
    draftQueryKey: queryKeys.content.equipment.draft(equipmentId),
    duplicate: api.content.equipment.duplicate,
    hasActiveContent: detailState.hasActiveContent,
    id: equipmentId,
    navigateEdit: async (subject) =>
      navigate({
        params: buildEquipmentRouteParams(subject.publicId, subject.label),
        to: '/equipment/$equipmentPublicId/$equipmentSlug/edit'
      }),
    navigateList: async () => navigate({ to: '/equipment' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <>
        <Stack>
          <Alert color='yellow'>
            This equipment draft cannot be previewed. Delete it to return to the equipment list.
          </Alert>
          <Button
            color='red'
            loading={actions.isDeleting}
            onClick={() =>
              actions.deleteContent({
                id: equipmentId,
                kind: 'draft',
                label: detailState.draft?.label ?? 'equipment draft'
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
        <Alert color='yellow'>That equipment could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/equipment' })}>Back to equipment</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const equipmentParams = buildEquipmentRouteParams(
    draft?.publicId ?? response?.publicId ?? equipmentId,
    item.label
  )
  const pageActions = compactAuthoredDetailActions([
    detailState.mode === 'draft'
      ? {
          label: 'Resume Draft',
          tone: 'primary',
          onClick: () =>
            navigate({
              to: '/equipment/$equipmentPublicId/$equipmentSlug/edit',
              params: equipmentParams
            })
        }
      : detailState.permissions.canEdit
        ? {
            label: 'Edit',
            tone: 'primary',
            onClick: () =>
              navigate({
                to: '/equipment/$equipmentPublicId/$equipmentSlug/edit',
                params: equipmentParams
              })
          }
        : null,
    detailState.mode === 'active' && detailState.draft
      ? {
          label: 'View Draft',
          tone: 'secondary',
          onClick: () =>
            navigate({
              to: '/equipment/$equipmentPublicId/$equipmentSlug',
              params: equipmentParams,
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
              id: equipmentId,
              kind: detailState.mode === 'draft' ? 'draft' : 'active',
              label: item.label
            })
        }
      : null,
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/equipment/new' }) }
  ])

  return (
    <>
      <AuthoredDetailLayout
        actions={pageActions}
        actionsDisabled={actions.isDetailOperationPending}
        eyebrow='Equipment'
        facts={getEquipmentFacts(item, references)}
        notice={buildAuthoredDetailNotice({
          canViewActive: detailState.canViewActive,
          domainLabel: 'Equipment',
          hasInvalidDraft: detailState.hasInvalidDraft,
          isViewingActive: viewActive,
          mode: detailState.mode,
          onDiscard: () => void actions.discardDraft(),
          onViewActive: () =>
            navigate({
              to: '/equipment/$equipmentPublicId/$equipmentSlug',
              params: equipmentParams
            }),
          onViewDraft: () =>
            navigate({
              to: '/equipment/$equipmentPublicId/$equipmentSlug',
              params: equipmentParams,
              search: { view: 'draft' }
            })
        })}
        pendingOperation={actions.pendingOperation}
        sections={getEquipmentSections(item, references)}
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

function getEquipmentFacts(
  equipment: EquipmentAuthoringInputDto,
  references: Pick<AuthoredContentReferenceData, 'equipment' | 'rarities'>
): AuthoredDetailFact[] {
  const baseFacts: AuthoredDetailFact[] = [
    { label: 'Category', value: formatEnumLabel(equipment.category) },
    {
      label: 'Rarity',
      value: formatReferenceLabel(equipment.rarityId, 'Rarity selected', references.rarities)
    },
    { label: 'Properties', value: formatReferenceList(equipment.properties, 'property') }
  ]

  if (equipment.category === 'VARIANT') {
    return [
      ...baseFacts,
      {
        label: 'Parent',
        value: formatReferenceLabel(
          equipment.parentEquipmentId,
          'Parent equipment selected',
          references.equipment
        )
      }
    ]
  }

  return [
    ...baseFacts,
    { label: 'Cost', value: equipment.cost ? `${equipment.cost.amount} currency` : 'Not set' },
    {
      label: 'Weight',
      value: equipment.weight
        ? `${formatNumber(equipment.weight.amount)} ${formatEnumLabel(equipment.weight.unit)}`
        : 'Not set'
    }
  ]
}

function getEquipmentSections(
  equipment: EquipmentAuthoringInputDto,
  references: Pick<AuthoredContentReferenceData, 'equipment' | 'rarities'>
): AuthoredDetailSectionModel[] {
  const containedItems =
    equipment.category !== 'VARIANT'
      ? (equipment.contains ?? []).map((contained, index) => ({
          id: `${contained.equipmentId}-${index}`,
          title: formatReferenceLabel(contained.equipmentId, 'Equipment', references.equipment),
          meta: `Quantity ${contained.quantity}`
        }))
      : []
  const mechanicItems = [
    ...(equipment.charges
      ? [
          {
            id: equipment.charges.id,
            title: 'Charges',
            meta: formatEnumLabel(equipment.charges.resetKind)
          }
        ]
      : [])
  ]
  const featureItems = toDetailItems(equipment.features).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description
  }))

  return compactAuthoredDetailSections([
    hasDetailText(equipment.description)
      ? {
          id: 'description',
          title: 'Description',
          content: <AuthoredDetailProse html={equipment.description} />
        }
      : null,
    equipment.category !== 'VARIANT' && containedItems.length
      ? {
          id: 'contents',
          title: 'Contents',
          content: (
            <AuthoredDetailItemList
              empty='No contained equipment has been added.'
              items={containedItems}
            />
          )
        }
      : null,
    mechanicItems.length
      ? {
          id: 'mechanics',
          title: 'Mechanics',
          content: (
            <AuthoredDetailItemList empty='No mechanics have been added.' items={mechanicItems} />
          )
        }
      : null,
    featureItems.length
      ? {
          id: 'features',
          title: 'Features',
          content: (
            <AuthoredDetailItemList
              empty='No equipment features have been added.'
              items={featureItems}
            />
          )
        }
      : null
  ])
}
