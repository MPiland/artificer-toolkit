import { Alert, Badge, Button, Group, Modal, Select, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useState } from 'react'
import {
  encounterGmProjectionDtoSchema,
  type EncounterGmProjectionDto,
  type EncounterSummaryDto
} from '@artificer-toolkit/schema/api/encounters'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { LiveCampaignSummaryDto } from '@artificer-toolkit/schema/api/liveSessions'
import {
  getCampaignEncounters,
  getEncounter,
  useEncounterBlueprints
} from '#app/data/encounters/queries'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'
import { CampaignEncounterWorkspace } from './CampaignEncounterWorkspace'
import { mergeEncounterSummary } from '../vtt/liveCampaignSummary'
import * as sharedStyles from '../campaigns.css'
import * as sessionsStyles from '../campaignSessions.css'

export function CampaignEncounters({
  campaign,
  currentUserId,
  liveSummary,
  mode
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  /** The room's summary while the table runs; its ACTIVE Run replaces Convex's status and round. */
  liveSummary: LiveCampaignSummaryDto | null
  mode: 'PREPARE' | 'RUN'
}) {
  const navigate = useNavigate()
  const convex = useConvex()
  const encounters = useQuery(getCampaignEncounters(campaign.id))
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null)
  const [encounterAdderOpen, setEncounterAdderOpen] = useState(false)
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const canManage = campaign.capabilities.manageActiveCampaign
  const blueprints = useEncounterBlueprints(campaign.gameSystemId, canManage && encounterAdderOpen)
  const summaries = (encounters.data ?? []).map((summary) =>
    mergeEncounterSummary(liveSummary, summary)
  )
  const selected =
    summaries.find((candidate) => candidate.id === selectedEncounterId) ?? summaries[0]
  const selectedEncounter = useQuery({
    ...getEncounter(selected?.id ?? null),
    select: encounterGmProjectionDtoSchema.parse
  })
  const addEncounter = useMutation({
    mutationFn: async (blueprintId: string) =>
      encounterGmProjectionDtoSchema.parse(
        await convex.mutation(convexApi.encounters.runs.create, {
          campaignId: campaign.id,
          blueprintId,
          commandId: crypto.randomUUID()
        })
      ),
    onSuccess: (created) => {
      setSelectedEncounterId(created.id)
      setSelectedBlueprintId(null)
      setEncounterAdderOpen(false)
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
    onSuccess: () => {
      setDeleteConfirmOpen(false)
      setSelectedEncounterId(null)
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
            {summaries.length > 1 ? (
              <Select
                className={sessionsStyles.sessionEncounterSelect}
                classNames={{ input: sharedStyles.input }}
                data={summaries.map((encounter) => ({
                  label: encounter.name,
                  value: encounter.id
                }))}
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
          {selectedEncounter.isPending ? <Text c='dimmed'>Loading encounter…</Text> : null}
          {selectedEncounter.error ? (
            <Alert color='red'>That encounter couldn’t be loaded.</Alert>
          ) : null}
          {selectedEncounter.data ? (
            <CampaignEncounterWorkspace
              campaign={campaign}
              currentUserId={currentUserId}
              encounter={selectedEncounter.data}
              onUpdated={(updated) => setSelectedEncounterId(updated.id)}
            />
          ) : null}
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
                  disabled={!selectedEncounter.data}
                  loading={deleteEncounter.isPending}
                  onClick={() =>
                    selectedEncounter.data && deleteEncounter.mutate(selectedEncounter.data)
                  }
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
              {!blueprints.isPending && !blueprints.data?.length ? (
                <Text c='dimmed' size='sm'>
                  No saved encounters yet. Build one to add it here.
                </Text>
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

function encounterStatusLabel(status: EncounterSummaryDto['status']) {
  if (status === 'PREPARED') return 'Ready'
  if (status === 'ACTIVE') return 'In progress'
  return 'Completed'
}
