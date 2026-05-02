import { useState } from 'react'
import { Alert, Button, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import {
  vehicleAuthoringInputDtoSchema,
  type AuthoredDraftDto,
  type VehicleAuthoringInputDto,
  type VehicleResponseDto
} from '@artificer-toolkit/schema'
import {
  AuthoredDetailEmptyBlock,
  AuthoredDetailItemList,
  AuthoredDetailLayout,
  AuthoredDetailProse,
  buildAuthoredDetailNotice,
  buildDetailStatusLabels,
  compactAuthoredDetailActions,
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

export function VehicleDetailPage({
  draft,
  response,
  vehicleId
}: {
  draft: AuthoredDraftDto | null
  response: VehicleResponseDto
  vehicleId: string
}) {
  const navigate = useNavigate()
  const [viewActive, setViewActive] = useState(false)
  const detailState = resolveAuthoredDetailState<VehicleAuthoringInputDto>({
    draft,
    response,
    schema: vehicleAuthoringInputDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    discard: api.content.vehicles.discardDraft,
    detailQueryKey: queryKeys.content.vehicles.detail(vehicleId),
    domainLabel: 'Vehicle',
    domainQueryKey: queryKeys.content.vehicles.all(),
    draftQueryKey: queryKeys.content.vehicles.draft(vehicleId),
    duplicate: api.content.vehicles.duplicate,
    hasActiveContent: Boolean(detailState.activeItem),
    id: vehicleId,
    navigateEdit: async (id) => navigate({ to: '/vehicles/$vehicleId/edit', params: { vehicleId: id } }),
    navigateList: async () => navigate({ to: '/vehicles' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <Stack>
        <Alert color='yellow'>This vehicle draft cannot be previewed. Discard it to return to the vehicle list.</Alert>
        <Button loading={actions.isDiscardingDraft} onClick={() => void actions.discardDraft({ backToList: true })}>
          Discard draft
        </Button>
      </Stack>
    )
  }

  if (!detailState.item) {
    return (
      <Stack>
        <Alert color='yellow'>That vehicle could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/vehicles' })}>Back to vehicles</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const pageActions = compactAuthoredDetailActions([
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/vehicles/new' }) },
    detailState.mode === 'draft'
      ? { label: 'Resume Draft', tone: 'primary', onClick: () => navigate({ to: '/vehicles/$vehicleId/edit', params: { vehicleId } }) }
      : detailState.permissions.canEdit
        ? { label: 'Edit', tone: 'primary', onClick: () => navigate({ to: '/vehicles/$vehicleId/edit', params: { vehicleId } }) }
        : null,
    detailState.permissions.canCopy
      ? { label: 'Duplicate', tone: 'secondary', disabled: actions.isDuplicating, onClick: () => void actions.duplicateToDraft() }
      : null
  ])

  return (
    <AuthoredDetailLayout
      actions={pageActions}
      description={summarizeHtml(item.description, 'A vehicle reference entry ready for table use.')}
      eyebrow='Vehicle'
      facts={getVehicleFacts(item)}
      notice={buildAuthoredDetailNotice({
        canViewActive: Boolean(detailState.activeItem && detailState.draftItem),
        domainLabel: 'Vehicle',
        hasInvalidDraft: detailState.hasInvalidDraft,
        isViewingActive: viewActive,
        mode: detailState.mode,
        onDiscard: () => void actions.discardDraft(),
        onViewActive: () => setViewActive(true),
        onViewDraft: () => setViewActive(false)
      })}
      sections={getVehicleSections(item)}
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

function getVehicleFacts(vehicle: VehicleAuthoringInputDto): AuthoredDetailFact[] {
  return [
    { label: 'Category', value: formatEnumLabel(vehicle.category) },
    { label: 'Size', value: formatReference(vehicle.size, 'Size selected') },
    { label: 'Armor Class', value: formatNumber(vehicle.armorClass) },
    { label: 'Hit Points', value: formatNumber(vehicle.hitPoints) },
    { label: 'Speed', value: vehicle.speed ? `${vehicle.speed} ft.` : vehicle.speedNote ?? 'Not set' },
    { label: 'Properties', value: formatReferenceList(vehicle.properties, 'property') }
  ]
}

function getVehicleSections(vehicle: VehicleAuthoringInputDto): AuthoredDetailSectionModel[] {
  return [
    {
      id: 'description',
      title: 'Description',
      content: <AuthoredDetailProse html={vehicle.description} />
    },
    {
      id: 'capacity',
      title: 'Capacity & Economy',
      content: (
        <AuthoredDetailItemList
          empty='No capacity or economy details have been added.'
          items={[
            {
              id: 'crew',
              title: 'Crew',
              description: vehicle.crewMin || vehicle.crewMax
                ? `${formatNumber(vehicle.crewMin)} minimum, ${formatNumber(vehicle.crewMax)} maximum`
                : undefined
            },
            {
              id: 'passengers',
              title: 'Passenger Capacity',
              description: formatNumber(vehicle.passengerCapacity)
            },
            {
              id: 'cargo',
              title: 'Cargo Capacity',
              description: vehicle.cargoCapacity
            },
            {
              id: 'cost',
              title: 'Cost',
              description: vehicle.cost ? `${vehicle.cost.amount} currency` : undefined
            }
          ].filter((item) => item.description && item.description !== 'Not set')}
        />
      )
    },
    {
      id: 'details',
      title: 'Details',
      content: <AuthoredDetailItemList empty='No vehicle details have been added.' items={toDetailItems(vehicle.details)} />
    },
    {
      id: 'features',
      title: 'Features',
      content: <AuthoredDetailItemList empty='No vehicle features have been added.' items={toDetailItems(vehicle.features)} />
    },
    {
      id: 'properties',
      title: 'Properties',
      content: vehicle.properties?.length
        ? (
            <AuthoredDetailItemList
              empty='No vehicle properties have been added.'
              items={vehicle.properties.map((property) => ({
                id: property,
                title: formatReference(property, 'Property')
              }))}
            />
          )
        : <AuthoredDetailEmptyBlock>No vehicle properties have been added.</AuthoredDetailEmptyBlock>
    }
  ]
}
