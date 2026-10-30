import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey,
  type CharacterResourceOwnerRef,
  type CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'
import {
  temporaryHitPointsAfterLoss,
  temporaryHitPointsSet,
  withCharacterTemporaryHitPoints
} from '@artificer-toolkit/schema/shared/temporaryHitPoints'
import {
  EQUIPMENT_PROPERTY_CODE,
  HAND_CONFLICT_MESSAGE,
  nextEquipSlot,
  promotesOffHandItem,
  swapHeldItems,
  type HandSlotCode,
  type HeldItem
} from '@artificer-toolkit/shared/core'

import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterSheetCurrencyOptionDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { CharacterCurrencyIdentityDto } from '@artificer-toolkit/schema/shared/characterCurrency'

import {
  characterCurrencyIdentity,
  createCharacterCurrencyIdentityKey,
  currencyOptionIdentity
} from '@artificer-toolkit/schema/shared/characterCurrency'

import type {
  CharacterSheetCommandInputDto,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'

import type { CharacterSheetResponseDto as ReducerSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import {
  deathSavesAfterDamage,
  deathSavesAfterMarksSet,
  deathSavesAfterRoll,
  deathSavesAfterSheetEdit,
  isCharacterDying
} from '@artificer-toolkit/schema/shared/characterDeathSaves'
import { creatureConditionCapabilityRegistry } from '../platformPolicyModules.js'
import { CharacterSheetCommandError } from './sheetCommandError.js'
import { applyCharacterNoteCommand } from './sheetNotes.js'
import {
  buildSheetSpellSummon,
  withoutConcentrationSummons,
  type StatBlockSummonPlacement
} from './sheetSpellSummon.js'
import { applySpellSlotExchange, planSpellSlotExchange } from './sheetSpellSlotExchange.js'
export type SheetSpell = ReducerSheetResponseDto['spells']['spells'][number]
export type SheetSpellSource = NonNullable<SheetSpell['sources']>[number]
export type SheetSpellSlot = ReducerSheetResponseDto['spells']['slots'][number]
type SheetResource = ReducerSheetResponseDto['resources']['items'][number]
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
export function findResourceByOwner(
  resources: readonly SheetResource[],
  owner: CharacterResourceOwnerRef
): SheetResource | undefined {
  const ownerKey = createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner))
  return resources.find(
    (resource) =>
      createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(resource.owner)) === ownerKey
  )
}
function getSheetPreparationAvailableSpellIds(
  sheet: ReducerSheetResponseDto,
  classId: string
): Set<string> {
  const availableSpellIds = new Set<string>()
  const preparationSource = sheet.spells.preparationSources?.find(
    (source) => source.classId === classId
  )
  for (const spellId of preparationSource?.preparedSpellIds ?? []) availableSpellIds.add(spellId)
  for (const spell of sheet.spells.spells) {
    if (spell.sources?.some((source) => source.classId === classId && source.canPrepare))
      availableSpellIds.add(spell.id)
  }
  return availableSpellIds
}

type CharacterSheetStateCommand = CharacterSheetCommandInputDto extends infer Command
  ? Command extends CharacterSheetCommandInputDto
    ? Omit<Command, 'commandId'>
    : never
  : never

export { CharacterSheetCommandError } from './sheetCommandError.js'
export { getNoteGroups } from './sheetNotes.js'

export function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}

export function formatCodeLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getHitPointAdjustment(
  adjustments: readonly CharacterSheetAdjustment[],
  field: 'MAXIMUM_MODIFIER' | 'MAXIMUM_OVERRIDE'
): number | undefined {
  const adjustment = adjustments.find(
    (candidate) => candidate.family === 'HIT_POINTS' && candidate.field === field
  )
  return adjustment?.family === 'HIT_POINTS' ? adjustment.value : undefined
}

export function getSpellSlotKey(level: number): string {
  return `STANDARD:${level}`
}

export function parseSlotLevel(slotKey: string): number | null {
  const [, level] = slotKey.split(':')
  return level ? Number(level) : null
}

const MAX_NON_STACKABLE_COPIES_PER_COMMAND = 100

export function clearEmptyStateArrays(character: CharacterAuthored): CharacterAuthored {
  return {
    ...character,
    state: {
      ...character.state,
      currency: character.state.currency.filter((group) => group.currencies.length > 0),
      conditions: character.state.conditions?.length ? character.state.conditions : undefined,
      resources: character.state.resources?.length ? character.state.resources : undefined,
      spellSlots: character.state.spellSlots?.length ? character.state.spellSlots : undefined,
      classes: character.state.classes?.length ? character.state.classes : undefined,
      spellSummons: character.state.spellSummons?.length ? character.state.spellSummons : undefined,
      consequences: character.state.consequences?.length ? character.state.consequences : undefined
    }
  }
}

export function ensureResource(sheet: CharacterSheetResponseDto, resourceGrantId: string) {
  const resource = sheet.resources.items.find((item) => item.id === resourceGrantId)
  if (!resource)
    throw new CharacterSheetCommandError(
      `Resource "${resourceGrantId}" is not available on this character.`
    )
  return resource
}

export function ensureResourceByOwner(
  sheet: CharacterSheetResponseDto,
  owner: CharacterResourceOwnerRef
): SheetResource {
  const resource = findResourceByOwner(sheet.resources.items, owner)
  if (!resource)
    throw new CharacterSheetCommandError('Resource is not available on this character.')
  return resource
}

function ensureSpellSlot(sheet: CharacterSheetResponseDto, slotKey: string) {
  const slot = sheet.spells.slots.find((item) => item.slotKey === slotKey)
  if (!slot)
    throw new CharacterSheetCommandError(
      `Spell slot "${slotKey}" is not available on this character.`
    )
  return slot
}

export function resolveSpellCastSource(
  sheet: CharacterSheetResponseDto,
  command: Extract<CharacterSheetStateCommand, { type: 'CAST_SPELL' }>
): { source: SheetSpellSource | undefined; spell: SheetSpell } {
  const spell = sheet.spells.spells.find((candidate) => candidate.id === command.spellId)
  if (!spell)
    throw new CharacterSheetCommandError(
      `Spell "${command.spellId}" is not available on this character.`
    )
  const sources = spell.sources ?? []
  if (sources.length > 1 && !command.sourceId)
    throw new CharacterSheetCommandError('Choose a spell source before casting.')
  const source = command.sourceId
    ? sources.find((candidate) => candidate.id === command.sourceId)
    : sources[0]
  if (command.sourceId && !source)
    throw new CharacterSheetCommandError(
      `Spell source "${command.sourceId}" is not available for this spell.`
    )
  return { source, spell }
}

function resolveAvailableSpellCast(
  sheet: CharacterSheetResponseDto,
  command: Extract<CharacterSheetStateCommand, { type: 'CAST_SPELL' }>
): {
  source: SheetSpellSource | undefined
  spell: SheetSpell
  slotKey: string | undefined
  castLevel: number
} {
  const { source, spell } = resolveSpellCastSource(sheet, command)
  const sourceId = source?.id ?? source?.source.sourceInstanceId
  const entry = sheet.spells.activeGroups
    .flatMap((group) => group.entries)
    .find(
      (candidate) =>
        candidate.spellId === spell.id &&
        candidate.sourceId === sourceId &&
        candidate.cast.slotKey === command.slotKey
    )
  if (!entry) {
    throw new CharacterSheetCommandError(
      `Spell "${spell.label}" does not have a matching rule-approved cast.`
    )
  }
  if (!entry.available) {
    throw new CharacterSheetCommandError(
      entry.unavailableReason ?? `Spell "${spell.label}" is not available to cast.`
    )
  }
  return { source, spell, slotKey: entry.cast.slotKey, castLevel: entry.castLevel }
}

function ensureInventoryItem(character: CharacterAuthored, itemId: string) {
  const item = character.state.equipment.inventory.find((candidate) => candidate.id === itemId)
  if (!item)
    throw new CharacterSheetCommandError(`Inventory item "${itemId}" is not on this character.`)
  return item
}

function isSheetItemTwoHanded(sheet: CharacterSheetResponseDto, itemId: string): boolean {
  return (
    findInventoryItem(sheet, itemId)?.properties?.some(
      (property) => property.code === EQUIPMENT_PROPERTY_CODE.TWO_HANDED
    ) ?? false
  )
}

/** What the main and off hands hold now, with whether each item is two-handed. */
function heldItems(character: CharacterAuthored, sheet: CharacterSheetResponseDto): HeldItem[] {
  return character.state.equipment.equipped.flatMap(({ itemId, slot }) =>
    slot === 'WORN' ? [] : [{ id: itemId, slot, twoHanded: isSheetItemTwoHanded(sheet, itemId) }]
  )
}

/**
 * The Sheet UNEQUIP_ITEM transition without hand promotion. It reads no Sheet projection, so rule
 * settlement (shield stow, Disarm) reuses it: the item's slot is simply emptied.
 */
export function unequipCharacterItem(
  character: CharacterAuthored,
  itemId: string
): CharacterAuthored {
  ensureInventoryItem(character, itemId)
  return clearEmptyStateArrays({
    ...character,
    state: {
      ...character.state,
      equipment: {
        ...character.state.equipment,
        equipped: character.state.equipment.equipped.filter((entry) => entry.itemId !== itemId)
      }
    }
  })
}

/** Equips a carried item into a hand the caller has already chosen (an attack's draw, D107). */
export function drawCharacterItem(
  character: CharacterAuthored,
  itemId: string,
  slot: HandSlotCode
): CharacterAuthored {
  ensureInventoryItem(character, itemId)
  return {
    ...character,
    state: {
      ...character.state,
      equipment: {
        ...character.state.equipment,
        equipped: [...character.state.equipment.equipped, { itemId, slot }]
      }
    }
  }
}

export function updateSpellSlotUsage(
  character: CharacterAuthored,
  slotKey: string,
  updater: (used: number) => number
): CharacterAuthored {
  const existing = character.state.spellSlots ?? []
  const current = existing.find((slot) => slot.slotKey === slotKey)
  const used = Math.max(updater(current?.used ?? 0), 0)
  const updated = { ...current, slotKey, used }

  return clearEmptyStateArrays({
    ...character,
    state: {
      ...character.state,
      spellSlots: (current
        ? existing.map((slot) => (slot === current ? updated : slot))
        : [...existing, updated]
      ).filter((slot) => slot.used > 0 || slot.created)
    }
  })
}

/** Applies the already-authorized spell-slot transition used by CAST_SPELL. */
function applyApprovedSpellCastState(input: {
  character: CharacterAuthored
  slotKey: string | null
}): CharacterAuthored {
  if (input.slotKey === null) return clearEmptyStateArrays(input.character)
  return updateSpellSlotUsage(input.character, input.slotKey, (used) => used + 1)
}

type CharacterCurrencyGroup = CharacterAuthored['state']['currency'][number]
type CharacterCurrencyBalance = CharacterCurrencyGroup['currencies'][number]
type CurrencyBalanceLocation = {
  balance: CharacterCurrencyBalance
  identity: CharacterCurrencyIdentityDto
}

function assertCurrencyAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new CharacterSheetCommandError('Currency balances must be nonnegative safe integers.')
}

function toCurrencyAmount(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new CharacterSheetCommandError(
      'Currency balance exceeds the supported safe integer range.'
    )
  return Number(value)
}

function normalizeCharacterCurrencyGroups(
  groups: readonly CharacterCurrencyGroup[]
): CharacterCurrencyGroup[] {
  return groups.map((group) => {
    const identities = new Set<string>()
    return {
      ...group,
      currencies: group.currencies.map((balance) => {
        assertCurrencyAmount(balance.amount)
        const identity = characterCurrencyIdentity(balance)
        const key = createCharacterCurrencyIdentityKey(identity)
        if (identities.has(key))
          throw new CharacterSheetCommandError(
            `Currency "${balance.currencyId}" has duplicate identities in one currency group.`
          )
        identities.add(key)
        return { ...balance, ...identity }
      })
    }
  })
}

function findCurrencyBalanceLocations(
  groups: readonly CharacterCurrencyGroup[],
  containerId: string | undefined,
  currencyId: string,
  identity: CharacterCurrencyIdentityDto
): CurrencyBalanceLocation[] {
  const identityKey = createCharacterCurrencyIdentityKey(identity)
  return groups.flatMap((group) => {
    if (group.containerId !== containerId) return []
    return group.currencies.flatMap((balance) => {
      const balanceIdentity = characterCurrencyIdentity(balance)
      if (
        balance.currencyId !== currencyId ||
        createCharacterCurrencyIdentityKey(balanceIdentity) !== identityKey
      ) {
        return []
      }
      return [{ balance, identity: balanceIdentity }]
    })
  })
}

function sumCurrencyBalances(locations: readonly CurrencyBalanceLocation[]): bigint {
  return locations.reduce((total, location) => total + BigInt(location.balance.amount), 0n)
}

function replaceCurrencyAtPlacement(input: {
  groups: readonly CharacterCurrencyGroup[]
  containerId: string | undefined
  identity: CharacterCurrencyIdentityDto
  amount: number
  retainZero?: boolean
  createId: () => string
}): CharacterCurrencyGroup[] {
  const identityKey = createCharacterCurrencyIdentityKey(input.identity)
  let replaced = false
  const keepBalance = input.amount !== 0 || input.retainZero === true
  const groups = input.groups.map((group) => {
    if (group.containerId !== input.containerId) return group
    return {
      ...group,
      currencies: group.currencies.flatMap((balance) => {
        if (createCharacterCurrencyIdentityKey(characterCurrencyIdentity(balance)) !== identityKey)
          return [balance]
        if (replaced || !keepBalance) return []
        replaced = true
        return [{ ...balance, ...input.identity, amount: input.amount }]
      })
    }
  })

  if (replaced || !keepBalance) return groups
  const groupIndex = groups.findIndex((group) => group.containerId === input.containerId)
  if (groupIndex >= 0) {
    const group = groups[groupIndex]!
    groups[groupIndex] = {
      ...group,
      currencies: [...group.currencies, { ...input.identity, amount: input.amount }]
    }
    return groups
  }
  return [
    ...groups,
    {
      id: input.createId(),
      containerId: input.containerId,
      currencies: [{ ...input.identity, amount: input.amount }]
    }
  ]
}

function requireAcquirableCurrencyIdentity(
  command: Extract<CharacterSheetStateCommand, { type: 'ADJUST_CURRENCY' }>,
  options: readonly CharacterSheetCurrencyOptionDto[]
): CharacterCurrencyIdentityDto {
  const requestedKey = createCharacterCurrencyIdentityKey(characterCurrencyIdentity(command))
  for (const option of options) {
    const identity = currencyOptionIdentity(option)
    if (createCharacterCurrencyIdentityKey(identity) === requestedKey) return identity
  }
  throw new CharacterSheetCommandError(
    `Currency "${command.currencyId}" is not available for this system.`
  )
}

/**
 * D63: dropping to 0 hit points adds the System's 0 hit point condition, and regaining any removes
 * it. Dropping to 0 also ends the Sheet's Concentration and the summon that holds it (D190).
 */
function applyZeroHitPoints(character: CharacterAuthored, beforeCurrentHitPoints: number) {
  if (character.state.hitpoints.current === 0)
    character.state.spellSummons = withoutConcentrationSummons(character.state.spellSummons)
  const conditionTypeId = creatureConditionCapabilityRegistry.find(
    character.systemId
  )?.zeroHitPointsConditionDefinitionId
  if (!conditionTypeId) return
  const current = character.state.hitpoints.current
  const conditions = character.state.conditions ?? []
  const present = conditions.some((condition) => condition.conditionTypeId === conditionTypeId)
  if (beforeCurrentHitPoints > 0 && current === 0 && !present)
    character.state.conditions = [...conditions, { conditionTypeId }]
  else if (beforeCurrentHitPoints === 0 && current > 0 && present)
    character.state.conditions = conditions.filter(
      (condition) => condition.conditionTypeId !== conditionTypeId
    )
}

export function applyCharacterSheetCommand(
  character: CharacterAuthored,
  command: CharacterSheetStateCommand,
  sheet: CharacterSheetResponseDto,
  context: {
    adjustments?: readonly CharacterSheetAdjustment[]
    attunementSlotLimit?: number
    createId?: () => string
    now?: () => string
    /** The d20 the host rolled for ROLL_DEATH_SAVE; the reducer stays pure. */
    deathSaveDie?: number
    preparationEligibleSpellIdsByClassId?: ReadonlyMap<string, ReadonlySet<string>>
    /** The summon plan of a CAST_SPELL's cast, from the compile an Encounter runs (D190). */
    spellSummonPlacement?: (cast: {
      spellId: string
      castLevel: number
    }) => StatBlockSummonPlacement | null
    extraDefaults?: {
      creatures: ReadonlyMap<
        string,
        { hitPoints: number; hitDice?: { count: number; die: number } }
      >
      vehicles: ReadonlyMap<string, { hitPoints?: number }>
    }
  } = {}
): CharacterAuthored {
  switch (command.type) {
    case 'CREATE_NOTE':
    case 'UPDATE_NOTE':
    case 'DELETE_NOTE':
    case 'CREATE_NOTE_GROUP':
    case 'UPDATE_NOTE_GROUP':
    case 'DELETE_NOTE_GROUP':
      return clearEmptyStateArrays(applyCharacterNoteCommand(character, command, context))
  }
  const next = structuredClone(character)
  const createId = context.createId ?? (() => crypto.randomUUID())

  const ensureContainer = (containerId: string | undefined, movingItemId?: string) => {
    if (!containerId) return
    if (containerId === movingItemId)
      throw new CharacterSheetCommandError('An item cannot contain itself.')
    const container = sheet.inventory.containers?.find((candidate) => candidate.id === containerId)
    if (!container)
      throw new CharacterSheetCommandError(
        `Container "${containerId}" is not available on this character.`
      )
    const containerItem = next.state.equipment.inventory.find((item) => item.id === containerId)
    if (containerItem?.containerId)
      throw new CharacterSheetCommandError('Nested containers are not supported.')
  }

  const ensureEmptyContainer = (itemId: string) => {
    const containsItems = next.state.equipment.inventory.some((item) => item.containerId === itemId)
    const containsCurrency = next.state.currency.some((group) => group.containerId === itemId)
    const assignedToCreature = Object.values(next.state.creatureEquipment ?? {}).some(
      (assignments) => assignments.some((assignment) => assignment.equipmentItemId === itemId)
    )
    const assignedToVehicle = Object.values(next.state.vehicleEquipment ?? {}).some((assignments) =>
      assignments.some((assignment) => assignment.equipmentItemId === itemId)
    )
    if (containsItems || containsCurrency) {
      throw new CharacterSheetCommandError(
        'Move all items and currency out of this container before removing it.'
      )
    }
    if (assignedToCreature || assignedToVehicle) {
      throw new CharacterSheetCommandError('Unassign this item before removing it from inventory.')
    }
  }

  switch (command.type) {
    case 'UPSERT_SHEET_ADJUSTMENT':
    case 'REMOVE_SHEET_ADJUSTMENT':
    case 'RESET_SHEET_PANEL_ADJUSTMENTS':
    case 'SET_MOVEMENT_DISPLAY_PREFERENCE':
    case 'SET_PARTY_VISIBILITY':
    case 'UPDATE_SPELL_SOURCE_CUSTOMIZATION':
    case 'SET_SPELL_MECHANIC_CUSTOMIZATION':
    case 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION':
    case 'USE_SHEET_RESOURCE':
    case 'RECOVER_SHEET_RESOURCE':
      return clearEmptyStateArrays(next)

    case 'END_ACTIVE_EFFECT':
      return clearEmptyStateArrays(next)

    case 'END_CONCENTRATION':
      next.state.spellSummons = withoutConcentrationSummons(next.state.spellSummons)
      return clearEmptyStateArrays(next)

    case 'SET_INSPIRATION':
      next.state.inspiration = command.inspired || undefined
      return clearEmptyStateArrays(next)

    case 'ADD_SHEET_EXTRA': {
      if ('vehicleId' in command.extra) {
        const vehicle = context.extraDefaults?.vehicles.get(command.extra.vehicleId)
        const maximumHitPoints = Math.max(vehicle?.hitPoints ?? 0, 0)
        next.state.vehicles = [
          ...(next.state.vehicles ?? []),
          {
            id: createId(),
            vehicleId: command.extra.vehicleId,
            isActive: true,
            currentHitPoints: maximumHitPoints
          }
        ]
        return clearEmptyStateArrays(next)
      }

      const creature = context.extraDefaults?.creatures.get(command.extra.creatureId)
      const maximumHitPoints = Math.max(creature?.hitPoints ?? 0, 0)
      next.state.creatures = [
        ...(next.state.creatures ?? []),
        {
          id: createId(),
          creatureId: command.extra.creatureId,
          relationshipKind: command.extra.kind,
          originKind: command.extra.originKind,
          isActive: true,
          currentHitPoints: maximumHitPoints,
          hitDice: creature?.hitDice
            ? [{ die: creature.hitDice.die, total: creature.hitDice.count, used: 0 }]
            : undefined
        }
      ]
      return clearEmptyStateArrays(next)
    }

    case 'UPDATE_SHEET_EXTRA': {
      if (command.extra.kind === 'SPELL_SUMMON') {
        const extra = command.extra
        const summon = next.state.spellSummons?.find((entry) => entry.id === extra.extraId)
        if (!summon)
          throw new CharacterSheetCommandError(`Summon "${extra.extraId}" is not available.`)
        if (
          summon.maximumHitPoints === undefined &&
          (extra.currentHitPoints !== undefined || extra.tempHitPoints !== undefined)
        )
          throw new CharacterSheetCommandError(`Summon "${extra.extraId}" has no hit points.`)
        const currentHitPoints =
          extra.currentHitPoints === undefined || summon.maximumHitPoints === undefined
            ? summon.currentHitPoints
            : Math.min(extra.currentHitPoints, summon.maximumHitPoints)
        const tempHitPoints = extra.tempHitPoints ?? summon.tempHitPoints
        // A summon at 0 hit points is gone (D190).
        next.state.spellSummons = next.state.spellSummons?.flatMap((entry) =>
          entry.id !== extra.extraId
            ? [entry]
            : currentHitPoints === 0
              ? []
              : [
                  {
                    ...entry,
                    customName:
                      extra.customName === null
                        ? undefined
                        : (extra.customName ?? entry.customName),
                    notes: extra.notes === null ? undefined : (extra.notes ?? entry.notes),
                    ...(currentHitPoints === undefined ? {} : { currentHitPoints }),
                    ...(tempHitPoints ? { tempHitPoints } : { tempHitPoints: undefined })
                  }
                ]
        )
        return clearEmptyStateArrays(next)
      }
      const inventoryIds = new Set(next.state.equipment.inventory.map((item) => item.id))
      const ensureEquipmentAssignments = (itemIds: readonly string[] | undefined) => {
        if (!itemIds) return undefined
        const uniqueItemIds = [...new Set(itemIds)]
        const assignedElsewhere = new Set([
          ...Object.entries(next.state.creatureEquipment ?? {}).flatMap(([id, assignments]) =>
            command.extra.kind !== 'VEHICLE' && id === command.extra.extraId
              ? []
              : assignments.map((assignment) => assignment.equipmentItemId)
          ),
          ...Object.entries(next.state.vehicleEquipment ?? {}).flatMap(([id, assignments]) =>
            command.extra.kind === 'VEHICLE' && id === command.extra.extraId
              ? []
              : assignments.map((assignment) => assignment.equipmentItemId)
          )
        ])
        for (const itemId of uniqueItemIds) {
          if (!inventoryIds.has(itemId)) {
            throw new CharacterSheetCommandError(
              `Inventory item "${itemId}" is not available on this character.`
            )
          }
          if (assignedElsewhere.has(itemId)) {
            throw new CharacterSheetCommandError(
              `Inventory item "${itemId}" is already assigned to another extra.`
            )
          }
        }
        return uniqueItemIds.map((equipmentItemId) => ({ equipmentItemId }))
      }
      if (command.extra.kind === 'VEHICLE') {
        const { isActive } = command.extra
        const instance = next.state.vehicles?.find(
          (vehicle) => vehicle.id === command.extra.extraId
        )
        if (!instance) {
          throw new CharacterSheetCommandError(
            `Vehicle "${command.extra.extraId}" is not available.`
          )
        }
        const maximumHitPoints =
          sheet.extras.items.find(
            (item) => item.kind === 'VEHICLE' && item.id === command.extra.extraId
          )?.hitPoints?.maximum ?? 0
        next.state.vehicles = next.state.vehicles?.map((vehicle) =>
          vehicle.id !== command.extra.extraId
            ? vehicle
            : {
                ...vehicle,
                customName:
                  command.extra.customName === null
                    ? undefined
                    : (command.extra.customName ?? vehicle.customName),
                notes:
                  command.extra.notes === null ? undefined : (command.extra.notes ?? vehicle.notes),
                isActive: isActive ?? vehicle.isActive,
                currentHitPoints:
                  command.extra.currentHitPoints === undefined
                    ? vehicle.currentHitPoints
                    : clamp(command.extra.currentHitPoints, 0, maximumHitPoints)
              }
        )
        const assignments = ensureEquipmentAssignments(command.extra.equipmentItemIds)
        if (assignments) {
          next.state.vehicleEquipment = {
            ...next.state.vehicleEquipment,
            [command.extra.extraId]: assignments
          }
        }
        return clearEmptyStateArrays(next)
      }

      const creatureExtra = command.extra
      const instance = next.state.creatures?.find(
        (creature) => creature.id === creatureExtra.extraId
      )
      if (!instance || instance.relationshipKind !== creatureExtra.kind) {
        throw new CharacterSheetCommandError(
          `Creature "${creatureExtra.extraId}" is not available.`
        )
      }
      const sheetExtra = sheet.extras.items.find(
        (item) => item.kind === creatureExtra.kind && item.id === creatureExtra.extraId
      )
      const maximumHitPoints =
        sheetExtra?.kind === 'VEHICLE' ? 0 : (sheetExtra?.hitPoints?.maximum ?? 0)
      next.state.creatures = next.state.creatures?.map((creature) =>
        creature.id !== creatureExtra.extraId
          ? creature
          : {
              ...creature,
              customName:
                creatureExtra.customName === null
                  ? undefined
                  : (creatureExtra.customName ?? creature.customName),
              notes:
                creatureExtra.notes === null ? undefined : (creatureExtra.notes ?? creature.notes),
              isActive: creatureExtra.isActive ?? creature.isActive,
              currentHitPoints:
                creatureExtra.currentHitPoints === undefined
                  ? creature.currentHitPoints
                  : clamp(creatureExtra.currentHitPoints, 0, maximumHitPoints),
              tempHitPoints:
                creatureExtra.tempHitPoints === undefined
                  ? creature.tempHitPoints
                  : Math.max(creatureExtra.tempHitPoints, 0),
              hitDice:
                creatureExtra.hitDice === undefined
                  ? creature.hitDice
                  : creatureExtra.hitDice.map((die) => ({
                      die: die.die,
                      total: die.total,
                      used: Math.min(die.used, die.total)
                    }))
            }
      )
      const assignments = ensureEquipmentAssignments(creatureExtra.equipmentItemIds)
      if (assignments) {
        next.state.creatureEquipment = {
          ...next.state.creatureEquipment,
          [creatureExtra.extraId]: assignments
        }
      }
      return clearEmptyStateArrays(next)
    }

    case 'REMOVE_SHEET_EXTRA':
      if (command.extra.kind === 'SPELL_SUMMON') {
        const { extraId } = command.extra
        if (!next.state.spellSummons?.some((summon) => summon.id === extraId))
          throw new CharacterSheetCommandError(`Summon "${extraId}" is not available.`)
        next.state.spellSummons = next.state.spellSummons.filter((summon) => summon.id !== extraId)
        return clearEmptyStateArrays(next)
      }
      if (command.extra.kind === 'VEHICLE') {
        const existing = next.state.vehicles?.some(
          (vehicle) => vehicle.id === command.extra.extraId
        )
        if (!existing) {
          throw new CharacterSheetCommandError(
            `Vehicle "${command.extra.extraId}" is not available.`
          )
        }
        next.state.vehicles = next.state.vehicles?.filter(
          (vehicle) => vehicle.id !== command.extra.extraId
        )
        if (next.state.vehicleEquipment) {
          const { [command.extra.extraId]: _, ...vehicleEquipment } = next.state.vehicleEquipment
          next.state.vehicleEquipment = vehicleEquipment
        }
        return clearEmptyStateArrays(next)
      }
      const existing = next.state.creatures?.find(
        (creature) => creature.id === command.extra.extraId
      )
      if (!existing || existing.relationshipKind !== command.extra.kind) {
        throw new CharacterSheetCommandError(
          `Creature "${command.extra.extraId}" is not available.`
        )
      }
      next.state.creatures = next.state.creatures?.filter(
        (creature) => creature.id !== command.extra.extraId
      )
      if (next.state.creatureEquipment) {
        const { [command.extra.extraId]: _, ...creatureEquipment } = next.state.creatureEquipment
        next.state.creatureEquipment = creatureEquipment
      }
      return clearEmptyStateArrays(next)

    case 'SET_HIT_POINTS': {
      // A manual temporary hit point edit belongs to no effect (D156).
      if (command.temp != null)
        next.state.hitpoints = withCharacterTemporaryHitPoints(
          next.state.hitpoints,
          temporaryHitPointsSet(command.temp)
        )
      const maxHitPoints =
        command.maxOverride === undefined
          ? sheet.overview.maxHitPoints
          : command.maxOverride === null
            ? Number.MAX_SAFE_INTEGER
            : command.maxOverride
      next.state.hitpoints.current = clamp(
        command.current ?? next.state.hitpoints.current,
        0,
        maxHitPoints
      )
      next.state.hitpoints.deathSaves = deathSavesAfterSheetEdit({
        deathSaves: character.state.hitpoints.deathSaves,
        currentHitPoints: character.state.hitpoints.current,
        nextHitPoints: next.state.hitpoints.current,
        maximumHitPoints: maxHitPoints
      })
      applyZeroHitPoints(next, character.state.hitpoints.current)
      return clearEmptyStateArrays(next)
    }

    case 'ADJUST_HIT_POINTS': {
      const maxHitPoints = sheet.overview.maxHitPoints
      if (command.mode === 'HEAL') {
        next.state.hitpoints.current = clamp(
          next.state.hitpoints.current + command.amount,
          0,
          maxHitPoints
        )
        next.state.hitpoints.deathSaves = deathSavesAfterSheetEdit({
          deathSaves: character.state.hitpoints.deathSaves,
          currentHitPoints: character.state.hitpoints.current,
          nextHitPoints: next.state.hitpoints.current,
          maximumHitPoints: maxHitPoints
        })
      } else {
        const currentTemp = Math.max(next.state.hitpoints.temp, 0)
        const absorbed = Math.min(currentTemp, command.amount)
        const remainingDamage = command.amount - absorbed
        next.state.hitpoints = withCharacterTemporaryHitPoints(
          next.state.hitpoints,
          temporaryHitPointsAfterLoss(
            {
              amount: currentTemp,
              sourceEffectId: next.state.hitpoints.tempSourceEffectId ?? null
            },
            absorbed
          )
        )
        // Damage lands on the effective maximum when current HP stands above it.
        const standing = Math.min(next.state.hitpoints.current, maxHitPoints)
        next.state.hitpoints.current = clamp(standing - remainingDamage, 0, maxHitPoints)
        next.state.hitpoints.deathSaves = deathSavesAfterDamage({
          deathSaves: character.state.hitpoints.deathSaves,
          currentHitPoints: standing,
          maximumHitPoints: maxHitPoints,
          dealt: remainingDamage,
          critical: false
        })
      }
      applyZeroHitPoints(next, character.state.hitpoints.current)
      return clearEmptyStateArrays(next)
    }

    case 'USE_HIT_DIE': {
      const hitDie = next.state.hitpoints.hitDice.find((die) => die.die === command.die)
      if (!hitDie)
        throw new CharacterSheetCommandError(
          `No d${command.die} hit dice are available on this character.`
        )
      if (hitDie.used >= hitDie.total)
        throw new CharacterSheetCommandError(`All d${command.die} hit dice are already used.`)
      next.state.hitpoints.hitDice = next.state.hitpoints.hitDice.map((die) =>
        die.die === command.die ? { ...die, used: clamp(die.used + 1, 0, die.total) } : die
      )
      return clearEmptyStateArrays(next)
    }

    case 'SET_DEATH_SAVES': {
      if (next.state.hitpoints.current !== 0)
        throw new CharacterSheetCommandError('Death saves can only be set at 0 hit points.')
      next.state.hitpoints.deathSaves = deathSavesAfterMarksSet(command)
      return clearEmptyStateArrays(next)
    }

    case 'ROLL_DEATH_SAVE': {
      const { deathSaves, current } = next.state.hitpoints
      if (!isCharacterDying(deathSaves, current))
        throw new CharacterSheetCommandError('Only a dying Character makes a death save.')
      if (context.deathSaveDie === undefined)
        throw new Error('A death save needs the die the host rolled.')
      const roll = deathSavesAfterRoll(deathSaves, context.deathSaveDie)
      next.state.hitpoints.deathSaves = roll.deathSaves
      // The same outcome as the Encounter turn-start save: a natural 20 regains 1 hit point.
      if (roll.regainsHitPoint)
        next.state.hitpoints.current = Math.min(1, sheet.overview.maxHitPoints)
      applyZeroHitPoints(next, current)
      return clearEmptyStateArrays(next)
    }

    case 'COMPLETE_REST':
      throw new CharacterSheetCommandError(
        'Complete rest commands must be resolved against an authoritative rest preview.'
      )

    case 'SET_EXHAUSTION': {
      if (
        command.level < sheet.overview.exhaustion.minimumLevel ||
        command.level > sheet.overview.exhaustion.maximumLevel
      ) {
        throw new CharacterSheetCommandError(
          `Exhaustion level must be between ${sheet.overview.exhaustion.minimumLevel} and ${sheet.overview.exhaustion.maximumLevel}.`
        )
      }
      const notes = command.notes === undefined ? next.state.exhaustion?.notes : command.notes
      next.state.exhaustion =
        command.level > 0 ? { level: command.level, notes: notes || undefined } : undefined
      return clearEmptyStateArrays(next)
    }

    case 'ADD_CONDITION': {
      const conditionKnown = sheet.reference.conditionOptions.some(
        (condition) => condition.id === command.conditionTypeId
      )
      if (!conditionKnown)
        throw new CharacterSheetCommandError(
          `Condition "${command.conditionTypeId}" is not available for this system.`
        )
      const existing =
        next.state.conditions?.filter(
          (condition) => condition.conditionTypeId !== command.conditionTypeId
        ) ?? []
      next.state.conditions = [
        ...existing,
        {
          conditionTypeId: command.conditionTypeId,
          notes: command.notes
        }
      ]
      return clearEmptyStateArrays(next)
    }

    case 'REMOVE_CONDITION':
      next.state.conditions = next.state.conditions?.filter(
        (condition) => condition.conditionTypeId !== command.conditionTypeId
      )
      return clearEmptyStateArrays(next)

    case 'REMOVE_CONSEQUENCE':
      if (!next.state.consequences?.some(({ id }) => id === command.consequenceId))
        throw new CharacterSheetCommandError('That consequence is no longer recorded.')
      next.state.consequences = next.state.consequences.filter(
        ({ id }) => id !== command.consequenceId
      )
      return clearEmptyStateArrays(next)

    case 'USE_RESOURCE': {
      const resource = ensureResource(sheet, command.resourceGrantId)
      const amount = command.amount ?? 1
      if (amount > resource.remaining) {
        throw new CharacterSheetCommandError(
          `Resource "${resource.label}" only has ${resource.remaining} ${
            resource.remaining === 1 ? 'use' : 'uses'
          } remaining.`
        )
      }
      return next
    }

    case 'RESTORE_RESOURCE': {
      ensureResource(sheet, command.resourceGrantId)
      return next
    }

    case 'USE_SPELL_SLOT': {
      const slot = ensureSpellSlot(sheet, command.slotKey)
      if (slot.remaining < 1)
        throw new CharacterSheetCommandError(`Spell slot "${slot.label}" has no uses remaining.`)
      return updateSpellSlotUsage(next, command.slotKey, (used) => used + 1)
    }

    case 'RESTORE_SPELL_SLOT': {
      ensureSpellSlot(sheet, command.slotKey)
      return updateSpellSlotUsage(next, command.slotKey, (used) => (command.all ? 0 : used - 1))
    }

    case 'EXCHANGE_SPELL_SLOTS':
      return applySpellSlotExchange(next, planSpellSlotExchange(sheet, command))

    case 'CAST_SPELL': {
      const cast = resolveAvailableSpellCast(sheet, command)
      if (cast.slotKey) ensureSpellSlot(sheet, cast.slotKey)
      // A new Concentration replaces the one a summon holds.
      if (cast.spell.attributes?.includes('CONCENTRATION'))
        next.state.spellSummons = withoutConcentrationSummons(next.state.spellSummons)
      const placement = context.spellSummonPlacement?.({
        spellId: cast.spell.id,
        castLevel: cast.castLevel
      })
      if (placement)
        next.state.spellSummons = [
          ...(next.state.spellSummons ?? []),
          buildSheetSpellSummon({
            placement,
            casterHitPointMaximum: sheet.overview.maxHitPoints,
            spellId: cast.spell.id,
            label: cast.spell.label,
            id: createId(),
            castAt: (context.now ?? (() => new Date().toISOString()))()
          })
        ]
      return applyApprovedSpellCastState({ character: next, slotKey: cast.slotKey ?? null })
    }

    case 'SET_PREPARED_SPELLS': {
      if (!next.intent.classes.some((classIntent) => classIntent.classId === command.classId)) {
        throw new CharacterSheetCommandError(`Class "${command.classId}" is not on this character.`)
      }
      const preparedSpellIds = [...new Set(command.spellIds)]
      const preparationSource = sheet.spells.preparationSources?.find(
        (source) => source.classId === command.classId
      )
      if (!preparationSource && preparedSpellIds.length > 0) {
        throw new CharacterSheetCommandError(`Class "${command.classId}" does not prepare spells.`)
      }
      if (
        preparationSource?.preparedSpellLimit !== undefined &&
        preparedSpellIds.length > preparationSource.preparedSpellLimit
      ) {
        throw new CharacterSheetCommandError(
          `Class "${command.classId}" can prepare up to ${preparationSource.preparedSpellLimit} spells.`
        )
      }
      const availableSpellIds = context.preparationEligibleSpellIdsByClassId
        ? (context.preparationEligibleSpellIdsByClassId.get(command.classId) ?? new Set<string>())
        : getSheetPreparationAvailableSpellIds(sheet, command.classId)
      const unavailableSpell = preparedSpellIds.find((spellId) => !availableSpellIds.has(spellId))
      if (unavailableSpell)
        throw new CharacterSheetCommandError(
          `Spell "${unavailableSpell}" is not available for class "${command.classId}".`
        )
      const existing = next.state.classes ?? []
      const currentClassState = existing.find(
        (classState) => classState.classId === command.classId
      )
      const learned = currentClassState?.spells?.learned
      const spells = {
        ...(learned !== undefined ? { learned: [...new Set(learned)] } : {}),
        ...(preparedSpellIds.length ? { prepared: preparedSpellIds } : {})
      }
      const nextClassState =
        spells.learned || spells.prepared
          ? currentClassState
            ? { ...currentClassState, spells }
            : { classId: command.classId, spells }
          : null
      next.state.classes = currentClassState
        ? existing.flatMap((classState) =>
            classState.classId === command.classId
              ? nextClassState
                ? [nextClassState]
                : []
              : [classState]
          )
        : nextClassState
          ? [...existing, nextClassState]
          : existing
      return clearEmptyStateArrays(next)
    }

    case 'SET_KNOWN_SPELLS': {
      if (!next.intent.classes.some((classIntent) => classIntent.classId === command.classId)) {
        throw new CharacterSheetCommandError(`Class "${command.classId}" is not on this character.`)
      }
      const knownSpellIds = [...new Set(command.spellIds)]
      const availableSpellIds = new Set(
        sheet.spells.spells
          .filter((spell) =>
            spell.sources?.some(
              (source) =>
                source.classId === command.classId &&
                (source.source.sourceKind === 'CLASS' || source.source.sourceKind === 'SUBCLASS')
            )
          )
          .map((spell) => spell.id)
      )
      const unavailableSpell = knownSpellIds.find((spellId) => !availableSpellIds.has(spellId))
      if (unavailableSpell) {
        throw new CharacterSheetCommandError(
          `Spell "${unavailableSpell}" is not available for class "${command.classId}".`
        )
      }
      const existing = next.state.classes ?? []
      const currentClassState = existing.find(
        (classState) => classState.classId === command.classId
      )
      const spells = {
        learned: knownSpellIds,
        ...(currentClassState?.spells?.prepared?.length
          ? { prepared: currentClassState.spells.prepared }
          : {})
      }
      const nextClassState = { classId: command.classId, spells }
      next.state.classes = currentClassState
        ? existing.map((classState) =>
            classState.classId === command.classId ? nextClassState : classState
          )
        : [...existing, nextClassState]
      return clearEmptyStateArrays(next)
    }

    case 'ADD_INVENTORY_ITEM': {
      const equipment = sheet.reference.equipmentOptions.find(
        (candidate) => candidate.id === command.equipmentId
      )
      if (!equipment)
        throw new CharacterSheetCommandError(
          `Equipment "${command.equipmentId}" is not available for this character.`
        )
      if (command.containerId && equipment.isContainer) {
        throw new CharacterSheetCommandError('Nested containers are not supported.')
      }
      if (equipment.maxStack && equipment.maxStack > 1 && command.quantity > equipment.maxStack) {
        throw new CharacterSheetCommandError(
          `"${equipment.label}" stacks may contain at most ${equipment.maxStack} items.`
        )
      }
      if (equipment.maxStack === 1 && command.quantity > MAX_NON_STACKABLE_COPIES_PER_COMMAND) {
        throw new CharacterSheetCommandError(
          `Add at most ${MAX_NON_STACKABLE_COPIES_PER_COMMAND} non-stackable copies at a time.`
        )
      }
      ensureContainer(command.containerId)
      const addedItems = Array.from(
        { length: equipment.maxStack === 1 ? command.quantity : 1 },
        () => ({
          id: createId(),
          equipmentId: command.equipmentId,
          quantity: equipment.maxStack === 1 ? 1 : command.quantity,
          containerId: command.containerId,
          customName: command.customName,
          notes: command.notes
        })
      )
      next.state.equipment.inventory = [...next.state.equipment.inventory, ...addedItems]
      return clearEmptyStateArrays(next)
    }

    case 'REMOVE_INVENTORY_ITEM': {
      const existingItem = ensureInventoryItem(next, command.itemId)
      const quantityToRemove = command.quantity ?? existingItem.quantity
      const removesEntireStack = quantityToRemove >= existingItem.quantity
      if (removesEntireStack) ensureEmptyContainer(command.itemId)
      next.state.equipment.inventory = removesEntireStack
        ? next.state.equipment.inventory.filter((item) => item.id !== command.itemId)
        : next.state.equipment.inventory.map((item) =>
            item.id === command.itemId
              ? { ...item, quantity: item.quantity - quantityToRemove }
              : item
          )
      if (removesEntireStack) {
        next.state.equipment.equipped = next.state.equipment.equipped.filter(
          ({ itemId }) => itemId !== command.itemId
        )
        next.state.equipment.attuned = next.state.equipment.attuned.filter(
          (itemId) => itemId !== command.itemId
        )
      }
      return clearEmptyStateArrays(next)
    }

    case 'UPDATE_INVENTORY_ITEM': {
      const existingItem = ensureInventoryItem(next, command.itemId)
      const equipment = sheet.reference.equipmentOptions.find(
        (candidate) => candidate.id === existingItem.equipmentId
      )
      if (
        command.quantity !== undefined &&
        command.quantity > 0 &&
        equipment?.maxStack !== undefined &&
        command.quantity > equipment.maxStack
      ) {
        throw new CharacterSheetCommandError(
          `"${equipment.label}" stacks may contain at most ${equipment.maxStack} items.`
        )
      }
      if (command.quantity === 0) {
        ensureEmptyContainer(command.itemId)
        next.state.equipment.inventory = next.state.equipment.inventory.filter(
          (item) => item.id !== command.itemId
        )
        next.state.equipment.equipped = next.state.equipment.equipped.filter(
          ({ itemId }) => itemId !== command.itemId
        )
        next.state.equipment.attuned = next.state.equipment.attuned.filter(
          (itemId) => itemId !== command.itemId
        )
        return clearEmptyStateArrays(next)
      }

      if (command.containerId !== undefined && command.containerId !== null) {
        const movingItem = sheet.inventory.items.find((item) => item.id === command.itemId)
        if (movingItem?.capacity) {
          throw new CharacterSheetCommandError('Nested containers are not supported.')
        }
        ensureContainer(command.containerId, command.itemId)
      }

      next.state.equipment.inventory = next.state.equipment.inventory.map((item) =>
        item.id === command.itemId
          ? {
              ...item,
              quantity: command.quantity ?? item.quantity,
              containerId:
                command.containerId === null
                  ? undefined
                  : (command.containerId ?? item.containerId),
              customName:
                command.customName === null ? undefined : (command.customName ?? item.customName),
              notes: command.notes === null ? undefined : (command.notes ?? item.notes)
            }
          : item
      )
      return clearEmptyStateArrays(next)
    }

    case 'EQUIP_ITEM': {
      ensureInventoryItem(next, command.itemId)
      if (next.state.equipment.equipped.some((entry) => entry.itemId === command.itemId))
        return clearEmptyStateArrays(next)
      const assignment = nextEquipSlot(
        {
          id: command.itemId,
          category: findInventoryItem(sheet, command.itemId)?.category,
          twoHanded: isSheetItemTwoHanded(sheet, command.itemId)
        },
        heldItems(next, sheet)
      )
      if ('conflict' in assignment)
        throw new CharacterSheetCommandError(HAND_CONFLICT_MESSAGE[assignment.conflict])
      next.state.equipment.equipped = [
        ...next.state.equipment.equipped,
        { itemId: command.itemId, slot: assignment.slot }
      ]
      return clearEmptyStateArrays(next)
    }

    case 'SWAP_HELD_ITEMS': {
      const held = heldItems(next, sheet)
      if (held.length === 0) throw new CharacterSheetCommandError('No item is held to swap.')
      const swapped = swapHeldItems(held)
      if ('conflict' in swapped)
        throw new CharacterSheetCommandError(HAND_CONFLICT_MESSAGE[swapped.conflict])
      const slotByItemId = new Map(swapped.held.map(({ id, slot }) => [id, slot]))
      next.state.equipment.equipped = next.state.equipment.equipped.map((entry) => ({
        ...entry,
        slot: slotByItemId.get(entry.itemId) ?? entry.slot
      }))
      return clearEmptyStateArrays(next)
    }

    case 'UNEQUIP_ITEM': {
      const removed = next.state.equipment.equipped.find((entry) => entry.itemId === command.itemId)
      const unequipped = unequipCharacterItem(next, command.itemId)
      // Emptying the main hand moves an off-hand weapon into it; an off-hand shield stays put.
      const offHand = unequipped.state.equipment.equipped.find((entry) => entry.slot === 'OFF_HAND')
      if (
        offHand === undefined ||
        !promotesOffHandItem(removed?.slot, findInventoryItem(sheet, offHand.itemId)?.category)
      )
        return unequipped
      unequipped.state.equipment.equipped = unequipped.state.equipment.equipped.map((entry) =>
        entry === offHand ? { ...entry, slot: 'MAIN_HAND' } : entry
      )
      return unequipped
    }

    case 'ATTUNE_ITEM': {
      ensureInventoryItem(next, command.itemId)
      const sheetItem = sheet.inventory.items.find((item) => item.id === command.itemId)
      if (!sheetItem?.requiresAttunement) {
        throw new CharacterSheetCommandError(
          `Item "${command.itemId}" does not require attunement.`
        )
      }
      if (
        !next.state.equipment.attuned.includes(command.itemId) &&
        next.state.equipment.attuned.length >= (context.attunementSlotLimit ?? 3)
      ) {
        throw new CharacterSheetCommandError(
          `A character cannot attune to more than ${context.attunementSlotLimit ?? 3} items.`
        )
      }
      next.state.equipment.attuned = [...new Set([...next.state.equipment.attuned, command.itemId])]
      return clearEmptyStateArrays(next)
    }

    case 'UNATTUNE_ITEM':
      ensureInventoryItem(next, command.itemId)
      next.state.equipment.attuned = next.state.equipment.attuned.filter(
        (itemId) => itemId !== command.itemId
      )
      return clearEmptyStateArrays(next)

    case 'ADJUST_CURRENCY': {
      next.state.currency = normalizeCharacterCurrencyGroups(next.state.currency)
      const identity = requireAcquirableCurrencyIdentity(command, sheet.reference.currencyOptions)
      ensureContainer(command.containerId)
      const existing = findCurrencyBalanceLocations(
        next.state.currency,
        command.containerId,
        command.currencyId,
        identity
      )
      if (!Number.isSafeInteger(command.amount))
        throw new CharacterSheetCommandError('Currency adjustments must use safe integer amounts.')
      if (existing.length === 0 && command.amount <= 0) return clearEmptyStateArrays(next)
      const amount = sumCurrencyBalances(existing) + BigInt(command.amount)
      const nextAmount = toCurrencyAmount(amount < 0n ? 0n : amount)
      next.state.currency = replaceCurrencyAtPlacement({
        groups: next.state.currency,
        containerId: command.containerId,
        identity,
        amount: nextAmount,
        retainZero: true,
        createId
      })
      return clearEmptyStateArrays(next)
    }

    case 'MOVE_CURRENCY': {
      next.state.currency = normalizeCharacterCurrencyGroups(next.state.currency)
      ensureContainer(command.fromContainerId)
      ensureContainer(command.toContainerId)
      if (command.fromContainerId === command.toContainerId) return clearEmptyStateArrays(next)

      const identity = characterCurrencyIdentity(command)
      const source = findCurrencyBalanceLocations(
        next.state.currency,
        command.fromContainerId,
        command.currencyId,
        identity
      )
      const destination = findCurrencyBalanceLocations(
        next.state.currency,
        command.toContainerId,
        command.currencyId,
        identity
      )
      if (!Number.isSafeInteger(command.amount) || command.amount <= 0)
        throw new CharacterSheetCommandError(
          'Currency moves must use positive safe integer amounts.'
        )
      const amount = BigInt(command.amount)

      const sourceAmount = sumCurrencyBalances(source)
      if (sourceAmount < amount)
        throw new CharacterSheetCommandError(
          'There is not enough currency in the source container.'
        )
      const destinationAmount = sumCurrencyBalances(destination)
      const nextDestinationAmount = toCurrencyAmount(destinationAmount + amount)
      const nextSourceAmount = toCurrencyAmount(sourceAmount - amount)

      next.state.currency = replaceCurrencyAtPlacement({
        groups: next.state.currency,
        containerId: command.fromContainerId,
        identity,
        amount: nextSourceAmount,
        createId
      })
      next.state.currency = replaceCurrencyAtPlacement({
        groups: next.state.currency,
        containerId: command.toContainerId,
        identity,
        amount: nextDestinationAmount,
        createId
      })
      return clearEmptyStateArrays(next)
    }

    default:
      return command satisfies never
  }
}

function findConditionLabel(
  sheet: CharacterSheetResponseDto | undefined,
  conditionTypeId: string
): string | undefined {
  return (
    sheet?.overview.conditions.find((condition) => condition.conditionTypeId === conditionTypeId)
      ?.label ??
    sheet?.reference.conditionOptions.find((condition) => condition.id === conditionTypeId)?.label
  )
}

function findResourceLabel(
  sheet: CharacterSheetResponseDto | undefined,
  resourceGrantId: string
): string | undefined {
  return sheet?.resources.items.find((resource) => resource.id === resourceGrantId)?.label
}

function findSpellSlotLabel(
  sheet: CharacterSheetResponseDto | undefined,
  slotKey: string
): string | undefined {
  return sheet?.spells.slots.find((slot) => slot.slotKey === slotKey)?.label
}

function findInventoryItem(
  sheet: CharacterSheetResponseDto | undefined,
  itemId: string
): CharacterSheetResponseDto['inventory']['items'][number] | undefined {
  return sheet?.inventory.items.find((item) => item.id === itemId)
}

function findInventoryItemLabel(
  sheet: CharacterSheetResponseDto | undefined,
  itemId: string
): string | undefined {
  return findInventoryItem(sheet, itemId)?.label
}

function findEquipmentOptionLabel(
  sheet: CharacterSheetResponseDto | undefined,
  equipmentId: string
): string | undefined {
  return sheet?.reference.equipmentOptions.find((item) => item.id === equipmentId)?.label
}

function findCurrencyLabel(
  sheet: CharacterSheetResponseDto | undefined,
  command: Extract<CharacterSheetStateCommand, { type: 'ADJUST_CURRENCY' | 'MOVE_CURRENCY' }>
): string | undefined {
  if (!sheet) return undefined
  const key = createCharacterCurrencyIdentityKey(characterCurrencyIdentity(command))
  return (
    sheet.reference.currencyOptions.find(
      (option) => createCharacterCurrencyIdentityKey(currencyOptionIdentity(option)) === key
    )?.label ??
    sheet.inventory.currencies.find(
      (row) => createCharacterCurrencyIdentityKey(characterCurrencyIdentity(row)) === key
    )?.label
  )
}

export function summarizeCharacterSheetCommand(
  command: CharacterSheetStateCommand,
  sheet?: CharacterSheetResponseDto
): string {
  switch (command.type) {
    case 'UPSERT_SHEET_ADJUSTMENT':
      return 'Character sheet adjustment updated'
    case 'REMOVE_SHEET_ADJUSTMENT':
      return 'Character sheet adjustment cleared'
    case 'RESET_SHEET_PANEL_ADJUSTMENTS':
      return 'Character sheet panel customizations reset'
    case 'SET_MOVEMENT_DISPLAY_PREFERENCE':
      return 'Primary movement display updated'
    case 'SET_PARTY_VISIBILITY':
      return 'Party visibility updated'
    case 'SET_SPELL_MECHANIC_CUSTOMIZATION':
      return 'Spell mechanic customization updated'
    case 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION':
      return 'Spell mechanic customization cleared'
    case 'UPDATE_SPELL_SOURCE_CUSTOMIZATION':
      return 'Spell source customization updated'
    case 'ADD_SHEET_EXTRA':
      return command.extra.kind === 'VEHICLE' ? 'Vehicle added' : 'Creature added'
    case 'UPDATE_SHEET_EXTRA':
      return command.extra.kind === 'VEHICLE'
        ? 'Vehicle updated'
        : command.extra.kind === 'SPELL_SUMMON'
          ? 'Summon updated'
          : 'Creature updated'
    case 'REMOVE_SHEET_EXTRA':
      return command.extra.kind === 'VEHICLE'
        ? 'Vehicle removed'
        : command.extra.kind === 'SPELL_SUMMON'
          ? 'Summon dismissed'
          : 'Creature removed'

    case 'END_ACTIVE_EFFECT':
      return 'Active effect ended'

    case 'END_CONCENTRATION':
      return 'Concentration ended'

    case 'SET_INSPIRATION':
      return command.inspired ? 'Inspiration granted' : 'Inspiration cleared'

    case 'SET_HIT_POINTS':
      return 'Hit points updated'
    case 'ADJUST_HIT_POINTS':
      return command.mode === 'DAMAGE'
        ? `${command.amount} damage applied`
        : `${command.amount} HP restored`
    case 'USE_HIT_DIE':
      return `Used one d${command.die} hit die`
    case 'SET_DEATH_SAVES':
      return 'Death saves updated'
    case 'ROLL_DEATH_SAVE':
      return 'Death save rolled'
    case 'COMPLETE_REST':
      return command.restKind === 'LONG' ? 'Long rest completed' : 'Short rest completed'
    case 'SET_EXHAUSTION':
      return command.level > 0 ? `Exhaustion set to level ${command.level}` : 'Exhaustion cleared'
    case 'ADD_CONDITION':
      return `${findConditionLabel(sheet, command.conditionTypeId) ?? 'Condition'} added`
    case 'REMOVE_CONDITION':
      return `${findConditionLabel(sheet, command.conditionTypeId) ?? 'Condition'} removed`
    case 'REMOVE_CONSEQUENCE':
      return `${sheet?.overview.consequences.find(({ id }) => id === command.consequenceId)?.label ?? 'Consequence'} removed`
    case 'USE_RESOURCE':
      return `${findResourceLabel(sheet, command.resourceGrantId) ?? 'Resource'} used`
    case 'RESTORE_RESOURCE':
      return `${findResourceLabel(sheet, command.resourceGrantId) ?? 'Resource'} restored`
    case 'USE_SHEET_RESOURCE':
      return 'Sheet resource used'
    case 'RECOVER_SHEET_RESOURCE':
      return 'Sheet resource recovered'
    case 'USE_SPELL_SLOT': {
      const slotLabel = findSpellSlotLabel(sheet, command.slotKey)
      return slotLabel ? `${slotLabel} spell slot used` : 'Spell slot used'
    }
    case 'RESTORE_SPELL_SLOT': {
      const slotLabel = findSpellSlotLabel(sheet, command.slotKey)
      return slotLabel ? `${slotLabel} spell slot restored` : 'Spell slot restored'
    }
    case 'EXCHANGE_SPELL_SLOTS':
      return `${sheet?.actions.items.find((action) => action.id === command.actionId)?.label ?? 'Spell slot exchange'} used`
    case 'CAST_SPELL':
      return `${sheet?.spells.spells.find((spell) => spell.id === command.spellId)?.label ?? 'Spell'} cast`
    case 'SET_PREPARED_SPELLS':
      return 'Prepared spells updated'
    case 'SET_KNOWN_SPELLS':
      return 'Known spells updated'
    case 'ADD_INVENTORY_ITEM':
      return `${findEquipmentOptionLabel(sheet, command.equipmentId) ?? 'Inventory item'} added`
    case 'REMOVE_INVENTORY_ITEM': {
      const item = findInventoryItem(sheet, command.itemId)
      const label = item?.label ?? 'Inventory item'
      if (command.quantity !== undefined && (!item || command.quantity < item.quantity)) {
        return `${label} quantity reduced by ${command.quantity}`
      }
      return `${label} removed`
    }
    case 'UPDATE_INVENTORY_ITEM':
      return `${findInventoryItemLabel(sheet, command.itemId) ?? 'Inventory item'} updated`
    case 'EQUIP_ITEM':
      return `${findInventoryItemLabel(sheet, command.itemId) ?? 'Item'} equipped`
    case 'UNEQUIP_ITEM':
      return `${findInventoryItemLabel(sheet, command.itemId) ?? 'Item'} unequipped`
    case 'SWAP_HELD_ITEMS':
      return 'Held items swapped'
    case 'ATTUNE_ITEM':
      return `${findInventoryItemLabel(sheet, command.itemId) ?? 'Item'} attuned`
    case 'UNATTUNE_ITEM':
      return `${findInventoryItemLabel(sheet, command.itemId) ?? 'Item'} unattuned`
    case 'ADJUST_CURRENCY':
      return `${findCurrencyLabel(sheet, command) ?? 'Currency'} updated`
    case 'MOVE_CURRENCY':
      return `${findCurrencyLabel(sheet, command) ?? 'Currency'} moved`
    case 'CREATE_NOTE':
      return `Note "${command.title}" created`
    case 'UPDATE_NOTE':
      return 'Note updated'
    case 'DELETE_NOTE':
      return 'Note deleted'
    case 'CREATE_NOTE_GROUP':
      return `Note group "${command.label}" created`
    case 'UPDATE_NOTE_GROUP':
      return 'Note group updated'
    case 'DELETE_NOTE_GROUP':
      return 'Note group deleted'
    default:
      return command satisfies never
  }
}
