import { describe, expect, it } from 'vitest'
import { movementPassageOfModifiers } from '../encounterMovementPassagePolicy.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { ATTACK_DOMAIN_CODE } from '@artificer-toolkit/shared/core'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_SPEEDS
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { resolveCharacterRulePolicyRollModes } from '../character/characterRuleRollProjection.js'
import {
  encounterAttackAgainstContributors,
  withCharacterActiveGrants
} from '../encounterActiveGrants.js'
import { encounterAttackSightContributors } from '../encounterAttackPerception.js'
import { withEncounterConditionMechanics } from '../encounterConditionMechanics.js'
import { encounterHolderState, withEncounterHolderDefense } from '../encounterHolderDefense.js'
import { buildMovementTarget, type MovementTarget } from '../encounterMovementTargets.js'
import { evaluateDnd5e2014CharacterPolicy } from '../systems/dnd5e/characterPolicy.js'
import {
  CAMPAIGN_ID,
  SRD_SYSTEM_ID,
  characterActor,
  creatureActor,
  creatureRuleFacts,
  srdCondition,
  srdCreatureActor,
  srdDefinitions,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { dodgeEffect } from './antitoxinEffectFixture.js'
import { SRD, evaluateSrdCharacter, srdByLabel, vocabulary } from '../testing/dnd5eSrdCharacter.js'

const HOLDER_ID = testUuid(0xd5a1)
const DODGE_ID = testUuid(0xd5a2)
const { DEXTERITY } = SRD_ABILITY_DEFINITION_IDS
const ATTACK_DOMAINS = Object.values(ATTACK_DOMAIN_CODE)
const WALK_ID = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id ?? ''
const DODGE_SOURCE_ID = createCharacterMechanicSourceKey({
  kind: 'ACTIVE_EFFECT',
  activeEffectId: DODGE_ID
})

const dodge = () => dodgeEffect({ id: DODGE_ID, holderActorId: HOLDER_ID })
const ogre = srdByLabel(SRD.creatures, 'Ogre')

function creatureHolder(conditionIds: readonly string[] = []) {
  return buildMovementTarget({
    actor: srdCreatureActor({ id: HOLDER_ID, creature: ogre, conditionIds }),
    activeEffects: [dodge()],
    gameSystemId: SRD_SYSTEM_ID,
    campaignId: CAMPAIGN_ID,
    characterFacts: null
  })
}

const defend = (target: MovementTarget) =>
  withEncounterHolderDefense({
    target,
    gameSystemId: SRD_SYSTEM_ID,
    definitions: srdDefinitions,
    speedDefinitions: SRD_SPEEDS,
    runEffectsByActorId: new Map(),
    readTurnMovedFeet: async () => 0
  })

const dexteritySave = (target: MovementTarget) =>
  (
    target.targetDerivedFacts.savingThrowDefinitions as unknown as readonly Record<
      string,
      unknown
    >[]
  ).find((row) => row.abilityDefinitionId === DEXTERITY && row.conditionTypeId === undefined)

describe('ATTACKS_AGAINST on a Creature holder', () => {
  it('gives attacks of every attack domain disadvantage that needs the holder to see the attacker', async () => {
    const defended = await defend(creatureHolder())
    expect(
      defended.attackAgainstContributors.map(({ attackDomain }) => attackDomain).sort()
    ).toEqual([...ATTACK_DOMAINS].sort())
    for (const entry of defended.attackAgainstContributors) {
      expect(entry).toMatchObject({
        requiresHolderSeesAttacker: true,
        contributor: {
          sourceId: DODGE_SOURCE_ID,
          domainKey: `active-grant:${HOLDER_ID}`,
          influence: 'DISADVANTAGE'
        }
      })
    }
  })

  it('keeps the contributor while the holder sees the attacker and drops it when it does not', async () => {
    const { attackAgainstContributors } = await defend(creatureHolder())
    const melee = attackAgainstContributors.filter(({ attackDomain }) => attackDomain === 'MELEE')
    const sight = (targetSeesAttacker: 'SEES' | 'UNSEEN') =>
      encounterAttackSightContributors({
        perception: {
          targetSeesAttacker,
          attackerSeesTarget: 'SEES',
          targetSenseLabels: [],
          attackerSenseLabels: [],
          attackerSenseDefinitionIds: []
        },
        attacksAgainst: melee
      }).map(({ sourceId }) => sourceId)
    expect(sight('SEES')).toEqual([DODGE_SOURCE_ID])
    expect(sight('UNSEEN')).not.toContain(DODGE_SOURCE_ID)
  })

  it('adds advantage to the Dexterity save only', async () => {
    const defended = await defend(creatureHolder())
    expect(dexteritySave(defended)).toMatchObject({
      rollMode: 'ADVANTAGE',
      contributors: [{ sourceId: DODGE_SOURCE_ID, influence: 'ADVANTAGE' }]
    })
    const other = (
      defended.targetDerivedFacts.savingThrowDefinitions as readonly {
        abilityDefinitionId: string
        rollMode: string
      }[]
    ).filter((row) => row.abilityDefinitionId !== DEXTERITY)
    expect(other.every((row) => row.rollMode === 'NORMAL')).toBe(true)
  })

  it('applies nothing without an active grant', async () => {
    const bare = buildMovementTarget({
      actor: srdCreatureActor({ id: HOLDER_ID, creature: ogre }),
      activeEffects: [],
      gameSystemId: SRD_SYSTEM_ID,
      campaignId: CAMPAIGN_ID,
      characterFacts: null
    })
    expect(await defend(bare)).toBe(bare)
  })
})

describe('ATTACKS_AGAINST on a Character holder', () => {
  const fighter = evaluateSrdCharacter({
    race: 'Human',
    abilities: { DEXTERITY: 14 },
    classes: [{ label: 'Fighter', level: 1 }]
  })

  /** The Character target the Encounter builds: its policy folds the holder's active grants. */
  function characterHolder(conditionIds: readonly string[] = []): MovementTarget {
    const effectiveRulePolicyOutput = resolveCharacterRulePolicyRollModes(
      evaluateDnd5e2014CharacterPolicy(withCharacterActiveGrants(fighter.facts, [dodge()])),
      vocabulary
    )
    return {
      characterFacts: null,
      actor: characterActor({ id: HOLDER_ID, characterId: testUuid(0xd5a3) }),
      activeEffects: [dodge()],
      state: { current: 10, temporary: 0, conditions: [...conditionIds], deathSaves: null },
      initialConditionRows: null,
      effectiveMaximumHitPoints: 10,
      damageInterceptions: [],
      baseScalarValues: {},
      effectiveScalarValues: {},
      baseRulePolicyOutput: null,
      perceptionSenses: [],
      effectiveRulePolicyOutput,
      targetDerivedFacts: { ...effectiveRulePolicyOutput },
      defenses: [],
      qualifiedDefenses: [],
      conditionImmunityIds: [],
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
  }

  it("does not fold the restricted grants into the Character's own policy", () => {
    const { effectiveRulePolicyOutput } = characterHolder()
    expect(dexteritySave(characterHolder())).toMatchObject({ rollMode: 'NORMAL', contributors: [] })
    expect(effectiveRulePolicyOutput?.rollModes.attacks).toMatchObject({
      MELEE: 'NORMAL',
      RANGED: 'NORMAL'
    })
  })

  it('gives attacks against it disadvantage and its Dexterity save advantage', async () => {
    const defended = await defend(characterHolder())
    expect(
      defended.attackAgainstContributors.map(({ attackDomain }) => attackDomain).sort()
    ).toEqual([...ATTACK_DOMAINS].sort())
    expect(dexteritySave(defended)).toMatchObject({
      rollMode: 'ADVANTAGE',
      contributors: [{ sourceId: DODGE_SOURCE_ID, influence: 'ADVANTAGE' }]
    })
  })

  it('applies nothing while it cannot act', async () => {
    const defended = await defend(characterHolder([srdCondition('Incapacitated')]))
    expect(defended.attackAgainstContributors).toEqual([])
    expect(dexteritySave(defended)).toMatchObject({ rollMode: 'NORMAL' })
  })
})

describe('holder-state predicates CAN_ACT and SPEED_ABOVE_ZERO', () => {
  const state = (conditionIds: readonly string[]) =>
    encounterHolderState({
      target: creatureHolder(conditionIds),
      gameSystemId: SRD_SYSTEM_ID,
      definitions: srdDefinitions,
      speedDefinitions: SRD_SPEEDS,
      runEffectsByActorId: new Map(),
      readTurnMovedFeet: async () => 0
    })

  it('CAN_ACT fails once a condition suppresses the actor-action capability', async () => {
    expect(await state([])).toMatchObject({ canAct: true })
    expect(await state([srdCondition('Incapacitated')])).toMatchObject({ canAct: false })
    expect(await state([srdCondition('Stunned')])).toMatchObject({ canAct: false })
  })

  it('SPEED_ABOVE_ZERO fails when condition mechanics set every speed to 0', async () => {
    expect(await state([])).toMatchObject({ speedAboveZero: true })
    const restrained = await defend(
      await withEncounterConditionMechanics({
        target: creatureHolder([srdCondition('Restrained')]),
        gameSystemId: SRD_SYSTEM_ID,
        definitions: srdDefinitions
      })
    )
    expect(restrained.attackAgainstContributors).toEqual([])
    // Restrained gives Dexterity saves disadvantage itself; Dodge's advantage is not among them.
    expect(dexteritySave(restrained)).toMatchObject({ rollMode: 'DISADVANTAGE' })
    expect(
      (
        (dexteritySave(restrained) ?? { contributors: [] }).contributors as readonly {
          sourceId: string
        }[]
      ).map(({ sourceId }) => sourceId)
    ).not.toContain(DODGE_SOURCE_ID)
  })

  it('fails the read on a Creature speed that is not a typed length', async () => {
    const scores = {
      STRENGTH: 11,
      DEXTERITY: 12,
      CONSTITUTION: 12,
      INTELLIGENCE: 10,
      WISDOM: 10,
      CHARISMA: 10
    }
    const malformed = (speeds: unknown[]) =>
      buildMovementTarget({
        actor: creatureActor({
          id: HOLDER_ID,
          currentHitPoints: 7,
          maxHitPoints: 11,
          tempHitPoints: 0,
          conditions: [],
          snapshot: {
            payload: {
              size: 'MEDIUM',
              naturalArmorBonus: 1,
              abilityScores: scores,
              speeds,
              senses: [],
              damageVulnerabilities: [],
              damageResistances: [],
              damageImmunities: [],
              conditionImmunities: []
            },
            ruleFacts: creatureRuleFacts(scores)
          }
        }),
        activeEffects: [],
        gameSystemId: SRD_SYSTEM_ID,
        campaignId: CAMPAIGN_ID,
        characterFacts: null
      })
    // The target reads its speeds when built, so building it is part of the read.
    const read = async (speeds: unknown[]) =>
      encounterHolderState({
        target: malformed(speeds),
        gameSystemId: SRD_SYSTEM_ID,
        definitions: srdDefinitions,
        speedDefinitions: SRD_SPEEDS,
        runEffectsByActorId: new Map(),
        readTurnMovedFeet: async () => 0
      })
    await expect(read([{ speedId: WALK_ID, amount: 30, unit: 'FEET' }])).resolves.toMatchObject({
      speedAboveZero: true
    })
    await expect(read([{ speedId: WALK_ID, amount: 'fast', unit: 'FEET' }])).rejects.toThrow(
      /amount/
    )
    await expect(read([{ speedId: WALK_ID, amount: 30, unit: 'FURLONGS' }])).rejects.toThrow(/unit/)
    await expect(read([{ speedId: testUuid(0xd5a4), amount: 30, unit: 'FEET' }])).rejects.toThrow(
      `Speed ${testUuid(0xd5a4)} is not in the System speed vocabulary.`
    )
  })

  it('a restriction with a condition other than the holder-state ones fails closed', () => {
    const [activeEffect] = [dodge()]
    const closed = activeEffect.definition.stateContributions.map((contribution) =>
      contribution.kind === 'MODIFIER_GRANT'
        ? {
            ...contribution,
            modifiers: contribution.modifiers.map((modifier) => ({
              ...modifier,
              restrictions: modifier.restrictions.map((group) => ({
                ...group,
                conditions: [
                  ...group.conditions,
                  { ...group.conditions[0]!, kind: 'UNSUPPORTED' as const }
                ]
              }))
            }))
          }
        : contribution
    )
    const effects = [
      { ...activeEffect, definition: { ...activeEffect.definition, stateContributions: closed } }
    ]
    expect(
      encounterAttackAgainstContributors({
        holderActorId: HOLDER_ID,
        effects: effects,
        grantFold: null,
        holderState: {
          kind: 'CHARACTER',
          creatureTypeIds: [],
          canAct: true,
          speedAboveZero: true,
          freeHand: true,
          stowableHeldItemInstanceId: null,
          turnMovement: { usedFeet: 0, speedFeet: 30 }
        }
      })
    ).toEqual([])
    expect(
      encounterAttackAgainstContributors({
        holderActorId: HOLDER_ID,
        effects: [activeEffect],
        grantFold: null,
        holderState: {
          kind: 'CHARACTER',
          creatureTypeIds: [],
          canAct: true,
          speedAboveZero: true,
          freeHand: true,
          stowableHeldItemInstanceId: null,
          turnMovement: { usedFeet: 0, speedFeet: 30 }
        }
      })
    ).toHaveLength(ATTACK_DOMAINS.length)
  })

  it('an INCLUDE predicate holds only while the state is true', () => {
    const [activeEffect] = [dodge()]
    const holds = (canAct: boolean, speedAboveZero: boolean) =>
      encounterAttackAgainstContributors({
        holderActorId: HOLDER_ID,
        effects: [activeEffect!],
        grantFold: null,
        holderState: {
          kind: 'CHARACTER',
          creatureTypeIds: [],
          canAct,
          speedAboveZero,
          freeHand: true,
          stowableHeldItemInstanceId: null,
          turnMovement: { usedFeet: 0, speedFeet: 30 }
        }
      }).length > 0
    expect(holds(true, true)).toBe(true)
    expect(holds(false, true)).toBe(false)
    expect(holds(true, false)).toBe(false)
  })
})
