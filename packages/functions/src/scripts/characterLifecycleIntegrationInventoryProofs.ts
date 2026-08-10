import assert from 'node:assert/strict'

import { type DBLike } from '@artificer-toolkit/db'
import { type CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import { dispatchAndReloadSheetCommand } from './characterLifecycleIntegrationAssertions.js'
import {
  requireRecordByLabel,
  type CharacterLifecycleFixture
} from './characterLifecycleIntegrationFixtures.js'
interface InventoryCommandFixtureState {
  containerId: string
  itemId: string
  sheet: CharacterSheetResponseDto
}

function requireAddedInventoryItem(
  before: CharacterSheetResponseDto,
  after: CharacterSheetResponseDto,
  equipmentId: string
): CharacterSheetResponseDto['inventory']['items'][number] {
  const existingIds = new Set(before.inventory.items.map(({ id }) => id))
  const added = after.inventory.items.filter(
    (item) => item.equipmentId === equipmentId && !existingIds.has(item.id)
  )
  assert.equal(
    added.length,
    1,
    'Expected one newly added inventory item for equipment ' + equipmentId + '.'
  )
  return added[0] as CharacterSheetResponseDto['inventory']['items'][number]
}

export async function proveInventoryItemCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto,
  attunementEquipmentId: string
): Promise<InventoryCommandFixtureState> {
  const containerEquipment = requireRecordByLabel(
    sheet.reference.equipmentOptions,
    'Backpack',
    'equipment option'
  )
  assert.equal(containerEquipment.isContainer, true)
  const attunementEquipment = sheet.reference.equipmentOptions.find(
    ({ id }) => id === attunementEquipmentId
  )
  assert.ok(
    attunementEquipment,
    'The transaction-local attunement equipment was not resolved for Sheet commands.'
  )
  assert.equal(attunementEquipment.requiresAttunement, true)

  let current = await dispatchAndReloadSheetCommand(db, fixture, sheet, {
    type: 'ADD_INVENTORY_ITEM',
    equipmentId: containerEquipment.id,
    quantity: 1,
    customName: 'Lifecycle Pack'
  })
  const container = requireAddedInventoryItem(sheet, current, containerEquipment.id)
  assert.ok(
    current.inventory.containers?.some(({ id }) => id === container.id),
    'The added Backpack was not exposed as a Sheet container.'
  )

  const beforeItem = current
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'ADD_INVENTORY_ITEM',
    equipmentId: attunementEquipment.id,
    quantity: 1
  })
  const item = requireAddedInventoryItem(beforeItem, current, attunementEquipment.id)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'UPDATE_INVENTORY_ITEM',
    itemId: item.id,
    quantity: 2,
    containerId: container.id,
    customName: 'Lifecycle Attunement Club',
    notes: 'Moved through the Sheet command integration proof.'
  })
  const movedItem = current.inventory.items.find(({ id }) => id === item.id)
  assert.ok(movedItem, 'The moved inventory item was not found.')
  assert.equal(movedItem.quantity, 2)
  assert.equal(movedItem.containerId, container.id)
  assert.equal(movedItem.customName, 'Lifecycle Attunement Club')
  assert.equal(movedItem.notes, 'Moved through the Sheet command integration proof.')

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'EQUIP_ITEM',
    itemId: item.id
  })
  assert.equal(current.inventory.items.find(({ id }) => id === item.id)?.equipped, true)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'UNEQUIP_ITEM',
    itemId: item.id
  })
  assert.equal(current.inventory.items.find(({ id }) => id === item.id)?.equipped, false)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'ATTUNE_ITEM',
    itemId: item.id
  })
  assert.equal(current.inventory.items.find(({ id }) => id === item.id)?.attuned, true)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'UNATTUNE_ITEM',
    itemId: item.id
  })
  assert.equal(current.inventory.items.find(({ id }) => id === item.id)?.attuned, false)

  return { containerId: container.id, itemId: item.id, sheet: current }
}

function getCurrencyAmount(
  sheet: CharacterSheetResponseDto,
  currencyId: string,
  containerId?: string
): number {
  return (
    sheet.inventory.currencies.find(
      (currency) => currency.currencyId === currencyId && currency.containerId === containerId
    )?.amount ?? 0
  )
}

export async function proveCurrencyCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  inventory: InventoryCommandFixtureState
): Promise<InventoryCommandFixtureState> {
  const currency = requireRecordByLabel(
    inventory.sheet.reference.currencyOptions,
    'Gold Piece',
    'currency option'
  )
  const initialCarriedAmount = getCurrencyAmount(inventory.sheet, currency.id)
  let current = await dispatchAndReloadSheetCommand(db, fixture, inventory.sheet, {
    type: 'ADJUST_CURRENCY',
    currencyId: currency.id,
    amount: 10
  })
  assert.equal(getCurrencyAmount(current, currency.id), initialCarriedAmount + 10)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'ADJUST_CURRENCY',
    currencyId: currency.id,
    amount: 4,
    containerId: inventory.containerId
  })
  assert.equal(getCurrencyAmount(current, currency.id, inventory.containerId), 4)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'MOVE_CURRENCY',
    currencyId: currency.id,
    amount: 3,
    toContainerId: inventory.containerId
  })
  assert.equal(getCurrencyAmount(current, currency.id), initialCarriedAmount + 7)
  assert.equal(getCurrencyAmount(current, currency.id, inventory.containerId), 7)
  assert.equal(
    current.inventory.containers
      ?.find(({ id }) => id === inventory.containerId)
      ?.currencies.find(({ currencyId }) => currencyId === currency.id)?.amount,
    7
  )

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'MOVE_CURRENCY',
    currencyId: currency.id,
    amount: 7,
    fromContainerId: inventory.containerId
  })
  assert.equal(getCurrencyAmount(current, currency.id), initialCarriedAmount + 14)
  assert.equal(getCurrencyAmount(current, currency.id, inventory.containerId), 0)

  return { ...inventory, sheet: current }
}

export async function proveInventoryRemovalCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  inventory: InventoryCommandFixtureState
): Promise<CharacterSheetResponseDto> {
  let current = await dispatchAndReloadSheetCommand(db, fixture, inventory.sheet, {
    type: 'UPDATE_INVENTORY_ITEM',
    itemId: inventory.itemId,
    containerId: null
  })
  assert.equal(
    current.inventory.items.find(({ id }) => id === inventory.itemId)?.containerId,
    undefined
  )

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'REMOVE_INVENTORY_ITEM',
    itemId: inventory.itemId
  })
  assert.equal(
    current.inventory.items.some(({ id }) => id === inventory.itemId),
    false
  )

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'REMOVE_INVENTORY_ITEM',
    itemId: inventory.containerId
  })
  assert.equal(
    current.inventory.items.some(({ id }) => id === inventory.containerId),
    false
  )

  return current
}

export async function proveNoteCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto
): Promise<CharacterSheetResponseDto> {
  const existingGroupIds = new Set(sheet.notes.groups?.map(({ id }) => id) ?? [])
  let current = await dispatchAndReloadSheetCommand(db, fixture, sheet, {
    type: 'CREATE_NOTE_GROUP',
    label: 'Lifecycle Notes'
  })
  const group = current.notes.groups?.find(
    ({ id, kind }) => kind === 'CUSTOM' && !existingGroupIds.has(id)
  )
  assert.ok(group, 'CREATE_NOTE_GROUP did not expose the persisted custom group.')

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'UPDATE_NOTE_GROUP',
    groupId: group.id,
    label: 'Lifecycle Session Notes',
    sortOrder: 0
  })
  const updatedGroup = current.notes.groups?.find(({ id }) => id === group.id)
  assert.equal(updatedGroup?.label, 'Lifecycle Session Notes')
  assert.equal(updatedGroup?.sortOrder, 0)

  const existingNoteIds = new Set(current.notes.items?.map(({ id }) => id) ?? [])
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'CREATE_NOTE',
    title: 'Lifecycle note',
    body: 'Created through the production Sheet command path.',
    groupId: group.id
  })
  const note = current.notes.items?.find(({ id }) => !existingNoteIds.has(id))
  assert.ok(note, 'CREATE_NOTE did not expose the persisted note.')

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'UPDATE_NOTE',
    noteId: note.id,
    title: 'Updated lifecycle note',
    body: 'Updated through the production Sheet command path.',
    pinned: true
  })
  const updatedNote = current.notes.items?.find(({ id }) => id === note.id)
  assert.equal(updatedNote?.title, 'Updated lifecycle note')
  assert.equal(updatedNote?.body, 'Updated through the production Sheet command path.')
  assert.equal(updatedNote?.pinned, true)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'DELETE_NOTE',
    noteId: note.id
  })
  assert.equal(current.notes.items?.some(({ id }) => id === note.id) ?? false, false)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'DELETE_NOTE_GROUP',
    groupId: group.id
  })
  assert.equal(current.notes.groups?.some(({ id }) => id === group.id) ?? false, false)

  return current
}
