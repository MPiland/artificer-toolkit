import { Alert, Badge, Button, Group, Modal, Select, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useState } from 'react'
import {
  encounterGmProjectionDtoSchema,
  type EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { getCampaignEncounters, getEncounterBlueprints } from '#app/data/encounters/queries'
import { queryKeys } from '#app/lib/queryKeys'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'
import { CampaignEncounterWorkspace } from './CampaignEncounterWorkspace'
import * as sharedStyles from '../campaigns.css'
import * as sessionsStyles from '../campaignSessions.css'

export function CampaignEncounters({
  campaign,
  currentUserId,
  mode
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  mode: 'PREPARE' | 'RUN'
}) {
  const navigate = useNavigate()
  const convex = useConvex()
  const queryClient = useQueryClient()
  const encounters = useQuery(getCampaignEncounters(campaign.id, convex))
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null)
  const [encounterAdderOpen, setEncounterAdderOpen] = useState(false)
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const canManage = campaign.role === 'OWNER' && campaign.status === 'ACTIVE'
  const blueprints = useQuery({
    ...getEncounterBlueprints(campaign.gameSystemId, convex),
    enabled: canManage && encounterAdderOpen
  })
  const ordered = (encounters.data ?? [])
    .flatMap((candidate) => {
      const parsed = encounterGmProjectionDtoSchema.safeParse(candidate)
      return parsed.success ? [parsed.data] : []
    })
    .sort((left, right) => encounterStatusOrder[left.status] - encounterStatusOrder[right.status])
  const selected = ordered.find((candidate) => candidate.id === selectedEncounterId) ?? ordered[0]
  const addEncounter = useMutation({
    mutationFn: (blueprintId: string) =>
      convex.mutation(convexApi.encounters.runs.create, {
        campaignId: campaign.id,
        blueprintId,
        commandId: crypto.randomUUID()
      }),
    onSuccess: (created) => {
      setSelectedEncounterId(created.id)
      setSelectedBlueprintId(null)
      setEncounterAdderOpen(false)
      queryClient.setQueryData(
        queryKeys.encounters.list(campaign.id),
        (current: typeof encounters.data) => [...(current ?? []), created]
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.encounters.list(campaign.id) })
    }
  })
  const deleteEncounter = useMutation({
    mutationFn: (encounter: EncounterGmProjectionDto) =>
      convex.mutation(convexApi.encounters.runs.deletePrepared, {
        campaignId: campaign.id,
        encounterId: encounter.id,
        commandId: crypto.randomUUID(),
        expectedVersion: encounter.version
      }),
    onSuccess: ({ encounterId }) => {
      setDeleteConfirmOpen(false)
      setSelectedEncounterId(null)
      queryClient.setQueryData(
        queryKeys.encounters.list(campaign.id),
        (current: typeof encounters.data) =>
          current?.filter((candidate) => candidate.id !== encounterId)
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.encounters.list(campaign.id) })
    }
  })

  return (
    <section
      className={sessionsStyles.sessionEncounterPanel}
      aria-labelledby={`session-${mode.toLowerCase()}-encounters`}
    >
      <div>
        <Title id={`session-${mode.toLowerCase()}-encounters`} order={2}>
          Encounters
        </Title>
        <Text c='dimmed' size='sm'>
          {mode === 'PREPARE'
            ? 'Attach saved encounters and prepare their combatants.'
            : 'Run initiative, enemy actions, health, and turn order.'}
        </Text>
      </div>
      {encounters.isPending ? <Text c='dimmed'>Loading encounters…</Text> : null}
      {encounters.error ? <Alert color='red'>Encounters couldn’t be loaded.</Alert> : null}
      {selected ? (
        <Stack gap='md'>
          <Group align='end' justify='space-between' wrap='wrap'>
            {ordered.length > 1 ? (
              <Select
                className={sessionsStyles.sessionEncounterSelect}
                classNames={{ input: sharedStyles.input }}
                data={ordered.map((encounter) => ({ label: encounter.name, value: encounter.id }))}
                label='Encounter'
                value={selected.id}
                onChange={setSelectedEncounterId}
              />
            ) : (
              <Title order={3}>{selected.name}</Title>
            )}
            <Group gap='xs'>
              <Badge color={selected.status === 'ACTIVE' ? 'green' : 'gray'} variant='light'>
                {encounterStatusLabel(selected.status)}
              </Badge>
              {canManage && selected.status === 'PREPARED' ? (
                <Button color='red' variant='subtle' onClick={() => setDeleteConfirmOpen(true)}>
                  Delete encounter
                </Button>
              ) : null}
            </Group>
          </Group>
          <CampaignEncounterWorkspace
            campaign={campaign}
            currentUserId={currentUserId}
            encounter={selected}
            onUpdated={(updated) => setSelectedEncounterId(updated.id)}
          />
          <Modal
            centered
            opened={deleteConfirmOpen}
            title='Delete encounter?'
            onClose={() => setDeleteConfirmOpen(false)}
          >
            <Stack gap='md'>
              <Text>
                Delete {selected.name}? Its prepared combatants will be removed. The saved encounter
                stays available to add again.
              </Text>
              {deleteEncounter.error ? (
                <Alert color='red'>That encounter couldn’t be deleted.</Alert>
              ) : null}
              <Group justify='flex-end'>
                <Button variant='default' onClick={() => setDeleteConfirmOpen(false)}>
                  Keep encounter
                </Button>
                <Button
                  color='red'
                  loading={deleteEncounter.isPending}
                  onClick={() => deleteEncounter.mutate(selected)}
                >
                  Delete encounter
                </Button>
              </Group>
            </Stack>
          </Modal>
        </Stack>
      ) : !encounters.isPending && !encounters.error ? (
        <Text c='dimmed'>No encounters have been added to this Campaign.</Text>
      ) : null}
      {canManage ? (
        <div
          className={sessionsStyles.sessionEncounterAdder}
          data-open={encounterAdderOpen || undefined}
          id={`session-${mode.toLowerCase()}-encounter-adder`}
        >
          {encounterAdderOpen ? (
            <>
              <Group align='end' wrap='wrap'>
                <Select
                  className={sessionsStyles.sessionEncounterSelect}
                  classNames={{ input: sharedStyles.input }}
                  data={(blueprints.data ?? []).map((blueprint) => ({
                    label: `${blueprint.name} · ${blueprint.enemies.length} ${blueprint.enemies.length === 1 ? 'enemy' : 'enemies'}`,
                    value: blueprint.id
                  }))}
                  disabled={blueprints.isPending || !blueprints.data?.length}
                  label='Encounter Blueprint'
                  placeholder={blueprints.isPending ? 'Loading encounters…' : 'Choose an encounter'}
                  searchable
                  value={selectedBlueprintId}
                  onChange={setSelectedBlueprintId}
                />
                <Button
                  disabled={!selectedBlueprintId || addEncounter.isPending}
                  loading={addEncounter.isPending}
                  onClick={() => selectedBlueprintId && addEncounter.mutate(selectedBlueprintId)}
                >
                  Add encounter
                </Button>
                <Button
                  variant='subtle'
                  onClick={() =>
                    navigate({
                      to: '/campaigns/$campaignPublicId/$campaignSlug/encounters',
                      params: buildCampaignRouteParams(campaign.publicId, campaign.name)
                    })
                  }
                >
                  Build new
                </Button>
                <Button
                  variant='subtle'
                  onClick={() => {
                    setEncounterAdderOpen(false)
                    setSelectedBlueprintId(null)
                  }}
                >
                  Cancel
                </Button>
              </Group>
              {!blueprints.isPending && !blueprints.error && !blueprints.data?.length ? (
                <Text c='dimmed' size='sm'>
                  No saved encounters yet. Build one to add it here.
                </Text>
              ) : null}
              {blueprints.error ? (
                <Alert color='red'>Saved encounters couldn’t be loaded.</Alert>
              ) : null}
              {addEncounter.error ? (
                <Alert color='red'>That encounter couldn’t be added.</Alert>
              ) : null}
            </>
          ) : (
            <Button
              aria-controls={`session-${mode.toLowerCase()}-encounter-adder`}
              aria-expanded={false}
              variant='subtle'
              onClick={() => setEncounterAdderOpen(true)}
            >
              Add encounter
            </Button>
          )}
        </div>
      ) : null}
    </section>
  )
}

const encounterStatusOrder: Record<EncounterGmProjectionDto['status'], number> = {
  ACTIVE: 0,
  PREPARED: 1,
  COMPLETED: 2
}

function encounterStatusLabel(status: EncounterGmProjectionDto['status']) {
  if (status === 'PREPARED') return 'Ready'
  if (status === 'ACTIVE') return 'In progress'
  return 'Completed'
}
