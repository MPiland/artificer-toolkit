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

export type EncounterOccupantAura = Extract<
  LiveSessionEncounterRulesResponse,
  { kind: 'OCCUPANT_AURAS' }
>['auras'][number]

/**
 * The occupant auras (D155) that hold the target: zones lending `occupantSaveBonus` or
 * `occupantConditionImmunity` whose area its token's footprint shares area with, whose source is the
 * target or its ally, and that are neither suppressed by their Creature source's defeat nor exempt
 * the target. Whether a Character source is unconscious is left to
 * {@link withEncounterOccupantAuras}, which reads its play state.
 */
export function encounterOccupantAuras(input: {
  targetActorId: string
  actors: readonly EncounterRunActorState[]
  effects: readonly EncounterSpatialRuleEffectRecord[]
  tokens: readonly SpatialSceneToken[]
  actorIdByTokenId: ReadonlyMap<string, string>
}): EncounterOccupantAura[] {
  const target = input.actors.find((actor) => actor.id === input.targetActorId)
  const targetToken = input.tokens.find(
    (token) => input.actorIdByTokenId.get(token.id) === input.targetActorId
  )
  if (!target || !targetToken) return []
  const auras = input.effects.filter(
    (effect) => effect.placement.occupantSaveBonus || effect.placement.occupantConditionImmunity
  )
  const instances = toSpatialInstances(auras, input.actors)
  return auras
    .flatMap((effect, index) => {
      const instance = instances[index]!
      const source = input.actors.find((actor) => actor.id === instance.sourceActorId)
      const { occupantSaveBonus, occupantConditionImmunity } = effect.placement
      if (
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
              saveBonus: occupantSaveBonus?.amount ?? null,
              conditionImmunityIds: occupantConditionImmunity?.conditionTypeIds ?? []
            }
          ]
        : []
    })
    .sort((left, right) => left.effectId.localeCompare(right.effectId))
}

/**
 * Applies the auras holding the target (D155): the largest save bonus among them is added to every
 * one of its save rows, so the bound save fact records it and replay is exact (two auras of one
 * feature do not stack), and the conditions they keep off join its condition immunities. An aura
 * whose Character source is unconscious lends nothing. The source's conditions are read only when it
 * is not the target.
 */
export async function withEncounterOccupantAuras<T extends MovementTarget>(input: {
  target: T
  gameSystemId: string
  auras: readonly EncounterOccupantAura[]
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
  const conditionImmunityIds: string[] = []
  for (const aura of input.auras) {
    const { sourceActorId, sourceCharacterId } = aura
    const conditionIds =
      sourceCharacterId === null || unconscious === null
        ? []
        : sourceActorId === target.actor.id
          ? heldConditionIds(target)
          : await input.readCharacterConditionIds({ sourceActorId, sourceCharacterId })
    if (unconscious !== null && conditionIds.includes(unconscious)) continue
    if (aura.saveBonus !== null) amounts.push(aura.saveBonus)
    conditionImmunityIds.push(...aura.conditionImmunityIds)
  }
  const saved = amounts.length ? withOccupantSaveBonusRows(target, Math.max(...amounts)) : target
  return conditionImmunityIds.length
    ? withOccupantConditionImmunities(saved, conditionImmunityIds)
    : saved
}

/** The target with `conditionTypeIds` joined to its condition immunities and recorded as its aura's. */
export function withOccupantConditionImmunities<T extends MovementTarget>(
  target: T,
  conditionTypeIds: readonly string[]
): T {
  const occupantConditionImmunityIds = [...new Set(conditionTypeIds)].sort()
  return {
    ...target,
    occupantConditionImmunityIds,
    conditionImmunityIds: [
      ...new Set([...target.conditionImmunityIds, ...occupantConditionImmunityIds])
    ]
  }
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
