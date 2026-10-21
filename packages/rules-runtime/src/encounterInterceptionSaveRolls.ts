import { dnd5eConcentrationHolderSaves } from './systems/dnd5e/concentrationPolicy.js'
import { DND5E_ABILITY_DEFINITION_ID_BY_CODE } from './systems/dnd5e/identity.js'
import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import type { HeldDamageInterception } from './encounterDamageInterception.js'
import { EncounterValidationError } from './encounterErrors.js'

/**
 * The target with each save its damage interceptions ask rolled once, before any blow lands: the
 * holder's saving throw for the authored ability with its roll mode, so the planner and the fold
 * settle the same die. A target none of whose interceptions ask a save draws nothing. A condition
 * that fails the save outright is not read here.
 */
export function withInterceptionSaveRolls<
  TTarget extends Parameters<typeof dnd5eConcentrationHolderSaves>[0] & {
    damageInterceptions: readonly HeldDamageInterception[]
  }
>(input: { target: TTarget; random(maximum: number): number }): TTarget {
  const { target, random } = input
  if (!target.damageInterceptions.some(({ save, saveRoll }) => save && !saveRoll)) return target
  const rows = dnd5eConcentrationHolderSaves(target).savingThrowDefinitions ?? []
  const rollD20 = () => random(20) + 1
  return {
    ...target,
    damageInterceptions: target.damageInterceptions.map((interception) => {
      if (!interception.save || interception.saveRoll) return interception
      const abilityDefinitionId = DND5E_ABILITY_DEFINITION_ID_BY_CODE[interception.save.ability]
      const row = rows.find((entry) => entry.abilityDefinitionId === abilityDefinitionId)
      if (!row) throw new EncounterValidationError('A damage interception save has no ability.')
      const first = rollD20()
      const rawDie =
        row.rollMode === 'NORMAL'
          ? first
          : row.rollMode === 'ADVANTAGE'
            ? Math.max(first, rollD20())
            : Math.min(first, rollD20())
      return { ...interception, saveRoll: { rawDie, addedTotal: row.modifier } }
    })
  }
}

/**
 * The interceptions with each save die the batch's applications recorded, for a caller that replays
 * a plan another one rolled (a room commit): the fold still recomputes every pass and DC from it.
 */
export function withRecordedInterceptionSaveRolls(
  interceptions: readonly HeldDamageInterception[],
  applications: readonly CharacterRuleActionApplication[]
): readonly HeldDamageInterception[] {
  const recorded = applications.flatMap((application) =>
    application.kind === 'DAMAGE' ? (application.interceptionSaves ?? []) : []
  )
  return interceptions.map((interception) => {
    const save = recorded.find(({ effectId }) => effectId === interception.effectId)
    return interception.save && !interception.saveRoll && save
      ? { ...interception, saveRoll: { rawDie: save.rawDie, addedTotal: save.addedTotal } }
      : interception
  })
}
