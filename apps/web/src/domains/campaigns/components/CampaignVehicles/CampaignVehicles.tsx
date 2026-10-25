import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  Title
} from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useLoadAllPages } from '#app/data/useLoadAllPages'
import type {
  CampaignVehicleDto,
  CampaignVehicleLifecycleInput
} from '@artificer-toolkit/schema/api/campaignVehicles'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { usePaginatedQuery as useCandidatePaginatedQuery } from 'convex-helpers/react'
import { useConvex, useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { campaignVehicleShareLabel } from './campaignVehicleLabels'
import * as styles from './CampaignVehicles.css'

export function CampaignVehicles({ campaign }: { campaign: CampaignDetailDto }) {
  const convex = useConvex()
  const vehicles = usePaginatedQuery(
    convexApi.campaigns.vehicles.list,
    { campaignId: campaign.id },
    { initialNumItems: 48 }
  )
  const definitionOptions = useCandidatePaginatedQuery(
    convexApi.campaigns.vehicles.definitionOptions,
    { campaignId: campaign.id },
    { initialNumItems: 48 }
  )
  const sharedVehicles = useCandidatePaginatedQuery(
    convexApi.campaigns.contentShares.list,
    { campaignId: campaign.id },
    { initialNumItems: 48 }
  )
  const createVehicle = useConvexMutation(convexApi.campaigns.vehicles.create)
  const lifecycleVehicle = useConvexMutation(convexApi.campaigns.vehicles.lifecycle)
  const [vehicleDefinitionId, setVehicleDefinitionId] = useState<string | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<CampaignVehicleDto | null>(null)
  const [lifecycleRequest, setLifecycleRequest] = useState<CampaignVehicleLifecycleInput | null>(
    null
  )
  const [preparingLifecycle, setPreparingLifecycle] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  useLoadAllPages(definitionOptions, 48)
  useLoadAllPages(sharedVehicles, 48)

  const vehicleOptions = [
    ...definitionOptions.results.map((vehicle) => ({ value: vehicle.id, label: vehicle.label })),
    ...sharedVehicles.results
      .filter((share) => share.subjectKind === 'VEHICLE')
      .map((share) => ({
        value: share.subjectId,
        label: campaignVehicleShareLabel(share)
      }))
  ]
  const create = useMutation({
    mutationFn: () =>
      createVehicle({
        campaignId: campaign.id,
        vehicleDefinitionId: vehicleDefinitionId!,
        label: null
      }),
    onSuccess: () => {
      setVehicleDefinitionId(null)
    }
  })
  const lifecycle = useMutation({
    mutationFn: (input: CampaignVehicleLifecycleInput) => lifecycleVehicle({ input }),
    onSuccess: () => {
      setLifecycleRequest(null)
      setRequestError(null)
      setSelectedVehicle(null)
    }
  })
  const editable = campaign.capabilities.manageActiveCampaign
  const pickerReady =
    definitionOptions.status === 'Exhausted' && sharedVehicles.status === 'Exhausted'

  async function startLifecycle(
    vehicle: CampaignVehicleDto,
    action: CampaignVehicleLifecycleInput['action']
  ) {
    if (preparingLifecycle || lifecycle.isPending) return
    setPreparingLifecycle(true)
    setRequestError(null)
    try {
      const inventoryVersion =
        action === 'REMOVE_RETURN_CARGO' || action === 'REMOVE_DESTROY_CARGO'
          ? (
              await convex.query(convexApi.campaigns.vehicleInventory.items, {
                campaignId: campaign.id,
                vehicleId: vehicle.id,
                paginationOpts: { cursor: null, numItems: 1 }
              })
            ).version
          : undefined
      const common = {
        campaignId: campaign.id,
        vehicleId: vehicle.id,
        expectedVersion: vehicle.version,
        idempotencyKey: crypto.randomUUID()
      }
      const input =
        action === 'REMOVE_RETURN_CARGO'
          ? {
              ...common,
              action,
              expectedInventoryVersion: inventoryVersion!,
              expectedPartyInventoryVersion: (
                await convex.query(convexApi.campaigns.partyInventory.items, {
                  campaignId: campaign.id,
                  paginationOpts: { cursor: null, numItems: 1 }
                })
              ).version
            }
          : action === 'REMOVE_DESTROY_CARGO'
            ? { ...common, action, expectedInventoryVersion: inventoryVersion! }
            : { ...common, action }
      setLifecycleRequest(input)
      lifecycle.mutate(input)
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : 'Vehicle change couldn’t be prepared.'
      )
    } finally {
      setPreparingLifecycle(false)
    }
  }

  return (
    <section className={styles.panel} aria-labelledby='campaign-vehicles-title'>
      <div>
        <Title id='campaign-vehicles-title' order={2}>
          Vehicles
        </Title>
        <Text c='dimmed' size='sm'>
          Campaign vehicles have their own inventory custody.
        </Text>
      </div>
      {vehicles.status === 'LoadingFirstPage' ? (
        <Loader aria-label='Loading Campaign vehicles' size='sm' />
      ) : null}
      <Stack gap={0}>
        {vehicles.results.map((vehicle) => (
          <div className={styles.row} key={vehicle.id}>
            <div>
              <Group gap='xs'>
                <Text fw={700}>
                  {vehicle.label ??
                    vehicleOptions.find((option) => option.value === vehicle.vehicleDefinitionId)
                      ?.label ??
                    'Campaign Vehicle'}
                </Text>
                {vehicle.availability === 'UNAVAILABLE' ? (
                  <Badge color='yellow'>Unavailable</Badge>
                ) : null}
              </Group>
              {vehicle.availability === 'UNAVAILABLE' ? (
                <Text c='dimmed' size='sm'>
                  Unavailable vehicles remain visible to the Campaign owner and cannot be accessed
                  by players.
                </Text>
              ) : null}
            </div>
            {editable ? (
              <Group gap='xs'>
                {vehicle.availability === 'UNAVAILABLE' ? (
                  <Button
                    disabled={preparingLifecycle || lifecycle.isPending}
                    size='compact-sm'
                    variant='subtle'
                    onClick={() => void startLifecycle(vehicle, 'RESTORE')}
                  >
                    Restore
                  </Button>
                ) : (
                  <Button
                    disabled={preparingLifecycle || lifecycle.isPending}
                    size='compact-sm'
                    variant='subtle'
                    onClick={() => void startLifecycle(vehicle, 'MAKE_UNAVAILABLE')}
                  >
                    Mark unavailable
                  </Button>
                )}
                <Button
                  color='red'
                  disabled={preparingLifecycle || lifecycle.isPending}
                  size='compact-sm'
                  variant='subtle'
                  onClick={() => {
                    setLifecycleRequest(null)
                    setRequestError(null)
                    setSelectedVehicle(vehicle)
                  }}
                >
                  Remove
                </Button>
              </Group>
            ) : null}
          </div>
        ))}
      </Stack>
      {vehicles.status === 'Exhausted' && vehicles.results.length === 0 ? (
        <Text c='dimmed'>No Campaign vehicles.</Text>
      ) : null}
      {vehicles.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => vehicles.loadMore(48)}>
          Load more vehicles
        </Button>
      ) : null}
      {vehicles.status === 'LoadingMore' ? (
        <Loader aria-label='Loading more Campaign vehicles' size='sm' />
      ) : null}
      {editable ? (
        <div className={styles.picker}>
          <Select
            className={styles.select}
            data={vehicleOptions}
            disabled={!pickerReady}
            label='Current Vehicle'
            placeholder={pickerReady ? 'Choose a Vehicle' : 'Loading available Vehicles'}
            searchable
            value={vehicleDefinitionId}
            onChange={setVehicleDefinitionId}
          />
          <Button
            disabled={!vehicleDefinitionId || !pickerReady}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Add vehicle
          </Button>
        </div>
      ) : null}
      {create.error || lifecycle.error || requestError ? (
        <Alert color='red'>
          {requestError ?? create.error?.message ?? lifecycle.error?.message}
          {lifecycleRequest && !preparingLifecycle && !lifecycle.isPending ? (
            <Button
              ml='sm'
              size='compact-sm'
              variant='subtle'
              onClick={() => lifecycle.mutate(lifecycleRequest)}
            >
              Retry vehicle change
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <Modal
        centered
        opened={selectedVehicle !== null}
        title='Remove Campaign vehicle'
        onClose={() => {
          if (preparingLifecycle || lifecycle.isPending) return
          setLifecycleRequest(null)
          setRequestError(null)
          setSelectedVehicle(null)
        }}
      >
        <Stack gap='sm'>
          <Text>
            Choose what happens to every item and coin carried by this vehicle before it is removed.
          </Text>
          <Button
            disabled={!selectedVehicle || preparingLifecycle || lifecycle.isPending}
            loading={lifecycle.isPending}
            onClick={() => {
              const vehicle = vehicles.results.find((item) => item.id === selectedVehicle?.id)
              if (vehicle) void startLifecycle(vehicle, 'REMOVE_RETURN_CARGO')
            }}
          >
            Remove and return cargo to Party
          </Button>
          <Button
            color='red'
            disabled={!selectedVehicle || preparingLifecycle || lifecycle.isPending}
            loading={lifecycle.isPending}
            onClick={() => {
              const vehicle = vehicles.results.find((item) => item.id === selectedVehicle?.id)
              if (vehicle) void startLifecycle(vehicle, 'REMOVE_DESTROY_CARGO')
            }}
          >
            Remove and destroy all cargo and coins
          </Button>
          <Text c='red' size='sm'>
            Destroying cargo permanently removes every item and coin held by this vehicle.
          </Text>
        </Stack>
      </Modal>
    </section>
  )
}
