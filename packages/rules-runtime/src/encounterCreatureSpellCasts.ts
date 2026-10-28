import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'

import { createCharacterSpellCastCandidateId } from './character/characterSpellCastRuleFacts.js'
import { featureChargeUsed } from './encounterActorState.js'
import {
  createSpellCastCandidateList,
  spellCastMode,
  type SpellCastCandidate
} from './spellCastCandidates.js'

/** A Creature's cast candidate, with the Feature whose grant gives it the spell. */
export interface CreatureSpellCastCandidate {
  ownerFeature: FeatureDto
  cast: SpellCastCandidate
  /** The spell save DC the grant states; null when it states none. */
  spellSaveDc: number | null
  /** The Feature's slot table row the cast spends, by id; null for a cast that spends no slot. */
  slotRowId: string | null
}

/**
 * The spells a Creature may cast, as the Character path lists them, over its Features' spell grants.
 * A Creature's grants are always granted: there is no class or preparation to gate them. A grant that
 * pays from a slot (no at-will, limited-use or cast-at-level attribute) offers the spell at every
 * level of the Feature's slot table at or above the spell's own that still has a slot left. A grant
 * paid from a charge pool has no Creature cast path yet, so it is not offered. A slot cast spends
 * the row of its cast level.
 */
export function listCreatureSpellCasts(input: {
  actor: Parameters<typeof featureChargeUsed>[0] & { id: string }
  features: readonly FeatureDto[]
  spellLevelsById: ReadonlyMap<string, { label: string; level: number }>
}): readonly CreatureSpellCastCandidate[] {
  const { candidates, append } = createSpellCastCandidateList(createCharacterSpellCastCandidateId)
  const grantByCandidateId = new Map<
    string,
    { ownerFeature: FeatureDto; spellSaveDc: number | null; slotRowIdByLevel: Map<number, string> }
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
      const mode = spellCastMode(grant.attributes ?? [])
      if (mode !== 'AT_WILL' && mode !== 'SPELL_SLOT') continue
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
            offersLevel:
              mode === 'SPELL_SLOT' && spell.level > 0
                ? (level) => slotRowIdByLevel.has(level)
                : undefined
          }
        )
        for (const added of candidates.slice(before))
          grantByCandidateId.set(added.candidateId, {
            ownerFeature: feature,
            spellSaveDc: grant.spellSaveDc ?? null,
            slotRowIdByLevel
          })
      }
    }
  }
  return candidates.map((cast) => {
    const { ownerFeature, spellSaveDc, slotRowIdByLevel } = grantByCandidateId.get(
      cast.candidateId
    )!
    return {
      ownerFeature,
      cast,
      spellSaveDc,
      slotRowId:
        cast.castMode === 'SPELL_SLOT' && cast.castLevel > 0
          ? slotRowIdByLevel.get(cast.castLevel)!
          : null
    }
  })
}
