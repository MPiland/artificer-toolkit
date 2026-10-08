import type {
  ConditionMechanicAttackRangeDto,
  ConditionMechanicDto,
  PinnedConditionRuleStateDefinitionDto
} from '@artificer-toolkit/schema/shared/ruleState'
import { resolveD20Contributors } from '@artificer-toolkit/shared/rolls'
import { compareCanonicalD20Contributors } from '@artificer-toolkit/shared/rules'

import {
  measuredDistance,
  type EncounterActionSceneContext
} from './encounterActionTargetPolicy.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { EncounterRelationshipD20Contributor } from './encounterRelationshipActionFacts.js'
import {
  resolveRuleCapabilityState,
  type CurrentReusableDefinitionSource
} from './ruleCapabilityStateService.js'
import {
  DND5E_EXHAUSTION_CONDITION_DEFINITION_ID,
  DND5E_SYSTEM_ID
} from './systems/dnd5e/identity.js'

/** The System condition a Character's exhaustion level is a level of. */
const exhaustionConditionIdBySystemId: ReadonlyMap<string, string> = new Map([
  [DND5E_SYSTEM_ID, DND5E_EXHAUSTION_CONDITION_DEFINITION_ID]
])

/** One mechanic an actor's condition applies now, and the condition that holds it (D94). */
export type EncounterConditionMechanic = {
  conditionDefinitionId: string
  mechanic: ConditionMechanicDto
}

/** The attack a condition mechanic reads: its delivery and, when on a Scene, both positions. */
export type EncounterConditionAttack = {
  melee: boolean
  sceneContext: EncounterActionSceneContext | null
}

/**
 * The mechanics an actor's pinned condition definitions apply (D94). A leveled condition applies
 * each mechanic its level reaches, so higher levels keep the lower ones; a condition without a
 * recorded level is at level 1.
 */
export function activeEncounterConditionMechanics(input: {
  conditionDefinitions: readonly PinnedConditionRuleStateDefinitionDto[]
  conditionLevels: ReadonlyMap<string, number>
}): EncounterConditionMechanic[] {
  return [...input.conditionDefinitions]
    .sort((left, right) => left.conditionDefinitionId.localeCompare(right.conditionDefinitionId))
    .flatMap((definition) => {
      const level = input.conditionLevels.get(definition.conditionDefinitionId) ?? 1
      return definition.document.mechanics
        .filter((mechanic) => mechanic.minimumLevel === null || level >= mechanic.minimumLevel)
        .map((mechanic) => ({ conditionDefinitionId: definition.conditionDefinitionId, mechanic }))
    })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The conditions an actor has now and their levels: each held condition is at level 1 unless its
 * condition row records a level, and a Character's exhaustion level is a level of its System's
 * Exhaustion condition.
 */
export function encounterConditionLevels(input: {
  conditionIds: readonly string[]
  conditionRows: readonly unknown[]
  exhaustionLevel: number
  gameSystemId: string
}): Map<string, number> {
  const levels = new Map<string, number>(
    input.conditionIds.map((conditionId) => [conditionId, 1] as const)
  )
  for (const row of input.conditionRows)
    if (
      isRecord(row) &&
      typeof row.conditionTypeId === 'string' &&
      levels.has(row.conditionTypeId) &&
      typeof row.level === 'number' &&
      Number.isSafeInteger(row.level) &&
      row.level >= 1
    )
      levels.set(row.conditionTypeId, row.level)
  const exhaustionConditionId = exhaustionConditionIdBySystemId.get(input.gameSystemId)
  if (exhaustionConditionId && input.exhaustionLevel > 0)
    levels.set(exhaustionConditionId, input.exhaustionLevel)
  return levels
}

function heldConditionLevels(target: MovementTarget, gameSystemId: string) {
  return encounterConditionLevels({
    conditionIds: target.state.conditions,
    conditionRows: target.initialConditionRows ?? [],
    exhaustionLevel: target.characterFacts?.character.state.exhaustion?.level ?? 0,
    gameSystemId
  })
}

/** Pins the current definitions of the held conditions (D94); none are read when none are held. */
export async function pinEncounterConditionDefinitions(input: {
  conditionLevels: ReadonlyMap<string, number>
  gameSystemId: string
  definitions: CurrentReusableDefinitionSource
}): Promise<PinnedConditionRuleStateDefinitionDto[]> {
  if (!input.conditionLevels.size) return []
  const state = await resolveRuleCapabilityState({
    definitions: input.definitions,
    gameSystemId: input.gameSystemId,
    activeConditionDefinitionIds: [...input.conditionLevels.keys()],
    capabilityDefinitionIds: []
  })
  return state.conditionDefinitions
}

/**
 * Pins the target's condition definitions (D94) and applies their mechanics. A Character's
 * exhaustion level is a level of its System's Exhaustion condition; a Creature's condition row may
 * record a level.
 */
export async function withEncounterConditionMechanics<T extends MovementTarget>(input: {
  target: T
  gameSystemId: string
  definitions: CurrentReusableDefinitionSource
}): Promise<T> {
  const conditionLevels = heldConditionLevels(input.target, input.gameSystemId)
  if (!conditionLevels.size) return input.target
  return applyEncounterConditionMechanics({
    target: {
      ...input.target,
      conditionDefinitions: await pinEncounterConditionDefinitions({
        conditionLevels,
        gameSystemId: input.gameSystemId,
        definitions: input.definitions
      })
    },
    gameSystemId: input.gameSystemId
  })
}

/**
 * Derives the mechanics the target's current conditions apply from its pinned condition
 * definitions and adds their saving-throw contributors to its save rows. A flow that rebuilds a
 * target carries its pins over and re-applies this; a condition gained since the pins were loaded
 * applies nothing until the next load.
 */
export function applyEncounterConditionMechanics<T extends MovementTarget>(input: {
  target: T
  gameSystemId: string
}): T {
  const { target } = input
  const held = heldConditionLevels(target, input.gameSystemId)
  const conditionMechanics = activeEncounterConditionMechanics({
    conditionDefinitions: target.conditionDefinitions.filter((definition) =>
      held.has(definition.conditionDefinitionId)
    ),
    conditionLevels: held
  })
  const savingThrowDefinitions = target.targetDerivedFacts.savingThrowDefinitions
  return {
    ...target,
    conditionMechanics,
    targetDerivedFacts: {
      ...target.targetDerivedFacts,
      ...(Array.isArray(savingThrowDefinitions) && conditionMechanics.length
        ? {
            savingThrowDefinitions: savingThrowDefinitions.map((definition: unknown) => {
              if (!isRecord(definition) || !Array.isArray(definition.contributors))
                return definition
              const contributors = encounterConditionSaveContributors({
                holderActorId: target.actor.id,
                mechanics: conditionMechanics,
                abilityDefinitionId: String(definition.abilityDefinitionId)
              })
              if (!contributors.length) return definition
              const merged = uniqueContributors([
                ...(definition.contributors as EncounterRelationshipD20Contributor[]),
                ...contributors
              ])
              return {
                ...definition,
                contributors: merged,
                rollMode: resolveD20Contributors(merged).rollMode
              }
            })
          }
        : {})
    }
  }
}

/**
 * A condition's d20 contributor: its source id names the condition, so the derived-mode reason
 * reads the condition's label, and its domain key names the actor that has the condition.
 */
function conditionContributor(
  conditionDefinitionId: string,
  holderActorId: string,
  influence: EncounterRelationshipD20Contributor['influence']
): EncounterRelationshipD20Contributor {
  return {
    sourceId: `condition:${conditionDefinitionId}`,
    grantId: null,
    domainKey: `condition:${holderActorId}`,
    influence
  }
}

function uniqueContributors(
  contributors: readonly EncounterRelationshipD20Contributor[]
): EncounterRelationshipD20Contributor[] {
  return [...contributors]
    .sort(compareCanonicalD20Contributors)
    .filter(
      (contributor, index, sorted) =>
        index === 0 || compareCanonicalD20Contributors(sorted[index - 1]!, contributor) !== 0
    )
}

/** Without a Scene to measure on, a melee attack is within the range and a ranged one beyond it. */
function attackInRange(range: ConditionMechanicAttackRangeDto, attack: EncounterConditionAttack) {
  if (range.kind === 'ANY') return true
  const distance = attack.sceneContext
    ? measuredDistance(attack.sceneContext, range.distance)
    : null
  const within = distance ? distance.measured <= distance.maximum : attack.melee
  return range.kind === 'WITHIN' ? within : !within
}

/** Attack-roll contributors from the attacker's conditions and the target's. */
export function encounterConditionAttackContributors(input: {
  attackerActorId: string
  attacker: readonly EncounterConditionMechanic[]
  targetActorId: string
  target: readonly EncounterConditionMechanic[]
  attack: EncounterConditionAttack
}): EncounterRelationshipD20Contributor[] {
  return uniqueContributors([
    ...input.attacker.flatMap(({ conditionDefinitionId, mechanic }) =>
      mechanic.kind === 'D20_ROLL_MODE' && mechanic.roll.kind === 'ATTACKS_BY'
        ? [conditionContributor(conditionDefinitionId, input.attackerActorId, mechanic.influence)]
        : []
    ),
    ...input.target.flatMap(({ conditionDefinitionId, mechanic }) =>
      mechanic.kind === 'D20_ROLL_MODE' &&
      mechanic.roll.kind === 'ATTACKS_AGAINST' &&
      attackInRange(mechanic.roll.range, input.attack)
        ? [conditionContributor(conditionDefinitionId, input.targetActorId, mechanic.influence)]
        : []
    )
  ])
}

/** Whether a hit against the target is a critical hit because of its conditions. */
export function encounterConditionHitIsCritical(input: {
  target: readonly EncounterConditionMechanic[]
  attack: EncounterConditionAttack
}): boolean {
  return input.target.some(
    ({ mechanic }) =>
      mechanic.kind === 'HITS_AGAINST_CRITICAL' && attackInRange(mechanic.range, input.attack)
  )
}

/** A saving throw's contributors from the saver's conditions. */
function encounterConditionSaveContributors(input: {
  holderActorId: string
  mechanics: readonly EncounterConditionMechanic[]
  abilityDefinitionId: string
}): EncounterRelationshipD20Contributor[] {
  return uniqueContributors(
    input.mechanics.flatMap(({ conditionDefinitionId, mechanic }) =>
      mechanic.kind === 'D20_ROLL_MODE' &&
      mechanic.roll.kind === 'SAVES' &&
      (mechanic.roll.abilityDefinitionIds?.includes(input.abilityDefinitionId) ?? true)
        ? [conditionContributor(conditionDefinitionId, input.holderActorId, mechanic.influence)]
        : []
    )
  )
}

/** The abilities whose saving throws the holder's conditions fail unrolled, sorted. */
export function encounterConditionSaveAutoFailAbilityIds(
  mechanics: readonly EncounterConditionMechanic[]
): string[] {
  return [
    ...new Set(
      mechanics.flatMap(({ mechanic }) =>
        mechanic.kind === 'SAVE_AUTO_FAIL' ? mechanic.abilityDefinitionIds : []
      )
    )
  ].sort()
}

/** An ability check's roll with the checker's condition contributors added (D94). */
export function withEncounterConditionCheckContributors(input: {
  holderActorId: string
  mechanics: readonly EncounterConditionMechanic[]
  roll: {
    contributors: readonly EncounterRelationshipD20Contributor[]
    rollMode: ReturnType<typeof resolveD20Contributors>['rollMode']
  }
}): {
  contributors: EncounterRelationshipD20Contributor[]
  rollMode: ReturnType<typeof resolveD20Contributors>['rollMode']
} {
  const conditionContributors = input.mechanics.flatMap(({ conditionDefinitionId, mechanic }) =>
    mechanic.kind === 'D20_ROLL_MODE' && mechanic.roll.kind === 'ABILITY_CHECKS'
      ? [conditionContributor(conditionDefinitionId, input.holderActorId, mechanic.influence)]
      : []
  )
  if (!conditionContributors.length)
    return { contributors: [...input.roll.contributors], rollMode: input.roll.rollMode }
  const contributors = uniqueContributors([...input.roll.contributors, ...conditionContributors])
  return { contributors, rollMode: resolveD20Contributors(contributors).rollMode }
}

/** A speed after every speed mechanic of the actor's conditions, rounded down. */
export function encounterConditionSpeed(input: {
  mechanics: readonly EncounterConditionMechanic[]
  speed: number
}): number {
  return input.mechanics.reduce(
    (speed, { mechanic }) =>
      mechanic.kind === 'SPEED'
        ? Math.floor((speed * mechanic.numerator) / mechanic.denominator)
        : speed,
    input.speed
  )
}
