import type { HitPointMaximumFractionDto } from '@artificer-toolkit/schema/shared/hitPointMaximumFraction'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'

import { readEncounterActorConditionState } from './encounterCharacterMechanicsBatch.js'
import {
  activeEncounterConditionMechanics,
  encounterConditionLevels,
  pinEncounterConditionDefinitions,
  type EncounterConditionMechanic
} from './encounterConditionMechanics.js'

type ReadCurrentDefinition = (definitionId: string) => Promise<ReusableDefinitionCurrentDto | null>

function greatestCommonDivisor(left: number, right: number): number {
  return right === 0 ? left : greatestCommonDivisor(right, left % right)
}

/**
 * The share of its hit point maximum a holder keeps under its conditions' mechanics: the product of
 * every `HIT_POINT_MAXIMUM` fraction, reduced; null when none applies.
 */
export function hitPointMaximumFraction(
  mechanics: readonly EncounterConditionMechanic[]
): HitPointMaximumFractionDto | null {
  const product = mechanics.reduce(
    (fraction, { mechanic }) =>
      mechanic.kind === 'HIT_POINT_MAXIMUM'
        ? {
            numerator: fraction.numerator * mechanic.numerator,
            denominator: fraction.denominator * mechanic.denominator
          }
        : fraction,
    { numerator: 1, denominator: 1 }
  )
  const divisor = greatestCommonDivisor(product.numerator, product.denominator)
  const reduced = {
    numerator: product.numerator / divisor,
    denominator: product.denominator / divisor
  }
  return reduced.numerator === reduced.denominator ? null : reduced
}

/**
 * The fraction the held conditions leave a holder, at the levels given. A condition with no
 * rule-state definition has no mechanics.
 */
export async function resolveHitPointMaximumFraction(input: {
  conditionLevels: ReadonlyMap<string, number>
  gameSystemId: string
  readCurrentDefinition: ReadCurrentDefinition
}): Promise<HitPointMaximumFractionDto | null> {
  const current = new Map<string, ReusableDefinitionCurrentDto>()
  for (const conditionId of input.conditionLevels.keys()) {
    const definition = await input.readCurrentDefinition(conditionId)
    if (definition) current.set(conditionId, definition)
  }
  const conditionLevels = new Map(
    [...input.conditionLevels].filter(([conditionId]) => current.has(conditionId))
  )
  const conditionDefinitions = await pinEncounterConditionDefinitions({
    conditionLevels,
    gameSystemId: input.gameSystemId,
    definitions: { requireCurrent: async (definitionId) => current.get(definitionId)! }
  })
  return hitPointMaximumFraction(
    activeEncounterConditionMechanics({ conditionDefinitions, conditionLevels })
  )
}

/** The fraction a Character's conditions and exhaustion leave its maximum. */
export function characterHitPointMaximumFraction(input: {
  character: {
    systemId: string
    state: {
      conditions?: readonly { conditionTypeId: string }[]
      exhaustion?: { level: number } | null
    }
  }
  readCurrentDefinition: ReadCurrentDefinition
}) {
  const { character } = input
  return resolveHitPointMaximumFraction({
    conditionLevels: encounterConditionLevels({
      conditionIds: (character.state.conditions ?? []).map(
        ({ conditionTypeId }) => conditionTypeId
      ),
      conditionRows: [],
      exhaustionLevel: character.state.exhaustion?.level ?? 0,
      gameSystemId: character.systemId
    }),
    gameSystemId: character.systemId,
    readCurrentDefinition: input.readCurrentDefinition
  })
}

/** The fraction a Creature actor's condition rows leave its maximum. */
export function creatureHitPointMaximumFraction(input: {
  conditionRows: unknown
  gameSystemId: string
  readCurrentDefinition: ReadCurrentDefinition
}) {
  const { ids, values } = readEncounterActorConditionState(input.conditionRows)
  return resolveHitPointMaximumFraction({
    conditionLevels: encounterConditionLevels({
      conditionIds: ids,
      conditionRows: values,
      exhaustionLevel: 0,
      gameSystemId: input.gameSystemId
    }),
    gameSystemId: input.gameSystemId,
    readCurrentDefinition: input.readCurrentDefinition
  })
}

/** What a condition change leaves a Character's maximum: the fraction to store and the maximum it gives. */
export type ConditionMaximum = {
  fraction: HitPointMaximumFractionDto | null
  maximumHitPoints: number
}

/**
 * The maximum a Sheet command that changes a Character's conditions leaves it, or undefined for any
 * other command. Hosts pass the answer to the reducer, which stores the fraction and keeps current
 * hit points within the maximum (SPELLS-10.T1b). `maximumHitPoints` gives the maximum for a fraction.
 */
export async function sheetCommandConditionMaximum(input: {
  character: {
    systemId: string
    state: {
      conditions?: readonly { conditionTypeId: string }[]
      exhaustion?: { level: number } | null
    }
  }
  command: { type: string; level?: number; conditionTypeId?: string }
  readCurrentDefinition: ReadCurrentDefinition
  maximumHitPoints: (fraction: HitPointMaximumFractionDto | null) => number
}): Promise<ConditionMaximum | undefined> {
  const { character, command } = input
  const conditions = character.state.conditions ?? []
  const state =
    command.type === 'SET_EXHAUSTION'
      ? { ...character.state, exhaustion: command.level ? { level: command.level } : null }
      : command.type === 'ADD_CONDITION' && command.conditionTypeId
        ? {
            ...character.state,
            conditions: [...conditions, { conditionTypeId: command.conditionTypeId }]
          }
        : command.type === 'REMOVE_CONDITION'
          ? {
              ...character.state,
              conditions: conditions.filter(
                ({ conditionTypeId }) => conditionTypeId !== command.conditionTypeId
              )
            }
          : null
  if (!state) return undefined
  const fraction = await characterHitPointMaximumFraction({
    character: { systemId: character.systemId, state },
    readCurrentDefinition: input.readCurrentDefinition
  })
  return { fraction, maximumHitPoints: input.maximumHitPoints(fraction) }
}
