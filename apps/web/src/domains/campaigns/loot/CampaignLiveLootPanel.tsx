import {
  ActionIcon,
  Badge,
  Drawer,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  Tooltip
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useQuery as useConvexQuery } from 'convex/react'
import { Coins } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { LootEntry, LootTable } from '@artificer-toolkit/schema/api/lootTables'
import { findLootRangeForRoll, formatLootRange } from '@artificer-toolkit/shared/vtt/lootTable'
import { useContentCatalogue } from '#app/data/contentSnapshots/useContentCatalogue'
import * as styles from './CampaignLiveLootPanel.css'
import type { DefeatedCreatureLoot } from './CampaignLiveLootPanel.model'

type Section = { key: string; title: string; tables: readonly LootTable[] }

/**
 * The GM's live Loot panel: the presented Scene's tables and those of defeated creatures. Entering
 * a roll result highlights the matching range; nothing is rolled, shown to players or given out.
 */
export function CampaignLiveLootPanel({
  creatures,
  gameSystemId,
  sceneTables
}: {
  creatures: readonly DefeatedCreatureLoot[]
  gameSystemId: string
  sceneTables: readonly LootTable[]
}) {
  const [opened, { open, close }] = useDisclosure(false)
  const [rolls, setRolls] = useState<Record<string, string | number>>({})
  const sections: Section[] = [
    ...(sceneTables.length > 0 ? [{ key: 'scene', title: 'This scene', tables: sceneTables }] : []),
    ...creatures.map(({ id, label, tables }) => ({ key: id, title: `${label} (defeated)`, tables }))
  ]
  return (
    <>
      <Tooltip label='Loot'>
        <ActionIcon aria-label='Open loot' size='lg' variant='default' onClick={open}>
          <Coins aria-hidden size={18} />
        </ActionIcon>
      </Tooltip>
      <Drawer
        opened={opened}
        position='right'
        size='min(28rem, 100vw)'
        title='Loot'
        zIndex={400}
        onClose={close}
      >
        <Stack gap='md'>
          <Text c='dimmed' size='xs'>
            A reference for you only. Players never see it, and nothing is rolled or given out
            automatically.
          </Text>
          {sections.length === 0 ? (
            <Text c='dimmed' size='sm'>
              This scene and its defeated creatures have no loot tables.
            </Text>
          ) : (
            <LootSections
              gameSystemId={gameSystemId}
              rolls={rolls}
              sections={sections}
              onRoll={(tableId, value) => setRolls((current) => ({ ...current, [tableId]: value }))}
            />
          )}
        </Stack>
      </Drawer>
    </>
  )
}

function LootSections({
  gameSystemId,
  rolls,
  sections,
  onRoll
}: {
  gameSystemId: string
  rolls: Record<string, string | number>
  sections: Section[]
  onRoll: (tableId: string, value: string | number) => void
}) {
  const system = useConvexQuery(convexApi.content.systems.get, { id: gameSystemId })
  const items = useContentCatalogue('EQUIPMENT', { systemId: gameSystemId })
  const labels = useMemo(
    () =>
      new Map([
        ...(items.items ?? []).map((item) => [item.id, item.label] as const),
        ...(system?.currencies ?? []).map((currency) => [currency.id, currency.label] as const),
        ...(system?.skills ?? []).map((skill) => [skill.id, skill.label] as const)
      ]),
    [items.items, system]
  )
  const describeEntry = (entry: LootEntry) =>
    entry.kind === 'ITEM'
      ? `${entry.quantity} × ${labels.get(entry.itemId) ?? 'Unavailable item'}`
      : `${entry.amount} ${labels.get(entry.denominationId) ?? 'coin'}`
  return sections.map((section) => (
    <section aria-label={section.title} key={section.key}>
      <Text fw={650} mb='xs'>
        {section.title}
      </Text>
      <Stack gap='sm'>
        {section.tables.map((table) => {
          const roll = rolls[table.id] ?? ''
          const matched =
            typeof roll === 'number' ? findLootRangeForRoll(table.ranges, roll) : undefined
          return (
            <Paper
              aria-label={`Loot table ${table.name}`}
              key={table.id}
              p='sm'
              role='group'
              withBorder
            >
              <Stack gap='xs'>
                <Group align='flex-end' justify='space-between' wrap='nowrap'>
                  <div>
                    <Text fw={600}>{table.name}</Text>
                    {table.skillId ? (
                      <Text c='dimmed' size='xs'>
                        Check: {labels.get(table.skillId) ?? 'Unavailable skill'}
                      </Text>
                    ) : null}
                  </div>
                  <NumberInput
                    allowDecimal={false}
                    aria-label={`Roll result for ${table.name}`}
                    label='Roll result'
                    size='xs'
                    value={roll}
                    w='6rem'
                    onChange={(value) => onRoll(table.id, value)}
                  />
                </Group>
                {roll !== '' && !matched ? (
                  <Text c='dimmed' size='xs'>
                    No range matches this roll.
                  </Text>
                ) : null}
                {table.ranges.map((range) => (
                  <div
                    aria-current={range === matched ? 'true' : undefined}
                    className={styles.range}
                    data-matched={range === matched || undefined}
                    key={range.id}
                  >
                    <Group gap='xs'>
                      <Text fw={600} size='sm'>
                        {formatLootRange(range)}
                      </Text>
                      {range === matched ? (
                        <Badge size='sm' variant='light'>
                          Matches roll
                        </Badge>
                      ) : null}
                    </Group>
                    {range.entries.length === 0 ? (
                      <Text c='dimmed' size='xs'>
                        Nothing
                      </Text>
                    ) : (
                      range.entries.map((entry, index) => (
                        <Text key={`${index}:${entry.kind}`} size='sm'>
                          {describeEntry(entry)}
                        </Text>
                      ))
                    )}
                    {range.note ? (
                      <Text c='dimmed' size='xs'>
                        {range.note}
                      </Text>
                    ) : null}
                  </div>
                ))}
              </Stack>
            </Paper>
          )
        })}
      </Stack>
    </section>
  ))
}
