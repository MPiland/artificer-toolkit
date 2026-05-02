import { useState } from 'react'
import { Alert, Button, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import {
  equipmentAuthoringInputDtoSchema,
  type AuthoredDraftDto,
  type EquipmentAuthoringInputDto,
  type EquipmentResponseDto
} from '@artificer-toolkit/schema'
import {
  AuthoredDetailEmptyBlock,
  AuthoredDetailItemList,
  AuthoredDetailLayout,
  AuthoredDetailProse,
  buildAuthoredDetailNotice,
  buildDetailStatusLabels,
  compactAuthoredDetailActions,
  formatCount,
  formatEnumLabel,
  formatNumber,
  formatReference,
  formatReferenceList,
  resolveAuthoredDetailState,
  summarizeHtml,
  toDetailItems,
  useAuthoredDetailActions,
  type AuthoredDetailFact,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function EquipmentDetailPage({
  draft,
  equipmentId,
  response
}: {
  draft: AuthoredDraftDto | null
  equipmentId: string
  response: EquipmentResponseDto
}) {
  const navigate = useNavigate()
  const [viewActive, setViewActive] = useState(false)
  const detailState = resolveAuthoredDetailState<EquipmentAuthoringInputDto>({
    draft,
    response,
    schema: equipmentAuthoringInputDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    discard: api.content.equipment.discardDraft,
    detailQueryKey: queryKeys.content.equipment.detail(equipmentId),
    domainLabel: 'Equipment',
    domainQueryKey: queryKeys.content.equipment.all(),
    draftQueryKey: queryKeys.content.equipment.draft(equipmentId),
    duplicate: api.content.equipment.duplicate,
    hasActiveContent: Boolean(detailState.activeItem),
    id: equipmentId,
    navigateEdit: async (id) => navigate({ to: '/equipment/$equipmentId/edit', params: { equipmentId: id } }),
    navigateList: async () => navigate({ to: '/equipment' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <Stack>
        <Alert color='yellow'>This equipment draft cannot be previewed. Discard it to return to the equipment list.</Alert>
        <Button loading={actions.isDiscardingDraft} onClick={() => void actions.discardDraft({ backToList: true })}>
          Discard draft
        </Button>
      </Stack>
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
  const pageActions = compactAuthoredDetailActions([
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/equipment/new' }) },
    detailState.mode === 'draft'
      ? { label: 'Resume Draft', tone: 'primary', onClick: () => navigate({ to: '/equipment/$equipmentId/edit', params: { equipmentId } }) }
      : detailState.permissions.canEdit
        ? { label: 'Edit', tone: 'primary', onClick: () => navigate({ to: '/equipment/$equipmentId/edit', params: { equipmentId } }) }
        : null,
    detailState.permissions.canCopy
      ? { label: 'Duplicate', tone: 'secondary', disabled: actions.isDuplicating, onClick: () => void actions.duplicateToDraft() }
      : null
  ])

  return (
    <AuthoredDetailLayout
      actions={pageActions}
      description={summarizeHtml(item.description, 'An equipment reference entry ready for table use.')}
      eyebrow='Equipment'
      facts={getEquipmentFacts(item)}
      notice={buildAuthoredDetailNotice({
        canViewActive: Boolean(detailState.activeItem && detailState.draftItem),
        domainLabel: 'Equipment',
        hasInvalidDraft: detailState.hasInvalidDraft,
        isViewingActive: viewActive,
        mode: detailState.mode,
        onDiscard: () => void actions.discardDraft(),
        onViewActive: () => setViewActive(true),
        onViewDraft: () => setViewActive(false)
      })}
      sections={getEquipmentSections(item)}
      status={buildDetailStatusLabels({
        draft: detailState.draft,
        mode: detailState.mode,
        provenance: detailState.provenance,
        status: item.status
      })}
      title={item.label}
    />
  )
}

function getEquipmentFacts(equipment: EquipmentAuthoringInputDto): AuthoredDetailFact[] {
  const baseFacts: AuthoredDetailFact[] = [
    { label: 'Category', value: formatEnumLabel(equipment.category) },
    { label: 'Rarity', value: formatReference(equipment.rarityId, 'Rarity selected') },
    { label: 'Properties', value: formatReferenceList(equipment.properties, 'property') },
    { label: 'Features', value: formatCount(equipment.features?.length, 'feature') }
  ]

  if (equipment.category === 'VARIANT') {
    return [
      ...baseFacts,
      { label: 'Parent', value: formatReference(equipment.parentEquipmentId, 'Parent equipment selected') }
    ]
  }

  return [
    ...baseFacts,
    { label: 'Cost', value: equipment.cost ? `${equipment.cost.amount} currency` : 'Not set' },
    { label: 'Weight', value: `${formatNumber(equipment.weight.amount)} ${formatEnumLabel(equipment.weight.unit)}` }
  ]
}

function getEquipmentSections(equipment: EquipmentAuthoringInputDto): AuthoredDetailSectionModel[] {
  return [
    {
      id: 'description',
      title: 'Description',
      content: <AuthoredDetailProse html={equipment.description} />
    },
    {
      id: 'restrictions',
      title: 'Restrictions',
      content: equipment.restrictions
        ? <AuthoredDetailEmptyBlock>Restrictions are configured for this item.</AuthoredDetailEmptyBlock>
        : <AuthoredDetailEmptyBlock>No restrictions have been added.</AuthoredDetailEmptyBlock>
    },
    {
      id: 'contents',
      title: 'Contents',
      content: equipment.category !== 'VARIANT'
        ? (
            <AuthoredDetailItemList
              empty='No contained equipment has been added.'
              items={(equipment.contains ?? []).map((contained, index) => ({
                id: `${contained.equipmentId}-${index}`,
                title: formatReference(contained.equipmentId, 'Equipment'),
                meta: `Quantity ${contained.quantity}`
              }))}
            />
          )
        : <AuthoredDetailEmptyBlock>Variants do not define contained equipment.</AuthoredDetailEmptyBlock>
    },
    {
      id: 'mechanics',
      title: 'Mechanics',
      content: (
        <AuthoredDetailItemList
          empty='No mechanics have been added.'
          items={[
            ...(equipment.charges
              ? [
                  {
                    id: equipment.charges.id,
                    title: 'Charges',
                    meta: formatEnumLabel(equipment.charges.resetKind)
                  }
                ]
              : []),
            ...(equipment.effects ?? []).map((effect, index) => ({
              id: effect.id,
              title: `Effect ${index + 1}`,
              meta: formatEnumLabel(effect.invocation.triggerCode),
              description: `${formatCount(effect.paths.length, 'outcome path')} configured.`
            })),
            ...(equipment.modifiers ?? []).map((modifier, index) => ({
              id: modifier.id,
              title: 'Modifier',
              meta: `Modifier ${index + 1}`
            }))
          ]}
        />
      )
    },
    {
      id: 'features',
      title: 'Features',
      content: <AuthoredDetailItemList empty='No equipment features have been added.' items={toDetailItems(equipment.features)} />
    }
  ]
}
