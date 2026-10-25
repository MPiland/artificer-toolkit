import {
  encounterActorRuleInputSchema,
  encounterActorRuleOutputSchema,
  type EncounterActorRuleInput,
  type EncounterActorRuleOutput
} from '@artificer-toolkit/schema/api/encounterActorRules'
import { abilityModifier } from './abilityModifier.js'

function clampInteger(
  value: number,
  minimum: number | undefined,
  maximum: number | undefined
): number {
  return Math.floor(Math.min(Math.max(value, minimum ?? -Infinity), maximum ?? Infinity))
}

function resolveMaximum(
  charge: EncounterActorRuleInput['actors'][number]['featureResources'][number]['charge'],
  abilities: EncounterActorRuleInput['actors'][number]['resourceAbilityScores']
): number | null {
  if (
    charge === null ||
    charge.limitKind === 'SOURCE_CHARGES' ||
    charge.scalingKind !== 'NONE' ||
    (charge.limitKind !== 'FIXED_AMOUNT' && charge.limitKind !== 'ABILITY_MODIFIER') ||
    (charge.bonuses ?? []).some((bonus) => bonus.bonusKind !== 'ABILITY_MODIFIER')
  ) {
    return null
  }

  let maximum: number
  if (charge.limitKind === 'FIXED_AMOUNT') {
    maximum = charge.amount
  } else {
    const score = abilities?.[charge.ability]
    if (score === undefined) return null
    maximum = clampInteger(
      abilityModifier(score) * (charge.multiplier ?? 1),
      charge.min,
      charge.max
    )
  }

  for (const bonus of charge.bonuses ?? []) {
    if (bonus.bonusKind !== 'ABILITY_MODIFIER') return null
    const score = abilities?.[bonus.ability]
    if (score === undefined) return null
    maximum += clampInteger(abilityModifier(score) * (bonus.multiplier ?? 1), bonus.min, bonus.max)
  }

  return Math.max(0, Math.floor(maximum))
}

/** Pure D&D Encounter actor policy; application reconciliation owns usage clamping. */
export function evaluateDnd5e2014EncounterActors(candidate: unknown): EncounterActorRuleOutput {
  const input = encounterActorRuleInputSchema.parse(candidate)
  return encounterActorRuleOutputSchema.parse({
    actors: input.actors.map((actor) => ({
      actorId: actor.actorId,
      initiativeModifier:
        actor.initiativeAbilityDefinitionId === undefined ||
        actor.initiativeAbilityDefinitionId === null ||
        actor.abilityScores[actor.initiativeAbilityDefinitionId] === undefined
          ? 0
          : abilityModifier(actor.abilityScores[actor.initiativeAbilityDefinitionId]),
      savingThrowDefinitions: Object.entries(actor.abilityScores)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([abilityDefinitionId, score]) => ({
          abilityDefinitionId,
          modifier:
            abilityModifier(score) + (actor.saveProficiencyBonuses[abilityDefinitionId] ?? 0),
          rollMode: 'NORMAL' as const,
          contributors: []
        })),
      targetProtection: actor.targetProtection,
      featureResources: actor.featureResources.map((feature) => {
        const maximum = resolveMaximum(feature.charge, actor.resourceAbilityScores)
        const used = maximum === null ? 0 : feature.used
        return {
          featureId: feature.featureId,
          maximum,
          reconciliationPolicy: maximum === null ? null : ('CLAMP_USED_TO_MAXIMUM' as const),
          rawUsed: feature.used,
          used,
          remaining: maximum === null ? null : Math.max(0, maximum - used),
          resetKind:
            maximum === null ||
            feature.charge === null ||
            feature.charge.limitKind === 'SOURCE_CHARGES'
              ? null
              : feature.charge.resetKind
        }
      })
    }))
  })
}
