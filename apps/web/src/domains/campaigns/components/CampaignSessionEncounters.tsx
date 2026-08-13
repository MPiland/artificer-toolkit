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
import { getCampaignEncounters, getEncounterTemplates } from '#app/data/encounters/queries'
import { getSystemList } from '#app/data/systems/queries'
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null)
  const templates = useQuery({
    ...getEncounterTemplates(campaign.id),
    enabled: campaign.status === 'ACTIVE' && encounterAdderOpen
  })
  const selectedTemplate = templates.data?.find((template) => template.id === selectedTemplateId)
  const needsExplicitSystem =
    selectedTemplate?.enemies.every((enemy) => enemy.systemId === null) === true
  const systems = useQuery({
    ...getSystemList(),
    enabled: encounterAdderOpen && needsExplicitSystem
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
    mutationFn: (templateId: string) =>
      api.encounters.create({
        campaignId: campaign.id,
        sessionId: session.id,
        templateId,
        ...(needsExplicitSystem && selectedSystemId ? { systemId: selectedSystemId } : {}),
        commandId: crypto.randomUUID()
      }),
    onSuccess: (created) => {
      setSelectedEncounterId(created.id)
      setSelectedTemplateId(null)
      setSelectedSystemId(null)
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
                  data={(templates.data ?? []).map((template) => ({
                    label: `${template.name} · ${template.enemies.length} ${template.enemies.length === 1 ? 'enemy' : 'enemies'}`,
                    value: template.id
                  }))}
                  disabled={templates.isPending || !templates.data?.length}
                  label='Saved encounter'
                  placeholder={templates.isPending ? 'Loading encounters…' : 'Choose an encounter'}
                  searchable
                  value={selectedTemplateId}
                  onChange={(value) => {
                    setSelectedTemplateId(value)
                    setSelectedSystemId(null)
                  }}
                />
                {needsExplicitSystem ? (
                  <Select
                    className={sessionsStyles.sessionEncounterSelect}
                    classNames={{ input: sharedStyles.input }}
                    data={(systems.data ?? []).map((system) => ({
                      label: `${system.label} · ${system.rulesetCode} ${system.rulesetVersion}`,
                      value: system.id
                    }))}
                    disabled={systems.isPending || !systems.data?.length}
                    label='Game system'
                    placeholder={systems.isPending ? 'Loading systems…' : 'Choose a system'}
                    searchable
                    value={selectedSystemId}
                    onChange={setSelectedSystemId}
                  />
                ) : null}
                <Button
                  disabled={
                    !selectedTemplateId ||
                    (needsExplicitSystem && !selectedSystemId) ||
                    addEncounter.isPending
                  }
                  loading={addEncounter.isPending}
                  onClick={() => selectedTemplateId && addEncounter.mutate(selectedTemplateId)}
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
                    setSelectedTemplateId(null)
                    setSelectedSystemId(null)
                  }}
                >
                  Cancel
                </Button>
              </Group>
              {!templates.isPending && !templates.error && !templates.data?.length ? (
                <Text c='dimmed' size='sm'>
                  No saved encounters yet. Build one to add it here.
                </Text>
              ) : null}
              {templates.error ? (
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
