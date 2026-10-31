import { heldConditionIds } from './encounterInnateConditions.js'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type {
  ConditionMechanicAttackRangeDto,
  ConditionMechanicDto,
  PinnedConditionRuleStateDefinitionDto
} from '@artificer-toolkit/schema/shared/ruleState'
import { compareCanonicalD20Contributors } from '@artificer-toolkit/shared/rules'
import { measureSceneTokenFootprintDistance, type SceneGrid } from '@artificer-toolkit/shared/vtt'

import {
  measuredDistance,
  type EncounterActionSceneContext
} from './encounterActionTargetPolicy.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { EncounterRelationshipD20Contributor } from './encounterRelationshipActionFacts.js'
import {
  creatureConditionCapabilityRegistry,
  rollModeCapabilityRegistry
} from './platformPolicyModules.js'
import {
  resolveRuleCapabilityState,
  type CurrentReusableDefinitionSource
} from './ruleCapabilityStateService.js'

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
  const { exhaustionConditionDefinitionId: exhaustionConditionId } =
    creatureConditionCapabilityRegistry.require(input.gameSystemId)
  if (exhaustionConditionId && input.exhaustionLevel > 0)
    levels.set(exhaustionConditionId, input.exhaustionLevel)
  return levels
}

function heldConditionLevels(target: MovementTarget, gameSystemId: string) {
  return encounterConditionLevels({
    conditionIds: heldConditionIds(target),
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
 * definitions, adds their saving-throw contributors to its save rows and their damage defenses to
 * its defenses. A flow that rebuilds a target carries its pins over and re-applies this; a condition
 * gained since the pins were loaded applies nothing until the next load.
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
    defenses: withConditionDamageDefenses(target.defenses, conditionMechanics),
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
                rollMode: rollModeCapabilityRegistry.resolveRollMode({
                  gameSystemId: input.gameSystemId,
                  contributors: merged
                }).rollMode
              }
            })
          }
        : {})
    }
  }
}

/**
 * The holder's damage defenses with its conditions' defenses added (SPELLS-10). A condition's
 * defense holds against any damage, so it stands in for the same defense limited to some sources.
 */
function withConditionDamageDefenses(
  defenses: MovementTarget['defenses'],
  mechanics: readonly EncounterConditionMechanic[]
): MovementTarget['defenses'] {
  const added = new Map(
    mechanics.flatMap(({ mechanic }) =>
      mechanic.kind === 'DAMAGE_DEFENSE'
        ? mechanic.damageTypeIds.map(
            (damageTypeId) =>
              [
                `${mechanic.defense}:${damageTypeId}`,
                { kind: mechanic.defense, damageTypeId }
              ] as const
          )
        : []
    )
  )
  if (!added.size) return defenses
  return [
    ...defenses.filter(({ kind, damageTypeId }) => !added.has(`${kind}:${damageTypeId}`)),
    ...[...added].sort(([left], [right]) => left.localeCompare(right)).map(([, defense]) => defense)
  ]
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
    influence,
    source: { kind: 'CONDITION', id: conditionDefinitionId.toLowerCase(), holderActorId }
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

/** An ability check's roll with the checker's condition contributors added (D94). */
export function withEncounterConditionCheckContributors(input: {
  gameSystemId: string
  holderActorId: string
  mechanics: readonly EncounterConditionMechanic[]
  roll: {
    contributors: readonly EncounterRelationshipD20Contributor[]
    rollMode: string
  }
}): {
  contributors: EncounterRelationshipD20Contributor[]
  rollMode: string
} {
  const conditionContributors = input.mechanics.flatMap(({ conditionDefinitionId, mechanic }) =>
    mechanic.kind === 'D20_ROLL_MODE' && mechanic.roll.kind === 'ABILITY_CHECKS'
      ? [conditionContributor(conditionDefinitionId, input.holderActorId, mechanic.influence)]
      : []
  )
  if (!conditionContributors.length)
    return { contributors: [...input.roll.contributors], rollMode: input.roll.rollMode }
  const contributors = uniqueContributors([...input.roll.contributors, ...conditionContributors])
  return {
    contributors,
    rollMode: rollModeCapabilityRegistry.resolveRollMode({
      gameSystemId: input.gameSystemId,
      contributors
    }).rollMode
  }
}

/**
 * The recorded sources of each condition the holder has, sorted and unique. A condition is sourced
 * only when every effect that owns it recorded the creature that applied it; one held before its
 * effect, applied by hand, or owned by an effect that records no source has none (SPELLS-29).
 */
export function encounterConditionSources(
  target: Pick<MovementTarget, 'state' | 'activeEffects'>
): Map<string, string[]> {
  const held = new Set(target.state.conditions)
  const holdings = new Map<string, (string | null)[]>()
  for (const { definition } of target.activeEffects)
    for (const contribution of definition.stateContributions)
      if (contribution.kind === 'CONDITION_OWNERSHIP' && held.has(contribution.conditionId))
        holdings.set(contribution.conditionId, [
          ...(holdings.get(contribution.conditionId) ?? []),
          contribution.baselinePresent ? null : (contribution.sourceActorId ?? null)
        ])
  return new Map(
    [...holdings].flatMap(([conditionId, sources]) =>
      sources.every((source): source is string => source !== null)
        ? [[conditionId, [...new Set(sources)].sort()] as const]
        : []
    )
  )
}

/**
 * The creatures the holder must Dash away from, sorted and unique: the recorded source of each
 * held condition whose owning effect authored `fleesSource` (SPELLS-29.T2).
 */
export function encounterConditionFleeSources(target: {
  state: Pick<MovementTarget['state'], 'conditions'>
  activeEffects: MovementTarget['activeEffects']
}): string[] {
  const held = new Set(target.state.conditions)
  return [
    ...new Set(
      target.activeEffects.flatMap(({ definition }) =>
        definition.stateContributions.flatMap((contribution) =>
          contribution.kind === 'CONDITION_OWNERSHIP' &&
          held.has(contribution.conditionId) &&
          !contribution.baselinePresent &&
          contribution.fleesSource &&
          contribution.sourceActorId
            ? [contribution.sourceActorId]
            : []
        )
      )
    )
  ].sort()
}

/**
 * The warning for an action that is not Dash, taken by a creature that must Dash away from a source
 * (a bonus action or reaction is no substitute for the Action the Dash needs).
 */
export function encounterFleeActionWarnings(input: {
  sourceActorIds: readonly string[]
  activationCode: string
  dash: boolean
}): EncounterRuleWarningDto[] {
  return input.sourceActorIds.length > 0 && input.activationCode === 'ACTION' && !input.dash
    ? [
        {
          code: 'CONDITION_SOURCE_FLEE',
          message:
            'This creature must take the Dash action to move away from the source of a condition.'
        }
      ]
    : []
}

/**
 * The mechanics that apply while the holder sees what it sees: a sight-gated roll mode of a sourced
 * condition applies only while the holder sees one of its sources; unsourced, it always applies.
 */
export function encounterConditionMechanicsInSourceSight(input: {
  mechanics: readonly EncounterConditionMechanic[]
  sources: ReadonlyMap<string, readonly string[]>
  seenActorIds: ReadonlySet<string>
}): EncounterConditionMechanic[] {
  return input.mechanics.filter(({ conditionDefinitionId, mechanic }) => {
    const sources = input.sources.get(conditionDefinitionId)
    return !(
      mechanic.kind === 'D20_ROLL_MODE' &&
      mechanic.requiresHolderSeesSource &&
      sources &&
      !sources.some((sourceId) => input.seenActorIds.has(sourceId))
    )
  })
}

/**
 * The rule warning a move raises when it ends closer to a recorded source of a condition that
 * forbids approaching it (ADR 0034 soft enforcement). A source without a token on the Scene cannot
 * be approached.
 */
export function encounterConditionApproachWarnings(input: {
  mechanics: readonly EncounterConditionMechanic[]
  sources: ReadonlyMap<string, readonly string[]>
  grid: SceneGrid
  start: EncounterActionSceneContext['sourceToken']
  end: EncounterActionSceneContext['sourceToken']
  sourceTokens: ReadonlyMap<string, EncounterActionSceneContext['targetToken']>
}): EncounterRuleWarningDto[] {
  const approaches = input.mechanics.some(
    ({ conditionDefinitionId, mechanic }) =>
      mechanic.kind === 'APPROACH_SOURCE_FORBIDDEN' &&
      (input.sources.get(conditionDefinitionId) ?? []).some((sourceId) => {
        const source = input.sourceTokens.get(sourceId)
        return (
          source &&
          measureSceneTokenFootprintDistance(input.grid, input.end, source) <
            measureSceneTokenFootprintDistance(input.grid, input.start, source)
        )
      })
  )
  return approaches
    ? [
        {
          code: 'CONDITION_SOURCE_APPROACH',
          message: 'This move ends closer to the source of a condition that forbids it.'
        }
      ]
    : []
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
