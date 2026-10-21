import { heldConditionIds } from './encounterInnateConditions.js'
import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import {
  effectiveSpatialGeometry,
  spatialEffectAffects,
  spatialGeometryOverlapsTokenFootprint,
  type SpatialSceneToken
} from '@artificer-toolkit/shared/vtt'
import { creatureConditionCapabilityRegistry } from './platformPolicyModules.js'
import { encounterActorRelationship } from './encounterActionTargetPolicy.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { toSpatialInstances } from './encounterSpatialCandidateExecution.js'

export type EncounterOccupantSaveAura = Extract<
  LiveSessionEncounterRulesResponse,
  { kind: 'OCCUPANT_SAVE_AURAS' }
>['auras'][number]

/**
 * The save-bonus auras (D155) that hold the target: zones lending `occupantSaveBonus` whose area
 * its token's footprint shares area with, whose source is the target or its ally, and that are
 * neither suppressed by their Creature source's defeat nor exempt the target. Whether a Character
 * source is unconscious is left to {@link withEncounterOccupantSaveBonus}, which reads its play state.
 */
export function encounterOccupantSaveAuras(input: {
  targetActorId: string
  actors: readonly EncounterRunActorState[]
  effects: readonly EncounterSpatialRuleEffectRecord[]
  tokens: readonly SpatialSceneToken[]
  actorIdByTokenId: ReadonlyMap<string, string>
}): EncounterOccupantSaveAura[] {
  const target = input.actors.find((actor) => actor.id === input.targetActorId)
  const targetToken = input.tokens.find(
    (token) => input.actorIdByTokenId.get(token.id) === input.targetActorId
  )
  if (!target || !targetToken) return []
  const auras = input.effects.filter((effect) => effect.placement.occupantSaveBonus)
  const instances = toSpatialInstances(auras, input.actors)
  return auras
    .flatMap((effect, index) => {
      const instance = instances[index]!
      const source = input.actors.find((actor) => actor.id === instance.sourceActorId)
      const bonus = effect.placement.occupantSaveBonus
      if (
        !bonus ||
        !source ||
        !spatialEffectAffects(instance, target.id) ||
        (source.id !== target.id &&
          encounterActorRelationship(source.disposition, target.disposition) !== 'ALLIED')
      )
        return []
      const geometry = effectiveSpatialGeometry(instance, input.tokens)
      return geometry && spatialGeometryOverlapsTokenFootprint({ geometry, token: targetToken })
        ? [
            {
              effectId: effect.id,
              sourceActorId: source.id,
              sourceCharacterId: source.kind === 'CHARACTER' ? source.sourceId : null,
              amount: bonus.amount
            }
          ]
        : []
    })
    .sort((left, right) => left.effectId.localeCompare(right.effectId))
}

/**
 * Adds the largest bonus of the auras holding the target (D155) to every one of its save rows, so
 * the bound save fact records it and replay is exact; two auras of one feature do not stack. An
 * aura whose Character source is unconscious lends nothing. The source's conditions are read only
 * when it is not the target.
 */
export async function withEncounterOccupantSaveBonus<T extends MovementTarget>(input: {
  target: T
  gameSystemId: string
  auras: readonly EncounterOccupantSaveAura[]
  readCharacterConditionIds(source: {
    sourceActorId: string
    sourceCharacterId: string
  }): Promise<readonly string[]>
}): Promise<T> {
  const { target } = input
  const unconscious = creatureConditionCapabilityRegistry.require(
    input.gameSystemId
  ).zeroHitPointsConditionDefinitionId
  const amounts: number[] = []
  for (const { sourceActorId, sourceCharacterId, amount } of input.auras) {
    const conditionIds =
      sourceCharacterId === null || unconscious === null
        ? []
        : sourceActorId === target.actor.id
          ? heldConditionIds(target)
          : await input.readCharacterConditionIds({ sourceActorId, sourceCharacterId })
    if (unconscious === null || !conditionIds.includes(unconscious)) amounts.push(amount)
  }
  return amounts.length ? withOccupantSaveBonusRows(target, Math.max(...amounts)) : target
}

/** The target with `bonus` added to every save row and recorded as its `occupantSaveBonus`. */
export function withOccupantSaveBonusRows<T extends MovementTarget>(target: T, bonus: number): T {
  const { savingThrowDefinitions } = target.targetDerivedFacts
  if (!Array.isArray(savingThrowDefinitions)) return target
  return {
    ...target,
    occupantSaveBonus: bonus,
    targetDerivedFacts: {
      ...target.targetDerivedFacts,
      savingThrowDefinitions: savingThrowDefinitions.map((row: unknown) =>
        typeof row === 'object' &&
        row !== null &&
        'modifier' in row &&
        typeof row.modifier === 'number'
          ? { ...row, modifier: row.modifier + bonus }
          : row
      )
    }
  }
}
