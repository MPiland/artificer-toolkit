import { Alert, Button, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { vehicleAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import {
  type AuthoredDraftDto,
  type VehicleResponseDto
} from '@artificer-toolkit/schema/api/content'
import { type VehicleAuthoringInputDto } from '@artificer-toolkit/schema/subjects/vehicle'
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
  formatReference,
  formatReferenceList,
  hasDetailText,
  resolveAuthoredDetailState,
  toDetailItems,
  useAuthoredDetailActions,
  useAuthoredExportAction,
  type AuthoredDetailFact,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildVehicleRouteParams } from '#app/routing/authoredRouteParams'
import * as styles from './VehicleDetailPage.css'

type VehicleMetric = {
  id: string
  label: string
  value: string
  note?: string
}

export function VehicleDetailPage({
  draft,
  response,
  vehicleId,
  view
}: {
  draft: AuthoredDraftDto | null
  response: VehicleResponseDto
  vehicleId: string
  view: 'active' | 'draft'
}) {
  const navigate = useNavigate()
  const viewActive = view === 'active'
  const detailState = resolveAuthoredDetailState<VehicleAuthoringInputDto>({
    draft,
    response,
    schema: vehicleAuthoringInputDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    deleteActive: api.content.vehicles.deleteActive,
    discard: api.content.vehicles.discardDraft,
    detailSubjectQueryKey: queryKeys.content.vehicles.detailRoot(vehicleId),
    domainLabel: 'Vehicle',
    domainQueryKey: queryKeys.content.vehicles.all(),
    draftQueryKey: queryKeys.content.vehicles.draft(vehicleId),
    duplicate: api.content.vehicles.duplicate,
    hasActiveContent: detailState.hasActiveContent,
    id: vehicleId,
    navigateEdit: async (subject) =>
      navigate({
        params: buildVehicleRouteParams(subject.publicId, subject.label),
        to: '/vehicles/$vehiclePublicId/$vehicleSlug/edit'
      }),
    navigateList: async () => navigate({ to: '/vehicles' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <>
        <Stack>
          <Alert color='yellow'>
            This vehicle draft cannot be previewed. Delete it to return to the vehicle list.
          </Alert>
          <Button
            color='red'
            loading={actions.isDeleting}
            onClick={() =>
              actions.deleteContent({
                id: vehicleId,
                kind: 'draft',
                label: detailState.draft?.label ?? 'vehicle draft'
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
        <Alert color='yellow'>That vehicle could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/vehicles' })}>Back to vehicles</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const vehicleParams = buildVehicleRouteParams(
    draft?.publicId ?? response?.publicId ?? vehicleId,
    item.label
  )
  const exportAction = useAuthoredExportAction({
    canExport: detailState.provenance.kind === 'OWNED' && detailState.permissions.canEdit,
    id: vehicleId,
    label: item.label,
    subjectKind: 'VEHICLE',
    view: detailState.mode === 'draft' ? 'draft' : 'active'
  })
  const pageActions = compactAuthoredDetailActions([
    detailState.mode === 'draft'
      ? {
          label: 'Resume Draft',
          tone: 'primary',
          onClick: () =>
            navigate({ to: '/vehicles/$vehiclePublicId/$vehicleSlug/edit', params: vehicleParams })
        }
      : detailState.permissions.canEdit
        ? {
            label: 'Edit',
            tone: 'primary',
            onClick: () =>
              navigate({
                to: '/vehicles/$vehiclePublicId/$vehicleSlug/edit',
                params: vehicleParams
              })
          }
        : null,
    detailState.mode === 'active' && detailState.draft
      ? {
          label: 'View Draft',
          tone: 'secondary',
          onClick: () =>
            navigate({
              to: '/vehicles/$vehiclePublicId/$vehicleSlug',
              params: vehicleParams,
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
              id: vehicleId,
              kind: detailState.mode === 'draft' ? 'draft' : 'active',
              label: item.label
            })
        }
      : null,
    exportAction,
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/vehicles/new' }) }
  ])

  return (
    <>
      <AuthoredDetailLayout
        actions={pageActions}
        actionsDisabled={actions.isDetailOperationPending}
        artworkTarget={{
          lookup: {
            type: 'AUTHORED_IMAGE',
            subjectKind: 'VEHICLE',
            subjectId: vehicleId,
            scope: detailState.mode === 'draft' ? 'DRAFT' : 'ACTIVE'
          },
          attach: { type: 'AUTHORED_IMAGE', subjectKind: 'VEHICLE', subjectId: vehicleId }
        }}
        eyebrow='Vehicle'
        facts={getVehicleFacts(item)}
        notice={buildAuthoredDetailNotice({
          canViewActive: detailState.canViewActive,
          domainLabel: 'Vehicle',
          hasInvalidDraft: detailState.hasInvalidDraft,
          isViewingActive: viewActive,
          mode: detailState.mode,
          onDiscard: () => void actions.discardDraft(),
          onViewActive: () =>
            navigate({ to: '/vehicles/$vehiclePublicId/$vehicleSlug', params: vehicleParams }),
          onViewDraft: () =>
            navigate({
              to: '/vehicles/$vehiclePublicId/$vehicleSlug',
              params: vehicleParams,
              search: { view: 'draft' }
            })
        })}
        pendingOperation={actions.pendingOperation}
        sections={getVehicleSections(item, response?.meta?.currencies ?? [])}
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

function getVehicleFacts(vehicle: VehicleAuthoringInputDto): AuthoredDetailFact[] {
  return [
    { label: 'Category', value: formatEnumLabel(vehicle.category) },
    { label: 'Size', value: formatReference(vehicle.size, 'Size selected') },
    { label: 'Armor Class', value: formatNumber(vehicle.armorClass) },
    { label: 'Hit Points', value: formatNumber(vehicle.hitPoints) },
    {
      label: 'Speed',
      value: vehicle.speed ? `${vehicle.speed} ft.` : (vehicle.speedNote ?? 'Not set')
    },
    { label: 'Properties', value: formatReferenceList(vehicle.properties, 'property') }
  ]
}

function getVehicleSections(
  vehicle: VehicleAuthoringInputDto,
  currencies: NonNullable<NonNullable<VehicleResponseDto>['meta']>['currencies'] = []
): AuthoredDetailSectionModel[] {
  const capacityItems: VehicleMetric[] = [
    {
      id: 'crew',
      label: 'Crew',
      value:
        vehicle.crewMin !== undefined || vehicle.crewMax !== undefined
          ? `${formatNumber(vehicle.crewMin ?? 0)} - ${formatNumber(vehicle.crewMax ?? vehicle.crewMin ?? 0)}`
          : '',
      note:
        vehicle.crewMin !== undefined || vehicle.crewMax !== undefined
          ? 'Minimum to maximum operators'
          : undefined
    },
    {
      id: 'passengers',
      label: 'Passengers',
      value: vehicle.passengerCapacity !== undefined ? formatNumber(vehicle.passengerCapacity) : ''
    },
    {
      id: 'cargo',
      label: 'Cargo',
      value: vehicle.cargoCapacity ?? ''
    },
    {
      id: 'cost',
      label: 'Cost',
      value: vehicle.cost ? formatVehicleCost(vehicle.cost, currencies) : ''
    }
  ].filter((item) => item.value && item.value !== 'Not set')
  const detailItems = toDetailItems(vehicle.details)
  const featureItems = toDetailItems(vehicle.features).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description
  }))
  const propertyItems = (vehicle.properties ?? []).map((property) => ({
    id: property,
    title: formatReference(property, 'Property')
  }))

  return compactAuthoredDetailSections([
    hasDetailText(vehicle.description)
      ? {
          id: 'description',
          title: 'Description',
          content: <AuthoredDetailProse html={vehicle.description} />
        }
      : null,
    capacityItems.length
      ? {
          id: 'capacity',
          title: 'Capacity & Economy',
          content: <VehicleCapacityEconomy metrics={capacityItems} />
        }
      : null,
    detailItems.length
      ? {
          id: 'details',
          title: 'Details',
          content: (
            <AuthoredDetailItemList
              empty='No vehicle details have been added.'
              items={detailItems}
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
              empty='No vehicle features have been added.'
              items={featureItems}
            />
          )
        }
      : null,
    propertyItems.length
      ? {
          id: 'properties',
          title: 'Properties',
          content: (
            <AuthoredDetailItemList
              empty='No vehicle properties have been added.'
              items={propertyItems}
            />
          )
        }
      : null
  ])
}

function VehicleCapacityEconomy({ metrics }: { metrics: VehicleMetric[] }) {
  return (
    <div className={styles.metricGrid}>
      {metrics.map((metric) => (
        <div className={styles.metricCell} key={metric.id}>
          <span className={styles.metricLabel}>{metric.label}</span>
          <strong className={styles.metricValue}>{metric.value}</strong>
          {metric.note ? <span className={styles.metricNote}>{metric.note}</span> : null}
        </div>
      ))}
    </div>
  )
}

function formatVehicleCost(
  cost: NonNullable<VehicleAuthoringInputDto['cost']>,
  currencies: NonNullable<NonNullable<VehicleResponseDto>['meta']>['currencies']
) {
  const currency =
    currencies?.find((option) => option.value === cost.currencyId)?.label ?? cost.currencyId
  return `${new Intl.NumberFormat('en-US').format(cost.amount)} ${currency}`
}
