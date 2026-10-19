import { attackDecoysPayloadDtoSchema } from '@artificer-toolkit/schema/grants/modifier'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterAttackPerception } from './encounterAttackPerception.js'
import { listActiveEffectGrants } from './character/activeEffectGrantTotals.js'
import { abilityModifier } from './systems/dnd5e/abilityModifier.js'

/** What a holder's attack decoys (`ATTACK_DECOYS`) do to one attack made against it. */
export type EncounterAttackDecoy = {
  /** The effect that counts the decoys; a hit on a decoy spends one of its uses. */
  effect: ActiveRuleEffectRecord
  /** The decoys left before the attack. */
  remaining: number
  /** The d20 the server rolled for this attack, and the roll it needed to target a decoy. */
  roll: number
  minimumRoll: number
  /** The armor class the attack is rolled against while it targets a decoy. */
  armorClass: number
}

/**
 * The holder's decoy effect and the payload its first `ATTACK_DECOYS` grant carries. A holder that
 * carries several decoy effects uses the one with the lowest id, so every replay picks the same.
 */
function heldDecoys(effects: readonly ActiveRuleEffectRecord[]) {
  for (const effect of [...effects].sort((left, right) => left.id.localeCompare(right.id))) {
    const remaining = effect.lifecycle.remainingUses
    if (remaining === undefined) continue
    for (const { modifiers } of listActiveEffectGrants([effect])) {
      for (const modifier of modifiers) {
        if (modifier.valueDomainCode !== 'ATTACK_DECOYS') continue
        return {
          effect,
          remaining,
          payload: attackDecoysPayloadDtoSchema.parse(modifier.payload)
        }
      }
    }
  }
  return null
}

/**
 * The d20 for one attack, derived from the occurrence the server minted so a replay of the same
 * action (the attacker's roll arrives in a later request) reads the same roll and no client can
 * choose it. The bias of the 32-bit remainder is below one in 10^8.
 */
function decoyRoll(occurrenceId: string, effectId: string): number {
  const digest = checksumRuleDocument({ occurrenceId, effectId, purpose: 'ATTACK_DECOY_ROLL' })
  return (Number.parseInt(digest.slice(0, 8), 16) % 20) + 1
}

/**
 * Whether an attack against the holder targets one of its decoys instead: the holder's decoys must
 * remain, and the attack's d20 must reach the minimum its threshold names for the decoys left. The
 * decoy's armor class adds the holder's ability modifiers to its base amount. An attacker that
 * cannot see the holder, or perceives it through one of the payload's exempt Senses (blindsight,
 * truesight), is unaffected; with no perception loaded the attacker is taken to see the holder.
 */
export function attackDecoyFor(input: {
  occurrenceId: string
  effects: readonly ActiveRuleEffectRecord[]
  /** The holder's ability scores by ability definition id. */
  scalarValues: Readonly<Record<string, number>>
  abilities: readonly { id: string; code: string }[]
  /** The attacker's true perception of the holder. */
  perception: EncounterAttackPerception | null
}): EncounterAttackDecoy | null {
  const held = heldDecoys(input.effects)
  if (!held) return null
  const { perception } = input
  if (
    perception &&
    (perception.attackerSeesTarget === 'UNSEEN' ||
      held.payload.exemptAttackerSenseDefinitionIds?.some((senseId) =>
        perception.attackerSenseDefinitionIds.includes(senseId)
      ))
  )
    return null
  const threshold = held.payload.thresholds.find(({ remaining }) => remaining === held.remaining)
  if (!threshold) return null
  const roll = decoyRoll(input.occurrenceId, held.effect.id)
  if (roll < threshold.minimumRoll) return null
  const modifiers = held.payload.armorClass.abilities.reduce((total, code) => {
    const ability = input.abilities.find((entry) => entry.code === code)
    const score = ability ? input.scalarValues[ability.id] : undefined
    return total + (score === undefined ? 0 : abilityModifier(score))
  }, 0)
  return {
    effect: held.effect,
    remaining: held.remaining,
    roll,
    minimumRoll: threshold.minimumRoll,
    armorClass: held.payload.armorClass.amount + modifiers
  }
}

/**
 * The target facts with the decoy's armor class where the holder's stands, which both a Character's
 * derived stats and a Creature's stat block carry.
 */
export function withAttackDecoyArmorClass(
  facts: Readonly<Record<string, unknown>>,
  armorClass: number
): Record<string, unknown> {
  const derivedStats = record(facts.derivedStats)
  const statBlock = record(facts.statBlock)
  return {
    ...facts,
    ...(derivedStats && {
      derivedStats: {
        ...derivedStats,
        armorClass: { ...record(derivedStats.armorClass), effective: armorClass }
      }
    }),
    ...(statBlock && { statBlock: { ...statBlock, armorClass } })
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Prepares an attack against a holder that may carry decoys: unshielded first, which reads the
 * attacker's true perception of the holder, then again against the decoy's armor class when the
 * attack targets one. The result echoes the decoy it was prepared against (`attackDecoy`).
 */
export async function prepareAttackBehindDecoys<
  TPrepared extends {
    makesAttackRoll: boolean
    targetFacts: { effectiveScalarValues: Readonly<Record<string, number>> }
    attackSight: { actual: EncounterAttackPerception } | null
  }
>(input: {
  /** Distinct per attack: a reaction shares its move's occurrence, so it salts it. */
  occurrenceId: string
  /** The holder's active effects. */
  effects: readonly ActiveRuleEffectRecord[]
  abilities: readonly { id: string; code: string }[]
  prepare: (attackDecoy: EncounterAttackDecoy | null) => Promise<TPrepared>
  /**
   * The attacker's true perception of the holder, for a flow whose preparation does not read it
   * (a Legendary Action's); by default the unshielded preparation's own.
   */
  perceive?: (unshielded: TPrepared) => Promise<EncounterAttackPerception | null>
}): Promise<TPrepared> {
  const unshielded = await input.prepare(null)
  const attackDecoy = unshielded.makesAttackRoll
    ? attackDecoyFor({
        occurrenceId: input.occurrenceId,
        effects: input.effects,
        scalarValues: unshielded.targetFacts.effectiveScalarValues,
        abilities: input.abilities,
        perception: input.perceive
          ? await input.perceive(unshielded)
          : (unshielded.attackSight?.actual ?? null)
      })
    : null
  return attackDecoy ? input.prepare(attackDecoy) : unshielded
}

/** Whether an attack that targeted a decoy struck it, which destroys the decoy. */
export function decoyStruck(resultPath: string | null | undefined): boolean {
  return resultPath === 'ON_HIT' || resultPath === 'ON_CRIT'
}

/** Whether the struck decoy was the effect's last, so the effect ends instead of spending a use. */
export function decoyIsLast(decoy: Pick<EncounterAttackDecoy, 'remaining'>) {
  return decoy.remaining <= 1
}

export type DecoyStrikeEffects = {
  spentUseGrants: ActiveRuleEffectRecord[]
  endedGrants: ActiveRuleEffectRecord[]
}

/**
 * What a settled attack does to the decoy it was rolled against: a hit destroys it, so the last
 * decoy ends its effect and any other spends one of the effect's uses.
 */
export function decoyStrikeEffects(
  decoy: Pick<EncounterAttackDecoy, 'effect' | 'remaining'> | null | undefined,
  resultPath: string | null | undefined
): DecoyStrikeEffects {
  if (!decoy || !decoyStruck(resultPath)) return { spentUseGrants: [], endedGrants: [] }
  return decoyIsLast(decoy)
    ? { spentUseGrants: [], endedGrants: [decoy.effect] }
    : { spentUseGrants: [decoy.effect], endedGrants: [] }
}

/**
 * The holder's effects as the commit leaves them after a decoy strike, for an attack later in the
 * same move or turn to read: the ended effect gone, the spent one a use lower at its next version.
 */
export function withDecoyStrikeApplied(
  effects: readonly ActiveRuleEffectRecord[],
  strike: DecoyStrikeEffects
): ActiveRuleEffectRecord[] {
  return effects.flatMap((effect) => {
    if (strike.endedGrants.some(({ id }) => id === effect.id)) return []
    if (!strike.spentUseGrants.some(({ id }) => id === effect.id)) return [effect]
    return [
      {
        ...effect,
        version: effect.version + 1,
        lifecycle: { ...effect.lifecycle, remainingUses: (effect.lifecycle.remainingUses ?? 1) - 1 }
      }
    ]
  })
}
