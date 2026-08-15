import { type CharacterSheetStatePatch } from '@artificer-toolkit/db'

import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey,
  type CharacterResourceOwnerRef,
  type CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'

import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import type {
  CharacterSheetCommandInputDto,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'

import type { CharacterSheetResponseDto as ReducerSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
export type SheetSpell = ReducerSheetResponseDto['spells']['spells'][number]
export type SheetSpellSource = NonNullable<SheetSpell['sources']>[number]
export type SheetSpellSlot = ReducerSheetResponseDto['spells']['slots'][number]
export type SheetResource = ReducerSheetResponseDto['resources']['items'][number]
export function createNamedError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}
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

export class CharacterSheetCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterSheetCommandError'
  }
}

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

const DEFAULT_NOTE_GROUPS = [
  { id: 'session-notes', label: 'Session Notes', sortOrder: 0, kind: 'SESSION' as const },
  { id: 'loot', label: 'Loot', sortOrder: 1, kind: 'LOOT' as const },
  { id: 'characters', label: 'Characters', sortOrder: 2, kind: 'CHARACTERS' as const },
  { id: 'places', label: 'Places', sortOrder: 3, kind: 'PLACES' as const }
]

const MAX_NON_STACKABLE_COPIES_PER_COMMAND = 100

export function getNoteGroups(character: CharacterAuthored) {
  const persistedGroups = character.state.noteGroups ?? []
  const builtInByKind = new Map(
    persistedGroups
      .filter(
        (group) =>
          group.kind !== 'CUSTOM' && !DEFAULT_NOTE_GROUPS.some((builtIn) => builtIn.id === group.id)
      )
      .map((group) => [group.kind, group])
  )

  return DEFAULT_NOTE_GROUPS.map((group) => builtInByKind.get(group.kind) ?? group)
    .concat(persistedGroups.filter((group) => group.kind === 'CUSTOM'))
    .sort(
      (left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
    )
}

export function clearEmptyStateArrays(character: CharacterAuthored): CharacterAuthored {
  return {
    ...character,
    state: {
      ...character.state,
      currency: character.state.currency.filter((group) => group.currencies.length > 0),
      conditions: character.state.conditions?.length ? character.state.conditions : undefined,
      resources: character.state.resources?.length ? character.state.resources : undefined,
      spellSlots: character.state.spellSlots?.length ? character.state.spellSlots : undefined,
      classes: character.state.classes?.length ? character.state.classes : undefined
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
  return { source, spell, slotKey: entry.cast.slotKey }
}

function ensureInventoryItem(character: CharacterAuthored, itemId: string) {
  const item = character.state.equipment.inventory.find((candidate) => candidate.id === itemId)
  if (!item)
    throw new CharacterSheetCommandError(`Inventory item "${itemId}" is not on this character.`)
  return item
}

function updateSpellSlotUsage(
  character: CharacterAuthored,
  slotKey: string,
  updater: (used: number) => number
): CharacterAuthored {
  const existing = character.state.spellSlots ?? []
  const next = new Map(existing.map((slot) => [slot.slotKey, slot.used]))
  const used = Math.max(updater(next.get(slotKey) ?? 0), 0)
  next.set(slotKey, used)

  return clearEmptyStateArrays({
    ...character,
    state: {
      ...character.state,
      spellSlots: [...next.entries()]
        .filter(([, amount]) => amount > 0)
        .map(([key, amount]) => ({ slotKey: key, used: amount }))
    }
  })
}

function setOptionalText(value: string | null | undefined): string | undefined {
  return value == null || value.trim().length === 0 ? undefined : value
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
    extraDefaults?: {
      creatures: ReadonlyMap<
        string,
        { hitPoints: number; hitDice?: { count: number; die: number } }
      >
      vehicles: ReadonlyMap<string, { hitPoints?: number }>
    }
  } = {}
): CharacterAuthored {
  const next = structuredClone(character)
  const createId = context.createId ?? (() => crypto.randomUUID())
  const now = context.now ?? (() => new Date().toISOString())

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

  const ensureNoteGroup = (groupId: string) => {
    const persistedGroup = next.state.noteGroups?.find((candidate) => candidate.id === groupId)
    if (
      persistedGroup &&
      !DEFAULT_NOTE_GROUPS.some((builtIn) => builtIn.id === persistedGroup.id)
    ) {
      return persistedGroup
    }

    const builtIn = DEFAULT_NOTE_GROUPS.find((candidate) => candidate.id === groupId)
    if (!builtIn) throw new CharacterSheetCommandError(`Note group "${groupId}" was not found.`)

    const existingBuiltIn = next.state.noteGroups?.find(
      (candidate) =>
        candidate.kind === builtIn.kind &&
        !DEFAULT_NOTE_GROUPS.some((definition) => definition.id === candidate.id)
    )
    if (existingBuiltIn) return existingBuiltIn

    const materialized = { ...builtIn, id: createId() }
    const replacedPseudoIds = new Set(
      (next.state.noteGroups ?? [])
        .filter((candidate) => candidate.kind === builtIn.kind)
        .map((candidate) => candidate.id)
    )
    next.state.noteGroups = [
      ...(next.state.noteGroups ?? []).filter((candidate) => candidate.kind !== builtIn.kind),
      materialized
    ]
    if (replacedPseudoIds.size > 0) {
      next.state.notes = next.state.notes?.map((note) =>
        replacedPseudoIds.has(note.groupId) ? { ...note, groupId: materialized.id } : note
      )
    }
    return materialized
  }

  switch (command.type) {
    case 'UPGRADE_RULE_PACK':
      return next

    case 'UPSERT_SHEET_ADJUSTMENT':
    case 'REMOVE_SHEET_ADJUSTMENT':
    case 'RESET_SHEET_PANEL_ADJUSTMENTS':
    case 'SET_MOVEMENT_DISPLAY_PREFERENCE':
    case 'UPDATE_SPELL_SOURCE_CUSTOMIZATION':
    case 'SET_SPELL_MECHANIC_CUSTOMIZATION':
    case 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION':
    case 'USE_SHEET_RESOURCE':
    case 'RECOVER_SHEET_RESOURCE':
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
      const inventoryIds = new Set(next.state.equipment.inventory.map((item) => item.id))
      const ensureEquipmentAssignments = (itemIds: readonly string[] | undefined) => {
        if (!itemIds) return undefined
        const uniqueItemIds = [...new Set(itemIds)]
        for (const itemId of uniqueItemIds) {
          if (!inventoryIds.has(itemId)) {
            throw new CharacterSheetCommandError(
              `Inventory item "${itemId}" is not available on this character.`
            )
          }
        }
        return uniqueItemIds.map((equipmentItemId) => ({ equipmentItemId }))
      }
      if (command.extra.kind === 'VEHICLE') {
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
          )?.hitPoints.maximum ?? 0
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
                isActive: command.extra.isActive ?? vehicle.isActive,
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
      if (!('tempHitPoints' in creatureExtra)) {
        throw new CharacterSheetCommandError(
          `Creature "${creatureExtra.extraId}" is not available.`
        )
      }
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
        sheetExtra?.kind === 'VEHICLE' ? 0 : (sheetExtra?.hitPoints.maximum ?? 0)
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
      next.state.hitpoints.temp = command.temp == null ? next.state.hitpoints.temp : command.temp
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
        return clearEmptyStateArrays(next)
      }

      const currentTemp = next.state.hitpoints.temp ?? 0
      const absorbed = Math.min(currentTemp, command.amount)
      const remainingDamage = command.amount - absorbed
      next.state.hitpoints.temp = Math.max(currentTemp - absorbed, 0)
      next.state.hitpoints.current = clamp(
        next.state.hitpoints.current - remainingDamage,
        0,
        maxHitPoints
      )
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

    case 'CAST_SPELL': {
      const cast = resolveAvailableSpellCast(sheet, command)
      if (!cast.slotKey) return clearEmptyStateArrays(next)
      ensureSpellSlot(sheet, cast.slotKey)
      return updateSpellSlotUsage(next, cast.slotKey, (used) => used + 1)
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
      const availableSpellIds = getSheetPreparationAvailableSpellIds(sheet, command.classId)
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
          (itemId) => itemId !== command.itemId
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
          (itemId) => itemId !== command.itemId
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

    case 'EQUIP_ITEM':
      ensureInventoryItem(next, command.itemId)
      next.state.equipment.equipped = [
        ...new Set([...next.state.equipment.equipped, command.itemId])
      ]
      return clearEmptyStateArrays(next)

    case 'UNEQUIP_ITEM':
      ensureInventoryItem(next, command.itemId)
      next.state.equipment.equipped = next.state.equipment.equipped.filter(
        (itemId) => itemId !== command.itemId
      )
      return clearEmptyStateArrays(next)

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
      const currencyKnown = sheet.reference.currencyOptions.some(
        (currency) => currency.id === command.currencyId
      )
      if (!currencyKnown)
        throw new CharacterSheetCommandError(
          `Currency "${command.currencyId}" is not available for this system.`
        )
      ensureContainer(command.containerId)
      const groupIndex = next.state.currency.findIndex(
        (group) => group.containerId === command.containerId
      )
      if (groupIndex < 0 && command.amount <= 0) return clearEmptyStateArrays(next)
      const groups =
        groupIndex >= 0
          ? next.state.currency
          : [
              ...next.state.currency,
              { id: createId(), containerId: command.containerId, currencies: [] }
            ]
      const targetIndex = groupIndex >= 0 ? groupIndex : groups.length - 1
      const group = groups[targetIndex]
      if (!group) return next

      const currencyIndex = group.currencies.findIndex(
        (currency) => currency.currencyId === command.currencyId
      )
      const currencies =
        currencyIndex >= 0
          ? group.currencies.map((currency) =>
              currency.currencyId === command.currencyId
                ? { ...currency, amount: Math.max(currency.amount + command.amount, 0) }
                : currency
            )
          : command.amount > 0
            ? [...group.currencies, { currencyId: command.currencyId, amount: command.amount }]
            : group.currencies
      groups[targetIndex] = { ...group, currencies }
      next.state.currency = groups
      return clearEmptyStateArrays(next)
    }

    case 'MOVE_CURRENCY': {
      ensureContainer(command.fromContainerId)
      ensureContainer(command.toContainerId)
      if (command.fromContainerId === command.toContainerId) return clearEmptyStateArrays(next)
      const sourceGroup = next.state.currency.find(
        (group) => group.containerId === command.fromContainerId
      )
      const available =
        sourceGroup?.currencies.find((currency) => currency.currencyId === command.currencyId)
          ?.amount ?? 0
      if (available < command.amount)
        throw new CharacterSheetCommandError(
          'There is not enough currency in the source container.'
        )
      const move = (containerId: string | undefined, amount: number) => {
        const groupIndex = next.state.currency.findIndex(
          (group) => group.containerId === containerId
        )
        if (groupIndex < 0) {
          if (amount > 0)
            next.state.currency.push({
              id: createId(),
              containerId,
              currencies: [{ currencyId: command.currencyId, amount }]
            })
          return
        }
        const group = next.state.currency[groupIndex]
        if (!group) return
        const existing = group.currencies.find(
          (currency) => currency.currencyId === command.currencyId
        )
        group.currencies = existing
          ? group.currencies
              .map((currency) =>
                currency.currencyId === command.currencyId
                  ? { ...currency, amount: currency.amount + amount }
                  : currency
              )
              .filter((currency) => currency.amount > 0)
          : [...group.currencies, { currencyId: command.currencyId, amount }]
      }
      move(command.fromContainerId, -command.amount)
      move(command.toContainerId, command.amount)
      return clearEmptyStateArrays(next)
    }

    case 'CREATE_NOTE': {
      const group = ensureNoteGroup(command.groupId)
      const timestamp = now()
      next.state.notes = [
        ...(next.state.notes ?? []),
        {
          id: createId(),
          title: command.title.trim(),
          body: setOptionalText(command.body),
          groupId: group.id,
          pinned: command.pinned || undefined,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ]
      return clearEmptyStateArrays(next)
    }

    case 'UPDATE_NOTE': {
      const existing = next.state.notes?.find((note) => note.id === command.noteId)
      if (!existing) throw new CharacterSheetCommandError('Note was not found.')
      const group = ensureNoteGroup(command.groupId ?? existing.groupId)
      next.state.notes = next.state.notes?.map((note) =>
        note.id === command.noteId
          ? {
              ...note,
              title: command.title?.trim() ?? note.title,
              body: command.body === null ? undefined : (command.body ?? note.body),
              groupId: group.id,
              pinned: command.pinned ?? note.pinned,
              updatedAt: now()
            }
          : note
      )
      return clearEmptyStateArrays(next)
    }

    case 'DELETE_NOTE':
      if (!next.state.notes?.some((note) => note.id === command.noteId))
        throw new CharacterSheetCommandError('Note was not found.')
      next.state.notes = next.state.notes.filter((note) => note.id !== command.noteId)
      return clearEmptyStateArrays(next)

    case 'CREATE_NOTE_GROUP':
      next.state.noteGroups = [
        ...(next.state.noteGroups ?? []),
        {
          id: createId(),
          label: command.label.trim(),
          sortOrder: Math.max(-1, ...getNoteGroups(next).map((group) => group.sortOrder)) + 1,
          kind: 'CUSTOM'
        }
      ]
      return clearEmptyStateArrays(next)

    case 'UPDATE_NOTE_GROUP': {
      const group = ensureNoteGroup(command.groupId)
      const updated = {
        ...group,
        label: command.label?.trim() ?? group.label,
        sortOrder: command.sortOrder ?? group.sortOrder
      }
      next.state.noteGroups = [
        ...(next.state.noteGroups ?? []).filter((candidate) => candidate.id !== group.id),
        updated
      ]
      return clearEmptyStateArrays(next)
    }

    case 'DELETE_NOTE_GROUP': {
      const group = ensureNoteGroup(command.groupId)
      if (group.kind !== 'CUSTOM')
        throw new CharacterSheetCommandError('Built-in note groups cannot be deleted.')
      if (next.state.notes?.some((note) => note.groupId === group.id))
        throw new CharacterSheetCommandError('Move or delete the notes in this group first.')
      next.state.noteGroups = next.state.noteGroups?.filter(
        (candidate) => candidate.id !== group.id
      )
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
  currencyId: string
): string | undefined {
  return sheet?.reference.currencyOptions.find((currency) => currency.id === currencyId)?.label
}

export function summarizeCharacterSheetCommand(
  command: CharacterSheetStateCommand,
  sheet?: CharacterSheetResponseDto
): string {
  switch (command.type) {
    case 'UPGRADE_RULE_PACK':
      return 'Character rules upgraded'
    case 'UPSERT_SHEET_ADJUSTMENT':
      return 'Character sheet adjustment updated'
    case 'REMOVE_SHEET_ADJUSTMENT':
      return 'Character sheet adjustment cleared'
    case 'RESET_SHEET_PANEL_ADJUSTMENTS':
      return 'Character sheet panel customizations reset'
    case 'SET_MOVEMENT_DISPLAY_PREFERENCE':
      return 'Primary movement display updated'
    case 'SET_SPELL_MECHANIC_CUSTOMIZATION':
      return 'Spell mechanic customization updated'
    case 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION':
      return 'Spell mechanic customization cleared'
    case 'UPDATE_SPELL_SOURCE_CUSTOMIZATION':
      return 'Spell source customization updated'
    case 'ADD_SHEET_EXTRA':
      return command.extra.kind === 'VEHICLE' ? 'Vehicle added' : 'Creature added'
    case 'UPDATE_SHEET_EXTRA':
      return command.extra.kind === 'VEHICLE' ? 'Vehicle updated' : 'Creature updated'
    case 'REMOVE_SHEET_EXTRA':
      return command.extra.kind === 'VEHICLE' ? 'Vehicle removed' : 'Creature removed'

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
    case 'COMPLETE_REST':
      return command.restKind === 'LONG' ? 'Long rest completed' : 'Short rest completed'
    case 'SET_EXHAUSTION':
      return command.level > 0 ? `Exhaustion set to level ${command.level}` : 'Exhaustion cleared'
    case 'ADD_CONDITION':
      return `${findConditionLabel(sheet, command.conditionTypeId) ?? 'Condition'} added`
    case 'REMOVE_CONDITION':
      return `${findConditionLabel(sheet, command.conditionTypeId) ?? 'Condition'} removed`
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
    case 'ATTUNE_ITEM':
      return `${findInventoryItemLabel(sheet, command.itemId) ?? 'Item'} attuned`
    case 'UNATTUNE_ITEM':
      return `${findInventoryItemLabel(sheet, command.itemId) ?? 'Item'} unattuned`
    case 'ADJUST_CURRENCY':
      return `${findCurrencyLabel(sheet, command.currencyId) ?? 'Currency'} updated`
    case 'MOVE_CURRENCY':
      return `${findCurrencyLabel(sheet, command.currencyId) ?? 'Currency'} moved`
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

function stateValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function createCharacterSheetStatePatches(
  current: CharacterAuthored,
  next: CharacterAuthored
): CharacterSheetStatePatch[] {
  const patches: CharacterSheetStatePatch[] = []

  if (!stateValuesEqual(current.state.inspiration, next.state.inspiration)) {
    patches.push({ kind: 'INSPIRATION', value: next.state.inspiration ?? false })
  }
  if (!stateValuesEqual(current.state.hitpoints, next.state.hitpoints)) {
    patches.push({ kind: 'HITPOINTS', value: next.state.hitpoints })
  }
  if (!stateValuesEqual(current.state.resources, next.state.resources)) {
    patches.push({ kind: 'RESOURCES', value: next.state.resources })
  }
  if (!stateValuesEqual(current.state.spellSlots, next.state.spellSlots)) {
    patches.push({ kind: 'SPELL_SLOTS', value: next.state.spellSlots })
  }
  if (!stateValuesEqual(current.state.classes, next.state.classes)) {
    patches.push({ kind: 'CLASS_SPELLS', value: next.state.classes })
  }
  if (!stateValuesEqual(current.state.conditions, next.state.conditions)) {
    patches.push({ kind: 'CONDITIONS', value: next.state.conditions })
  }
  if (!stateValuesEqual(current.state.exhaustion, next.state.exhaustion)) {
    patches.push({ kind: 'EXHAUSTION', value: next.state.exhaustion })
  }
  if (!stateValuesEqual(current.state.equipment, next.state.equipment)) {
    patches.push({
      kind: 'EQUIPMENT',
      value: next.state.equipment,
      creatureEquipment: next.state.creatureEquipment,
      vehicleEquipment: next.state.vehicleEquipment
    })
  }
  if (
    !stateValuesEqual(current.state.creatures, next.state.creatures) ||
    !stateValuesEqual(current.state.vehicles, next.state.vehicles) ||
    !stateValuesEqual(current.state.creatureEquipment, next.state.creatureEquipment) ||
    !stateValuesEqual(current.state.vehicleEquipment, next.state.vehicleEquipment)
  ) {
    patches.push({
      kind: 'EXTRAS',
      creatures: next.state.creatures ?? [],
      vehicles: next.state.vehicles ?? [],
      creatureEquipment: next.state.creatureEquipment ?? {},
      vehicleEquipment: next.state.vehicleEquipment ?? {}
    })
  }
  if (!stateValuesEqual(current.state.currency, next.state.currency)) {
    patches.push({ kind: 'CURRENCY', value: next.state.currency })
  }
  if (
    !stateValuesEqual(current.state.noteGroups, next.state.noteGroups) ||
    !stateValuesEqual(current.state.notes, next.state.notes)
  ) {
    patches.push({
      kind: 'NOTES',
      groups: next.state.noteGroups,
      notes: next.state.notes
    })
  }

  return patches
}
