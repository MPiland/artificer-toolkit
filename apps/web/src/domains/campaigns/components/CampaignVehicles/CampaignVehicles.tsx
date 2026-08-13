import { Alert, Button, Loader, Select, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CampaignContentBindingDto, CampaignDetailDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignContent, getCampaignVehicles } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import * as styles from './CampaignVehicles.css'

export function CampaignVehicles({ campaign }: { campaign: CampaignDetailDto }) {
  const queryClient = useQueryClient()
  const vehicles = useQuery(getCampaignVehicles(campaign.id))
  const content = useQuery(getCampaignContent(campaign.id))
  const [contentVersionId, setContentVersionId] = useState<string | null>(null)
  const approved = (content.data ?? []).filter(
    (binding) => binding.subjectKind === 'VEHICLE' && binding.status === 'APPROVED'
  )
  const create = useMutation({
    mutationFn: () =>
      api.campaigns.vehicles.create({
        campaignId: campaign.id,
        contentVersionId: contentVersionId!,
        label: null
      }),
    onSuccess: async () => {
      setContentVersionId(null)
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
          Pinned Campaign vehicles have their own inventory custody.
        </Text>
      </div>
      {vehicles.isPending ? <Loader aria-label='Loading Campaign vehicles' size='sm' /> : null}
      {vehicles.error ? <Alert color='red'>Campaign vehicles couldn’t be loaded.</Alert> : null}
      <Stack gap={0}>
        {vehicles.data?.map((vehicle) => (
          <div className={styles.row} key={vehicle.id}>
            <Text fw={700}>
              {vehicle.label ?? contentLabel(content.data, vehicle.contentVersionId)}
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
        <Text c='dimmed'>No vehicles pinned.</Text>
      ) : null}
      {editable ? (
        <div className={styles.picker}>
          <Select
            className={styles.select}
            data={approved.map((binding) => ({
              value: binding.id,
              label: bindingLabel(binding)
            }))}
            label='Approved Vehicle revision'
            placeholder={approved.length ? 'Choose a Vehicle' : 'No approved Vehicles'}
            searchable
            value={contentVersionId}
            onChange={setContentVersionId}
          />
          <Button
            disabled={!contentVersionId}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Pin vehicle
          </Button>
        </div>
      ) : null}
      {create.error || remove.error ? (
        <Alert color='red'>The Vehicle change couldn’t be saved.</Alert>
      ) : null}
    </section>
  )
}

function contentLabel(content: CampaignContentBindingDto[] | undefined, id: string) {
  const binding = content?.find((candidate) => candidate.id === id)
  return binding ? bindingLabel(binding) : 'Campaign Vehicle'
}

function bindingLabel(binding: CampaignContentBindingDto) {
  const snapshot = binding.snapshot
  if (
    snapshot &&
    typeof snapshot === 'object' &&
    !Array.isArray(snapshot) &&
    'label' in snapshot &&
    typeof snapshot.label === 'string'
  )
    return snapshot.label
  return `Vehicle revision ${binding.version}`
}
