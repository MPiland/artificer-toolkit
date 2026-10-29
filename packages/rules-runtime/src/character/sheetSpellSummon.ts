import { CREATURE_ORIGIN_KIND_REGISTRY } from '@artificer-toolkit/shared/core'
import type { SpellSummonStatBlockValues } from '@artificer-toolkit/shared/authored'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledActionSummonPlacement } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  spellSummonStatBlockValuesDtoSchema,
  type CharacterSpellSummonStateDto
} from '@artificer-toolkit/schema/subjects/characterState'
import { resolveSpellSummonStatBlock } from '../spellSummonStatBlock.js'
import { summonHitPoints } from '../summonHitPoints.js'
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
  const maximumHitPoints = summonHitPoints(input.placement.statBlock, input.casterHitPointMaximum)
  return {
    id: input.id,
    ...resolveSpellSummonStatBlock(input),
    ...(maximumHitPoints > 0 ? { maximumHitPoints, currentHitPoints: maximumHitPoints } : {}),
    castAt: input.castAt
  }
}

/** The summons left once the Sheet's Concentration ends. */
export function withoutConcentrationSummons(
  summons: readonly CharacterSpellSummonStateDto[] | undefined
): CharacterSpellSummonStateDto[] | undefined {
  return summons?.filter((summon) => !summon.concentration)
}

type SpellSummonExtra = Extract<
  CharacterSheetResponseDto['extras']['items'][number],
  { kind: 'SPELL_SUMMON' }
>

/** The Extras entry a summon reads as, on either path: its resolved values plus where it lives. */
function spellSummonExtra(
  summon: SpellSummonStatBlockValues,
  record: Pick<
    SpellSummonExtra,
    'id' | 'customName' | 'notes' | 'hitPoints' | 'speedLabel' | 'encounterActorId'
  >
): SpellSummonExtra {
  return {
    kind: 'SPELL_SUMMON',
    kindLabel: 'Spell Summon',
    ...record,
    spellId: summon.spellId,
    originKind: 'SUMMONED',
    originLabel: CREATURE_ORIGIN_KIND_REGISTRY.SUMMONED.label,
    authoredName: summon.label,
    displayName: record.customName ?? summon.label,
    isActive: true,
    concentration: summon.concentration,
    armorClass: summon.armorClass,
    ...(summon.size ? { size: summon.size } : {}),
    ...(summon.abilityScores ? { abilityScores: summon.abilityScores } : {}),
    ...(summon.passivePerception === undefined
      ? {}
      : { passivePerception: summon.passivePerception }),
    actions: summon.actions ?? [],
    features: [],
    equipmentItemIds: []
  }
}

/** The Extras entry a Sheet summon reads as. */
export function sheetSpellSummonExtra(
  summon: CharacterSpellSummonStateDto,
  speedLabel: string | undefined
): SpellSummonExtra {
  return spellSummonExtra(summon, {
    id: summon.id,
    ...(summon.customName ? { customName: summon.customName } : {}),
    ...(summon.notes ? { notes: summon.notes } : {}),
    ...(speedLabel ? { speedLabel } : {}),
    ...(summon.maximumHitPoints === undefined || summon.currentHitPoints === undefined
      ? {}
      : {
          hitPoints: {
            current: summon.currentHitPoints,
            maximum: summon.maximumHitPoints,
            temp: summon.tempHitPoints ?? 0
          }
        })
  })
}

/** An Encounter summon the owner's Sheet reads: the Run actor its cast created, and its values. */
export interface EncounterSpellSummon {
  actor: Pick<EncounterRunActorState, 'id' | 'currentHitPoints' | 'maxHitPoints' | 'tempHitPoints'>
  summon: SpellSummonStatBlockValues
}

/**
 * The summons a Character's Run actor owns that its Sheet lists (D190): live actors a summon cast
 * created. The actor stays the only record, so a summon leaves with it, and at 0 hit points, when
 * the Run marks it defeated.
 */
export function ownedEncounterSpellSummons(
  actors: readonly EncounterRunActorState[],
  ownerActorId: string
): EncounterSpellSummon[] {
  return actors.flatMap((actor) => {
    if (actor.owner?.ownerActorId !== ownerActorId || actor.defeated) return []
    const { snapshot } = actor
    const stored =
      typeof snapshot === 'object' && snapshot !== null && 'summon' in snapshot
        ? spellSummonStatBlockValuesDtoSchema.safeParse(snapshot.summon)
        : null
    return stored?.success ? [{ actor, summon: stored.data }] : []
  })
}

/** The Extras entry an Encounter summon reads as: read-only, with the Run actor's live hit points. */
export function encounterSpellSummonExtra(
  { actor, summon }: EncounterSpellSummon,
  speedLabel: string | undefined
): SpellSummonExtra {
  return spellSummonExtra(summon, {
    id: actor.id,
    encounterActorId: actor.id,
    ...(speedLabel ? { speedLabel } : {}),
    ...(actor.maxHitPoints > 0
      ? {
          hitPoints: {
            current: actor.currentHitPoints,
            maximum: actor.maxHitPoints,
            temp: actor.tempHitPoints
          }
        }
      : {})
  })
}

/** The Concentration a Sheet summon holds, shown when no Run carried one. */
export function sheetSpellSummonConcentration(
  summons: readonly CharacterSpellSummonStateDto[] | undefined
): { label: string; sourceHidden: false } | null {
  const summon = summons?.find((entry) => entry.concentration)
  return summon ? { label: summon.label, sourceHidden: false } : null
}
