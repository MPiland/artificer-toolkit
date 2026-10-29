import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { CharacterSheetCommandError } from './sheetCommandError.js'

type ExchangeCommand = Extract<CharacterSheetCommandInputDto, { type: 'EXCHANGE_SPELL_SLOTS' }>

/** What one EXCHANGE_SPELL_SLOTS command changes, checked against the Sheet it runs on. */
export interface SpellSlotExchangePlan {
  /** Slots each key frees (negative) or expends (positive). */
  slotUsage: { slotKey: string; delta: number }[]
  /** The standard slot key gaining one created slot until the next long rest. */
  createdSlotKey: string | null
  /** The one charge pool the command spends (positive) or refills (negative). */
  resourceUse: { resourceId: string; delta: number } | null
}

function sheetResource(sheet: CharacterSheetResponseDto, resourceId: string) {
  const resource = sheet.resources.items.find((item) => item.id === resourceId)
  if (!resource)
    throw new CharacterSheetCommandError(`Resource "${resourceId}" is not available on this character.`)
  return resource
}

function sheetSlot(sheet: CharacterSheetResponseDto, slotKey: string) {
  const slot = sheet.spells.slots.find((item) => item.slotKey === slotKey)
  if (!slot || slot.level === null)
    throw new CharacterSheetCommandError(`Spell slot "${slotKey}" is not available on this character.`)
  return { ...slot, level: slot.level }
}

function selectedSlotKeys(command: ExchangeCommand): string[] {
  if (command.selection.kind !== 'SLOTS')
    throw new CharacterSheetCommandError('Choose the spell slots to exchange.')
  return command.selection.slotKeys
}

/**
 * Plans an action's SPELL_SLOT_EXCHANGE outcome. The action's own charge pays for a recovery; a
 * conversion moves value between the slots and the outcome's pool, so its action may not also
 * spend a charge.
 */
export function planSpellSlotExchange(
  sheet: CharacterSheetResponseDto,
  command: ExchangeCommand
): SpellSlotExchangePlan {
  const action = sheet.actions.items.find((candidate) => candidate.id === command.actionId)
  if (!action) throw new CharacterSheetCommandError(`Action "${command.actionId}" is not available.`)
  if (action.availability.status === 'UNAVAILABLE')
    throw new CharacterSheetCommandError(`Action "${action.label}" is unavailable.`)
  const exchange = action.mechanic?.outcomes.flatMap((outcome) =>
    outcome.kind === 'EFFECT' && outcome.spellSlotExchange ? [outcome.spellSlotExchange] : []
  )[0]
  if (!exchange)
    throw new CharacterSheetCommandError(`Action "${action.label}" does not exchange spell slots.`)
  const actionCharge =
    action.resourceGrantId && action.resourceCost
      ? { resourceId: action.resourceGrantId, delta: action.resourceCost }
      : null
  if (actionCharge && sheetResource(sheet, actionCharge.resourceId).remaining < actionCharge.delta)
    throw new CharacterSheetCommandError(`Action "${action.label}" has no uses remaining.`)
  if (actionCharge && exchange.mode !== 'RECOVER_SLOTS')
    throw new CharacterSheetCommandError(
      `Action "${action.label}" cannot spend a charge and convert spell slots at once.`
    )

  switch (exchange.mode) {
    case 'RECOVER_SLOTS': {
      const counts = new Map<string, number>()
      for (const slotKey of selectedSlotKeys(command))
        counts.set(slotKey, (counts.get(slotKey) ?? 0) + 1)
      let levels = 0
      for (const [slotKey, count] of counts) {
        const slot = sheetSlot(sheet, slotKey)
        if (slot.level > exchange.maximumSlotLevel)
          throw new CharacterSheetCommandError(
            `Spell slots above level ${exchange.maximumSlotLevel} cannot be recovered.`
          )
        if (count > slot.max - slot.remaining)
          throw new CharacterSheetCommandError(`Only expended ${slot.label} slots can be recovered.`)
        levels += slot.level * count
      }
      if (levels > exchange.levelBudget)
        throw new CharacterSheetCommandError(
          `The recovered slots total ${levels} levels; at most ${exchange.levelBudget} can be recovered.`
        )
      return {
        slotUsage: [...counts].map(([slotKey, count]) => ({ slotKey, delta: -count })),
        createdSlotKey: null,
        resourceUse: actionCharge
      }
    }
    case 'SLOT_TO_RESOURCE': {
      const slotKeys = selectedSlotKeys(command)
      if (slotKeys.length !== 1)
        throw new CharacterSheetCommandError('Choose one spell slot to convert.')
      const slot = sheetSlot(sheet, slotKeys[0]!)
      if (slot.remaining < 1)
        throw new CharacterSheetCommandError(`Spell slot "${slot.label}" has no uses remaining.`)
      if (exchange.maximumSlotLevel !== null && slot.level > exchange.maximumSlotLevel)
        throw new CharacterSheetCommandError(
          `Spell slots above level ${exchange.maximumSlotLevel} cannot be converted.`
        )
      const pool = sheetResource(sheet, exchange.resourcePoolId)
      if (pool.remaining >= pool.max)
        throw new CharacterSheetCommandError(`Resource "${pool.label}" is already full.`)
      return {
        slotUsage: [{ slotKey: slot.slotKey, delta: 1 }],
        createdSlotKey: null,
        resourceUse: { resourceId: pool.id, delta: -slot.level }
      }
    }
    case 'RESOURCE_TO_SLOT': {
      if (command.selection.kind !== 'SLOT_LEVEL')
        throw new CharacterSheetCommandError('Choose the spell slot level to create.')
      const { slotLevel } = command.selection
      const cost = exchange.costs.find((entry) => entry.slotLevel === slotLevel)?.cost
      if (cost === undefined)
        throw new CharacterSheetCommandError(`A level ${slotLevel} spell slot cannot be created.`)
      const pool = sheetResource(sheet, exchange.resourcePoolId)
      if (pool.remaining < cost)
        throw new CharacterSheetCommandError(
          `Resource "${pool.label}" only has ${pool.remaining} of the ${cost} needed.`
        )
      return {
        slotUsage: [],
        createdSlotKey: `STANDARD:${slotLevel}`,
        resourceUse: { resourceId: pool.id, delta: cost }
      }
    }
  }
}

/** Applies a planned exchange's slot changes to the Character's spell slot usage. */
export function applySpellSlotExchange(
  character: CharacterAuthored,
  plan: SpellSlotExchangePlan
): CharacterAuthored {
  const usage = new Map(
    (character.state.spellSlots ?? []).map((slot) => [slot.slotKey, { ...slot }])
  )
  for (const { slotKey, delta } of plan.slotUsage) {
    const slot = usage.get(slotKey) ?? { slotKey, used: 0 }
    usage.set(slotKey, { ...slot, used: Math.max(slot.used + delta, 0) })
  }
  if (plan.createdSlotKey) {
    const slot = usage.get(plan.createdSlotKey) ?? { slotKey: plan.createdSlotKey, used: 0 }
    usage.set(plan.createdSlotKey, { ...slot, created: (slot.created ?? 0) + 1 })
  }
  const spellSlots = [...usage.values()].filter((slot) => slot.used > 0 || slot.created)
  return {
    ...character,
    state: { ...character.state, spellSlots: spellSlots.length ? spellSlots : undefined }
  }
}
