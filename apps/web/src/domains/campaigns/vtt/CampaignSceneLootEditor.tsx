import { Alert, Button, Group, Paper, Stack, Text, TextInput } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useConvex, useQuery as useConvexQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { LootOwner, LootTable } from '@artificer-toolkit/schema/api/lootTables'
import { getLoot, saveLoot } from '#app/data/campaigns/loot'
import { useContentCatalogue } from '#app/data/contentSnapshots/useContentCatalogue'
import { queryKeys } from '#app/lib/queryKeys'
import { AppSelect } from '#ui/primitives/Select'
import { CampaignSceneLootRange } from './CampaignSceneLootRange'
import {
  createLootRange,
  createLootTable,
  describeLootDraftRefusal
} from './CampaignSceneLootEditor.model'

/** GM-only reference tables for a Scene; nothing here is rolled, revealed or granted. */
export function CampaignSceneLootEditor({
  campaignId,
  gameSystemId,
  sceneId
}: {
  campaignId: string
  gameSystemId: string
  sceneId: string
}) {
  const convex = useConvex()
  const queryClient = useQueryClient()
  const owner: LootOwner = { kind: 'SCENE', campaignId, sceneDefinitionId: sceneId }
  const loot = useQuery(getLoot(owner, convex))
  const system = useConvexQuery(convexApi.content.systems.get, { id: gameSystemId })
  const items = useContentCatalogue('EQUIPMENT', { systemId: gameSystemId })
  const [draft, setDraft] = useState<LootTable[] | null>(null)
  const tables = draft ?? loot.data?.tables ?? []
  const dirty = draft !== null

  const save = useMutation({
    mutationFn: () =>
      saveLoot(convex, {
        owner,
        expectedVersion: loot.data?.version ?? 0,
        tables
      }),
    onSuccess: async (saved) => {
      queryClient.setQueryData(queryKeys.campaigns.loot(owner), saved)
      setDraft(null)
    }
  })

  const itemOptions = useMemo(
    () => (items.items ?? []).map((item) => ({ value: item.id, label: item.label })),
    [items.items]
  )
  const coinOptions = useMemo(
    () =>
      (system?.currencies ?? []).map((currency) => ({ value: currency.id, label: currency.label })),
    [system]
  )
  const skillOptions = useMemo(
    () => (system?.skills ?? []).map((skill) => ({ value: skill.id, label: skill.label })),
    [system]
  )
  const refusal = describeLootDraftRefusal(tables)

  const change = (next: LootTable[]) => {
    save.reset()
    setDraft(next)
  }
  const setTable = (id: string, next: LootTable) =>
    change(tables.map((table) => (table.id === id ? next : table)))

  return (
    <section aria-label='Scene loot tables'>
      <Stack gap='sm' p='md'>
        <Group justify='space-between'>
          <div>
            <Text fw={650}>Loot</Text>
            <Text c='dimmed' size='xs'>
              A reference for you only. Players never see these tables, and nothing is rolled or
              given out automatically.
            </Text>
          </div>
          <Group gap='xs'>
            <Button
              disabled={save.isPending}
              size='xs'
              variant='default'
              onClick={() => change([...tables, createLootTable()])}
            >
              Add loot table
            </Button>
            <Button
              disabled={!dirty || save.isPending}
              size='xs'
              variant='default'
              onClick={() => {
                save.reset()
                setDraft(null)
              }}
            >
              Reset loot
            </Button>
            <Button
              disabled={!dirty || refusal !== null || loot.data === undefined}
              loading={save.isPending}
              size='xs'
              onClick={() => save.mutate()}
            >
              Save loot
            </Button>
          </Group>
        </Group>
        {loot.error ? <Alert color='red'>{loot.error.message}</Alert> : null}
        {refusal ? (
          <Alert color='red' role='alert'>
            {refusal}
          </Alert>
        ) : null}
        {save.error ? <Alert color='red'>{save.error.message}</Alert> : null}
        {tables.length === 0 && loot.data ? (
          <Text c='dimmed' size='sm'>
            No loot tables on this Scene yet.
          </Text>
        ) : null}
        {tables.map((table, tableIndex) => (
          <Paper
            aria-label={`Loot table ${table.name}`}
            key={table.id}
            p='sm'
            role='group'
            withBorder
          >
            <Stack gap='sm'>
              <Group align='flex-end' gap='xs'>
                <TextInput
                  disabled={save.isPending}
                  label='Table name'
                  maxLength={80}
                  size='xs'
                  value={table.name}
                  onChange={(event) =>
                    setTable(table.id, { ...table, name: event.currentTarget.value })
                  }
                />
                <AppSelect
                  clearable
                  data={skillOptions}
                  disabled={save.isPending}
                  label='Check (optional)'
                  size='xs'
                  value={table.skillId ?? null}
                  onChange={(skillId) => {
                    const { skillId: _skillId, ...rest } = table
                    setTable(table.id, skillId ? { ...rest, skillId } : rest)
                  }}
                />
                <Button
                  color='red'
                  disabled={save.isPending}
                  size='xs'
                  variant='subtle'
                  onClick={() => change(tables.filter((current) => current.id !== table.id))}
                >
                  Remove table
                </Button>
              </Group>
              {table.ranges.map((range, rangeIndex) => (
                <CampaignSceneLootRange
                  coinOptions={coinOptions}
                  disabled={save.isPending}
                  itemOptions={itemOptions}
                  key={range.id}
                  label={`Table ${tableIndex + 1} range ${rangeIndex + 1}`}
                  range={range}
                  onChange={(next) =>
                    setTable(table.id, {
                      ...table,
                      ranges: table.ranges.map((current) =>
                        current.id === range.id ? next : current
                      )
                    })
                  }
                  onRemove={() =>
                    setTable(table.id, {
                      ...table,
                      ranges: table.ranges.filter((current) => current.id !== range.id)
                    })
                  }
                />
              ))}
              <Button
                disabled={save.isPending}
                size='compact-xs'
                variant='default'
                onClick={() =>
                  setTable(table.id, {
                    ...table,
                    ranges: [...table.ranges, createLootRange(table.ranges)]
                  })
                }
              >
                Add range
              </Button>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </section>
  )
}
