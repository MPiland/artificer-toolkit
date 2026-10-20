import {
  Accordion,
  Alert,
  Button,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Text,
  Title
} from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type {
  InventoryDto,
  TransferCampaignInventoryInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useState } from 'react'
import { useLoadAllPages } from '#app/data/useLoadAllPages'
import { usePaginatedQuery } from 'convex-helpers/react'
import { useConvex, useMutation as useConvexMutation, useQuery } from 'convex/react'
import { CurrencySystemEditor } from './CurrencySystemEditor'
import { CampaignInventoryAudit } from './CampaignInventoryAudit'
import { CampaignPartyInventoryActions } from './CampaignPartyInventoryActions'
import {
  aggregateInventoryCurrencies,
  getAuthorizedSourceOwners,
  getCharacterInventory,
  getCurrentCurrencyOptions,
  getTransferDestinationOwners,
  inventoryCurrencyKey,
  parseOwner
} from './campaignInventory.utils'
import * as sharedStyles from '../campaigns.css'
import * as inventoryStyles from './inventory.css'

export function CampaignInventory({
  campaign,
  currentUserId,
  partyOnly = false
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  partyOnly?: boolean
}) {
  const convex = useConvex()
  const transferInventory = useConvexMutation(convexApi.campaigns.inventoryTransfers.transfer)
  const retryCleanup = useConvexMutation(convexApi.campaigns.inventoryCleanup.retry)
  const [ownerValue, setOwnerValue] = useState('PARTY')
  const [destinationValue, setDestinationValue] = useState(() => {
    const assignedCharacter = campaign.memberships.find((member) => member.assignedCharacter)
    return assignedCharacter?.assignedCharacter
      ? `CHARACTER:${assignedCharacter.assignedCharacter.id}`
      : ''
  })
  const [assetValue, setAssetValue] = useState('')
  const [amount, setAmount] = useState(1)
  const [preparingTransfer, setPreparingTransfer] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const destinationOwner = destinationValue ? parseOwner(destinationValue, campaign.id) : null
  const vehicles = usePaginatedQuery(
    convexApi.campaigns.vehicles.list,
    partyOnly ? 'skip' : { campaignId: campaign.id },
    { initialNumItems: 48 }
  )
  const ownerOptions = getAuthorizedSourceOwners(campaign, currentUserId, vehicles.results)
  const selectedOwnerValue = ownerOptions.some((option) => option.value === ownerValue)
    ? ownerValue
    : 'PARTY'
  const sourceOwner = parseOwner(selectedOwnerValue, campaign.id)
  const cleanup = usePaginatedQuery(
    convexApi.campaigns.inventoryCleanup.pending,
    sourceOwner.kind === 'CHARACTER'
      ? 'skip'
      : {
          campaignId: campaign.id,
          ...(sourceOwner.kind === 'VEHICLE' ? { vehicleId: sourceOwner.vehicleId } : {})
        },
    { initialNumItems: 48 }
  )
  const cleanupNotices = [
    ...new Map(cleanup.results.map((notice) => [notice.jobId, notice])).values()
  ]
  const vehicleCleanupPending = sourceOwner.kind === 'VEHICLE' && cleanupNotices.length > 0
  const cleanupRetry = useMutation({
    mutationFn: (jobId: string) => retryCleanup({ campaignId: campaign.id, jobId })
  })
  const partyItems = usePaginatedQuery(
    convexApi.campaigns.partyInventory.items,
    sourceOwner.kind === 'CAMPAIGN' ? { campaignId: campaign.id } : 'skip',
    { initialNumItems: 48 }
  )
  const partyCurrencies = usePaginatedQuery(
    convexApi.campaigns.partyInventory.currencies,
    sourceOwner.kind === 'CAMPAIGN' ? { campaignId: campaign.id } : 'skip',
    { initialNumItems: 48 }
  )
  const vehicleItems = usePaginatedQuery(
    convexApi.campaigns.vehicleInventory.items,
    sourceOwner.kind === 'VEHICLE'
      ? { campaignId: campaign.id, vehicleId: sourceOwner.vehicleId }
      : 'skip',
    { initialNumItems: 48 }
  )
  const vehicleCurrencies = usePaginatedQuery(
    convexApi.campaigns.vehicleInventory.currencies,
    sourceOwner.kind === 'VEHICLE'
      ? { campaignId: campaign.id, vehicleId: sourceOwner.vehicleId }
      : 'skip',
    { initialNumItems: 48 }
  )
  const characterSlice = useQuery(
    convexApi.characters.sheetSlices.get,
    sourceOwner.kind === 'CHARACTER'
      ? { campaignId: campaign.id, id: sourceOwner.characterId, slice: 'INVENTORY' }
      : 'skip'
  )
  const characterSheet =
    characterSlice?.slice === 'INVENTORY'
      ? characterSlice.data
      : characterSlice === null
        ? null
        : undefined
  const ownerVersion = useQuery(convexApi.campaigns.inventoryOwners.version, {
    input: { campaignId: campaign.id, owner: sourceOwner }
  })
  const currencySystems = usePaginatedQuery(
    convexApi.campaigns.currencySystems.list,
    !partyOnly ? { campaignId: campaign.id } : 'skip',
    { initialNumItems: 48 }
  )
  const canManageInventory =
    campaign.capabilities.managePartyInventory && campaign.status === 'ACTIVE'
  const system = useQuery(
    convexApi.content.systems.get,
    !partyOnly ? { id: campaign.gameSystemId } : 'skip'
  )

  if (ownerValue !== selectedOwnerValue) {
    setOwnerValue(selectedOwnerValue)
    setAssetValue('')
  }
  useLoadAllPages(cleanup, 48)
  useLoadAllPages(vehicles, 48)
  useLoadAllPages(partyItems, 48)
  useLoadAllPages(partyCurrencies, 48)
  useLoadAllPages(vehicleItems, 48)
  useLoadAllPages(vehicleCurrencies, 48)
  useLoadAllPages(currencySystems, 48)

  const destinationOptions = getTransferDestinationOwners(campaign, vehicles.results)
  const currencyOptionsReady =
    !partyOnly && system !== undefined && currencySystems.status === 'Exhausted'
  const currencyOptions = currencyOptionsReady
    ? getCurrentCurrencyOptions(system, currencySystems.results, campaign.contentMaturity)
    : []
  const characterInventory =
    sourceOwner.kind === 'CHARACTER' && characterSheet && ownerVersion
      ? getCharacterInventory(characterSheet, sourceOwner, currencyOptions)
      : undefined
  const inventory =
    sourceOwner.kind === 'CHARACTER'
      ? characterInventory?.inventory
      : ownerVersion
        ? {
            owner: sourceOwner,
            version: ownerVersion.version,
            items: sourceOwner.kind === 'CAMPAIGN' ? partyItems.results : vehicleItems.results,
            currencies:
              sourceOwner.kind === 'CAMPAIGN' ? partyCurrencies.results : vehicleCurrencies.results
          }
        : undefined
  const inventoryLoading =
    ownerVersion === undefined ||
    (sourceOwner.kind === 'CAMPAIGN' &&
      (partyItems.status === 'LoadingFirstPage' ||
        partyCurrencies.status === 'LoadingFirstPage')) ||
    (sourceOwner.kind === 'VEHICLE' &&
      (vehicleItems.status === 'LoadingFirstPage' ||
        vehicleCurrencies.status === 'LoadingFirstPage')) ||
    (sourceOwner.kind === 'CHARACTER' && characterSheet === undefined)
  const carriedItems = (inventory?.items ?? []).filter((item) => !item.containerId)
  const carriedCurrencies = aggregateInventoryCurrencies(
    (inventory?.currencies ?? []).filter((currency) => !currency.containerId)
  )
  const containers = (inventory?.items ?? []).filter((item) => item.isContainer)
  const transferableCurrencies = aggregateInventoryCurrencies(
    (inventory?.currencies ?? [])
      .filter(
        (currency) =>
          Boolean(currency.kind) &&
          (currency.kind !== 'CAMPAIGN' || Boolean(currency.campaignCurrencySystemId))
      )
      .map((currency) => ({ ...currency, containerId: null }))
  )
  const assetOptions = [
    ...(inventory?.items ?? []).map((item) => ({
      value: `ITEM:${item.id}`,
      label: `${item.label} (${item.quantity})`,
      item
    })),
    ...transferableCurrencies.map((currency) => ({
      value: `CURRENCY:${inventoryCurrencyKey(currency)}`,
      label: `${currency.label} (${currency.amount} ${currency.abbreviation})`,
      currency
    }))
  ]
  const selectedAsset = assetOptions.find((option) => option.value === assetValue)
  const transfer = useMutation({
    mutationFn: (input: TransferCampaignInventoryInput) => transferInventory({ input }),
    onSuccess: () => {
      setTransferError(null)
      setAssetValue('')
    }
  })
  const canTransfer =
    campaign.status === 'ACTIVE' &&
    (sourceOwner.kind !== 'VEHICLE' || campaign.capabilities.managePartyInventory) &&
    (campaign.capabilities.managePartyInventory || campaign.capabilities.transferOwnInventory)
  const transferPending = preparingTransfer || transfer.isPending
  const sourceReady =
    !vehicleCleanupPending &&
    inventory !== undefined &&
    (sourceOwner.kind === 'CHARACTER'
      ? currencyOptionsReady
      : sourceOwner.kind === 'CAMPAIGN'
        ? partyItems.status === 'Exhausted' && partyCurrencies.status === 'Exhausted'
        : vehicleItems.status === 'Exhausted' && vehicleCurrencies.status === 'Exhausted')

  async function startTransfer() {
    if (
      transferPending ||
      !sourceReady ||
      !inventory ||
      !destinationOwner ||
      !selectedAsset ||
      destinationValue === selectedOwnerValue
    )
      return
    setPreparingTransfer(true)
    setTransferError(null)
    try {
      const fences = await convex.query(convexApi.campaigns.inventoryOwners.transferVersions, {
        input: { campaignId: campaign.id, source: sourceOwner, destination: destinationOwner }
      })
      if ('currency' in selectedAsset && !selectedAsset.currency.kind)
        throw new Error('Choose a currency with a current namespace.')
      const common = {
        campaignId: campaign.id,
        source: sourceOwner,
        destination: destinationOwner,
        amount,
        expectedSourceVersion: inventory.version,
        expectedDestinationVersion: fences.destinationVersion,
        idempotencyKey: crypto.randomUUID()
      }
      const input: TransferCampaignInventoryInput =
        'item' in selectedAsset
          ? { ...common, kind: 'ITEM', itemId: selectedAsset.item.id }
          : {
              ...common,
              kind: 'CURRENCY',
              campaignCurrencySystemId:
                selectedAsset.currency.kind === 'RULESET'
                  ? null
                  : selectedAsset.currency.campaignCurrencySystemId,
              denominationId: selectedAsset.currency.denominationId
            }
      transfer.mutate(input)
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : 'Transfer could not be prepared.')
    } finally {
      setPreparingTransfer(false)
    }
  }

  function resetTransferSelection() {
    transfer.reset()
    setTransferError(null)
  }

  return (
    <div className={partyOnly ? undefined : inventoryStyles.inventoryWorkspace}>
      <section
        className={`${sharedStyles.panel} ${inventoryStyles.inventoryPanel}`}
        aria-labelledby='inventory-title'
      >
        {!partyOnly ? (
          <>
            <div>
              <Title order={2} id='inventory-title'>
                Inventory
              </Title>
              <Text c='dimmed' size='sm'>
                Party custody and authorized assigned Characters.
              </Text>
            </div>
            <Select
              data={ownerOptions}
              classNames={{ input: sharedStyles.input }}
              disabled={transferPending}
              label='Inventory owner'
              value={selectedOwnerValue}
              onChange={(value) => {
                resetTransferSelection()
                setOwnerValue(value ?? 'PARTY')
                setAssetValue('')
              }}
            />
          </>
        ) : null}
        {cleanupNotices.map((notice) => (
          <Group key={notice.jobId} gap='xs' role='status' aria-live='polite'>
            {notice.status === 'RUNNING' ? <Loader size='xs' aria-hidden='true' /> : null}
            <Text size='sm'>
              {notice.status === 'FAILED'
                ? 'Inventory update needs a retry.'
                : sourceOwner.kind === 'VEHICLE'
                  ? 'Updating Vehicle cargo'
                  : 'Updating incoming inventory'}
            </Text>
            {notice.status === 'FAILED' && campaign.role === 'OWNER' && notice.retryReady ? (
              <Button
                size='compact-sm'
                variant='subtle'
                disabled={cleanupRetry.isPending}
                loading={cleanupRetry.isPending && cleanupRetry.variables === notice.jobId}
                onClick={() => cleanupRetry.mutate(notice.jobId)}
              >
                Retry update
              </Button>
            ) : null}
            {cleanupRetry.error && cleanupRetry.variables === notice.jobId ? (
              <Text c='red' size='sm'>
                Inventory update could not be retried.
              </Text>
            ) : null}
          </Group>
        ))}
        {characterInventory?.error ? <Alert color='red'>{characterInventory.error}</Alert> : null}
        {inventoryLoading ? (
          <Loader size='sm' />
        ) : partyOnly ? (
          <Accordion multiple defaultValue={['carried']}>
            <Accordion.Item value='carried'>
              <Accordion.Control>Carried</Accordion.Control>
              <Accordion.Panel>
                <InventoryEntries items={carriedItems} currencies={carriedCurrencies} />
              </Accordion.Panel>
            </Accordion.Item>
            {containers.map((container) => (
              <Accordion.Item key={container.id} value={container.id}>
                <Accordion.Control>{container.label}</Accordion.Control>
                <Accordion.Panel>
                  <InventoryEntries
                    items={(inventory?.items ?? []).filter(
                      (item) => item.containerId === container.id
                    )}
                    currencies={aggregateInventoryCurrencies(
                      (inventory?.currencies ?? []).filter(
                        (currency) => currency.containerId === container.id
                      )
                    )}
                  />
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        ) : sourceOwner.kind !== 'CHARACTER' && inventory && canManageInventory ? null : (
          <InventoryEntries
            items={inventory?.items ?? []}
            currencies={aggregateInventoryCurrencies(inventory?.currencies ?? [])}
          />
        )}
        {sourceOwner.kind !== 'CHARACTER' &&
        inventory &&
        canManageInventory &&
        !vehicleCleanupPending ? (
          <CampaignPartyInventoryActions
            key={selectedOwnerValue}
            campaignId={campaign.id}
            currencyOptions={currencyOptions}
            inventory={inventory}
          />
        ) : null}
        {canTransfer ? (
          <Stack gap='sm'>
            <Title order={3}>Transfer</Title>
            {transfer.error || transferError ? (
              <Alert color='red'>
                {transferError ?? transfer.error?.message}
                {transfer.variables && !transferPending ? (
                  <Button
                    ml='sm'
                    size='compact-sm'
                    variant='subtle'
                    onClick={() => transfer.mutate(transfer.variables)}
                  >
                    Retry transfer
                  </Button>
                ) : null}
              </Alert>
            ) : null}
            <div className={inventoryStyles.inventoryTransferGrid}>
              <Select
                data={assetOptions.map(({ value, label }) => ({ value, label }))}
                classNames={{ input: sharedStyles.input }}
                disabled={transferPending || !sourceReady}
                label='Item or currency'
                value={assetValue}
                onChange={(value) => {
                  resetTransferSelection()
                  setAssetValue(value ?? '')
                }}
              />
              <Select
                data={destinationOptions.filter((option) => option.value !== selectedOwnerValue)}
                classNames={{ input: sharedStyles.input }}
                disabled={transferPending || !sourceReady}
                label='Destination'
                value={destinationValue === selectedOwnerValue ? null : destinationValue}
                onChange={(value) => {
                  resetTransferSelection()
                  setDestinationValue(value ?? '')
                }}
              />
              <NumberInput
                classNames={{ input: sharedStyles.input }}
                disabled={transferPending || !sourceReady}
                label='Amount'
                min={1}
                step={1}
                value={amount}
                onChange={(value) => setAmount(Number(value) || 1)}
              />
              <Button
                disabled={
                  transferPending ||
                  !sourceReady ||
                  !assetValue ||
                  !destinationValue ||
                  destinationValue === selectedOwnerValue
                }
                loading={transferPending}
                onClick={() => void startTransfer()}
              >
                Transfer
              </Button>
            </div>
          </Stack>
        ) : null}
      </section>

      {!partyOnly && campaign.role === 'OWNER' ? (
        <section className={sharedStyles.panel} aria-labelledby='currency-systems-title'>
          <div>
            <Title order={2} id='currency-systems-title'>
              Currency systems
            </Title>
            <Text c='dimmed' size='sm'>
              Each system has one to five denominations and exactly one scale of 1.
            </Text>
          </div>
          {campaign.status === 'ACTIVE' ? (
            <CurrencySystemEditor campaignId={campaign.id} systems={currencySystems.results} />
          ) : (
            <Stack gap='xs'>
              {currencySystems.results.map((currencySystem) => (
                <div key={currencySystem.id}>
                  <Text fw={600}>{currencySystem.label}</Text>
                  <Text c='dimmed' size='sm'>
                    {currencySystem.denominations
                      .map(
                        (denomination) => `${denomination.label} (${denomination.scaleInReference})`
                      )
                      .join(', ')}
                  </Text>
                </div>
              ))}
            </Stack>
          )}
        </section>
      ) : null}
      {!partyOnly && campaign.role === 'OWNER' ? (
        <CampaignInventoryAudit campaign={campaign} />
      ) : null}
    </div>
  )
}

function InventoryEntries({
  items,
  currencies
}: {
  items: InventoryDto['items']
  currencies: ReturnType<typeof aggregateInventoryCurrencies>
}) {
  if (items.length === 0 && currencies.length === 0) return <Text c='dimmed'>Empty.</Text>
  return (
    <Stack gap='xs'>
      {items.map((item) => (
        <Group justify='space-between' key={item.id}>
          <Text>{item.label}</Text>
          <Text>{item.quantity}</Text>
        </Group>
      ))}
      {currencies.map((currency) => (
        <Group
          justify='space-between'
          key={JSON.stringify([inventoryCurrencyKey(currency), currency.containerId ?? null])}
        >
          <Text>{currency.label}</Text>
          <Text>
            {currency.amount} {currency.abbreviation}
          </Text>
        </Group>
      ))}
    </Stack>
  )
}
