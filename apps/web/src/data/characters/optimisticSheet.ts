import {
  createCharacterResourceOwnerKey,
  createCharacterSpellSourceKey,
  toCharacterResourceOwnerKey
} from '@artificer-toolkit/shared/character'

import type {
  CharacterSheetCommandInputDto,
  CharacterSheetPanelDto,
  CharacterSheetResponseDto
} from '#app/lib/api'

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

function projectResources(
  sheet: CharacterSheetResponseDto,
  command: CharacterSheetCommandInputDto
): CharacterSheetResponseDto {
  if (command.type === 'USE_SHEET_RESOURCE') {
    return {
      ...sheet,
      resources: {
        ...sheet.resources,
        items: sheet.resources.items.map((resource) =>
          sameResourceOwner(resource.owner, command.owner)
            ? updateResource(resource, resource.used + (command.amount ?? 1))
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

function projectSpellSlots(
  sheet: CharacterSheetResponseDto,
  command: CharacterSheetCommandInputDto
): CharacterSheetResponseDto {
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

function projectSpellSources(
  sheet: CharacterSheetResponseDto,
  command: CharacterSheetCommandInputDto
): CharacterSheetResponseDto {
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

  if (command.type !== 'SET_PREPARED_SPELLS') return sheet

  const preparedSpellIds = new Set(command.spellIds)
  return {
    ...sheet,
    spells: {
      ...sheet.spells,
      preparationSources: sheet.spells.preparationSources?.map((source) =>
        source.classId === command.classId
          ? { ...source, preparedSpellIds: command.spellIds }
          : source
      ),
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

function projectInventory(
  sheet: CharacterSheetResponseDto,
  command: CharacterSheetCommandInputDto
): CharacterSheetResponseDto {
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
    command.type !== 'EQUIP_ITEM' &&
    command.type !== 'UNEQUIP_ITEM' &&
    command.type !== 'ATTUNE_ITEM' &&
    command.type !== 'UNATTUNE_ITEM'
  ) {
    return sheet
  }

  return {
    ...sheet,
    inventory: {
      ...sheet.inventory,
      items: sheet.inventory.items.map((item) =>
        item.id === command.itemId
          ? {
              ...item,
              ...(command.type === 'EQUIP_ITEM'
                ? { equipped: true }
                : command.type === 'UNEQUIP_ITEM'
                  ? { equipped: false }
                  : command.type === 'ATTUNE_ITEM'
                    ? { attuned: true }
                    : { attuned: false })
            }
          : item
      )
    }
  }
}

function projectExtras(
  sheet: CharacterSheetResponseDto,
  command: CharacterSheetCommandInputDto
): CharacterSheetResponseDto {
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

export function projectOptimisticCharacterSheet(
  sheet: CharacterSheetResponseDto,
  command: CharacterSheetCommandInputDto
): CharacterSheetResponseDto {
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
            notes: command.notes
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
    case 'USE_SHEET_RESOURCE':
    case 'USE_RESOURCE':
    case 'RESTORE_RESOURCE':
      return projectResources(sheet, command)
    case 'USE_SPELL_SLOT':
    case 'RESTORE_SPELL_SLOT':
    case 'CAST_SPELL':
      return projectSpellSlots(sheet, command)
    case 'UPDATE_SPELL_SOURCE_CUSTOMIZATION':
    case 'SET_PREPARED_SPELLS':
      return projectSpellSources(sheet, command)
    case 'REMOVE_INVENTORY_ITEM':
    case 'UPDATE_INVENTORY_ITEM':
    case 'EQUIP_ITEM':
    case 'UNEQUIP_ITEM':
    case 'ATTUNE_ITEM':
    case 'UNATTUNE_ITEM':
      return projectInventory(sheet, command)
    case 'ADD_SHEET_EXTRA':
    case 'UPDATE_SHEET_EXTRA':
    case 'REMOVE_SHEET_EXTRA':
      return projectExtras(sheet, command)
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

  if (command.type === 'USE_SHEET_RESOURCE') {
    const amount = command.amount ?? 1
    if (panel.kind === 'RESOURCE' && sameResourceOwner(panel.owner, command.owner)) {
      const remaining = updatePanelResource(panel.remaining, panel.maximum, amount)
      return { ...panel, remaining, used: panel.maximum - remaining }
    }
    if (panel.kind === 'FEATURE' || panel.kind === 'ITEM') {
      return {
        ...panel,
        resources: panel.resources.map((resource) =>
          sameResourceOwner(resource.target.owner, command.owner)
            ? {
                ...resource,
                remaining: updatePanelResource(resource.remaining, resource.maximum, amount)
              }
            : resource
        )
      }
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
    (command.type === 'EQUIP_ITEM' ||
      command.type === 'UNEQUIP_ITEM' ||
      command.type === 'ATTUNE_ITEM' ||
      command.type === 'UNATTUNE_ITEM') &&
    panel.itemInstanceId === command.itemId
  ) {
    if (command.type === 'EQUIP_ITEM' || command.type === 'UNEQUIP_ITEM') {
      return { ...panel, equipped: command.type === 'EQUIP_ITEM' }
    }
    return { ...panel, attuned: command.type === 'ATTUNE_ITEM' }
  }

  return panel
}
