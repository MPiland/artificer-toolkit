import { ActionIcon, Alert, Button, Modal, NumberInput, Select, Stack, Text } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import type { CampaignContentShareDto } from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignPartyInventoryMutationInput,
  InventoryDto
} from '@artificer-toolkit/schema/api/campaignInventory'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { usePaginatedQuery as useCandidatePaginatedQuery } from 'convex-helpers/react'
import { useMutation as useConvexMutation } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import * as sharedStyles from '../campaigns.css'
import * as inventoryStyles from './inventory.css'

type PartyInventoryCommand = CampaignPartyInventoryMutationInput extends infer Input
  ? Input extends { kind: string }
    ? Omit<Input, 'campaignId' | 'expectedOwnerVersion' | 'idempotencyKey'>
    : never
  : never

type CurrencyIdentity = Pick<
  InventoryDto['currencies'][number],
  'kind' | 'campaignCurrencySystemId' | 'denominationId'
>
type CurrencyDisplayRow = Omit<InventoryDto['currencies'][number], 'amount'> & { amount: bigint }

function sharedEquipmentLabel(share: CampaignContentShareDto): string {
  const document = share.document
  return document &&
    typeof document === 'object' &&
    !Array.isArray(document) &&
    'label' in document &&
    typeof document.label === 'string'
    ? document.label
    : share.subjectId
}

function currencyKey(currency: CurrencyIdentity): string {
  return JSON.stringify([
    currency.kind,
    currency.campaignCurrencySystemId ?? null,
    currency.denominationId
  ])
}

export function CampaignPartyInventoryActions({
  campaignId,
  currencyOptions,
  inventory
}: {
  campaignId: string
  currencyOptions?: InventoryDto['currencies']
  inventory: InventoryDto
}) {
  const equipment = useCandidatePaginatedQuery(
    convexApi.campaigns.partyInventory.equipmentOptions,
    { campaignId },
    { initialNumItems: 48 }
  )
  const sharedEquipment = useCandidatePaginatedQuery(
    convexApi.campaigns.contentShares.list,
    { campaignId },
    { initialNumItems: 48 }
  )
  const mutatePartyInventory = useConvexMutation(convexApi.campaigns.partyInventoryCommands.mutate)
  const [equipmentId, setEquipmentId] = useState<string | null>(null)
  const [addLocation, setAddLocation] = useState('LOOSE')
  const containers = inventory.items.filter((item) => item.isContainer && item.containerId === null)
  const locations = [
    { value: 'LOOSE', label: 'Loose' },
    ...containers.map((item) => ({ value: item.id, label: item.label }))
  ]
  const [quantity, setQuantity] = useState(1)
  const [currencyKeyToAdd, setCurrencyKeyToAdd] = useState<string | null>(null)
  const [currencyAmountToAdd, setCurrencyAmountToAdd] = useState(1)
  const [currencyError, setCurrencyError] = useState<string | null>(null)

  useEffect(() => {
    if (equipment.status === 'CanLoadMore') equipment.loadMore(48)
  }, [equipment.loadMore, equipment.status])
  useEffect(() => {
    if (sharedEquipment.status === 'CanLoadMore') sharedEquipment.loadMore(48)
  }, [sharedEquipment.loadMore, sharedEquipment.status])

  const mutation = useMutation({
    mutationFn: (input: CampaignPartyInventoryMutationInput) => mutatePartyInventory({ input })
  })
  const submit = (input: PartyInventoryCommand) => {
    mutation.mutate({
      ...input,
      campaignId,
      ...(inventory.owner.kind === 'VEHICLE' ? { vehicleId: inventory.owner.vehicleId } : {}),
      expectedOwnerVersion: inventory.version,
      idempotencyKey: crypto.randomUUID()
    })
  }
  const heldCurrencies = useMemo(() => {
    const rows = new Map<string, CurrencyDisplayRow>()
    for (const currency of inventory.currencies) {
      const key = JSON.stringify([currencyKey(currency), currency.containerId])
      const current = rows.get(key)
      if (!current) rows.set(key, { ...currency, amount: BigInt(currency.amount) })
      else {
        rows.set(key, {
          ...current,
          amount: current.amount + BigInt(currency.amount)
        })
      }
    }
    return [...rows.values()]
  }, [inventory.currencies])
  const availableCurrencyOptions = (currencyOptions ?? []).filter(
    (currency): currency is InventoryDto['currencies'][number] & { kind: 'RULESET' | 'CAMPAIGN' } =>
      currency.kind === 'RULESET' || currency.kind === 'CAMPAIGN'
  )
  const equipmentOptions = [
    ...equipment.results.map((item) => ({ id: item.id, label: item.label })),
    ...sharedEquipment.results
      .filter((share) => share.subjectKind === 'EQUIPMENT')
      .map((share) => ({ id: share.subjectId, label: sharedEquipmentLabel(share) }))
  ]
  const pickerReady = equipment.status === 'Exhausted' && sharedEquipment.status === 'Exhausted'
  const equipmentSelectionReady =
    equipmentId !== null && equipmentOptions.some((item) => item.id === equipmentId)
  const selectedCurrency = availableCurrencyOptions.find(
    (currency) => currencyKey(currency) === currencyKeyToAdd
  )

  return (
    <Stack gap='sm'>
      {mutation.error ? (
        <Alert color='red'>
          {mutation.error.message}
          {mutation.variables ? (
            <Button
              ml='sm'
              size='compact-sm'
              variant='subtle'
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(mutation.variables)}
            >
              Retry
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <div className={inventoryStyles.partyInventoryActionList}>
        {inventory.items.length === 0 && heldCurrencies.length === 0 ? (
          <Text c='dimmed'>The party inventory is empty.</Text>
        ) : null}
        {inventory.items.map((item) => (
          <PartyItemActions
            disabled={mutation.isPending}
            containers={containers}
            item={item}
            key={item.id}
            onMutate={submit}
          />
        ))}
        {heldCurrencies.map((currency) => (
          <PartyCurrencyActions
            currency={currency}
            disabled={mutation.isPending}
            key={JSON.stringify([currencyKey(currency), currency.containerId])}
            containers={containers}
            onMove={(toContainerId, amount) =>
              submit({
                kind: 'CURRENCY_MOVE',
                campaignCurrencySystemId:
                  currency.kind === 'RULESET' ? null : currency.campaignCurrencySystemId,
                denominationId: currency.denominationId,
                fromContainerId: currency.containerId,
                toContainerId,
                amount
              })
            }
            onAdjust={(amount) =>
              submit({
                kind: 'CURRENCY_ADJUST',
                campaignCurrencySystemId:
                  currency.kind === 'RULESET' ? null : currency.campaignCurrencySystemId,
                denominationId: currency.denominationId,
                containerId: currency.containerId,
                amount
              })
            }
          />
        ))}
      </div>

      <Select
        data={locations}
        classNames={{ input: sharedStyles.input }}
        disabled={mutation.isPending}
        label='Add to'
        value={locations.some((location) => location.value === addLocation) ? addLocation : 'LOOSE'}
        onChange={(value) => setAddLocation(value ?? 'LOOSE')}
      />
      <div className={inventoryStyles.partyInventoryAddSection}>
        <Text fw={700}>Add equipment</Text>
        <div className={inventoryStyles.partyInventoryActionGrid}>
          <Select
            data={equipmentOptions.map((item) => ({ label: item.label, value: item.id }))}
            classNames={{ input: sharedStyles.input }}
            disabled={!pickerReady || mutation.isPending}
            label='Equipment'
            searchable
            value={equipmentId}
            onChange={setEquipmentId}
          />
          <NumberInput
            classNames={{ input: sharedStyles.input }}
            disabled={mutation.isPending}
            label='Quantity'
            min={1}
            step={1}
            value={quantity}
            onChange={(value) => setQuantity(Number(value) || 1)}
          />
          <Button
            disabled={!equipmentSelectionReady || !pickerReady || mutation.isPending}
            loading={mutation.isPending}
            onClick={() =>
              equipmentId &&
              submit({
                kind: 'ITEM_ADD',
                equipmentId,
                quantity,
                containerId:
                  locations.some((location) => location.value === addLocation) &&
                  addLocation !== 'LOOSE'
                    ? addLocation
                    : null
              })
            }
          >
            Add item
          </Button>
        </div>
      </div>

      <div className={inventoryStyles.partyInventoryAddSection}>
        <Text fw={700}>Add currency</Text>
        <div className={inventoryStyles.partyInventoryActionGrid}>
          <Select
            data={availableCurrencyOptions.map((currency) => ({
              label: currency.label,
              value: currencyKey(currency)
            }))}
            classNames={{ input: sharedStyles.input }}
            disabled={mutation.isPending}
            label='Currency'
            searchable
            value={currencyKeyToAdd}
            onChange={(value) => {
              setCurrencyKeyToAdd(value)
              setCurrencyError(null)
            }}
          />
          <NumberInput
            classNames={{ input: sharedStyles.input }}
            disabled={mutation.isPending}
            label='Amount'
            min={1}
            step={1}
            value={currencyAmountToAdd}
            onChange={(value) => setCurrencyAmountToAdd(Number(value) || 1)}
          />
          <Button
            disabled={!selectedCurrency || mutation.isPending}
            loading={mutation.isPending}
            onClick={() => {
              if (!selectedCurrency) return
              if (
                selectedCurrency.kind === 'CAMPAIGN' &&
                !selectedCurrency.campaignCurrencySystemId
              ) {
                setCurrencyError('This Campaign currency option is missing its currency system.')
                return
              }
              submit({
                kind: 'CURRENCY_ADJUST',
                campaignCurrencySystemId:
                  selectedCurrency.kind === 'RULESET'
                    ? null
                    : selectedCurrency.campaignCurrencySystemId,
                denominationId: selectedCurrency.denominationId,
                amount: currencyAmountToAdd,
                containerId:
                  locations.some((location) => location.value === addLocation) &&
                  addLocation !== 'LOOSE'
                    ? addLocation
                    : null
              })
            }}
          >
            Apply
          </Button>
        </div>
        {currencyError ? <Alert color='red'>{currencyError}</Alert> : null}
      </div>
    </Stack>
  )
}

function PartyItemActions({
  disabled,
  containers,
  item,
  onMutate
}: {
  disabled: boolean
  containers: InventoryDto['items']
  item: InventoryDto['items'][number]
  onMutate: (input: PartyInventoryCommand) => void
}) {
  const [quantity, setQuantity] = useState(item.quantity)
  const [confirmRemoval, setConfirmRemoval] = useState(false)
  useEffect(() => setQuantity(item.quantity), [item.quantity])

  return (
    <>
      <div className={inventoryStyles.partyInventoryActionRow}>
        <Stack gap='xs'>
          <Text fw={600}>{item.label}</Text>
          <Select
            classNames={{ input: sharedStyles.input }}
            data={[
              { value: 'LOOSE', label: 'Loose' },
              ...(!item.isContainer
                ? containers
                    .filter((container) => container.id !== item.id)
                    .map((container) => ({ value: container.id, label: container.label }))
                : [])
            ]}
            disabled={disabled}
            label={item.label + ' location'}
            value={item.containerId ?? 'LOOSE'}
            onChange={(value) => {
              if (value && value !== (item.containerId ?? 'LOOSE'))
                onMutate({
                  kind: 'ITEM_UPDATE',
                  itemId: item.id,
                  quantity: item.quantity,
                  containerId: value === 'LOOSE' ? null : value
                })
            }}
          />
        </Stack>
        <NumberInput
          aria-label={`${item.label} quantity`}
          classNames={{ input: sharedStyles.input }}
          disabled={disabled}
          label='Quantity'
          min={1}
          step={1}
          value={quantity}
          onBlur={() => {
            if (!disabled && quantity !== item.quantity)
              onMutate({ kind: 'ITEM_UPDATE', itemId: item.id, quantity })
          }}
          onChange={(value) => setQuantity(Number(value) || 1)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <div className={inventoryStyles.partyInventoryActionButtons}>
          <Button
            disabled={disabled}
            variant='default'
            onClick={() => onMutate({ kind: 'ITEM_CONSUME', itemId: item.id, amount: 1 })}
          >
            Consume 1
          </Button>
          <ActionIcon
            aria-label={`Remove all ${item.label}`}
            className={inventoryStyles.inlineFieldIconAction}
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
          <Text>This removes the entire stack from this inventory.</Text>
          <div className={inventoryStyles.confirmActions}>
            <Button variant='default' onClick={() => setConfirmRemoval(false)}>
              Keep item
            </Button>
            <Button
              color='red'
              disabled={disabled}
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
  containers,
  onMove,
  onAdjust
}: {
  currency: CurrencyDisplayRow
  disabled: boolean
  containers: InventoryDto['items']
  onMove: (toContainerId: string | null, amount: number) => void
  onAdjust: (amount: number) => void
}) {
  const [amount, setAmount] = useState(0)
  const [destination, setDestination] = useState<string | null>(null)
  return (
    <div className={inventoryStyles.partyInventoryActionRow}>
      <div>
        <Text fw={600}>{currency.label}</Text>
        <Text c='dimmed' size='sm'>
          {currency.amount.toString()} {currency.abbreviation}
          {currency.containerId
            ? ' in ' +
              (containers.find((container) => container.id === currency.containerId)?.label ??
                'container')
            : ' loose'}
        </Text>
        <Select
          classNames={{ input: sharedStyles.input }}
          data={[
            { value: 'LOOSE', label: 'Loose' },
            ...containers.map((container) => ({ value: container.id, label: container.label }))
          ].filter((location) => location.value !== (currency.containerId ?? 'LOOSE'))}
          disabled={disabled}
          label={currency.label + ' move to'}
          value={destination}
          onChange={setDestination}
        />
      </div>
      <NumberInput
        aria-label={`${currency.label} adjustment`}
        classNames={{ input: sharedStyles.input }}
        disabled={disabled}
        label='Change by (+/−)'
        step={1}
        value={amount}
        onChange={(value) => setAmount(Number(value) || 0)}
      />
      <div className={inventoryStyles.partyInventoryActionButtons}>
        <Button
          disabled={disabled || amount === 0}
          variant='default'
          onClick={() => onAdjust(amount)}
        >
          Apply
        </Button>
        <Button
          disabled={
            disabled ||
            !destination ||
            amount <= 0 ||
            !Number.isSafeInteger(amount) ||
            BigInt(amount) > currency.amount ||
            ![{ value: 'LOOSE' }, ...containers.map((container) => ({ value: container.id }))].some(
              (location) =>
                location.value === destination &&
                location.value !== (currency.containerId ?? 'LOOSE')
            )
          }
          variant='default'
          onClick={() =>
            destination && onMove(destination === 'LOOSE' ? null : destination, amount)
          }
        >
          Move
        </Button>
      </div>
    </div>
  )
}
