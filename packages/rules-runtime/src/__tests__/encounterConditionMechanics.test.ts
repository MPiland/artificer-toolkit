import { describe, expect, it } from 'vitest'
import { movementPassageOfModifiers } from '../encounterMovementPassagePolicy.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
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
  encounterConditionApproachWarnings,
  encounterConditionFleeSources,
  encounterFleeActionWarnings,
  encounterConditionAttackContributors,
  encounterConditionHitIsCritical,
  encounterConditionLevels,
  encounterConditionMechanicsInSourceSight,
  encounterConditionSaveAutoFailAbilityIds,
  encounterConditionSources,
  encounterConditionSpeed,
  pinEncounterConditionDefinitions,
  withEncounterConditionCheckContributors,
  withEncounterConditionMechanics,
  type EncounterConditionAttack
} from '../encounterConditionMechanics.js'
import type { MovementTarget } from '../encounterMovementTargets.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'
import { EncounterValidationError } from '../encounterErrors.js'
import { refuseUnmetTargetRequirements } from '../encounterTargetRequirements.js'
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
    form: null,
    absence: null,
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
    state: { current: 10, temporary: 0, conditions: [...conditions], deathSaves: null },
    initialConditionRows,
    effectiveMaximumHitPoints: 10,
    damageInterceptions: [],
    baseScalarValues: {},
    effectiveScalarValues: {},
    baseRulePolicyOutput: null,
    perceptionSenses: [],
    effectiveRulePolicyOutput: null,
    targetDerivedFacts: {
      savingThrowDefinitions: [
        { abilityDefinitionId: DEXTERITY, rollMode: 'NORMAL', contributors: [] },
        { abilityDefinitionId: WISDOM, rollMode: 'NORMAL', contributors: [] }
      ]
    },
    defenses: [],
    incomingDamage: { halved: false, saveForHalf: [] },
    qualifiedDefenses: [],
    conditionImmunityIds: [],
    sourceConditionImmunities: [],
    sourceSaves: [],
    spellSchoolImmunityIds: [],
    characterCurrentness: null,
    attackAgainstContributors: [],
    sourceSightSaves: [],
    conditionDefinitions: [],
    conditionMechanics: [],
    grantedAttackTraits: [],
    movementPassage: movementPassageOfModifiers(DND5E_SYSTEM_ID, []),
    featureModifiers: [],
    innateConditionIds: []
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
    influence,
    source: { kind: 'CONDITION', id: conditionDefinitionId, holderActorId }
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
          gameSystemId: SRD_SYSTEM_ID,
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
        gameSystemId: SRD_SYSTEM_ID,
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
      gameSystemId: SRD_SYSTEM_ID,
      holderActorId: ACTOR_ID,
      mechanics: await mechanicsOf([POISONED]),
      roll: {
        contributors: [
          {
            sourceId: 'help',
            grantId: null,
            domainKey: null,
            influence: 'ADVANTAGE',
            source: { kind: 'AUTHORED', id: 'help', holderActorId: null }
          }
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

const SOURCE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_SOURCE_ID = '33333333-3333-4333-8333-333333333334'

/** An effect on the holder that owns a condition, recording the creature that applied it or none. */
function owningEffect(
  id: number,
  conditionDefinitionId: string,
  sourceActorId: string | null,
  baselinePresent = false,
  fleesSource = false
) {
  return activeEffect({
    id: `44444444-4444-4444-8444-44444444444${id}`,
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: ACTOR_ID },
    createdOrdinal: id,
    sourceActorId,
    stateContributions: [
      {
        kind: 'CONDITION_OWNERSHIP',
        conditionId: conditionDefinitionId,
        baselinePresent,
        ...(sourceActorId ? { sourceActorId } : {}),
        ...(fleesSource ? { fleesSource } : {})
      }
    ]
  })
}

function holding(conditions: readonly string[], effects: ReturnType<typeof owningEffect>[]) {
  return { ...target(conditions), activeEffects: effects }
}

describe('a condition that follows its source (SPELLS-29)', () => {
  it('a condition is sourced only when every holding of it records the creature that applied it', () => {
    expect(
      encounterConditionSources(holding([FRIGHTENED], [owningEffect(1, FRIGHTENED, SOURCE_ID)]))
    ).toEqual(new Map([[FRIGHTENED, [SOURCE_ID]]]))
    expect(
      encounterConditionSources(
        holding(
          [FRIGHTENED],
          [owningEffect(1, FRIGHTENED, SOURCE_ID), owningEffect(2, FRIGHTENED, OTHER_SOURCE_ID)]
        )
      )
    ).toEqual(new Map([[FRIGHTENED, [SOURCE_ID, OTHER_SOURCE_ID].sort()]]))
    // Applied by hand, held before the effect, or owned by an effect that records no source.
    expect(encounterConditionSources(holding([FRIGHTENED], []))).toEqual(new Map())
    expect(
      encounterConditionSources(
        holding([FRIGHTENED], [owningEffect(1, FRIGHTENED, SOURCE_ID, true)])
      )
    ).toEqual(new Map())
    expect(
      encounterConditionSources(
        holding(
          [FRIGHTENED],
          [owningEffect(1, FRIGHTENED, SOURCE_ID), owningEffect(2, FRIGHTENED, null)]
        )
      )
    ).toEqual(new Map())
  })

  it('a sourced Frightened creature has disadvantage on attacks and checks only while it sees a source', async () => {
    const mechanics = await mechanicsOf([FRIGHTENED])
    const sources = encounterConditionSources(
      holding([FRIGHTENED], [owningEffect(1, FRIGHTENED, SOURCE_ID)])
    )
    const inSight = (seen: readonly string[]) =>
      encounterConditionMechanicsInSourceSight({
        mechanics,
        sources,
        seenActorIds: new Set(seen)
      })
    const checkMode = (seen: readonly string[]) =>
      withEncounterConditionCheckContributors({
        gameSystemId: SRD_SYSTEM_ID,
        holderActorId: ACTOR_ID,
        mechanics: inSight(seen),
        roll: { contributors: [], rollMode: 'NORMAL' }
      }).rollMode

    expect(attackContributors({ attacker: inSight([SOURCE_ID]), attack: RANGED })).toEqual([
      contributor(FRIGHTENED, ATTACKER_ID, 'DISADVANTAGE')
    ])
    expect(checkMode([SOURCE_ID])).toBe('DISADVANTAGE')
    expect(attackContributors({ attacker: inSight([]), attack: RANGED })).toEqual([])
    expect(checkMode([OTHER_SOURCE_ID])).toBe('NORMAL')
  })

  it('an unsourced Frightened keeps its disadvantage whatever the creature sees', async () => {
    const mechanics = await mechanicsOf([FRIGHTENED])
    const unsighted = encounterConditionMechanicsInSourceSight({
      mechanics,
      sources: encounterConditionSources(holding([FRIGHTENED], [])),
      seenActorIds: new Set()
    })
    expect(unsighted).toEqual(mechanics)
    expect(attackContributors({ attacker: unsighted, attack: RANGED })).toEqual([
      contributor(FRIGHTENED, ATTACKER_ID, 'DISADVANTAGE')
    ])
  })

  it('a move that ends closer to the source of a sourced Frightened warns; equal or farther does not', async () => {
    const mechanics = await mechanicsOf([FRIGHTENED])
    const sourced = encounterConditionSources(
      holding([FRIGHTENED], [owningEffect(1, FRIGHTENED, SOURCE_ID)])
    )
    const move = (from: number, to: number, sources = sourced) =>
      encounterConditionApproachWarnings({
        mechanics,
        sources,
        grid: FEET_GRID,
        start: token(from),
        end: token(to),
        sourceTokens: new Map([[SOURCE_ID, token(0)]])
      })
    expect(move(3, 2)).toEqual([{ code: 'CONDITION_SOURCE_APPROACH', message: expect.any(String) }])
    expect(move(3, 3)).toEqual([])
    expect(move(3, 5)).toEqual([])
    // An unsourced Frightened has no source to approach.
    expect(move(3, 1, new Map())).toEqual([])
    // A source with no token on the Scene cannot be approached.
    expect(
      encounterConditionApproachWarnings({
        mechanics,
        sources: sourced,
        grid: FEET_GRID,
        start: token(3),
        end: token(1),
        sourceTokens: new Map()
      })
    ).toEqual([])
  })

  it('a sourced condition without the approach mechanic never warns', async () => {
    const mechanics = await mechanicsOf([POISONED])
    expect(
      encounterConditionApproachWarnings({
        mechanics,
        sources: encounterConditionSources(
          holding([POISONED], [owningEffect(1, POISONED, SOURCE_ID)])
        ),
        grid: FEET_GRID,
        start: token(3),
        end: token(1),
        sourceTokens: new Map([[SOURCE_ID, token(0)]])
      })
    ).toEqual([])
  })
})

describe('a condition that flees its source (SPELLS-29.T2)', () => {
  const fleeing = (...effects: ReturnType<typeof owningEffect>[]) => holding([FRIGHTENED], effects)

  it('the sources to flee are the recorded sources of the held condition owners that flee', () => {
    expect(
      encounterConditionFleeSources(fleeing(owningEffect(1, FRIGHTENED, SOURCE_ID, false, true)))
    ).toEqual([SOURCE_ID])
    expect(
      encounterConditionFleeSources(
        fleeing(
          owningEffect(1, FRIGHTENED, OTHER_SOURCE_ID, false, true),
          owningEffect(2, FRIGHTENED, SOURCE_ID, false, true),
          owningEffect(3, FRIGHTENED, SOURCE_ID, false, true)
        )
      )
    ).toEqual([SOURCE_ID, OTHER_SOURCE_ID].sort())
    // A Frightened that does not flee, one held before its effect, an unsourced owner and a
    // condition the creature no longer holds flee nothing.
    expect(encounterConditionFleeSources(fleeing(owningEffect(1, FRIGHTENED, SOURCE_ID)))).toEqual(
      []
    )
    expect(
      encounterConditionFleeSources(fleeing(owningEffect(1, FRIGHTENED, SOURCE_ID, true, true)))
    ).toEqual([])
    expect(
      encounterConditionFleeSources(fleeing(owningEffect(1, FRIGHTENED, null, false, true)))
    ).toEqual([])
    expect(
      encounterConditionFleeSources({
        ...holding([], [owningEffect(1, FRIGHTENED, SOURCE_ID, false, true)])
      })
    ).toEqual([])
  })

  it('an action other than Dash warns for a fleeing creature; Dash and other allowances do not', () => {
    const warns = [{ code: 'CONDITION_SOURCE_FLEE', message: expect.any(String) }]
    expect(
      encounterFleeActionWarnings({
        sourceActorIds: [SOURCE_ID],
        activationCode: 'ACTION',
        dash: false
      })
    ).toEqual(warns)
    expect(
      encounterFleeActionWarnings({
        sourceActorIds: [SOURCE_ID],
        activationCode: 'ACTION',
        dash: true
      })
    ).toEqual([])
    expect(
      encounterFleeActionWarnings({
        sourceActorIds: [SOURCE_ID],
        activationCode: 'BONUS_ACTION',
        dash: false
      })
    ).toEqual([])
    expect(
      encounterFleeActionWarnings({ sourceActorIds: [], activationCode: 'ACTION', dash: false })
    ).toEqual([])
  })
})

describe('a single-target action’s target requirements (SPELLS-33.T4i4a)', () => {
  type Requirements = NonNullable<
    Parameters<typeof refuseUnmetTargetRequirements>[0]['requirements']
  >
  const SEEN = { attackerSeesTarget: 'SEES', targetSeesAttacker: 'UNSEEN' } as const
  const refusals = (
    requirements: Parameters<typeof refuseUnmetTargetRequirements>[0]['requirements'],
    held: ReturnType<typeof holding>,
    loadSight?: () => Promise<typeof SEEN>
  ) => refuseUnmetTargetRequirements({ requirements, actorId: SOURCE_ID, target: held, loadSight })

  it('a condition from the user is met only by a holding that records the user as its source', async () => {
    const requirements = [
      { kind: 'HAS_CONDITION', conditionIds: [FRIGHTENED], source: 'ACTOR' }
    ] satisfies Requirements
    await expect(
      refusals(requirements, holding([FRIGHTENED], [owningEffect(1, FRIGHTENED, SOURCE_ID)]))
    ).resolves.toBeUndefined()
    await expect(
      refusals(requirements, holding([FRIGHTENED], [owningEffect(1, FRIGHTENED, OTHER_SOURCE_ID)]))
    ).rejects.toThrow(EncounterValidationError)
    await expect(refusals(requirements, holding([], []))).rejects.toThrow(
      'does not have the required condition'
    )
  })

  it('a condition from anyone is met by any holding of it, applied by hand or innate', async () => {
    const requirements = [
      { kind: 'HAS_CONDITION', conditionIds: [FRIGHTENED, POISONED], source: 'ANY' }
    ] satisfies Requirements
    await expect(refusals(requirements, holding([FRIGHTENED], []))).resolves.toBeUndefined()
    await expect(refusals(requirements, holding([PRONE], []))).rejects.toThrow(
      EncounterValidationError
    )
    await expect(
      refusals(requirements, { ...holding([], []), innateConditionIds: [POISONED] })
    ).resolves.toBeUndefined()
  })

  it('sight is read in the direction the requirement names', async () => {
    const held = holding([], [])
    await expect(
      refusals([{ kind: 'SIGHT', direction: 'ACTOR_SEES_TARGET' }], held, async () => SEEN)
    ).resolves.toBeUndefined()
    await expect(
      refusals([{ kind: 'SIGHT', direction: 'TARGET_SEES_ACTOR' }], held, async () => SEEN)
    ).rejects.toThrow('out of the required sight')
  })

  it('refuses a sight requirement it cannot answer rather than skipping it', async () => {
    await expect(
      refusals([{ kind: 'SIGHT', direction: 'ACTOR_SEES_TARGET' }], holding([], []))
    ).rejects.toThrow('Target sight is unavailable.')
  })

  it('reads no sight for an action without a sight requirement', async () => {
    let reads = 0
    await refusals(
      [{ kind: 'HAS_CONDITION', conditionIds: [FRIGHTENED], source: 'ANY' }],
      holding([FRIGHTENED], []),
      async () => {
        reads += 1
        return SEEN
      }
    )
    expect(reads).toBe(0)
  })

  it('a target at 0 hit points is alive unless it is a dead Character', async () => {
    const requirements = [{ kind: 'AT_ZERO_HIT_POINTS' }] as const
    const at = (current: number, deathSaves: MovementTarget['state']['deathSaves']) => {
      const held = holding([], [])
      return { ...held, state: { ...held.state, current, deathSaves } }
    }
    await expect(refusals(requirements, at(0, null))).resolves.toBeUndefined()
    await expect(
      refusals(requirements, at(0, { successes: 0, failures: 2, stable: false }))
    ).resolves.toBeUndefined()
    await expect(
      refusals(requirements, at(0, { successes: 0, failures: 3, stable: false }))
    ).rejects.toThrow('not at 0 hit points')
    await expect(refusals(requirements, at(1, null))).rejects.toThrow(EncounterValidationError)
  })

  it('every requirement must hold, and an action with none admits any target', async () => {
    await expect(refusals(undefined, holding([], []))).resolves.toBeUndefined()
    await expect(
      refusals(
        [
          { kind: 'HAS_CONDITION', conditionIds: [FRIGHTENED], source: 'ANY' },
          { kind: 'AT_ZERO_HIT_POINTS' }
        ],
        holding([FRIGHTENED], [])
      )
    ).rejects.toThrow('not at 0 hit points')
  })
})
