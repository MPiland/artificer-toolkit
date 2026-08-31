import { Alert, Badge, Button, Group, Select, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  encounterGmProjectionDtoSchema,
  type EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type { CampaignDetailDto, CampaignSessionDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignEncounters, getEncounterBlueprints } from '#app/data/encounters/queries'
import { queryKeys } from '#app/lib/queryKeys'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'
import { CampaignEncounterWorkspace } from './CampaignEncounterWorkspace'
import * as sharedStyles from '../campaigns.css'
import * as sessionsStyles from '../campaignSessions.css'

export function CampaignSessionEncounters({
  campaign,
  currentUserId,
  session,
  mode
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  session: CampaignSessionDto
  mode: 'PREPARE' | 'RUN'
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const encounters = useQuery(getCampaignEncounters(campaign.id))
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null)
  const [encounterAdderOpen, setEncounterAdderOpen] = useState(false)
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null)
  const blueprints = useQuery({
    ...getEncounterBlueprints(campaign.gameSystemId),
    enabled: campaign.status === 'ACTIVE' && encounterAdderOpen
  })
  const sessionEncounters = (encounters.data ?? []).flatMap((candidate) => {
    const parsed = encounterGmProjectionDtoSchema.safeParse(candidate)
    return parsed.success && parsed.data.sessionId === session.id ? [parsed.data] : []
  })
  const activeEncounter = sessionEncounters.find((candidate) => candidate.status === 'ACTIVE')
  const ordered = activeEncounter
    ? [
        activeEncounter,
        ...sessionEncounters.filter((candidate) => candidate.id !== activeEncounter.id)
      ]
    : sessionEncounters
  const selected = ordered.find((candidate) => candidate.id === selectedEncounterId) ?? ordered[0]
  const addEncounter = useMutation({
    mutationFn: (blueprintId: string) =>
      api.encounters.create({
        campaignId: campaign.id,
        sessionId: session.id,
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
      {encounters.error ? <Alert color='red'>Session encounters couldn’t be loaded.</Alert> : null}
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
            <Badge color={selected.status === 'ACTIVE' ? 'green' : 'gray'} variant='light'>
              {encounterStatusLabel(selected.status)}
            </Badge>
          </Group>
          <CampaignEncounterWorkspace
            campaign={campaign}
            currentUserId={currentUserId}
            encounter={selected}
            sessionOpen={session.status === 'OPEN'}
            onUpdated={(updated) => setSelectedEncounterId(updated.id)}
          />
        </Stack>
      ) : !encounters.isPending && !encounters.error ? (
        <Text c='dimmed'>No encounters have been added to this Session.</Text>
      ) : null}
      {campaign.status === 'ACTIVE' ? (
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
              disabled={session.status !== 'OPEN'}
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

function encounterStatusLabel(status: EncounterGmProjectionDto['status']) {
  if (status === 'PREPARED') return 'Ready'
  if (status === 'ACTIVE') return 'In progress'
  return 'Completed'
}
