import { Alert, Button, Loader, Select, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CampaignContentShareDto, CampaignDetailDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { loadPagedAuthoredCatalogItems } from '#app/data/authoredCatalogPages'
import { getCampaignContent, getCampaignVehicles } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import * as styles from './CampaignVehicles.css'

export function CampaignVehicles({ campaign }: { campaign: CampaignDetailDto }) {
  const queryClient = useQueryClient()
  const vehicles = useQuery(getCampaignVehicles(campaign.id))
  const content = useQuery(getCampaignContent(campaign.id))
  const masterVehicles = useQuery({
    queryKey: [...queryKeys.content.vehicles.list(), 'campaign-master-options'],
    queryFn: async () =>
      (
        await loadPagedAuthoredCatalogItems(api.content.vehicles.list, {
          direction: 'FORWARD',
          limit: 48,
          sort: 'name'
        })
      )
        .filter((vehicle) => vehicle.provenance.kind === 'MASTER')
        .map((vehicle) => ({ value: vehicle.id, label: vehicle.label }))
  })
  const [vehicleDefinitionId, setVehicleDefinitionId] = useState<string | null>(null)
  const sharedVehicles = (content.data ?? []).filter((share) => share.subjectKind === 'VEHICLE')
  const vehicleOptions = [
    ...(masterVehicles.data ?? []),
    ...sharedVehicles.map((share) => ({
      value: share.subjectId,
      label: contentLabel(share)
    }))
  ]
  const create = useMutation({
    mutationFn: () =>
      api.campaigns.vehicles.create({
        campaignId: campaign.id,
        vehicleDefinitionId: vehicleDefinitionId!,
        label: null
      }),
    onSuccess: async () => {
      setVehicleDefinitionId(null)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.vehicles(campaign.id)
      })
    }
  })
  const remove = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.campaigns.vehicles.delete({
        campaignId: campaign.id,
        vehicleId: id,
        expectedVersion: version
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.vehicles(campaign.id)
      })
  })
  const editable = campaign.role === 'OWNER' && campaign.status === 'ACTIVE'

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
      {vehicles.isPending ? <Loader aria-label='Loading Campaign vehicles' size='sm' /> : null}
      {vehicles.error ? <Alert color='red'>Campaign vehicles couldn’t be loaded.</Alert> : null}
      <Stack gap={0}>
        {vehicles.data?.map((vehicle) => (
          <div className={styles.row} key={vehicle.id}>
            <Text fw={700}>
              {vehicle.label ??
                vehicleOptions.find((option) => option.value === vehicle.vehicleDefinitionId)
                  ?.label ??
                'Campaign Vehicle'}
            </Text>
            {editable ? (
              <Button
                color='red'
                disabled={remove.isPending}
                size='compact-sm'
                variant='subtle'
                onClick={() => remove.mutate(vehicle)}
              >
                Remove
              </Button>
            ) : null}
          </div>
        ))}
      </Stack>
      {!vehicles.isPending && vehicles.data?.length === 0 ? (
        <Text c='dimmed'>No Campaign vehicles.</Text>
      ) : null}
      {editable ? (
        <div className={styles.picker}>
          <Select
            className={styles.select}
            data={vehicleOptions}
            label='Current Vehicle'
            placeholder={vehicleOptions.length ? 'Choose a Vehicle' : 'No available Vehicles'}
            searchable
            value={vehicleDefinitionId}
            onChange={setVehicleDefinitionId}
          />
          <Button
            disabled={!vehicleDefinitionId}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Add vehicle
          </Button>
        </div>
      ) : null}
      {masterVehicles.error || create.error || remove.error ? (
        <Alert color='red'>The Vehicle change couldn’t be saved.</Alert>
      ) : null}
    </section>
  )
}

function contentLabel(share: CampaignContentShareDto) {
  const document = share.document
  if (
    document &&
    typeof document === 'object' &&
    !Array.isArray(document) &&
    'label' in document &&
    typeof document.label === 'string'
  )
    return document.label
  return 'Campaign Vehicle'
}
