import { ActionIcon, Alert, Button, Modal, NumberInput, Select, Stack, Text } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type {
  CampaignPartyInventoryMutationInput,
  InventoryDto
} from '@artificer-toolkit/schema/api/campaigns'
import { getEquipmentList } from '#app/data/equipment/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import * as styles from '../campaigns.css'

export function CampaignPartyInventoryActions({
  campaignId,
  inventory
}: {
  campaignId: string
  inventory: InventoryDto
}) {
  const queryClient = useQueryClient()
  const equipment = useQuery(getEquipmentList())
  const [equipmentId, setEquipmentId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const mutation = useMutation({
    mutationFn: (input: CampaignPartyInventoryMutationInput) =>
      api.campaigns.inventory.mutateParty(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.campaigns.inventory(campaignId, 'party')
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.inventoryAudit(campaignId) })
      ])
    }
  })
  const common = {
    campaignId,
    expectedOwnerVersion: inventory.version,
    idempotencyKey: crypto.randomUUID()
  }

  return (
    <Stack gap='sm'>
      {mutation.error ? <Alert color='red'>{mutation.error.message}</Alert> : null}
      <div className={styles.partyInventoryActionList}>
        {inventory.items.length === 0 && inventory.currencies.length === 0 ? (
          <Text c='dimmed'>The party inventory is empty.</Text>
        ) : null}
        {inventory.items.map((item) => (
          <PartyItemActions
            disabled={mutation.isPending}
            item={item}
            key={item.id}
            onMutate={(input) => mutation.mutate({ ...common, ...input })}
          />
        ))}
        {inventory.currencies
          .filter((currency) => !currency.containerId)
          .map((currency) => (
            <PartyCurrencyActions
              currency={currency}
              disabled={mutation.isPending}
              key={`${currency.kind}:${currency.denominationId}:${currency.containerId ?? 'carried'}`}
              onAdjust={(amount) =>
                mutation.mutate({
                  ...common,
                  kind: 'CURRENCY_ADJUST',
                  denominationId: currency.denominationId,
                  amount
                })
              }
            />
          ))}
      </div>

      <div className={styles.partyInventoryAddSection}>
        <Text fw={700}>Add equipment</Text>
        <div className={styles.partyInventoryActionGrid}>
          <Select
            data={(equipment.data?.items ?? [])
              .filter((item) => item.status === 'ACTIVE')
              .map((item) => ({ label: item.label, value: item.id }))}
            classNames={{ input: styles.input }}
            label='Equipment'
            searchable
            value={equipmentId}
            onChange={(value) => setEquipmentId(value ?? '')}
          />
          <NumberInput
            classNames={{ input: styles.input }}
            label='Quantity'
            min={1}
            step={1}
            value={quantity}
            onChange={(value) => setQuantity(Number(value) || 1)}
          />
          <Button
            disabled={!equipmentId}
            loading={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                ...common,
                kind: 'ITEM_ADD',
                equipmentId,
                quantity
              })
            }
          >
            Add item
          </Button>
        </div>
      </div>
    </Stack>
  )
}

function PartyItemActions({
  disabled,
  item,
  onMutate
}: {
  disabled: boolean
  item: InventoryDto['items'][number]
  onMutate: (
    input:
      | { kind: 'ITEM_UPDATE'; itemId: string; quantity: number }
      | { kind: 'ITEM_CONSUME'; itemId: string; amount: number }
      | { kind: 'ITEM_REMOVE'; itemId: string }
  ) => void
}) {
  const [quantity, setQuantity] = useState(item.quantity)
  const [confirmRemoval, setConfirmRemoval] = useState(false)
  useEffect(() => setQuantity(item.quantity), [item.quantity])

  function saveQuantity() {
    if (!disabled && quantity !== item.quantity) {
      onMutate({ kind: 'ITEM_UPDATE', itemId: item.id, quantity })
    }
  }

  return (
    <>
      <div className={styles.partyInventoryActionRow}>
        <Text fw={600}>{item.label}</Text>
        <NumberInput
          aria-label={`${item.label} quantity`}
          classNames={{ input: styles.input }}
          label='Quantity'
          min={1}
          step={1}
          value={quantity}
          onBlur={saveQuantity}
          onChange={(value) => setQuantity(Number(value) || 1)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <div className={styles.partyInventoryActionButtons}>
          <Button
            disabled={disabled}
            variant='default'
            onClick={() => onMutate({ kind: 'ITEM_CONSUME', itemId: item.id, amount: 1 })}
          >
            Consume 1
          </Button>
          <ActionIcon
            aria-label={`Remove all ${item.label}`}
            className={styles.inlineFieldIconAction}
            color='red'
            disabled={disabled}
            size='lg'
            variant='subtle'
            onClick={() => setConfirmRemoval(true)}
          >
            <Trash2 aria-hidden='true' size={18} />
          </ActionIcon>
        </div>
      </div>
      <Modal
        centered
        opened={confirmRemoval}
        title={`Remove ${item.label}?`}
        onClose={() => setConfirmRemoval(false)}
      >
        <Stack gap='md'>
          <Text>This removes the entire stack from party inventory.</Text>
          <div className={styles.confirmActions}>
            <Button variant='default' onClick={() => setConfirmRemoval(false)}>
              Keep item
            </Button>
            <Button
              color='red'
              onClick={() => {
                setConfirmRemoval(false)
                onMutate({ kind: 'ITEM_REMOVE', itemId: item.id })
              }}
            >
              Remove all
            </Button>
          </div>
        </Stack>
      </Modal>
    </>
  )
}

function PartyCurrencyActions({
  currency,
  disabled,
  onAdjust
}: {
  currency: InventoryDto['currencies'][number]
  disabled: boolean
  onAdjust: (amount: number) => void
}) {
  const [amount, setAmount] = useState(0)
  return (
    <div className={styles.partyInventoryActionRow}>
      <div>
        <Text fw={600}>{currency.label}</Text>
        <Text c='dimmed' size='sm'>
          {currency.amount} {currency.abbreviation}
        </Text>
      </div>
      <NumberInput
        aria-label={`${currency.label} adjustment`}
        classNames={{ input: styles.input }}
        label='Change by (+/−)'
        step={1}
        value={amount}
        onChange={(value) => setAmount(Number(value) || 0)}
      />
      <div className={styles.partyInventoryActionButtons}>
        <Button
          disabled={disabled || amount === 0}
          variant='default'
          onClick={() => onAdjust(amount)}
        >
          Apply
        </Button>
      </div>
    </div>
  )
}
