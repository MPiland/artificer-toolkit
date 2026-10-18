import type { CharacterSheetInventoryDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  Select,
  Text
} from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { IconSettings } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  CharacterSheetCompactActions,
  CharacterSheetDetailPanel,
  CharacterSheetDetailRow
} from '../shared/CharacterSheetDetailPanel'
import { CharacterSheetInventoryList } from './CharacterSheetInventoryList'
import * as inventoryStyles from './inventory.css'
import * as detailStyles from '../shared/detail.css'
import * as panelStyles from '../shared/panel.css'
import * as rowStyles from '../shared/rows.css'
import type { OpenSheetPanel, SubmitSheetCommand } from '../core/CharacterSheet.types'
import {
  getInventoryCurrencyRows,
  getInventoryCurrencyTotals
} from './characterSheetInventory.utils'
import {
  characterCurrencyIdentity,
  createCharacterCurrencyIdentityKey,
  currencyOptionIdentity
} from '@artificer-toolkit/schema/shared/characterCurrency'
import { toNumber } from '../core/characterSheet.utils'
import { AppSelect } from '#ui/primitives/Select'
import { getCharacterSheetEquipmentOptions } from '#app/data/characters/queries'

export function CharacterSheetInventory({
  editable = true,
  hideTitle,
  openPanel,
  partyInventory,
  pending,
  sheet,
  submitCommand
}: {
  editable?: boolean
  hideTitle?: boolean
  openPanel?: OpenSheetPanel
  partyInventory?: ReactNode
  pending: boolean
  sheet: CharacterSheetInventoryDto
  submitCommand: SubmitSheetCommand
}) {
  const version = sheet.meta.streamVersion
  const isMobile = useMediaQuery('(max-width: 760px)', false)
  const [manageOpened, manage] = useDisclosure(false)
  const [equipmentId, setEquipmentId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [currencyAdjustmentKey, setCurrencyAdjustmentKey] = useState<string | null>(null)
  const [currencyMoveKey, setCurrencyMoveKey] = useState<string | null>(null)
  const [currencyAmount, setCurrencyAmount] = useState(1)
  const [containerId, setContainerId] = useState<string | null>(null)
  const [currencyFromContainerId, setCurrencyFromContainerId] = useState('carried')
  const [currencyToContainerId, setCurrencyToContainerId] = useState('carried')
  const equipmentOptionsQuery = useQuery(
    getCharacterSheetEquipmentOptions(
      manageOpened ? sheet.meta.characterId : undefined,
      sheet.meta.campaignId
    )
  )
  const equipmentOptions = equipmentOptionsQuery.data ?? sheet.reference.equipmentOptions
  const equipmentOptionsUnavailable =
    manageOpened && (equipmentOptionsQuery.isPending || equipmentOptionsQuery.isError)
  const containers = sheet.inventory.containers ?? []
  const currencyTotals = getInventoryCurrencyTotals(sheet)
  const currencyRows = getInventoryCurrencyRows(sheet)
  const currentCurrencyOptions = sheet.reference.currencyOptions.map((option) => {
    const identity = currencyOptionIdentity(option)
    return { ...option, identity, key: createCharacterCurrencyIdentityKey(identity) }
  })
  const currentCurrencyByKey = new Map(currentCurrencyOptions.map((option) => [option.key, option]))
  const heldCurrencyOptions = [
    ...new Map(
      sheet.inventory.currencies.map((currency) => {
        const identity = characterCurrencyIdentity(currency)
        return [
          createCharacterCurrencyIdentityKey(identity),
          { identity, key: createCharacterCurrencyIdentityKey(identity), label: currency.label }
        ] as const
      })
    ).values()
  ]
  const adjustmentKey = currentCurrencyByKey.has(currencyAdjustmentKey ?? '')
    ? currencyAdjustmentKey
    : (currentCurrencyOptions[0]?.key ?? null)
  const moveKey = heldCurrencyOptions.some((option) => option.key === currencyMoveKey)
    ? currencyMoveKey
    : (heldCurrencyOptions[0]?.key ?? null)
  const selectedEquipment = equipmentOptions.find((option) => option.id === equipmentId)
  const containerOptions = [
    { value: 'carried', label: 'Carried' },
    ...containers.map((container) => ({ value: container.id, label: container.label }))
  ]

  return (
    <CharacterSheetDetailPanel
      ariaId='character-sheet-inventory'
      hideTitle={hideTitle}
      title='Inventory'
      headerActions={
        editable ? (
          <Button
            leftSection={<IconSettings size={16} />}
            size='xs'
            variant='default'
            onClick={manage.open}
          >
            Manage Equipment
          </Button>
        ) : undefined
      }
    >
      <Accordion multiple defaultValue={['my-inventory']}>
        <Accordion.Item value='my-inventory'>
          <Accordion.Control>My Inventory</Accordion.Control>
          <Accordion.Panel>
            <div aria-label='Currency totals' className={inventoryStyles.inventorySummary}>
              {currencyTotals.map((currency) => (
                <span key={currency.id}>
                  <strong>{currency.amount}</strong>
                  <small>{currency.label}</small>
                </span>
              ))}
            </div>

            <Accordion multiple defaultValue={['carried']}>
              <Accordion.Item value='carried'>
                <Accordion.Control>Carried</Accordion.Control>
                <Accordion.Panel>
                  <CharacterSheetInventoryList
                    emptyLabel='No gear is being carried.'
                    items={sheet.inventory.items.filter(
                      (item) =>
                        !item.containerId &&
                        !item.category?.toLocaleLowerCase().includes('consumable')
                    )}
                    openPanel={openPanel}
                    resources={sheet.resources.items}
                  />
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value='consumables'>
                <Accordion.Control>Consumables</Accordion.Control>
                <Accordion.Panel>
                  <CharacterSheetInventoryList
                    emptyLabel='No consumables are being carried.'
                    items={sheet.inventory.items.filter(
                      (item) =>
                        !item.containerId &&
                        item.category?.toLocaleLowerCase().includes('consumable')
                    )}
                    openPanel={openPanel}
                    resources={sheet.resources.items}
                  />
                </Accordion.Panel>
              </Accordion.Item>

              {containers.map((container) => (
                <Accordion.Item key={container.id} value={`container:${container.id}`}>
                  <Accordion.Control>
                    <Group justify='space-between' wrap='nowrap'>
                      <div>
                        <Text fw={700}>{container.label}</Text>
                        <Text className={panelStyles.muted} size='sm'>
                          {container.capacity
                            ? `${container.capacity.amount} ${container.capacity.unit.toLocaleLowerCase()} capacity`
                            : 'Container'}
                        </Text>
                      </div>
                      <Badge variant='default'>{container.itemIds.length} items</Badge>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <section className={inventoryStyles.containerSection}>
                      <CharacterSheetInventoryList
                        emptyLabel='This container is empty.'
                        items={sheet.inventory.items.filter(
                          (item) => item.containerId === container.id
                        )}
                        openPanel={openPanel}
                        resources={sheet.resources.items}
                      />
                      {container.currencies.length ? (
                        <div
                          aria-label={`${container.label} currency`}
                          className={inventoryStyles.inventorySummary}
                        >
                          {getInventoryCurrencyRows(sheet, container.currencies).map((currency) => (
                            <span key={currency.id}>
                              <strong>{currency.amount}</strong>
                              <small>{currency.label}</small>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Accordion.Panel>
        </Accordion.Item>

        {partyInventory ? (
          <Accordion.Item value='party-inventory'>
            <Accordion.Control>Party Inventory</Accordion.Control>
            <Accordion.Panel>{partyInventory}</Accordion.Panel>
          </Accordion.Item>
        ) : null}
      </Accordion>

      <Drawer
        opened={manageOpened}
        onClose={manage.close}
        position={isMobile ? 'bottom' : 'right'}
        size={isMobile ? '92%' : 'lg'}
        title='Manage Equipment'
      >
        <div className={detailStyles.drawerStack}>
          <section className={detailStyles.drawerSection}>
            <Text fw={700}>Add an item</Text>
            {equipmentOptionsQuery.isPending ? (
              <Text c='dimmed' role='status' size='sm'>
                Loading equipment…
              </Text>
            ) : equipmentOptionsQuery.isError ? (
              <Alert color='red' role='alert' title='Equipment unavailable'>
                Equipment choices could not be loaded. Try again later.
              </Alert>
            ) : null}
            <AppSelect
              data={equipmentOptions.map((option) => ({
                value: option.id,
                label: option.label
              }))}
              disabled={pending || equipmentOptionsUnavailable}
              label='Equipment'
              placeholder='Choose an item'
              searchable
              value={equipmentId}
              onChange={(value) => {
                setEquipmentId(value)
                if (equipmentOptions.find((option) => option.id === value)?.isContainer) {
                  setContainerId(null)
                }
              }}
            />
            <div className={detailStyles.inlineControlRow}>
              <NumberInput
                disabled={pending || equipmentOptionsUnavailable}
                label='Quantity'
                min={1}
                value={quantity}
                onChange={(value) => setQuantity(Math.max(toNumber(value), 1))}
              />
              <Select
                data={
                  selectedEquipment?.isContainer
                    ? [{ value: 'carried', label: 'Carried' }]
                    : containerOptions
                }
                disabled={pending || equipmentOptionsUnavailable || selectedEquipment?.isContainer}
                label='Add to'
                value={containerId ?? 'carried'}
                onChange={(value) => setContainerId(value === 'carried' ? null : value)}
              />
            </div>
            <Button
              disabled={pending || equipmentOptionsUnavailable || !equipmentId}
              onClick={() => {
                if (!equipmentId) return
                void submitCommand({
                  type: 'ADD_INVENTORY_ITEM',
                  equipmentId,
                  quantity,
                  containerId: containerId ?? undefined,
                  expectedVersion: version
                })
                setEquipmentId(null)
                setQuantity(1)
              }}
            >
              Add Item
            </Button>
          </section>

          <section className={detailStyles.drawerSection}>
            <Text fw={700}>Move currency</Text>
            <Select
              data={containerOptions}
              disabled={pending}
              label='From'
              value={currencyFromContainerId}
              onChange={(value) => setCurrencyFromContainerId(value ?? 'carried')}
            />
            <Select
              data={containerOptions}
              disabled={pending}
              label='To'
              value={currencyToContainerId}
              onChange={(value) => setCurrencyToContainerId(value ?? 'carried')}
            />
            <Select
              data={heldCurrencyOptions.map((option) => ({
                value: option.key,
                label: option.label
              }))}
              disabled={pending || heldCurrencyOptions.length === 0}
              label='Currency type to move'
              value={moveKey}
              onChange={setCurrencyMoveKey}
            />
            <NumberInput
              disabled={pending}
              label='Amount to move'
              min={1}
              value={currencyAmount}
              onChange={(value) => setCurrencyAmount(Math.max(toNumber(value), 1))}
            />
            <Button
              disabled={pending || !moveKey || currencyFromContainerId === currencyToContainerId}
              onClick={async () => {
                if (!moveKey || currencyFromContainerId === currencyToContainerId) return
                const identity = heldCurrencyOptions.find(
                  (option) => option.key === moveKey
                )?.identity
                if (!identity) return
                await submitCommand({
                  type: 'MOVE_CURRENCY',
                  ...identity,
                  amount: currencyAmount,
                  fromContainerId:
                    currencyFromContainerId === 'carried' ? undefined : currencyFromContainerId,
                  toContainerId:
                    currencyToContainerId === 'carried' ? undefined : currencyToContainerId,
                  expectedVersion: version
                })
              }}
            >
              Move Currency
            </Button>
          </section>

          <section className={detailStyles.drawerSection}>
            <Text fw={700}>Move items</Text>
            {sheet.inventory.items.map((item) => (
              <div className={inventoryStyles.itemManagementRow} key={item.id}>
                <Text>{item.label}</Text>
                <Select
                  aria-label={`Move ${item.label}`}
                  data={item.capacity ? [{ value: 'carried', label: 'Carried' }] : containerOptions}
                  disabled={pending || Boolean(item.capacity && !item.containerId)}
                  value={item.containerId ?? 'carried'}
                  onChange={(value) =>
                    submitCommand({
                      type: 'UPDATE_INVENTORY_ITEM',
                      itemId: item.id,
                      containerId: value === 'carried' ? null : value,
                      expectedVersion: version
                    })
                  }
                />
              </div>
            ))}
          </section>

          <section className={detailStyles.drawerSection}>
            <Text fw={700}>Currency</Text>
            {currencyRows.map((currency) => (
              <CharacterSheetDetailRow
                key={currency.id}
                left={
                  <>
                    <Text fw={700}>{currency.label}</Text>
                    <Text className={panelStyles.muted}>{currency.amount}</Text>
                  </>
                }
                right={
                  <CharacterSheetCompactActions>
                    <Button
                      className={rowStyles.compactActionControl}
                      disabled={
                        pending ||
                        !currentCurrencyByKey.has(
                          createCharacterCurrencyIdentityKey(currency.identity)
                        )
                      }
                      size='xs'
                      variant='default'
                      onClick={() =>
                        submitCommand({
                          type: 'ADJUST_CURRENCY',
                          ...currency.identity,
                          amount: -1,
                          containerId: currency.containerId,
                          expectedVersion: version
                        })
                      }
                    >
                      -1
                    </Button>
                    <Button
                      className={rowStyles.compactActionControl}
                      disabled={
                        pending ||
                        !currentCurrencyByKey.has(
                          createCharacterCurrencyIdentityKey(currency.identity)
                        )
                      }
                      size='xs'
                      onClick={() =>
                        submitCommand({
                          type: 'ADJUST_CURRENCY',
                          ...currency.identity,
                          amount: 1,
                          containerId: currency.containerId,
                          expectedVersion: version
                        })
                      }
                    >
                      +1
                    </Button>
                  </CharacterSheetCompactActions>
                }
              />
            ))}
          </section>

          <section className={detailStyles.drawerSection}>
            <Select
              data={currentCurrencyOptions.map((option) => ({
                value: option.key,
                label: option.label
              }))}
              disabled={pending || currentCurrencyOptions.length === 0}
              label='Currency type'
              placeholder='Choose currency'
              searchable
              value={adjustmentKey}
              onChange={setCurrencyAdjustmentKey}
            />
            <NumberInput
              disabled={pending}
              label='Amount'
              value={currencyAmount}
              onChange={(value) => setCurrencyAmount(toNumber(value))}
            />
            <Button
              disabled={pending || !adjustmentKey || currencyAmount === 0}
              variant='default'
              onClick={() => {
                if (!adjustmentKey || currencyAmount === 0) return
                const identity = currentCurrencyByKey.get(adjustmentKey)?.identity
                if (!identity) return
                void submitCommand({
                  type: 'ADJUST_CURRENCY',
                  ...identity,
                  amount: currencyAmount,
                  expectedVersion: version
                })
                setCurrencyAmount(1)
              }}
            >
              Apply Currency
            </Button>
          </section>
        </div>
      </Drawer>
    </CharacterSheetDetailPanel>
  )
}
