import {
  encounterCreatureRuleFactsSnapshotSchema,
  type EncounterCreatureRuleFactsSnapshot
} from '@artificer-toolkit/schema/api/encounterActorRules'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import {
  PROFICIENCY_KIND,
  ROUNDING_CODE,
  SCALING_AMOUNT_KIND
} from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { abilityModifier } from './abilityModifier.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { foldDnd5eCreatureFeatureGrants } from './creatureFeatureGrantFold.js'

function scaleProficiency(input: { bonus: number; level: string; rounding?: string }): number {
  switch (input.level) {
    case SCALING_AMOUNT_KIND.FULL:
      return input.bonus
    case SCALING_AMOUNT_KIND.DOUBLE:
      return input.bonus * 2
    case SCALING_AMOUNT_KIND.HALF:
      switch (input.rounding) {
        case ROUNDING_CODE.UP:
          return Math.ceil(input.bonus / 2)
        case ROUNDING_CODE.NEAREST:
          return Math.round(input.bonus / 2)
        case ROUNDING_CODE.DOWN:
          return Math.floor(input.bonus / 2)
        default:
          throw new Error('Half proficiency requires an authored rounding policy.')
      }
    default:
      throw new Error('Creature skill proficiency uses an unsupported scale.')
  }
}

/** D&D-specific compilation of legacy Creature authoring into pinned UUID facts. */
export function compileDnd5eCreatureRuleFacts(input: {
  creature: CreatureAuthored
  vocabulary: SystemVocabularySnapshot
}): EncounterCreatureRuleFactsSnapshot {
  const { creature, vocabulary } = input
  const document = vocabulary.document
  if (vocabulary.systemId !== DND5E_SYSTEM_ID) {
    throw new Error('D&D Creature rule facts require the current D&D System vocabulary.')
  }

  const abilitiesByCode = new Map(document.abilities.map((ability) => [ability.code, ability]))
  // System order, not the stored record's key order, so every read derives identical facts.
  const normalizedAbilities = document.abilities.flatMap(({ id, code }) => {
    const score = creature.abilityScores[code]
    return score === undefined ? [] : [[id, score] as const]
  })
  if (
    Object.keys(creature.abilityScores).some((code) => !abilitiesByCode.has(code)) ||
    normalizedAbilities.some(([, score]) => !Number.isFinite(score))
  ) {
    throw new Error('Creature ability facts are not normalized by the pinned System vocabulary.')
  }
  if (new Set(normalizedAbilities.map(([id]) => id)).size !== normalizedAbilities.length) {
    throw new Error('Creature ability definitions are duplicated.')
  }
  const abilityScores = Object.fromEntries(normalizedAbilities)
  const initiativeAbility = abilitiesByCode.get('DEXTERITY')
  if (!initiativeAbility || !(initiativeAbility.id in abilityScores)) {
    throw new Error('D&D Creature initiative requires a normalized Dexterity score.')
  }

  const checksById = new Map(document.skills.map((check) => [check.id, check]))
  const proficiencyByCheckId = new Map<string, NonNullable<typeof creature.proficiencies>[number]>()
  for (const proficiency of creature.proficiencies) {
    if (proficiency.proficiencyKind !== PROFICIENCY_KIND.SKILL) continue
    const skillIds =
      proficiency.authoringModeKind === 'ALL'
        ? [...checksById.keys()]
        : (proficiency.skillIds ?? [])
    for (const skillId of skillIds) {
      if (!checksById.has(skillId)) {
        throw new Error('Creature skill proficiency references a missing or foreign System check.')
      }
      if (proficiencyByCheckId.has(skillId)) {
        throw new Error('Creature check proficiency coverage is duplicated.')
      }
      proficiencyByCheckId.set(skillId, proficiency)
    }
  }

  const challengeRating = creature.challengeRatingId
    ? (document.challengeRatings.find((candidate) => candidate.id === creature.challengeRatingId) ??
      null)
    : null
  if (creature.challengeRatingId && !challengeRating) {
    throw new Error('Creature challenge rating is unavailable for D&D proficiency.')
  }

  const checkTotals: Record<string, number> = {}
  for (const check of document.skills) {
    if (check.governingAbilityDefinitionId === null) continue
    const score = abilityScores[check.governingAbilityDefinitionId]
    if (score === undefined) continue
    const proficiency = proficiencyByCheckId.get(check.id)
    if (proficiency && challengeRating === null) continue
    const proficiencyBonus = proficiency ? (challengeRating?.proficiencyBonus ?? 0) : 0
    checkTotals[check.id] =
      abilityModifier(score) +
      (proficiency
        ? scaleProficiency({
            bonus: proficiencyBonus,
            level: proficiency.level,
            ...(proficiency.level === SCALING_AMOUNT_KIND.HALF
              ? { rounding: proficiency.rounding }
              : {})
          })
        : 0)
  }

  const saveProficiencyBonuses: Record<string, number> = {}
  for (const proficiency of creature.proficiencies) {
    if (proficiency.proficiencyKind !== PROFICIENCY_KIND.SAVE_ABILITY) continue
    if (challengeRating === null) continue
    const abilityIds =
      proficiency.authoringModeKind === 'ALL'
        ? Object.keys(abilityScores)
        : (proficiency.abilities ?? []).map((code) => {
            const definition = abilitiesByCode.get(code)
            if (!definition)
              throw new Error('Creature save proficiency references a missing ability.')
            return definition.id
          })
    for (const abilityId of abilityIds) {
      if (abilityId in saveProficiencyBonuses) {
        throw new Error('Creature save proficiency coverage is duplicated.')
      }
      saveProficiencyBonuses[abilityId] = scaleProficiency({
        bonus: challengeRating.proficiencyBonus,
        level: proficiency.level,
        ...(proficiency.level === SCALING_AMOUNT_KIND.HALF
          ? { rounding: proficiency.rounding }
          : {})
      })
    }
  }

  return encounterCreatureRuleFactsSnapshotSchema.parse({
    gameSystemId: vocabulary.systemId,
    vocabularySnapshotId: vocabulary.snapshotId,
    vocabularySnapshotVersion: vocabulary.snapshotVersion,
    vocabularySnapshotChecksum: vocabulary.checksum,
    abilityScores,
    checkTotals,
    saveProficiencyBonuses,
    resourceAbilityScores: creature.abilityScores,
    initiativeAbilityDefinitionId: initiativeAbility.id,
    modifiers: foldDnd5eCreatureFeatureGrants(creature)
  })
}
