import { describe, expect, it } from 'vitest'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'

import {
  activeEncounterConditionMechanics,
  applyEncounterConditionMechanics,
  encounterConditionAttackContributors,
  encounterConditionHitIsCritical,
  encounterConditionLevels,
  encounterConditionSaveAutoFailAbilityIds,
  encounterConditionSpeed,
  pinEncounterConditionDefinitions,
  withEncounterConditionCheckContributors,
  withEncounterConditionMechanics,
  type EncounterConditionAttack
} from '../encounterConditionMechanics.js'
import type { MovementTarget } from '../encounterMovementTargets.js'
import {
  currentConditionDefinition,
  srdConditionDefinitionSource
} from './srdConditionDefinitions.js'

const ENCOUNTER_ID = '11111111-1111-4111-8111-111111111111'
const ACTOR_ID = '33333333-3333-4333-8333-333333333331'
const ATTACKER_ID = '33333333-3333-4333-8333-333333333332'
const HOMEBREW_SLOWED_ID = '66666666-6666-4666-8666-666666666661'
const { STRENGTH, DEXTERITY, WISDOM } = SRD_ABILITY_DEFINITION_IDS

function conditionId(code: string) {
  const condition = SRD_CONDITION_TYPES.find((entry) => entry.code === code)
  if (!condition) throw new Error(`Unknown SRD condition ${code}.`)
  return condition.id
}
const PRONE = conditionId('PRONE')
const POISONED = conditionId('POISONED')
const FRIGHTENED = conditionId('FRIGHTENED')
const RESTRAINED = conditionId('RESTRAINED')
const PARALYZED = conditionId('PARALYZED')
const PETRIFIED = conditionId('PETRIFIED')
const STUNNED = conditionId('STUNNED')
const UNCONSCIOUS = conditionId('UNCONSCIOUS')
const EXHAUSTION = conditionId('EXHAUSTION')

/** A homebrew condition authored as data alone: speed halved, no code of its own (D94). */
const homebrewSlowed = currentConditionDefinition({
  id: HOMEBREW_SLOWED_ID,
  definitionFamilyKey: 'condition-rule-state',
  label: 'Slowed rule policy',
  document: {
    schemaVersion: 1,
    kind: 'CONDITION_RULE_STATE',
    id: HOMEBREW_SLOWED_ID,
    gameSystemId: SRD_SYSTEM_ID,
    capabilitySuppressions: [],
    perceptionContributions: [],
    mechanics: [
      {
        id: '66666666-6666-4666-8666-666666666662',
        order: 0,
        kind: 'SPEED',
        numerator: 1,
        denominator: 2,
        minimumLevel: null
      }
    ]
  }
})

function sourceWith(reads: string[]) {
  return srdConditionDefinitionSource({ extra: [homebrewSlowed], reads })
}

function target(conditions: readonly string[], initialConditionRows: unknown[] | null = null) {
  const actor = encounterRunActorStateSchema.parse({
    id: ACTOR_ID,
    encounterId: ENCOUNTER_ID,
    kind: 'CREATURE',
    label: 'Ogre',
    sourceId: null,
    sourceRevision: null,
    public: true,
    controllerUserIds: [],
    disposition: 'HOSTILE',
    initiative: null,
    manualOrder: null,
    conditions: [...conditions],
    healthDisplay: null,
    systemId: SRD_SYSTEM_ID,
    stableTieKey: ACTOR_ID,
    currentHitPoints: 10,
    maxHitPoints: 10,
    tempHitPoints: 0,
    defeated: false,
    resources: {},
    gmNotes: null,
    sideId: '22222222-2222-4222-8222-222222222222',
    snapshot: {},
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z'
  })
  const movementTarget: MovementTarget = {
    characterFacts: null,
    actor,
    activeEffects: [],
    state: { current: 10, temporary: 0, conditions: [...conditions] },
    initialConditionRows,
    effectiveMaximumHitPoints: 10,
    baseScalarValues: {},
    effectiveScalarValues: {},
    baseRulePolicyOutput: null,
    effectiveRulePolicyOutput: null,
    targetDerivedFacts: {
      savingThrowDefinitions: [
        { abilityDefinitionId: DEXTERITY, rollMode: 'NORMAL', contributors: [] },
        { abilityDefinitionId: WISDOM, rollMode: 'NORMAL', contributors: [] }
      ]
    },
    defenses: [],
    qualifiedDefenses: [],
    conditionImmunityIds: [],
    characterCurrentness: null,
    basicActionAttackContributors: [],
    conditionDefinitions: [],
    conditionMechanics: []
  }
  return movementTarget
}

async function mechanicsOf(conditions: readonly string[], rows: unknown[] | null = null) {
  return (
    await withEncounterConditionMechanics({
      target: target(conditions, rows),
      gameSystemId: SRD_SYSTEM_ID,
      definitions: sourceWith([])
    })
  ).conditionMechanics
}

function contributor(conditionDefinitionId: string, holderActorId: string, influence: string) {
  return {
    sourceId: `condition:${conditionDefinitionId}`,
    grantId: null,
    domainKey: `condition:${holderActorId}`,
    influence
  }
}

const MELEE: EncounterConditionAttack = { melee: true, sceneContext: null }
const RANGED: EncounterConditionAttack = { melee: false, sceneContext: null }

/** 100px cells of 5 feet; a Medium token fills one cell, anchored at its center. */
const FEET_GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}
function token(column: number) {
  return { position: { x: column * 100 + 50, y: 50 }, width: 100, height: 100, rotationDegrees: 0 }
}
function onScene(melee: boolean, targetColumn: number): EncounterConditionAttack {
  return {
    melee,
    sceneContext: { grid: FEET_GRID, sourceToken: token(0), targetToken: token(targetColumn) }
  }
}

function attackContributors(input: {
  attacker?: Awaited<ReturnType<typeof mechanicsOf>>
  target?: Awaited<ReturnType<typeof mechanicsOf>>
  attack: EncounterConditionAttack
}) {
  return encounterConditionAttackContributors({
    attackerActorId: ATTACKER_ID,
    attacker: input.attacker ?? [],
    targetActorId: ACTOR_ID,
    target: input.target ?? [],
    attack: input.attack
  })
}

describe('encounter condition mechanics (D94)', () => {
  it('a Poisoned or Frightened attacker has disadvantage on attack rolls and ability checks', async () => {
    for (const condition of [POISONED, FRIGHTENED]) {
      const mechanics = await mechanicsOf([condition])
      expect(attackContributors({ attacker: mechanics, attack: RANGED })).toEqual([
        contributor(condition, ATTACKER_ID, 'DISADVANTAGE')
      ])
      expect(
        withEncounterConditionCheckContributors({
          holderActorId: ACTOR_ID,
          mechanics,
          roll: { contributors: [], rollMode: 'NORMAL' }
        })
      ).toEqual({
        contributors: [contributor(condition, ACTOR_ID, 'DISADVANTAGE')],
        rollMode: 'DISADVANTAGE'
      })
    }
  })

  it('attacks against a Prone target have advantage within 5 feet and disadvantage beyond', async () => {
    const prone = await mechanicsOf([PRONE])
    expect(attackContributors({ target: prone, attack: MELEE })).toEqual([
      contributor(PRONE, ACTOR_ID, 'ADVANTAGE')
    ])
    expect(attackContributors({ target: prone, attack: RANGED })).toEqual([
      contributor(PRONE, ACTOR_ID, 'DISADVANTAGE')
    ])
    // On a Scene the tokens are measured: a ranged attack from the adjacent square is within 5 feet.
    expect(attackContributors({ target: prone, attack: onScene(false, 1) })).toEqual([
      contributor(PRONE, ACTOR_ID, 'ADVANTAGE')
    ])
    expect(attackContributors({ target: prone, attack: onScene(true, 3) })).toEqual([
      contributor(PRONE, ACTOR_ID, 'DISADVANTAGE')
    ])
    // A Prone attacker has disadvantage on its own attack rolls.
    expect(attackContributors({ attacker: prone, attack: MELEE })).toEqual([
      contributor(PRONE, ATTACKER_ID, 'DISADVANTAGE')
    ])
  })

  it('Restrained sets speed to 0, gives advantage against it and disadvantage on its Dexterity saves', async () => {
    const restrained = await withEncounterConditionMechanics({
      target: target([RESTRAINED]),
      gameSystemId: SRD_SYSTEM_ID,
      definitions: sourceWith([])
    })
    expect(encounterConditionSpeed({ mechanics: restrained.conditionMechanics, speed: 30 })).toBe(0)
    expect(attackContributors({ target: restrained.conditionMechanics, attack: RANGED })).toEqual([
      contributor(RESTRAINED, ACTOR_ID, 'ADVANTAGE')
    ])
    expect(restrained.targetDerivedFacts.savingThrowDefinitions).toEqual([
      {
        abilityDefinitionId: DEXTERITY,
        rollMode: 'DISADVANTAGE',
        contributors: [contributor(RESTRAINED, ACTOR_ID, 'DISADVANTAGE')]
      },
      { abilityDefinitionId: WISDOM, rollMode: 'NORMAL', contributors: [] }
    ])
  })

  it('Paralyzed, Petrified, Stunned and Unconscious fail Strength and Dexterity saves and are attacked with advantage', async () => {
    for (const condition of [PARALYZED, PETRIFIED, STUNNED, UNCONSCIOUS]) {
      const mechanics = await mechanicsOf([condition])
      expect(encounterConditionSaveAutoFailAbilityIds(mechanics)).toEqual(
        [STRENGTH, DEXTERITY].sort()
      )
      expect(encounterConditionSpeed({ mechanics, speed: 30 })).toBe(0)
      expect(attackContributors({ target: mechanics, attack: RANGED })).toEqual([
        contributor(condition, ACTOR_ID, 'ADVANTAGE')
      ])
    }
  })

  it('a hit within 5 feet of a Paralyzed or Unconscious target is critical; Stunned and Petrified are not', async () => {
    for (const condition of [PARALYZED, UNCONSCIOUS]) {
      const mechanics = await mechanicsOf([condition])
      expect(encounterConditionHitIsCritical({ target: mechanics, attack: MELEE })).toBe(true)
      expect(
        encounterConditionHitIsCritical({ target: mechanics, attack: onScene(false, 1) })
      ).toBe(true)
      expect(encounterConditionHitIsCritical({ target: mechanics, attack: RANGED })).toBe(false)
      expect(encounterConditionHitIsCritical({ target: mechanics, attack: onScene(true, 4) })).toBe(
        false
      )
    }
    for (const condition of [STUNNED, PETRIFIED])
      expect(
        encounterConditionHitIsCritical({ target: await mechanicsOf([condition]), attack: MELEE })
      ).toBe(false)
  })

  it('each Exhaustion level adds its own mechanics and keeps the lower levels', async () => {
    const definitions = await pinEncounterConditionDefinitions({
      conditionLevels: new Map([[EXHAUSTION, 1]]),
      gameSystemId: SRD_SYSTEM_ID,
      definitions: sourceWith([])
    })
    const at = (level: number) =>
      activeEncounterConditionMechanics({
        conditionDefinitions: definitions,
        conditionLevels: encounterConditionLevels({
          conditionIds: [],
          conditionRows: [],
          exhaustionLevel: level,
          gameSystemId: SRD_SYSTEM_ID
        })
      })
    const checkMode = (level: number) =>
      withEncounterConditionCheckContributors({
        holderActorId: ACTOR_ID,
        mechanics: at(level),
        roll: { contributors: [], rollMode: 'NORMAL' }
      }).rollMode
    expect(checkMode(1)).toBe('DISADVANTAGE')
    expect(encounterConditionSpeed({ mechanics: at(1), speed: 30 })).toBe(30)
    expect(attackContributors({ attacker: at(2), attack: MELEE })).toEqual([])
    expect(encounterConditionSpeed({ mechanics: at(2), speed: 30 })).toBe(15)
    expect(encounterConditionSpeed({ mechanics: at(2), speed: 25 })).toBe(12)
    expect(attackContributors({ attacker: at(3), attack: MELEE })).toEqual([
      contributor(EXHAUSTION, ATTACKER_ID, 'DISADVANTAGE')
    ])
    expect(encounterConditionSpeed({ mechanics: at(4), speed: 30 })).toBe(15)
    expect(encounterConditionSpeed({ mechanics: at(5), speed: 30 })).toBe(0)
    expect(checkMode(5)).toBe('DISADVANTAGE')
  })

  it("a Creature's Exhaustion row level applies that level's mechanics to its saves", async () => {
    const exhausted = await withEncounterConditionMechanics({
      target: target([EXHAUSTION], [{ conditionTypeId: EXHAUSTION, level: 3 }]),
      gameSystemId: SRD_SYSTEM_ID,
      definitions: sourceWith([])
    })
    expect(encounterConditionSpeed({ mechanics: exhausted.conditionMechanics, speed: 40 })).toBe(20)
    expect(exhausted.targetDerivedFacts.savingThrowDefinitions).toEqual(
      [DEXTERITY, WISDOM].map((abilityDefinitionId) => ({
        abilityDefinitionId,
        rollMode: 'DISADVANTAGE',
        contributors: [contributor(EXHAUSTION, ACTOR_ID, 'DISADVANTAGE')]
      }))
    )
  })

  it('advantage and disadvantage from conditions cancel to a normal roll', async () => {
    const roll = withEncounterConditionCheckContributors({
      holderActorId: ACTOR_ID,
      mechanics: await mechanicsOf([POISONED]),
      roll: {
        contributors: [
          { sourceId: 'help', grantId: null, domainKey: null, influence: 'ADVANTAGE' }
        ],
        rollMode: 'ADVANTAGE'
      }
    })
    expect(roll.rollMode).toBe('NORMAL')
    expect(roll.contributors).toHaveLength(2)
  })

  it('a homebrew condition applies its authored mechanics with no condition-specific code', async () => {
    const mechanics = await mechanicsOf([HOMEBREW_SLOWED_ID])
    expect(encounterConditionSpeed({ mechanics, speed: 30 })).toBe(15)
    expect(attackContributors({ target: mechanics, attack: MELEE })).toEqual([])
  })

  it('reads no definitions for an actor without conditions', async () => {
    const reads: string[] = []
    const unconditioned = target([])
    expect(
      await withEncounterConditionMechanics({
        target: unconditioned,
        gameSystemId: SRD_SYSTEM_ID,
        definitions: sourceWith(reads)
      })
    ).toEqual(unconditioned)
    expect(reads).toEqual([])
  })

  it('a rebuilt target re-derives its mechanics from its pins: a removed condition applies nothing', async () => {
    const restrained = await withEncounterConditionMechanics({
      target: target([RESTRAINED, PRONE]),
      gameSystemId: SRD_SYSTEM_ID,
      definitions: sourceWith([])
    })
    const rebuilt = applyEncounterConditionMechanics({
      target: { ...target([PRONE]), conditionDefinitions: restrained.conditionDefinitions },
      gameSystemId: SRD_SYSTEM_ID
    })
    expect(encounterConditionSpeed({ mechanics: rebuilt.conditionMechanics, speed: 30 })).toBe(30)
    expect(rebuilt.conditionMechanics.every((entry) => entry.conditionDefinitionId === PRONE)).toBe(
      true
    )
    expect(rebuilt.targetDerivedFacts.savingThrowDefinitions).toEqual(
      target([]).targetDerivedFacts.savingThrowDefinitions
    )
  })
})
