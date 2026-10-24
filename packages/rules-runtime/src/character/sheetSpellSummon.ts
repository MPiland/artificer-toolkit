import { evaluateNumericExpr, type NumericExpr } from '@artificer-toolkit/shared/core'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledActionSummonPlacement } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { CharacterSpellSummonStateDto } from '@artificer-toolkit/schema/subjects/characterState'
import { summonHitPoints } from '../encounterSummon.js'
import type { CharacterSpellCastActions } from './characterSpellCastActions.js'

/**
 * The summon plan of a cast the Sheet makes, read from the same compile an Encounter offers its casts
 * from (D190): the compiled cast of `spellId` at `castLevel` that conjures a creature, else null.
 */
export function sheetSpellCastSummonPlacement(input: {
  casts: Pick<CharacterSpellCastActions, 'candidates' | 'compiledActionEntryPoints'>
  spellCastCandidates: CharacterRulePolicyInput['spellCastCandidates']
  spellId: string
  castLevel: number
}): CompiledActionSummonPlacement | null {
  const castIds = new Set(
    input.spellCastCandidates
      .filter((cast) => cast.spellId === input.spellId && cast.castLevel === input.castLevel)
      .map((cast) => cast.candidateId)
  )
  const actionIds = new Set(
    input.casts.candidates
      .filter((candidate) => castIds.has(candidate.sourceId))
      .map((candidate) => candidate.actionId)
  )
  for (const entry of input.casts.compiledActionEntryPoints)
    if (
      actionIds.has(entry.actionId) &&
      entry.kind === 'CHARACTER_ACTION' &&
      entry.compilation.kind === 'COMPILED' &&
      'summonPlacement' in entry.compilation &&
      entry.compilation.summonPlacement
    )
      return entry.compilation.summonPlacement
  return null
}

/**
 * The creature a Sheet cast conjures outside an Encounter: the plan's stat block with the values the
 * cast resolves against the caster. It is the Sheet's Concentration when the plan maintains one.
 */
export function buildSheetSpellSummon(input: {
  placement: CompiledActionSummonPlacement
  casterHitPointMaximum: number
  spellId: string
  /** The creature's name: the stat block's own, else the spell's. */
  label: string
  id: string
  castAt: string
}): CharacterSpellSummonStateDto {
  const { placement } = input
  const maximumHitPoints = summonHitPoints(placement.statBlock, input.casterHitPointMaximum)
  if (!maximumHitPoints) throw new Error('A summon the Sheet tracks needs hit points.')
  const { armorClass } = placement.statBlock
  return {
    id: input.id,
    spellId: input.spellId,
    summonOutcomeId: placement.summonOutcomeId,
    label: placement.label ?? input.label,
    concentration: placement.entry.maintenance !== null,
    statBlock: placement.statBlock,
    armorClass: armorClass
      ? evaluateNumericExpr(armorClass as NumericExpr, {
          hitPointMaximum: input.casterHitPointMaximum
        })
      : null,
    maximumHitPoints,
    currentHitPoints: maximumHitPoints,
    castAt: input.castAt
  }
}

/** The summons left once the Sheet's Concentration ends. */
export function withoutConcentrationSummons(
  summons: readonly CharacterSpellSummonStateDto[] | undefined
): CharacterSpellSummonStateDto[] | undefined {
  return summons?.filter((summon) => !summon.concentration)
}
