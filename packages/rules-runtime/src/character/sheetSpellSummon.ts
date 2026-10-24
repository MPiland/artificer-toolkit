import {
  CREATURE_ORIGIN_KIND_REGISTRY,
  evaluateNumericExpr,
  type NumericExpr
} from '@artificer-toolkit/shared/core'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
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
 * The creature a Sheet cast conjures outside an Encounter: the plan's stat block resolved against the
 * caster once, at cast time. It is the Sheet's Concentration when the plan maintains one.
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
  const { statBlock } = placement
  const maximumHitPoints = summonHitPoints(statBlock, input.casterHitPointMaximum)
  if (!maximumHitPoints) throw new Error('A summon the Sheet tracks needs hit points.')
  const resolve = (expr: unknown) =>
    expr === undefined
      ? null
      : evaluateNumericExpr(expr as NumericExpr, { hitPointMaximum: input.casterHitPointMaximum })
  const abilityScores = Object.fromEntries(
    Object.entries(statBlock.abilityScores ?? {}).flatMap(([ability, expr]) => {
      const score = resolve(expr)
      return score === null ? [] : [[ability, score]]
    })
  )
  const passivePerception = resolve(statBlock.passivePerception)
  return {
    id: input.id,
    spellId: input.spellId,
    summonOutcomeId: placement.summonOutcomeId,
    label: placement.label ?? input.label,
    concentration: placement.entry.maintenance !== null,
    ...(statBlock.size ? { size: statBlock.size } : {}),
    armorClass: resolve(statBlock.armorClass),
    ...(Object.keys(abilityScores).length ? { abilityScores } : {}),
    ...(statBlock.speeds?.length ? { speeds: statBlock.speeds } : {}),
    ...(passivePerception === null ? {} : { passivePerception }),
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

/** The Extras entry a Sheet summon reads as. */
export function sheetSpellSummonExtra(
  summon: CharacterSpellSummonStateDto,
  speedLabel: string | undefined
): Extract<CharacterSheetResponseDto['extras']['items'][number], { kind: 'SPELL_SUMMON' }> {
  return {
    kind: 'SPELL_SUMMON',
    kindLabel: 'Spell Summon',
    id: summon.id,
    spellId: summon.spellId,
    originKind: 'SUMMONED',
    originLabel: CREATURE_ORIGIN_KIND_REGISTRY.SUMMONED.label,
    authoredName: summon.label,
    displayName: summon.customName ?? summon.label,
    ...(summon.customName ? { customName: summon.customName } : {}),
    ...(summon.notes ? { notes: summon.notes } : {}),
    isActive: true,
    concentration: summon.concentration,
    armorClass: summon.armorClass,
    ...(speedLabel ? { speedLabel } : {}),
    hitPoints: {
      current: summon.currentHitPoints,
      maximum: summon.maximumHitPoints,
      temp: summon.tempHitPoints ?? 0
    },
    ...(summon.size ? { size: summon.size } : {}),
    ...(summon.abilityScores ? { abilityScores: summon.abilityScores } : {}),
    ...(summon.passivePerception === undefined
      ? {}
      : { passivePerception: summon.passivePerception }),
    // A summon's attacks are actions its spell authors (SPELLS-34.T2).
    actions: [],
    features: [],
    equipmentItemIds: []
  }
}

/** The Concentration a Sheet summon holds, shown when no Run carried one. */
export function sheetSpellSummonConcentration(
  summons: readonly CharacterSpellSummonStateDto[] | undefined
): { label: string; sourceHidden: false } | null {
  const summon = summons?.find((entry) => entry.concentration)
  return summon ? { label: summon.label, sourceHidden: false } : null
}
