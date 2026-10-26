import { deathSavesAfterMarksSet } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import type { CharacterSheetSliceResponseDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import {
  createCharacterResourceOwnerKey,
  createCharacterSpellSourceKey,
  toCharacterResourceOwnerKey
} from '@artificer-toolkit/shared/character'

import {
  EQUIPMENT_PROPERTY_CODE,
  nextEquipSlot,
  promotesOffHandItem,
  swapHeldItems,
  type HeldItem
} from '@artificer-toolkit/shared/core'

import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'

type SheetResource = CharacterSheetResponseDto['resources']['items'][number]
type SheetSpellSlot = CharacterSheetResponseDto['spells']['slots'][number]
type ResourceOwner = SheetResource['owner']

function resourceOwnerKey(owner: ResourceOwner): string {
  return createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner))
}

function sameResourceOwner(left: ResourceOwner, right: ResourceOwner): boolean {
  return resourceOwnerKey(left) === resourceOwnerKey(right)
}

function updateResource(resource: SheetResource, used: number): SheetResource {
  const nextUsed = Math.min(resource.max, Math.max(0, used))
  return {
    ...resource,
    used: nextUsed,
    remaining: resource.max - nextUsed
  }
}

function updateSlot(slot: SheetSpellSlot, used: number): SheetSpellSlot {
  const nextUsed = Math.min(slot.max, Math.max(0, used))
  return {
    ...slot,
    used: nextUsed,
    remaining: slot.max - nextUsed
  }
}

function projectResources<
  Sheet extends {
    resources: Pick<CharacterSheetResponseDto['resources'], 'items'>
    spells?: Pick<CharacterSheetResponseDto['spells'], 'spells'>
  }
>(sheet: Sheet, command: CharacterSheetCommandInputDto): Sheet {
  if (command.type === 'CAST_SPELL') {
    const spell = sheet.spells?.spells.find((candidate) => candidate.id === command.spellId)
    const sources = spell?.sources ?? []
    if (sources.length > 1 && !command.sourceId) return sheet
    const source = command.sourceId
      ? sources.find((candidate) => candidate.id === command.sourceId)
      : sources[0]
    const resourceOwner = source?.resourceOwner
    if (!resourceOwner) return sheet

    return {
      ...sheet,
      resources: {
        ...sheet.resources,
        items: sheet.resources.items.map((resource) =>
          sameResourceOwner(resource.owner, resourceOwner)
            ? updateResource(resource, resource.used + 1)
            : resource
        )
      }
    }
  }

  if (command.type === 'USE_SHEET_RESOURCE' || command.type === 'RECOVER_SHEET_RESOURCE') {
    return {
      ...sheet,
      resources: {
        ...sheet.resources,
        items: sheet.resources.items.map((resource) =>
          sameResourceOwner(resource.owner, command.owner)
            ? updateResource(
                resource,
                command.type === 'USE_SHEET_RESOURCE' ? resource.used + (command.amount ?? 1) : 0
              )
            : resource
        )
      }
    }
  }

  if (command.type === 'USE_RESOURCE' || command.type === 'RESTORE_RESOURCE') {
    return {
      ...sheet,
      resources: {
        ...sheet.resources,
        items: sheet.resources.items.map((resource) => {
          if (resource.id !== command.resourceGrantId) return resource
          if (command.type === 'USE_RESOURCE') {
            return updateResource(resource, resource.used + (command.amount ?? 1))
          }
          return updateResource(resource, command.all ? 0 : resource.used - (command.amount ?? 1))
        })
      }
    }
  }

  return sheet
}

function projectHitPoints<Sheet extends Pick<CharacterSheetResponseDto, 'overview'>>(
  sheet: Sheet,
  command: Extract<CharacterSheetCommandInputDto, { type: 'SET_HIT_POINTS' | 'ADJUST_HIT_POINTS' }>
): Sheet {
  if (command.type === 'SET_HIT_POINTS') {
    if (command.maxOverride !== undefined) return sheet

    return {
      ...sheet,
      overview: {
        ...sheet.overview,
        currentHitPoints:
          command.current === undefined
            ? sheet.overview.currentHitPoints
            : Math.min(sheet.overview.maxHitPoints, Math.max(0, command.current)),
        tempHitPoints:
          command.temp === undefined ? sheet.overview.tempHitPoints : Math.max(0, command.temp)
      }
    }
  }

  if (command.mode === 'HEAL') {
    return {
      ...sheet,
      overview: {
        ...sheet.overview,
        currentHitPoints: Math.min(
          sheet.overview.maxHitPoints,
          sheet.overview.currentHitPoints + command.amount
        )
      }
    }
  }

  const absorbed = Math.min(sheet.overview.tempHitPoints, command.amount)
  return {
    ...sheet,
    overview: {
      ...sheet.overview,
      currentHitPoints: Math.max(0, sheet.overview.currentHitPoints - (command.amount - absorbed)),
      tempHitPoints: sheet.overview.tempHitPoints - absorbed
    }
  }
}

function projectSpellSlots<Sheet extends Pick<CharacterSheetResponseDto, 'spells'>>(
  sheet: Sheet,
  command: CharacterSheetCommandInputDto
): Sheet {
  const slotKey =
    command.type === 'CAST_SPELL'
      ? command.slotKey
      : command.type === 'USE_SPELL_SLOT' || command.type === 'RESTORE_SPELL_SLOT'
        ? command.slotKey
        : undefined
  if (!slotKey) return sheet

  return {
    ...sheet,
    spells: {
      ...sheet.spells,
      slots: sheet.spells.slots.map((slot) => {
        if (slot.slotKey !== slotKey) return slot
        if (command.type === 'RESTORE_SPELL_SLOT') {
          return updateSlot(slot, command.all ? 0 : slot.used - 1)
        }
        return updateSlot(slot, slot.used + 1)
      })
    }
  }
}

function projectSpellSources<
  Sheet extends {
    spells: Pick<CharacterSheetResponseDto['spells'], 'activeGroups' | 'spells'> &
      Partial<Pick<CharacterSheetResponseDto['spells'], 'preparationSources'>>
  }
>(sheet: Sheet, command: CharacterSheetCommandInputDto): Sheet {
  if (command.type === 'UPDATE_SPELL_SOURCE_CUSTOMIZATION') {
    const sourceKey = createCharacterSpellSourceKey(command.source)
    return {
      ...sheet,
      spells: {
        ...sheet.spells,
        activeGroups: sheet.spells.activeGroups.map((group) => ({
          ...group,
          entries: group.entries.map((entry) =>
            createCharacterSpellSourceKey(entry.source) === sourceKey &&
            command.customName !== undefined
              ? {
                  ...entry,
                  displayName: command.customName ?? entry.displayName
                }
              : entry
          )
        })),
        spells: sheet.spells.spells.map((spell) => ({
          ...spell,
          sources: spell.sources?.map((source) =>
            createCharacterSpellSourceKey(source.source) === sourceKey
              ? {
                  ...source,
                  ...(command.customName !== undefined
                    ? { customName: command.customName ?? undefined }
                    : {}),
                  ...(command.notes !== undefined ? { notes: command.notes ?? undefined } : {}),
                  ...(command.displayAsAttack !== undefined
                    ? { displayAsAttack: command.displayAsAttack }
                    : {})
                }
              : source
          )
        }))
      }
    }
  }

  if (command.type === 'SET_KNOWN_SPELLS') {
    const knownSpellIds = new Set(command.spellIds)
    return {
      ...sheet,
      spells: {
        ...sheet.spells,
        spells: sheet.spells.spells.map((spell) => {
          const managedSource = (source: NonNullable<typeof spell.sources>[number]) =>
            source.classId === command.classId &&
            (source.source.sourceKind === 'CLASS' || source.source.sourceKind === 'SUBCLASS')
          const sources = spell.sources?.map((source) => {
            if (!managedSource(source) || source.prepared) return source
            return {
              ...source,
              acquisition: knownSpellIds.has(spell.id) ? ('KNOWN' as const) : undefined
            }
          })
          const hasManagedSource = spell.sources?.some(managedSource) ?? false
          const hasOtherKnownSource =
            spell.sources?.some(
              (source) => !managedSource(source) && source.acquisition === 'KNOWN'
            ) ?? false
          const known =
            hasOtherKnownSource || (hasManagedSource ? knownSpellIds.has(spell.id) : spell.known)
          return { ...spell, known, sources }
        })
      }
    }
  }

  if (command.type !== 'SET_PREPARED_SPELLS') return sheet

  const preparedSpellIds = new Set(command.spellIds)
  return {
    ...sheet,
    spells: {
      ...sheet.spells,
      ...('preparationSources' in sheet.spells
        ? {
            preparationSources: sheet.spells.preparationSources?.map((source) =>
              source.classId === command.classId
                ? { ...source, preparedSpellIds: command.spellIds }
                : source
            )
          }
        : {}),
      spells: sheet.spells.spells.map((spell) => {
        const sources = spell.sources?.map((source) =>
          source.classId === command.classId
            ? { ...source, prepared: preparedSpellIds.has(spell.id) }
            : source
        )
        return {
          ...spell,
          sources,
          prepared: sources?.some((source) => source.prepared) ?? spell.prepared
        }
      })
    }
  }
}

function projectInventory<Sheet extends Pick<CharacterSheetResponseDto, 'inventory'>>(
  sheet: Sheet,
  command: CharacterSheetCommandInputDto
): Sheet {
  if (command.type === 'REMOVE_INVENTORY_ITEM') {
    return {
      ...sheet,
      inventory: {
        ...sheet.inventory,
        items: sheet.inventory.items.flatMap((item) => {
          if (item.id !== command.itemId) return [item]
          const quantity = item.quantity - (command.quantity ?? item.quantity)
          return quantity > 0 ? [{ ...item, quantity }] : []
        })
      }
    }
  }

  if (command.type === 'UPDATE_INVENTORY_ITEM') {
    return {
      ...sheet,
      inventory: {
        ...sheet.inventory,
        items:
          command.quantity === 0
            ? sheet.inventory.items.filter((item) => item.id !== command.itemId)
            : sheet.inventory.items.map((item) =>
                item.id === command.itemId
                  ? {
                      ...item,
                      ...(command.quantity !== undefined ? { quantity: command.quantity } : {}),
                      ...(command.containerId !== undefined
                        ? { containerId: command.containerId ?? undefined }
                        : {}),
                      ...(command.customName !== undefined
                        ? { customName: command.customName ?? undefined }
                        : {}),
                      ...(command.notes !== undefined ? { notes: command.notes ?? undefined } : {})
                    }
                  : item
              )
      }
    }
  }

  if (
    command.type === 'EQUIP_ITEM' ||
    command.type === 'UNEQUIP_ITEM' ||
    command.type === 'SWAP_HELD_ITEMS'
  ) {
    return {
      ...sheet,
      inventory: {
        ...sheet.inventory,
        items: projectEquippedSlots(sheet.inventory.items, command)
      }
    }
  }

  if (command.type !== 'ATTUNE_ITEM' && command.type !== 'UNATTUNE_ITEM') return sheet

  return {
    ...sheet,
    inventory: {
      ...sheet.inventory,
      items: sheet.inventory.items.map((item) =>
        item.id === command.itemId ? { ...item, attuned: command.type === 'ATTUNE_ITEM' } : item
      )
    }
  }
}

type SheetInventoryItem = CharacterSheetResponseDto['inventory']['items'][number]

function isTwoHanded(item: SheetInventoryItem): boolean {
  return (
    item.properties?.some((property) => property.code === EQUIPMENT_PROPERTY_CODE.TWO_HANDED) ===
    true
  )
}

/** Applies the shared hand rules to the Sheet's items; a move the rules refuse changes nothing. */
function projectEquippedSlots(
  items: readonly SheetInventoryItem[],
  command: Extract<
    CharacterSheetCommandInputDto,
    { type: 'EQUIP_ITEM' | 'UNEQUIP_ITEM' | 'SWAP_HELD_ITEMS' }
  >
): SheetInventoryItem[] {
  const held = items.flatMap((item): HeldItem[] =>
    item.equippedSlot === 'MAIN_HAND' || item.equippedSlot === 'OFF_HAND'
      ? [{ id: item.id, slot: item.equippedSlot, twoHanded: isTwoHanded(item) }]
      : []
  )
  const slots = new Map<string, SheetInventoryItem['equippedSlot']>()

  if (command.type === 'EQUIP_ITEM') {
    const item = items.find((candidate) => candidate.id === command.itemId)
    if (item && item.equippedSlot === null) {
      const assignment = nextEquipSlot(
        { id: item.id, category: item.category, twoHanded: isTwoHanded(item) },
        held
      )
      if ('slot' in assignment) slots.set(item.id, assignment.slot)
    }
  } else if (command.type === 'UNEQUIP_ITEM') {
    slots.set(command.itemId, null)
    const removed = items.find((candidate) => candidate.id === command.itemId)
    const offHand = items.find((candidate) => candidate.equippedSlot === 'OFF_HAND')
    if (offHand && promotesOffHandItem(removed?.equippedSlot ?? undefined, offHand.category))
      slots.set(offHand.id, 'MAIN_HAND')
  } else {
    const swapped = swapHeldItems(held)
    if ('held' in swapped) for (const { id, slot } of swapped.held) slots.set(id, slot)
  }

  return items.map((item) =>
    slots.has(item.id) ? { ...item, equippedSlot: slots.get(item.id) ?? null } : item
  )
}

function projectExtras<Sheet extends Pick<CharacterSheetResponseDto, 'extras'>>(
  sheet: Sheet,
  command: CharacterSheetCommandInputDto
): Sheet {
  if (command.type === 'REMOVE_SHEET_EXTRA') {
    return {
      ...sheet,
      extras: {
        ...sheet.extras,
        items: sheet.extras.items.filter((extra) => extra.id !== command.extra.extraId)
      }
    }
  }

  if (command.type !== 'UPDATE_SHEET_EXTRA') return sheet

  return {
    ...sheet,
    extras: {
      ...sheet.extras,
      items: sheet.extras.items.map((item) => {
        if (item.id !== command.extra.extraId) return item
        // A summon's hit points can end it (D190); its row waits for the server.
        if (item.kind === 'SPELL_SUMMON' || command.extra.kind === 'SPELL_SUMMON') return item
        const displayName =
          command.extra.customName === undefined
            ? item.displayName
            : (command.extra.customName ?? item.authoredName)
        if (item.kind === 'VEHICLE') {
          if (command.extra.kind !== 'VEHICLE') return item
          return {
            ...item,
            ...(command.extra.customName !== undefined
              ? { customName: command.extra.customName ?? undefined, displayName }
              : {}),
            ...(command.extra.notes !== undefined
              ? { notes: command.extra.notes ?? undefined }
              : {}),
            ...(command.extra.isActive !== undefined ? { isActive: command.extra.isActive } : {}),
            ...(command.extra.currentHitPoints !== undefined
              ? { hitPoints: { ...item.hitPoints, current: command.extra.currentHitPoints } }
              : {}),
            ...(command.extra.equipmentItemIds !== undefined
              ? { equipmentItemIds: command.extra.equipmentItemIds }
              : {})
          }
        }
        if (command.extra.kind === 'VEHICLE') return item
        const creatureExtra = command.extra
        const hitDice = creatureExtra.hitDice
        return {
          ...item,
          ...(command.extra.customName !== undefined
            ? { customName: command.extra.customName ?? undefined, displayName }
            : {}),
          ...(command.extra.notes !== undefined ? { notes: command.extra.notes ?? undefined } : {}),
          ...(command.extra.isActive !== undefined ? { isActive: command.extra.isActive } : {}),
          ...(command.extra.currentHitPoints !== undefined ||
          command.extra.tempHitPoints !== undefined
            ? {
                hitPoints: {
                  ...item.hitPoints,
                  ...(command.extra.currentHitPoints !== undefined
                    ? { current: command.extra.currentHitPoints }
                    : {}),
                  ...(command.extra.tempHitPoints !== undefined
                    ? { temp: command.extra.tempHitPoints }
                    : {})
                }
              }
            : {}),
          ...(hitDice !== undefined
            ? {
                hitDice: item.hitDice.map((die) => {
                  const next = hitDice.find((candidate) => candidate.die === die.die)
                  return next
                    ? {
                        ...die,
                        total: next.total,
                        used: next.used,
                        remaining: next.total - next.used
                      }
                    : die
                })
              }
            : {}),
          ...(command.extra.equipmentItemIds !== undefined
            ? { equipmentItemIds: command.extra.equipmentItemIds }
            : {})
        }
      })
    }
  }
}

export function projectOptimisticCharacterSheetSlice<
  Response extends CharacterSheetSliceResponseDto
>(response: Response, command: CharacterSheetCommandInputDto): Response
export function projectOptimisticCharacterSheetSlice(
  response: CharacterSheetSliceResponseDto,
  command: CharacterSheetCommandInputDto
): CharacterSheetSliceResponseDto {
  if (response.data.meta.streamVersion !== command.expectedVersion) return response
  switch (response.slice) {
    case 'COMMON':
      return { ...response, data: projectCommon(response.data, command) }
    case 'ACTIONS':
      return {
        ...response,
        data: projectSpellSources(projectResources(response.data, command), command)
      }
    case 'SPELLS':
      return {
        ...response,
        data: projectSpellSlots(projectSpellSources(response.data, command), command)
      }
    case 'INVENTORY':
      return {
        ...response,
        data: projectResources(projectInventory(response.data, command), command)
      }
    case 'EXTRAS':
      return { ...response, data: projectExtras(response.data, command) }
    case 'FEATURES':
      return { ...response, data: projectResources(response.data, command) }
    case 'NOTES':
      return response
  }
}

/**
 * The whole Sheet with the command applied, for the room's push, which carries every slice. It
 * composes the same projections as the slice transform below.
 */
export function projectOptimisticCharacterSheet(
  sheet: CharacterSheetResponseDto,
  command: CharacterSheetCommandInputDto
): CharacterSheetResponseDto {
  if (sheet.meta.streamVersion !== command.expectedVersion) return sheet
  return projectCommon(
    projectExtras(
      projectResources(
        projectInventory(projectSpellSlots(projectSpellSources(sheet, command), command), command),
        command
      ),
      command
    ),
    command
  )
}

function projectCommon<
  Sheet extends Pick<CharacterSheetResponseDto, 'meta' | 'overview'> & {
    reference: Pick<CharacterSheetResponseDto['reference'], 'conditionOptions'>
  }
>(sheet: Sheet, command: CharacterSheetCommandInputDto): Sheet {
  switch (command.type) {
    case 'SET_INSPIRATION':
      return {
        ...sheet,
        overview: { ...sheet.overview, inspiration: command.inspired }
      }
    case 'SET_EXHAUSTION':
      return {
        ...sheet,
        overview: {
          ...sheet.overview,
          exhaustion: {
            ...sheet.overview.exhaustion,
            level: command.level,
            notes:
              command.notes === undefined
                ? sheet.overview.exhaustion.notes
                : command.notes || undefined
          }
        }
      }
    case 'ADD_CONDITION': {
      const condition = sheet.reference.conditionOptions.find(
        (option) => option.id === command.conditionTypeId
      )
      if (!condition) return sheet

      return {
        ...sheet,
        overview: {
          ...sheet.overview,
          conditions: [
            ...sheet.overview.conditions.filter(
              (existing) => existing.conditionTypeId !== command.conditionTypeId
            ),
            {
              conditionTypeId: condition.id,
              label: condition.label,
              ...(condition.description ? { description: condition.description } : {}),
              ...(command.notes ? { notes: command.notes } : {})
            }
          ]
        }
      }
    }
    case 'REMOVE_CONDITION':
      return {
        ...sheet,
        overview: {
          ...sheet.overview,
          conditions: sheet.overview.conditions.filter(
            (condition) => condition.conditionTypeId !== command.conditionTypeId
          )
        }
      }
    case 'REMOVE_CONSEQUENCE':
      return {
        ...sheet,
        overview: {
          ...sheet.overview,
          consequences: sheet.overview.consequences.filter(({ id }) => id !== command.consequenceId)
        }
      }

    case 'SET_HIT_POINTS':
    case 'ADJUST_HIT_POINTS':
      return projectHitPoints(sheet, command)
    case 'SET_DEATH_SAVES':
      return sheet.overview.currentHitPoints === 0
        ? {
            ...sheet,
            overview: { ...sheet.overview, deathSaves: deathSavesAfterMarksSet(command) }
          }
        : sheet
    case 'SET_PARTY_VISIBILITY':
      return { ...sheet, meta: { ...sheet.meta, partyVisibility: command.visibility } }
    default:
      return sheet
  }
}
function updatePanelResource(remaining: number, maximum: number, amount: number): number {
  return Math.max(0, Math.min(maximum, remaining - amount))
}

export function projectOptimisticCharacterSheetPanel(
  panel: CharacterSheetPanelDto,
  command: CharacterSheetCommandInputDto
): CharacterSheetPanelDto {
  if (command.type === 'UPDATE_SPELL_SOURCE_CUSTOMIZATION') {
    const sourceKey = createCharacterSpellSourceKey(command.source)
    if (panel.kind === 'SPELL' && createCharacterSpellSourceKey(panel.source) === sourceKey) {
      const displayName =
        command.customName !== undefined
          ? (command.customName ?? panel.authoredName)
          : panel.displayName
      return {
        ...panel,
        title: displayName,
        displayName,
        ...(command.displayAsAttack !== undefined
          ? { displayAsAttack: command.displayAsAttack }
          : {}),
        textEditors: panel.textEditors.map((editor) =>
          editor.field === 'CUSTOM_NAME' && command.customName !== undefined
            ? { ...editor, value: command.customName }
            : editor.field === 'NOTES' && command.notes !== undefined
              ? { ...editor, value: command.notes }
              : editor
        )
      }
    }
    if (panel.kind === 'SPELLS' && command.customName !== undefined) {
      return {
        ...panel,
        groups: panel.groups.map((group) => ({
          ...group,
          sources: group.sources.map((source) =>
            createCharacterSpellSourceKey(source.source) === sourceKey
              ? { ...source, label: command.customName ?? source.label }
              : source
          )
        }))
      }
    }
  }

  if (
    command.type === 'SET_SPELL_MECHANIC_CUSTOMIZATION' &&
    panel.kind === 'SPELL' &&
    createCharacterSpellSourceKey(panel.source) === createCharacterSpellSourceKey(command.source)
  ) {
    return {
      ...panel,
      state: command.mode === 'OVERRIDE' ? 'OVERRIDDEN' : 'ADJUSTED',
      customizationOptions: panel.customizationOptions.map((option) =>
        option.category === command.category
          ? {
              ...option,
              configured: {
                adjustmentId:
                  option.configured?.adjustmentId ?? '00000000-0000-4000-8000-000000000000',
                mode: command.mode,
                value: command.value,
                ...(command.sourceNote ? { sourceNote: command.sourceNote } : {})
              }
            }
          : option
      )
    }
  }

  if (
    command.type === 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION' &&
    panel.kind === 'SPELL' &&
    createCharacterSpellSourceKey(panel.source) === createCharacterSpellSourceKey(command.source)
  ) {
    return {
      ...panel,
      customizationOptions: panel.customizationOptions.map((option) =>
        option.category === command.category ? { ...option, configured: undefined } : option
      )
    }
  }

  if (command.type === 'SET_PREPARED_SPELLS') {
    const preparedSpellIds = new Set(command.spellIds)
    if (panel.kind === 'SPELLS') {
      return {
        ...panel,
        groups: panel.groups.map((group) => ({
          ...group,
          sources: group.sources.map((source) =>
            source.preparationClassId === command.classId
              ? { ...source, prepared: preparedSpellIds.has(source.spellId) }
              : source
          )
        }))
      }
    }
    if (panel.kind === 'SPELL' && panel.preparationClassId === command.classId) {
      return { ...panel, prepared: preparedSpellIds.has(panel.spellId) }
    }
  }

  if (command.type === 'SET_KNOWN_SPELLS') {
    const knownSpellIds = new Set(command.spellIds)
    if (panel.kind === 'SPELLS') {
      return {
        ...panel,
        groups: panel.groups.map((group) => ({
          ...group,
          sources: group.sources.map((source) =>
            source.knownClassId === command.classId
              ? { ...source, known: knownSpellIds.has(source.spellId) }
              : source
          )
        }))
      }
    }
    if (panel.kind === 'SPELL' && panel.knownClassId === command.classId) {
      return { ...panel, known: knownSpellIds.has(panel.spellId) }
    }
  }

  if (command.type === 'USE_SHEET_RESOURCE' || command.type === 'RECOVER_SHEET_RESOURCE') {
    const amount = command.type === 'USE_SHEET_RESOURCE' ? (command.amount ?? 1) : 0
    if (panel.kind === 'RESOURCE' && sameResourceOwner(panel.owner, command.owner)) {
      const remaining =
        command.type === 'RECOVER_SHEET_RESOURCE'
          ? panel.maximum
          : updatePanelResource(panel.remaining, panel.maximum, amount)
      return { ...panel, remaining, used: panel.maximum - remaining }
    }
    if (panel.kind === 'FEATURE') {
      return {
        ...panel,
        resources: panel.resources.map((resource) =>
          sameResourceOwner(resource.target.owner, command.owner)
            ? {
                ...resource,
                remaining:
                  command.type === 'RECOVER_SHEET_RESOURCE'
                    ? resource.maximum
                    : updatePanelResource(resource.remaining, resource.maximum, amount)
              }
            : resource
        )
      }
    }
    if (panel.kind === 'ITEM') {
      return {
        ...panel,
        resources: panel.resources.map((resource) =>
          sameResourceOwner(resource.target.owner, command.owner)
            ? {
                ...resource,
                remaining:
                  command.type === 'RECOVER_SHEET_RESOURCE'
                    ? resource.maximum
                    : updatePanelResource(resource.remaining, resource.maximum, amount)
              }
            : resource
        )
      }
    }
  }

  if (
    panel.kind === 'ITEM' &&
    (command.type === 'USE_RESOURCE' || command.type === 'RESTORE_RESOURCE')
  ) {
    const amount = command.amount ?? 1
    return {
      ...panel,
      resources: panel.resources.map((resource) => {
        if (resource.id !== command.resourceGrantId) return resource
        const remaining =
          command.type === 'RESTORE_RESOURCE' && command.all
            ? resource.maximum
            : updatePanelResource(
                resource.remaining,
                resource.maximum,
                command.type === 'USE_RESOURCE' ? amount : -amount
              )
        return { ...resource, remaining }
      })
    }
  }

  if (
    panel.kind === 'SPELLS' &&
    (command.type === 'USE_SPELL_SLOT' ||
      command.type === 'RESTORE_SPELL_SLOT' ||
      (command.type === 'CAST_SPELL' && command.slotKey))
  ) {
    const slotKey = command.slotKey
    return {
      ...panel,
      slots: panel.slots.map((slot) => {
        if (slot.slotKey !== slotKey) return slot
        const used =
          command.type === 'RESTORE_SPELL_SLOT'
            ? command.all
              ? 0
              : Math.max(0, slot.used - 1)
            : Math.min(slot.maximum, slot.used + 1)
        return { ...slot, used, remaining: slot.maximum - used }
      })
    }
  }

  if (
    panel.kind === 'ITEM' &&
    (command.type === 'UNEQUIP_ITEM' ||
      command.type === 'ATTUNE_ITEM' ||
      command.type === 'UNATTUNE_ITEM') &&
    panel.itemInstanceId === command.itemId
  ) {
    // The panel carries no hands, so the slot an equip or swap lands in waits for the response.
    if (command.type === 'UNEQUIP_ITEM') return { ...panel, equippedSlot: null }
    return { ...panel, attuned: command.type === 'ATTUNE_ITEM' }
  }

  switch (command.type) {
    case 'UPSERT_SHEET_ADJUSTMENT':
    case 'REMOVE_SHEET_ADJUSTMENT':
    case 'RESET_SHEET_PANEL_ADJUSTMENTS':
    case 'SET_MOVEMENT_DISPLAY_PREFERENCE':
    case 'SET_PARTY_VISIBILITY':
    case 'END_ACTIVE_EFFECT':
    case 'END_CONCENTRATION':
    case 'UPDATE_SPELL_SOURCE_CUSTOMIZATION':
    case 'ADD_SHEET_EXTRA':
    case 'UPDATE_SHEET_EXTRA':
    case 'REMOVE_SHEET_EXTRA':
    case 'SET_SPELL_MECHANIC_CUSTOMIZATION':
    case 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION':
    case 'USE_SHEET_RESOURCE':
    case 'RECOVER_SHEET_RESOURCE':
    case 'SET_INSPIRATION':
    case 'SET_HIT_POINTS':
    case 'ADJUST_HIT_POINTS':
    case 'USE_HIT_DIE':
    case 'SET_DEATH_SAVES':
    case 'ROLL_DEATH_SAVE':
    case 'COMPLETE_REST':
    case 'SET_EXHAUSTION':
    case 'ADD_CONDITION':
    case 'REMOVE_CONDITION':
    case 'REMOVE_CONSEQUENCE':
    case 'USE_RESOURCE':
    case 'RESTORE_RESOURCE':
    case 'USE_SPELL_SLOT':
    case 'RESTORE_SPELL_SLOT':
    case 'CAST_SPELL':
    case 'SET_PREPARED_SPELLS':
    case 'SET_KNOWN_SPELLS':
    case 'ADD_INVENTORY_ITEM':
    case 'REMOVE_INVENTORY_ITEM':
    case 'UPDATE_INVENTORY_ITEM':
    case 'EQUIP_ITEM':
    case 'UNEQUIP_ITEM':
    case 'SWAP_HELD_ITEMS':
    case 'ATTUNE_ITEM':
    case 'UNATTUNE_ITEM':
    case 'ADJUST_CURRENCY':
    case 'MOVE_CURRENCY':
    case 'CREATE_NOTE':
    case 'UPDATE_NOTE':
    case 'DELETE_NOTE':
    case 'CREATE_NOTE_GROUP':
    case 'UPDATE_NOTE_GROUP':
    case 'DELETE_NOTE_GROUP':
      return panel
    default:
      return command satisfies never
  }
}
