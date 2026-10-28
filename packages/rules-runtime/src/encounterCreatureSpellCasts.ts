import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'

import { createCharacterSpellCastCandidateId } from './character/characterSpellCastRuleFacts.js'
import { featureChargeUsed } from './encounterActorState.js'
import {
  createSpellCastCandidateList,
  spellCastMode,
  type SpellCastCandidate
} from './spellCastCandidates.js'

type SpellGrant = NonNullable<NonNullable<FeatureDto['grants']>['spells']>[number]
type CreatureActor = Parameters<typeof featureChargeUsed>[0] & { id: string }

/** A Creature's cast candidate, with the Feature whose grant gives it the spell. */
export interface CreatureSpellCastCandidate {
  ownerFeature: FeatureDto
  cast: SpellCastCandidate
  /** The spell save DC the grant states; null when it states none. */
  spellSaveDc: number | null
  /**
   * What the cast spends, by the id that keys its used count: a row of the Feature's slot table, or
   * the grant's charge pool. Null for a cast that spends neither.
   */
  slotKey: string | null
}

/**
 * What a levelled cast of the grant at a cast level spends, by id: the slot table row of that level
 * for a slot-paid grant, the grant's charge pool for a limited-use or cast-at-level grant that has
 * one. Null when it spends nothing (at will, or cast-at-level with no pool); undefined when it cannot
 * be paid now (no slot or use left, or a limited-use grant whose pool a Creature cannot count).
 */
function grantCastSpend(
  actor: CreatureActor,
  grant: SpellGrant,
  mode: SpellCastCandidate['castMode'],
  slotRowIdByLevel: ReadonlyMap<number, string>
): (castLevel: number) => string | null | undefined {
  if (mode === 'AT_WILL') return () => null
  if (mode === 'SPELL_SLOT') return (castLevel) => slotRowIdByLevel.get(castLevel)
  const charges = grant.charges
  if (!charges) return () => (mode === 'FIXED_LEVEL' ? null : undefined)
  const maximum = charges.limitKind === 'FIXED_AMOUNT' && 'amount' in charges ? charges.amount : 0
  return () => (maximum - featureChargeUsed(actor, charges.id) > 0 ? charges.id : undefined)
}

/**
 * The spells a Creature may cast, as the Character path lists them, over its Features' spell grants.
 * A Creature's grants are always granted: there is no class or preparation to gate them. A grant that
 * pays from a slot (no at-will, limited-use or cast-at-level attribute) offers the spell at every
 * level of the Feature's slot table at or above the spell's own that still has a slot left, and the
 * cast spends that row. A limited-use or cast-at-level grant (innate "3/day each") offers it at the
 * grant's level while its charge pool has a use left, and the cast spends one; a cast-at-level grant
 * with no pool casts freely. A cantrip spends nothing.
 */
export function listCreatureSpellCasts(input: {
  actor: CreatureActor
  features: readonly FeatureDto[]
  spellLevelsById: ReadonlyMap<string, { label: string; level: number }>
}): readonly CreatureSpellCastCandidate[] {
  const { candidates, append } = createSpellCastCandidateList(createCharacterSpellCastCandidateId)
  const grantByCandidateId = new Map<
    string,
    {
      ownerFeature: FeatureDto
      spellSaveDc: number | null
      spend: (castLevel: number) => string | null | undefined
    }
  >()
  for (const feature of input.features) {
    const slotRowIdByLevel = new Map(
      (feature.grants?.spellSlots?.levels ?? []).flatMap((row) =>
        row.amount - featureChargeUsed(input.actor, row.id) > 0
          ? [[row.level, row.id] as const]
          : []
      )
    )
    for (const grant of feature.grants?.spells ?? []) {
      if (grant.authoringModeKind !== 'SELECTED') continue
      const attributes = grant.attributes ?? []
      const mode = spellCastMode(attributes)
      if (mode === 'RITUAL') continue
      const spend = grantCastSpend(input.actor, grant, mode, slotRowIdByLevel)
      for (const spellId of grant.spellIds) {
        const spell = input.spellLevelsById.get(spellId)
        if (!spell) throw new Error(`Spell ${spellId} is not pinned to this Run.`)
        const before = candidates.length
        append(
          {
            spellId,
            sourceKind: 'FEATURE',
            sourceInstanceId: `${input.actor.id}:${feature.id}:${grant.id}`
          },
          spell.label,
          spell.level,
          mode,
          null,
          {
            fixedLevel: attributes.includes('CAST_AT_LEVEL') ? grant.castAtLevel : undefined,
            offersLevel: spell.level > 0 ? (level) => spend(level) !== undefined : undefined
          }
        )
        for (const added of candidates.slice(before))
          grantByCandidateId.set(added.candidateId, {
            ownerFeature: feature,
            spellSaveDc: grant.spellSaveDc ?? null,
            spend
          })
      }
    }
  }
  return candidates.map((cast) => {
    const { ownerFeature, spellSaveDc, spend } = grantByCandidateId.get(cast.candidateId)!
    return {
      ownerFeature,
      cast,
      spellSaveDc,
      slotKey: cast.spellLevel > 0 ? (spend(cast.castLevel) ?? null) : null
    }
  })
}
