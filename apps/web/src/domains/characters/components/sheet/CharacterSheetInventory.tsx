import { Badge, Button, Collapse, Drawer, Modal, NumberInput, Select, Tabs, Text, Textarea, TextInput } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { IconBackpack, IconCoin, IconSettings } from '@tabler/icons-react'
import { useState } from 'react'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import {
  CharacterSheetCompactActions,
  CharacterSheetDetailPanel,
  CharacterSheetDetailRow,
  CharacterSheetDetailRowList
} from './CharacterSheetDetailPanel'
import * as styles from './characterSheet.css'
import type { CharacterSheet, CharacterSheetSectionProps, SubmitSheetCommand } from './CharacterSheet.types'
import { formatInventoryItemProperties, formatInventoryItemSummary } from './characterSheetInventory.utils'
import { toNumber } from './characterSheet.utils'

function CharacterSheetInventoryItemRow({
  item,
  pending,
  submitCommand,
  version
}: {
  item: CharacterSheet['inventory']['items'][number]
  pending: boolean
  submitCommand: SubmitSheetCommand
  version: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [customName, setCustomName] = useState(item.customName ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [removeQuantity, setRemoveQuantity] = useState<number | undefined | null>(null)
  const properties = formatInventoryItemProperties(item)

  return (
    <div>
      <CharacterSheetDetailRow
        left={(
          <>
            <Text fw={700}>{item.label}</Text>
            {item.customName && item.equipmentLabel ? <Text className={styles.muted}>{item.equipmentLabel}</Text> : null}
            <Text className={styles.muted}>{formatInventoryItemSummary(item)}</Text>
            {properties
              ? (
                  <Text className={styles.muted}>
                    Properties:
                    {' '}
                    {properties}
                  </Text>
                )
              : null}
            {item.notes ? <Text className={styles.muted}>{item.notes}</Text> : null}
          </>
        )}
        right={(
          <CharacterSheetCompactActions>
            <Button
              className={styles.compactActionControl}
              aria-label={`Decrease ${item.label} quantity`}
              disabled={pending || item.quantity <= 0}
              size='xs'
              variant='default'
              onClick={() => {
                if (item.quantity === 1) {
                  setRemoveQuantity(1)
                  return
                }
                void submitCommand({ type: 'REMOVE_INVENTORY_ITEM', itemId: item.id, quantity: 1, expectedVersion: version })
              }}
            >
              -1
            </Button>
            <Button
              className={styles.compactActionControl}
              aria-label={`Increase ${item.label} quantity`}
              disabled={pending}
              size='xs'
              variant='default'
              onClick={() => submitCommand({
                type: 'UPDATE_INVENTORY_ITEM',
                itemId: item.id,
                quantity: item.quantity + 1,
                expectedVersion: version
              })}
            >
              +1
            </Button>
            <Button
              className={styles.compactActionControl}
              aria-label={`${item.equipped ? 'Unequip' : 'Equip'} ${item.label}`}
              disabled={pending}
              size='xs'
              variant={item.equipped ? 'default' : 'filled'}
              onClick={() => submitCommand({
                type: item.equipped ? 'UNEQUIP_ITEM' : 'EQUIP_ITEM',
                itemId: item.id,
                expectedVersion: version
              })}
            >
              {item.equipped ? 'Unequip' : 'Equip'}
            </Button>
            {item.requiresAttunement || item.attuned
              ? (
                  <Button
                    className={styles.compactActionControl}
                    aria-label={`${item.attuned ? 'Unattune' : 'Attune'} ${item.label}`}
                    disabled={pending}
                    size='xs'
                    variant={item.attuned ? 'default' : 'light'}
                    onClick={() => submitCommand({
                      type: item.attuned ? 'UNATTUNE_ITEM' : 'ATTUNE_ITEM',
                      itemId: item.id,
                      expectedVersion: version
                    })}
                  >
                    {item.attuned ? 'Unattune' : 'Attune'}
                  </Button>
                )
              : null}
            <Button
              className={styles.compactActionControl}
              aria-label={`Edit ${item.label} details`}
              disabled={pending}
              size='xs'
              variant='default'
              onClick={() => setExpanded((current) => !current)}
            >
              Details
            </Button>
            <Button
              className={styles.compactActionControl}
              aria-label={`Remove ${item.label}`}
              disabled={pending}
              size='xs'
              color='red'
              variant='subtle'
              onClick={() => setRemoveQuantity(undefined)}
            >
              Remove
            </Button>
          </CharacterSheetCompactActions>
        )}
      />
      <Collapse className={styles.inlineEditorShell} expanded={expanded}>
        <div className={styles.inlineEditor}>
          {item.description ? <AuthoredDetailProse html={item.description} fallback='' /> : null}
          <TextInput
            disabled={pending}
            label='Custom name'
            placeholder={item.label}
            value={customName}
            onChange={(event) => setCustomName(event.currentTarget.value)}
          />
          <Textarea
            autosize
            disabled={pending}
            label='Item notes'
            minRows={2}
            placeholder='Track charges, placement, ownership, or table notes.'
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
          />
          <div className={styles.compactActions}>
            <Button
              className={styles.compactActionControl}
              disabled={pending}
              size='xs'
              onClick={() => submitCommand({
                type: 'UPDATE_INVENTORY_ITEM',
                itemId: item.id,
                customName: customName.trim() || null,
                notes: notes.trim() || null,
                expectedVersion: version
              })}
            >
              Save Details
            </Button>
          </div>
        </div>
      </Collapse>
      <Modal
        opened={removeQuantity !== null}
        title={`Remove ${item.label}?`}
        onClose={() => setRemoveQuantity(null)}
      >
        <div className={styles.drawerStack}>
          <Text>
            {removeQuantity === 1
              ? `This removes the final ${item.label} and its custom details.`
              : `This removes all ${item.quantity} ${item.label} and their custom details.`}
          </Text>
          <div className={styles.compactActions}>
            <Button variant='default' onClick={() => setRemoveQuantity(null)}>Cancel</Button>
            <Button
              color='red'
              disabled={pending}
              onClick={async () => {
                const removed = await submitCommand({
                  type: 'REMOVE_INVENTORY_ITEM',
                  itemId: item.id,
                  quantity: removeQuantity ?? undefined,
                  expectedVersion: version
                })
                if (removed) setRemoveQuantity(null)
              }}
            >
              Remove item
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export function CharacterSheetInventory({
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  const version = sheet.meta.streamVersion
  const isMobile = useMediaQuery('(max-width: 760px)', false)
  const [manageOpened, manage] = useDisclosure(false)
  const [equipmentId, setEquipmentId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [currencyId, setCurrencyId] = useState<string | null>(sheet.reference.currencyOptions[0]?.id ?? null)
  const [currencyAmount, setCurrencyAmount] = useState(1)
  const [containerId, setContainerId] = useState<string | null>(null)
  const [currencyFromContainerId, setCurrencyFromContainerId] = useState('carried')
  const [currencyToContainerId, setCurrencyToContainerId] = useState('carried')
  const containers = sheet.inventory.containers ?? []
  const selectedEquipment = sheet.reference.equipmentOptions.find((option) => option.id === equipmentId)
  const containerOptions = [
    { value: 'carried', label: 'Carried' },
    ...containers.map((container) => ({ value: container.id, label: container.label }))
  ]

  return (
    <CharacterSheetDetailPanel
      ariaId='character-sheet-inventory'
      description='Equipment, attunement, and currency.'
      title='Equipment'
      headerActions={(
        <Button leftSection={<IconSettings size={16} />} size='xs' variant='default' onClick={manage.open}>
          Manage Equipment
        </Button>
      )}
    >
      <div className={styles.inventorySummary}>
        <div><IconBackpack size={20} /><span><strong>{sheet.inventory.items.length}</strong><small>Items</small></span></div>
        <div><IconCoin size={20} /><span><strong>{sheet.inventory.currencies.reduce((total, currency) => total + currency.amount, 0)}</strong><small>Coins</small></span></div>
        <div><span><strong>{sheet.inventory.items.filter((item) => item.attuned).length} / 3</strong><small>Attuned</small></span></div>
      </div>

      <Tabs defaultValue='equipped'>
        <Tabs.List className={styles.subsectionTabs}>
          <Tabs.Tab value='equipped'>Equipped</Tabs.Tab>
          <Tabs.Tab value='containers'>Containers</Tabs.Tab>
          <Tabs.Tab value='consumables'>Consumables</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value='equipped' pt='md'>
          <CharacterSheetDetailRowList>
            {sheet.inventory.items.filter((item) => item.equipped).length
              ? sheet.inventory.items.filter((item) => item.equipped).map((item) => (
                  <CharacterSheetInventoryItemRow item={item} key={`${version}:${item.id}`} pending={pending} submitCommand={submitCommand} version={version} />
                ))
              : <Text className={styles.muted}>No gear is equipped.</Text>}
          </CharacterSheetDetailRowList>
        </Tabs.Panel>
        <Tabs.Panel value='containers' pt='md'>
          <div className={styles.containerList}>
            <section className={styles.containerSection}>
              <div className={styles.containerHeading}><div><Text fw={700}>Carried</Text><Text className={styles.muted} size='sm'>Items not assigned to a container</Text></div><Badge variant='default'>{sheet.inventory.items.filter((item) => !item.containerId).length} items</Badge></div>
              {sheet.inventory.items.filter((item) => !item.containerId).map((item) => <CharacterSheetInventoryItemRow item={item} key={`${version}:${item.id}`} pending={pending} submitCommand={submitCommand} version={version} />)}
            </section>
            {containers.map((container) => (
              <section className={styles.containerSection} key={container.id}>
                <div className={styles.containerHeading}>
                  <div><Text fw={700}>{container.label}</Text><Text className={styles.muted} size='sm'>{container.capacity ? `${container.capacity.amount} ${container.capacity.unit.toLocaleLowerCase()} capacity` : 'Container'}</Text></div>
                  <Badge variant='default'>{container.itemIds.length} items</Badge>
                </div>
                {sheet.inventory.items.filter((item) => item.containerId === container.id).map((item) => <CharacterSheetInventoryItemRow item={item} key={`${version}:${item.id}`} pending={pending} submitCommand={submitCommand} version={version} />)}
                {container.currencies.length ? <Text className={styles.muted} size='sm'>{container.currencies.map((currency) => `${currency.amount} ${currency.label}`).join(' · ')}</Text> : null}
              </section>
            ))}
          </div>
        </Tabs.Panel>
        <Tabs.Panel value='consumables' pt='md'>
          <CharacterSheetDetailRowList>
            {sheet.inventory.items.filter((item) => item.category?.toLocaleLowerCase().includes('consumable')).length
              ? sheet.inventory.items.filter((item) => item.category?.toLocaleLowerCase().includes('consumable')).map((item) => <CharacterSheetInventoryItemRow item={item} key={`${version}:${item.id}`} pending={pending} submitCommand={submitCommand} version={version} />)
              : <Text className={styles.muted}>No consumables are being carried.</Text>}
          </CharacterSheetDetailRowList>
        </Tabs.Panel>
      </Tabs>

      <Drawer opened={manageOpened} onClose={manage.close} position={isMobile ? 'bottom' : 'right'} size={isMobile ? '92%' : 'lg'} title='Manage Equipment'>
        <div className={styles.drawerStack}>
          <section className={styles.drawerSection}>
            <Text fw={700}>Add an item</Text>
            <Select
              data={sheet.reference.equipmentOptions.map((option) => ({ value: option.id, label: option.label }))}
              disabled={pending}
              label='Equipment'
              placeholder='Choose an item'
              searchable
              value={equipmentId}
              onChange={(value) => {
                setEquipmentId(value)
                if (sheet.reference.equipmentOptions.find((option) => option.id === value)?.isContainer) {
                  setContainerId(null)
                }
              }}
            />
            <div className={styles.inlineControlRow}>
              <NumberInput disabled={pending} label='Quantity' min={1} value={quantity} onChange={(value) => setQuantity(Math.max(toNumber(value), 1))} />
              <Select
                data={selectedEquipment?.isContainer ? [{ value: 'carried', label: 'Carried' }] : containerOptions}
                disabled={pending || selectedEquipment?.isContainer}
                label='Add to'
                value={containerId ?? 'carried'}
                onChange={(value) => setContainerId(value === 'carried' ? null : value)}
              />
            </div>
            <Button disabled={pending || !equipmentId} onClick={() => {
              if (!equipmentId) return
              void submitCommand({ type: 'ADD_INVENTORY_ITEM', equipmentId, quantity, containerId: containerId ?? undefined, expectedVersion: version })
              setEquipmentId(null); setQuantity(1)
            }}>Add Item</Button>
          </section>

          <section className={styles.drawerSection}>
            <Text fw={700}>Move currency</Text>
            <Select data={containerOptions} disabled={pending} label='From' value={currencyFromContainerId} onChange={(value) => setCurrencyFromContainerId(value ?? 'carried')} />
            <Select data={containerOptions} disabled={pending} label='To' value={currencyToContainerId} onChange={(value) => setCurrencyToContainerId(value ?? 'carried')} />
            <Select
              data={sheet.reference.currencyOptions.map((option) => ({ value: option.id, label: option.label }))}
              disabled={pending}
              label='Currency type to move'
              value={currencyId}
              onChange={setCurrencyId}
            />
            <NumberInput disabled={pending} label='Amount to move' min={1} value={currencyAmount} onChange={(value) => setCurrencyAmount(Math.max(toNumber(value), 1))} />
            <Button
              disabled={pending || !currencyId || currencyFromContainerId === currencyToContainerId}
              onClick={async () => {
                if (!currencyId || currencyFromContainerId === currencyToContainerId) return
                await submitCommand({
                  type: 'MOVE_CURRENCY', currencyId, amount: currencyAmount,
                  fromContainerId: currencyFromContainerId === 'carried' ? undefined : currencyFromContainerId,
                  toContainerId: currencyToContainerId === 'carried' ? undefined : currencyToContainerId,
                  expectedVersion: version
                })
              }}
            >Move Currency</Button>
          </section>

          <section className={styles.drawerSection}>
            <Text fw={700}>Move items</Text>
            {sheet.inventory.items.map((item) => (
              <div className={styles.itemManagementRow} key={item.id}>
                <Text>{item.label}</Text>
                <Select
                  aria-label={`Move ${item.label}`}
                  data={item.capacity ? [{ value: 'carried', label: 'Carried' }] : containerOptions}
                  disabled={pending || Boolean(item.capacity && !item.containerId)}
                  value={item.containerId ?? 'carried'}
                  onChange={(value) => submitCommand({ type: 'UPDATE_INVENTORY_ITEM', itemId: item.id, containerId: value === 'carried' ? null : value, expectedVersion: version })}
                />
              </div>
            ))}
          </section>

          <section className={styles.drawerSection}>
            <Text fw={700}>Currency</Text>
            {sheet.inventory.currencies.map((currency) => (
              <CharacterSheetDetailRow
                key={`${currency.containerId ?? 'carried'}:${currency.currencyId}`}
                left={(
                  <>
                    <Text fw={700}>{currency.label}</Text>
                    <Text className={styles.muted}>{currency.amount}</Text>
                  </>
                )}
                right={(
                  <CharacterSheetCompactActions>
                    <Button
                      className={styles.compactActionControl}
                      disabled={pending}
                      size='xs'
                      variant='default'
                      onClick={() => submitCommand({
                        type: 'ADJUST_CURRENCY',
                        currencyId: currency.currencyId,
                        amount: -1,
                        containerId: currency.containerId,
                        expectedVersion: version
                      })}
                    >
                      -1
                    </Button>
                    <Button
                      className={styles.compactActionControl}
                      disabled={pending}
                      size='xs'
                      onClick={() => submitCommand({
                        type: 'ADJUST_CURRENCY',
                        currencyId: currency.currencyId,
                        amount: 1,
                        containerId: currency.containerId,
                        expectedVersion: version
                      })}
                    >
                      +1
                    </Button>
                  </CharacterSheetCompactActions>
                )}
              />
            ))}
          </section>

          <section className={styles.drawerSection}>
        <Select
          data={sheet.reference.currencyOptions.map((option) => ({
            value: option.id,
            label: option.label
          }))}
          disabled={pending || sheet.reference.currencyOptions.length === 0}
          label='Currency type'
          placeholder='Choose currency'
          searchable
          value={currencyId}
          onChange={setCurrencyId}
        />
        <NumberInput
          disabled={pending}
          label='Amount'
          value={currencyAmount}
          onChange={(value) => setCurrencyAmount(toNumber(value))}
        />
        <Button
          disabled={pending || !currencyId || currencyAmount === 0}
          variant='default'
          onClick={() => {
            if (!currencyId || currencyAmount === 0) return
            void submitCommand({
              type: 'ADJUST_CURRENCY',
              currencyId,
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
