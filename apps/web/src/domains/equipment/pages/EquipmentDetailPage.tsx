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
  formatReferenceLabelList,
  formatReferenceList,
  hasDetailText,
  resolveAuthoredDetailState,
  stripHtml,
  toDetailItems,
  useAuthoredDetailActions,
  useAuthoredExportAction,
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
  references: Pick<
    AuthoredContentReferenceData,
    'classes' | 'currencies' | 'equipment' | 'heritages' | 'rarities'
  >
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
  const exportAction = useAuthoredExportAction({
    canExport: detailState.provenance.kind === 'OWNED' && detailState.permissions.canEdit,
    id: equipmentId,
    label: item.label,
    subjectKind: 'EQUIPMENT',
    view: detailState.mode === 'draft' ? 'draft' : 'active'
  })
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
    exportAction,
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/equipment/new' }) }
  ])

  return (
    <>
      <AuthoredDetailLayout
        actions={pageActions}
        actionsDisabled={actions.isDetailOperationPending}
        artworkTarget={{
          lookup: {
            type: 'AUTHORED_IMAGE',
            subjectKind: 'EQUIPMENT',
            subjectId: equipmentId,
            scope: detailState.mode === 'draft' ? 'DRAFT' : 'ACTIVE'
          },
          attach: { type: 'AUTHORED_IMAGE', subjectKind: 'EQUIPMENT', subjectId: equipmentId }
        }}
        description={stripHtml(item.quote) || undefined}
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
  references: Pick<
    AuthoredContentReferenceData,
    'classes' | 'currencies' | 'equipment' | 'heritages' | 'rarities'
  >
): AuthoredDetailFact[] {
  const baseFacts: AuthoredDetailFact[] = [
    { label: 'Category', value: formatEnumLabel(equipment.category) },
    {
      label: 'Rarity',
      value: formatReferenceLabel(equipment.rarityId, 'Rarity selected', references.rarities)
    },
    { label: 'Properties', value: formatReferenceList(equipment.properties, 'property') },
    ...(equipment.requiresAttunement ? [{ label: 'Attunement', value: 'Required' }] : [])
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
    {
      label: 'Cost',
      value: equipment.cost
        ? `${formatNumber(equipment.cost.amount)} ${formatReferenceLabel(
            equipment.cost.currencyId,
            'Currency',
            references.currencies
          )}`
        : 'Not set'
    },
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
  references: Pick<
    AuthoredContentReferenceData,
    'classes' | 'currencies' | 'equipment' | 'heritages' | 'rarities'
  >
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
  const restrictionItems = (equipment.restrictions?.groups ?? [])
    .map((group, index) => {
      const requirements = group.contexts
        .flatMap((context) => context.conditions ?? [])
        .map((condition) => formatEquipmentRestrictionCondition(condition, references))
        .filter((requirement): requirement is string => Boolean(requirement))

      return requirements.length
        ? {
            id: group.id,
            title:
              equipment.restrictions!.groups.length === 1 ? 'Requirements' : `Option ${index + 1}`,
            description: requirements.join(' and ')
          }
        : null
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

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
    restrictionItems.length
      ? {
          id: 'eligibility',
          title: 'Eligibility',
          content: (
            <AuthoredDetailItemList
              empty='No eligibility requirements have been added.'
              items={restrictionItems}
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
              empty='No equipment features have been added.'
              items={featureItems}
            />
          )
        }
      : null
  ])
}

function formatEquipmentRestrictionCondition(
  condition: NonNullable<
    NonNullable<
      EquipmentAuthoringInputDto['restrictions']
    >['groups'][number]['contexts'][number]['conditions']
  >[number],
  references: Pick<AuthoredContentReferenceData, 'classes' | 'heritages'>
): string | null {
  if (condition.kind !== 'PREDICATE') return null

  let requirement: string | null = null
  if (condition.predicateCode === 'CLASS_LEVEL') {
    const classes = formatReferenceLabelList(condition.classIds, 'class', references.classes)
    const level = condition.max
      ? `levels ${condition.min}-${condition.max}`
      : `level ${condition.min}+`
    requirement = `${classes} ${level}`
  } else if (condition.predicateCode === 'HERITAGE' && condition.authoringModeKind === 'SELECTED') {
    const heritageIds =
      'heritageIds' in condition && Array.isArray(condition.heritageIds)
        ? condition.heritageIds.filter((id): id is string => typeof id === 'string')
        : []
    requirement = formatReferenceLabelList(heritageIds, 'heritage', references.heritages)
  }

  if (!requirement) return null
  return condition.constraint === 'EXCLUDE' ? `Not ${requirement}` : requirement
}
