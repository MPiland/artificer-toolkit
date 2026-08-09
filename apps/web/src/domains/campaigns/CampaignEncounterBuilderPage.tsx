import {
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { IconChevronLeft } from '@tabler/icons-react'
import { useState } from 'react'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import { getCreatureList } from '#app/data/creatures/queries'
import { getEncounterTemplates } from '#app/data/encounters/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import * as styles from './campaigns.css'

type TemplateEnemy =
  | { kind: 'CREATURE'; sourceId: string; label: string }
  | { kind: 'CUSTOM'; label: string; maxHitPoints: number }

export function CampaignEncounterBuilderPage({ campaignId }: { campaignId: string }) {
  const { data: campaign } = useSuspenseQuery(getCampaignDetail(campaignId))
  const templates = useQuery({
    ...getEncounterTemplates(campaign.id),
    enabled: campaign.role === 'OWNER' && campaign.status === 'ACTIVE'
  })
  const creatures = useQuery(getCreatureList())
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [creatureId, setCreatureId] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [customHitPoints, setCustomHitPoints] = useState(10)
  const [enemies, setEnemies] = useState<TemplateEnemy[]>([])
  const create = useMutation({
    mutationFn: () =>
      api.encounters.templates.create({
        campaignId: campaign.id,
        name: name.trim(),
        enemies: enemies.map((enemy) =>
          enemy.kind === 'CREATURE'
            ? { kind: 'CREATURE', sourceId: enemy.sourceId }
            : { kind: 'CUSTOM', label: enemy.label, maxHitPoints: enemy.maxHitPoints }
        ),
        commandId: crypto.randomUUID()
      }),
    onSuccess: async () => {
      setName('')
      setEnemies([])
      await queryClient.invalidateQueries({ queryKey: queryKeys.encounters.templates(campaign.id) })
      window.history.back()
    }
  })

  if (campaign.role !== 'OWNER' || campaign.status !== 'ACTIVE') {
    return <Alert color='red'>Only the active Campaign GM can build encounters.</Alert>
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <Title order={1}>Build an encounter</Title>
          <Text c='dimmed'>Create a reusable enemy roster, then add it to a Session.</Text>
        </div>
        <Button
          leftSection={<IconChevronLeft aria-hidden size={16} />}
          variant='default'
          onClick={() => window.history.back()}
        >
          Back to Session
        </Button>
      </header>
      {templates.error || creatures.error ? (
        <Alert color='red'>
          Encounter builder options couldn’t be loaded. Refresh the page to try again.
        </Alert>
      ) : create.error ? (
        <Alert color='red'>The Encounter couldn’t be saved. Your roster is still here.</Alert>
      ) : null}
      <div className={styles.encounterBuilderGrid}>
        <section className={styles.panel} aria-labelledby='encounter-template-builder-title'>
          <Title id='encounter-template-builder-title' order={2}>
            Encounter roster
          </Title>
          <Text c='dimmed' size='sm'>
            Name the encounter and add the enemies the party will face.
          </Text>
          <TextInput
            classNames={{ input: styles.input }}
            label='Encounter name'
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <Group className={styles.encounterBuilderSourceRow} align='end' wrap='wrap'>
            <Select
              classNames={{ input: styles.input }}
              data={(creatures.data?.items ?? []).map((creature) => ({
                value: creature.id,
                label: creature.label
              }))}
              label='Bestiary creature'
              searchable
              value={creatureId}
              onChange={setCreatureId}
            />
            <Button
              disabled={!creatureId}
              variant='default'
              onClick={() => {
                const creature = (creatures.data?.items ?? []).find(
                  (item) => item.id === creatureId
                )
                if (!creature) return
                setEnemies((current) => [
                  ...current,
                  { kind: 'CREATURE', sourceId: creature.id, label: creature.label }
                ])
                setCreatureId(null)
              }}
            >
              Add creature
            </Button>
          </Group>
          <Group className={styles.encounterBuilderCustomRow} align='end' wrap='wrap'>
            <TextInput
              classNames={{ input: styles.input }}
              label='Custom enemy name'
              value={customName}
              onChange={(event) => setCustomName(event.currentTarget.value)}
            />
            <NumberInput
              classNames={{ input: styles.input }}
              label='Max HP'
              min={0}
              value={customHitPoints}
              onChange={(value) => setCustomHitPoints(Number(value) || 0)}
            />
            <Button
              disabled={!customName.trim()}
              variant='default'
              onClick={() => {
                setEnemies((current) => [
                  ...current,
                  { kind: 'CUSTOM', label: customName.trim(), maxHitPoints: customHitPoints }
                ])
                setCustomName('')
                setCustomHitPoints(10)
              }}
            >
              Add custom enemy
            </Button>
          </Group>
          {enemies.length ? (
            <Stack gap='xs'>
              {enemies.map((enemy, index) => (
                <Group
                  className={styles.encounterActorSummary}
                  justify='space-between'
                  key={`${enemy.kind}-${index}`}
                >
                  <div>
                    <Text fw={600}>{enemy.label}</Text>
                    <Text c='dimmed' size='sm'>
                      {enemy.kind === 'CUSTOM'
                        ? `Custom · ${enemy.maxHitPoints} HP`
                        : 'Bestiary creature'}
                    </Text>
                  </div>
                  <Button
                    color='red'
                    size='sm'
                    variant='subtle'
                    onClick={() =>
                      setEnemies((current) => current.filter((_, item) => item !== index))
                    }
                  >
                    Remove
                  </Button>
                </Group>
              ))}
            </Stack>
          ) : (
            <Text c='dimmed' size='sm'>
              Add at least one enemy to save this encounter.
            </Text>
          )}
          <Group>
            <Button
              disabled={!name.trim() || enemies.length === 0}
              loading={create.isPending}
              onClick={() => create.mutate()}
            >
              Save encounter
            </Button>
          </Group>
        </section>
        <section className={styles.panel} aria-labelledby='encounter-template-history-title'>
          <Group justify='space-between'>
            <Title id='encounter-template-history-title' order={2}>
              Saved encounters
            </Title>
            <Badge variant='light'>{templates.data?.length ?? 0}</Badge>
          </Group>
          {templates.isPending ? <Text c='dimmed'>Loading saved encounters…</Text> : null}
          {templates.data?.length ? (
            <Stack gap='xs'>
              {templates.data.map((template) => (
                <div className={styles.encounterActorSummary} key={template.id}>
                  <Text fw={600}>{template.name}</Text>
                  <Text c='dimmed' size='sm'>
                    {template.enemies
                      .map((enemy) => `${enemy.label} (${enemy.maxHitPoints} HP)`)
                      .join(', ')}
                  </Text>
                </div>
              ))}
            </Stack>
          ) : !templates.isPending ? (
            <Text c='dimmed'>No saved encounters yet.</Text>
          ) : null}
        </section>
      </div>
    </main>
  )
}
