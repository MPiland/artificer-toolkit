import { ActionIcon, Button, Group, NumberInput, Stack, Textarea } from '@mantine/core'
import { Trash2 } from 'lucide-react'
import type { LootEntry, LootRange } from '@artificer-toolkit/schema/api/lootTables'
import { AppSelect } from '#ui/primitives/Select'
import type { AppSelectOption } from '#ui/primitives/Select/Select.types'
import { createLootEntry } from './CampaignSceneLootEditor.model'

export function CampaignSceneLootRange({
  coinOptions,
  disabled,
  itemOptions,
  label,
  range,
  onChange,
  onRemove
}: {
  coinOptions: AppSelectOption[]
  disabled: boolean
  itemOptions: AppSelectOption[]
  label: string
  range: LootRange
  onChange: (range: LootRange) => void
  onRemove: () => void
}) {
  const setEntry = (index: number, entry: LootEntry) =>
    onChange({
      ...range,
      entries: range.entries.map((current, at) => (at === index ? entry : current))
    })
  const addEntry = (kind: LootEntry['kind']) => {
    const fallback = (kind === 'ITEM' ? itemOptions : coinOptions)[0]?.value
    if (fallback)
      onChange({ ...range, entries: [...range.entries, createLootEntry(kind, fallback)] })
  }
  return (
    <Stack gap='xs' role='group' aria-label={label}>
      <Group align='flex-end' gap='xs' wrap='nowrap'>
        <NumberInput
          allowDecimal={false}
          aria-label={`${label} roll from`}
          disabled={disabled}
          label='Roll from'
          size='xs'
          value={range.min}
          onChange={(value) => typeof value === 'number' && onChange({ ...range, min: value })}
        />
        <NumberInput
          allowDecimal={false}
          aria-label={`${label} roll to`}
          description='Empty for no upper limit'
          disabled={disabled}
          label='Roll to'
          size='xs'
          value={range.max ?? ''}
          onChange={(value) =>
            onChange({ ...range, max: typeof value === 'number' ? value : null })
          }
        />
        <ActionIcon
          aria-label={`Remove ${label}`}
          color='red'
          disabled={disabled}
          variant='subtle'
          onClick={onRemove}
        >
          <Trash2 aria-hidden size={16} />
        </ActionIcon>
      </Group>
      {range.entries.map((entry, index) => (
        <Group align='flex-end' gap='xs' key={`${entry.kind}-${index}`} wrap='nowrap'>
          {entry.kind === 'ITEM' ? (
            <>
              <AppSelect
                data={itemOptions}
                disabled={disabled}
                label='Item'
                size='xs'
                value={entry.itemId}
                onChange={(itemId) => itemId && setEntry(index, { ...entry, itemId })}
              />
              <NumberInput
                allowDecimal={false}
                disabled={disabled}
                label='Quantity'
                min={1}
                size='xs'
                value={entry.quantity}
                onChange={(value) =>
                  typeof value === 'number' && setEntry(index, { ...entry, quantity: value })
                }
              />
            </>
          ) : (
            <>
              <AppSelect
                data={coinOptions}
                disabled={disabled}
                label='Coin'
                size='xs'
                value={entry.denominationId}
                onChange={(denominationId) =>
                  denominationId && setEntry(index, { ...entry, denominationId })
                }
              />
              <NumberInput
                allowDecimal={false}
                disabled={disabled}
                label='Amount'
                min={1}
                size='xs'
                value={entry.amount}
                onChange={(value) =>
                  typeof value === 'number' && setEntry(index, { ...entry, amount: value })
                }
              />
            </>
          )}
          <ActionIcon
            aria-label={`Remove ${entry.kind === 'ITEM' ? 'item' : 'coin'} entry ${index + 1} from ${label}`}
            color='red'
            disabled={disabled}
            variant='subtle'
            onClick={() =>
              onChange({ ...range, entries: range.entries.filter((_, at) => at !== index) })
            }
          >
            <Trash2 aria-hidden size={16} />
          </ActionIcon>
        </Group>
      ))}
      <Group gap='xs'>
        <Button
          disabled={disabled || itemOptions.length === 0}
          size='compact-xs'
          variant='default'
          onClick={() => addEntry('ITEM')}
        >
          Add item
        </Button>
        <Button
          disabled={disabled || coinOptions.length === 0}
          size='compact-xs'
          variant='default'
          onClick={() => addEntry('COIN')}
        >
          Add coins
        </Button>
      </Group>
      <Textarea
        autosize
        disabled={disabled}
        label='Note'
        maxLength={500}
        minRows={1}
        size='xs'
        value={range.note ?? ''}
        onChange={(event) => {
          const { note: _note, ...rest } = range
          const text = event.currentTarget.value
          onChange(text.trim() === '' ? rest : { ...rest, note: text })
        }}
      />
    </Stack>
  )
}
