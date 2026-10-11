import { describe, expect, it } from 'vitest'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import {
  SRD_ABILITIES,
  SRD_ABILITY_DEFINITION_IDS,
  SRD_DAMAGE_TYPES,
  SRD_DARKVISION_SENSE_ID,
  SRD_SPEEDS,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { resolveCharacterRulePolicyRollModes } from '../character/characterRuleRollProjection.js'
import {
  creatureActiveGrantAttackContributors,
  effectiveHitPointMaximum,
  withActiveGrantSpeeds,
  withCharacterActiveGrants
} from '../encounterActiveGrants.js'
import { planEncounterMaintenanceOwner } from '../encounterActionMaintenance.js'
import { buildMovementTarget } from '../encounterMovementTargets.js'
import { evaluateDnd5e2014CharacterPolicy } from '../systems/dnd5e/characterPolicy.js'
import { selectDnd5eTargetSavingThrow } from '../systems/dnd5e/effectActionCompiler.js'
import { DND5E_ABILITY_DEFINITION_ID_BY_CODE } from '../systems/dnd5e/identity.js'
import { ENCOUNTER_ID, creatureActor, creatureRuleFacts } from '../testing/dnd5eSrdEncounter.js'
import {
  aidEffect,
  antitoxinEffect,
  darkvisionEffect,
  heroismEffect,
  longstriderEffect,
  protectionFromEnergyEffect,
  shimmeringShieldEffect,
  viciousMockeryEffect
} from './antitoxinEffectFixture.js'
import { evaluateSrdCharacter, vocabulary } from './dnd5eSrdCharacter.js'
import { FRIGHTENED_CONDITION_ID, POISONED_CONDITION_ID } from './encounterActiveEffectFixtures.js'

const { CONSTITUTION, WISDOM } = SRD_ABILITY_DEFINITION_IDS
const HOLDER_ID = '00000000-0000-4000-8000-00000000c201'
const CAMPAIGN_ID = '00000000-0000-4000-8000-00000000c202'
const EFFECT_ID = '00000000-0000-4000-8000-00000000c203'

const OTHER_EFFECT_ID = '00000000-0000-4000-8000-00000000c204'
const THIRD_EFFECT_ID = '00000000-0000-4000-8000-00000000c205'
const FIRE_DAMAGE_TYPE_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'FIRE')?.id

const antitoxin = () => antitoxinEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
const aid = () => aidEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
const longstrider = () => longstriderEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
const WALK_SPEED_ID = SRD_SPEEDS.find(({ code }) => code === 'WALK')?.id
const FLY_SPEED_ID = SRD_SPEEDS.find(({ code }) => code === 'FLY')?.id

describe('the Antitoxin active effect', () => {
  it('is a valid persisted definition carrying six poison-scoped save advantages', () => {
    const { definition } = antitoxin()
    expect(activeRuleEffectDefinitionDtoSchema.parse(definition)).toEqual(definition)
    expect(definition.schemaVersion === 2 && definition.stateContributions).toMatchObject([
      { kind: 'MODIFIER_GRANT', sourceLabel: 'Antitoxin (vial)', modifiers: expect.any(Array) }
    ])
  })
})

describe('the ability code to definition id map', () => {
  it('matches the SRD ability definitions', () => {
    expect(DND5E_ABILITY_DEFINITION_ID_BY_CODE).toEqual(
      Object.fromEntries(SRD_ABILITIES.map(({ code, id }) => [code, id]))
    )
  })
})

describe('Creature holder of an active grant', () => {
  const scores = {
    STRENGTH: 11,
    DEXTERITY: 12,
    CONSTITUTION: 12,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 10
  }
  const holderAt = (currentHitPoints: number) =>
    creatureActor({
      id: HOLDER_ID,
      currentHitPoints,
      maxHitPoints: 11,
      tempHitPoints: 0,
      conditions: [],
      snapshot: {
        payload: {
          size: 'MEDIUM',
          naturalArmorBonus: 1,
          abilityScores: scores,
          speeds: [],
          senses: [],
          damageVulnerabilities: [],
          damageResistances: [],
          damageImmunities: [],
          conditionImmunities: []
        },
        ruleFacts: creatureRuleFacts(scores)
      }
    })
  const holder = holderAt(7)
  const target = (activeEffects: ReturnType<typeof antitoxin>[]) =>
    buildMovementTarget({
      actor: holder,
      activeEffects,
      gameSystemId: SRD_SYSTEM_ID,
      campaignId: CAMPAIGN_ID,
      characterFacts: null
    })

  it('adds a poison-scoped advantage save beside the plain one for every ability', () => {
    const { savingThrowDefinitions } = target([antitoxin()]).targetDerivedFacts
    expect(savingThrowDefinitions).toHaveLength(12)
    const select = (conditionIds: readonly string[]) =>
      selectDnd5eTargetSavingThrow({
        savingThrowDefinitions,
        abilityDefinitionId: CONSTITUTION,
        conditionIds
      })
    expect(select([POISONED_CONDITION_ID])).toMatchObject({
      modifier: 1,
      rollMode: 'ADVANTAGE',
      contributors: [
        {
          sourceId: `ACTIVE_EFFECT:${EFFECT_ID}`,
          domainKey: `active-grant:${HOLDER_ID}`,
          influence: 'ADVANTAGE'
        }
      ]
    })
    expect(select([FRIGHTENED_CONDITION_ID])).toMatchObject({
      rollMode: 'NORMAL',
      contributors: []
    })
    expect(select([])).toMatchObject({ rollMode: 'NORMAL', contributors: [] })
  })

  it('raises the armor class by an ARMOR_CLASS grant (Shimmering Shield), only while held', () => {
    const shield = shimmeringShieldEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
    const armorClass = (effects: ReturnType<typeof antitoxin>[]) =>
      (target(effects).targetDerivedFacts.statBlock as { armorClass?: number }).armorClass
    expect(armorClass([shield])).toBe(14)
    expect(armorClass([])).toBe(12)
  })

  it('raises its maximum hit points by a maximum hit point grant (Aid), only while held', () => {
    expect(target([aid()]).effectiveMaximumHitPoints).toBe(16)
    expect(target([]).effectiveMaximumHitPoints).toBe(11)
  })

  it('moves farther by a speed grant (Longstrider) on every speed it has, only while held', () => {
    const speeds = [
      { speedId: WALK_SPEED_ID, amount: 30, unit: 'FEET' },
      { speedId: FLY_SPEED_ID, amount: 60, unit: 'FEET' }
    ]
    expect(withActiveGrantSpeeds(speeds, [longstrider()])).toEqual([
      { speedId: WALK_SPEED_ID, amount: 40, unit: 'FEET' },
      { speedId: FLY_SPEED_ID, amount: 60, unit: 'FEET' }
    ])
    expect(withActiveGrantSpeeds(speeds, [])).toEqual(speeds)
  })

  it('falls to its maximum when the maximum hit point grant ends', () => {
    const planned = planEncounterMaintenanceOwner({
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: HOLDER_ID },
      removed: [aid()],
      remaining: [],
      actors: [holderAt(15)],
      character: null
    })
    expect(planned.actors).toMatchObject([
      { before: { currentHitPoints: 15 }, after: { currentHitPoints: 11 } }
    ])
  })

  it('keeps hit points at or below the maximum when the grant ends', () => {
    const planned = planEncounterMaintenanceOwner({
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: HOLDER_ID },
      removed: [aid()],
      remaining: [],
      actors: [holder],
      character: null
    })
    expect(planned.actors).toMatchObject([{ after: { currentHitPoints: 7 } }])
  })

  it('leaves the saves untouched without a grant', () => {
    expect(target([]).targetDerivedFacts.savingThrowDefinitions).toHaveLength(6)
  })

  it('gains resistance (Protection from Energy) and an immunity (Heroism), only while held', () => {
    const fire = protectionFromEnergyEffect({
      id: EFFECT_ID,
      holderActorId: HOLDER_ID,
      energyLabel: 'Fire'
    })
    const brave = heroismEffect({ id: OTHER_EFFECT_ID, holderActorId: HOLDER_ID })
    const held = target([fire, brave])
    expect(held.defenses).toEqual([{ kind: 'RESISTANCE', damageTypeId: FIRE_DAMAGE_TYPE_ID }])
    expect(held.conditionImmunityIds).toEqual([FRIGHTENED_CONDITION_ID])
    expect(held.targetDerivedFacts.targetProtection).toMatchObject({
      defenses: [{ kind: 'RESISTANCE', damageTypeId: FIRE_DAMAGE_TYPE_ID }],
      conditionImmunityIds: [FRIGHTENED_CONDITION_ID]
    })
    expect(target([])).toMatchObject({ defenses: [], conditionImmunityIds: [] })
  })

  it('rolls its own attacks of each mocked domain with disadvantage (Vicious Mockery)', () => {
    const mockery = viciousMockeryEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
    for (const attackDomain of ['MELEE', 'RANGED', 'SPELL', 'UNARMED']) {
      expect(
        creatureActiveGrantAttackContributors(HOLDER_ID, attackDomain, [mockery])
      ).toMatchObject([
        {
          sourceId: `ACTIVE_EFFECT:${EFFECT_ID}`,
          domainKey: `active-grant:${HOLDER_ID}`,
          influence: 'DISADVANTAGE'
        }
      ])
    }
    expect(creatureActiveGrantAttackContributors(HOLDER_ID, 'MELEE', [antitoxin()])).toEqual([])
  })
})

describe('Character holder of an active grant', () => {
  const fighter = evaluateSrdCharacter({
    race: 'Human',
    abilities: { CONSTITUTION: 14 },
    classes: [{ label: 'Fighter', level: 1 }]
  })
  const constitutionSaves = (facts: typeof fighter.facts) =>
    resolveCharacterRulePolicyRollModes(
      evaluateDnd5e2014CharacterPolicy(facts),
      vocabulary
    ).savingThrowDefinitions.filter((save) => save.abilityDefinitionId === CONSTITUTION)

  it('folds the grant into a poison-scoped advantage save only', () => {
    const saves = constitutionSaves(withCharacterActiveGrants(fighter.facts, [antitoxin()]))
    const scoped = saves.filter((save) => 'conditionTypeId' in save)
    expect(scoped).toMatchObject([
      {
        conditionTypeId: POISONED_CONDITION_ID,
        rollMode: 'ADVANTAGE',
        contributors: [{ source: { kind: 'ACTIVE_EFFECT', activeEffectId: EFFECT_ID } }]
      }
    ])
    expect(saves.filter((save) => !('conditionTypeId' in save))).toMatchObject([
      { rollMode: 'NORMAL', contributors: [] }
    ])
    expect(saves.some((save) => save.abilityDefinitionId === WISDOM)).toBe(false)
  })

  it('raises the effective armor class by an ARMOR_CLASS grant', () => {
    const armorClass = (facts: typeof fighter.facts) =>
      evaluateDnd5e2014CharacterPolicy(facts).derivedStats.armorClass.effective
    const shield = shimmeringShieldEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
    expect(armorClass(withCharacterActiveGrants(fighter.facts, [shield]))).toBe(
      armorClass(fighter.facts) + 2
    )
  })

  it('folds resistance, an immunity and attack disadvantage into its policy', () => {
    const policy = evaluateDnd5e2014CharacterPolicy(
      withCharacterActiveGrants(fighter.facts, [
        protectionFromEnergyEffect({
          id: EFFECT_ID,
          holderActorId: HOLDER_ID,
          energyLabel: 'Fire'
        }),
        heroismEffect({ id: OTHER_EFFECT_ID, holderActorId: HOLDER_ID }),
        viciousMockeryEffect({ id: THIRD_EFFECT_ID, holderActorId: HOLDER_ID })
      ])
    )
    expect(policy.defenses).toContainEqual(
      expect.objectContaining({ kind: 'RESISTANCE', damageTypeId: FIRE_DAMAGE_TYPE_ID })
    )
    expect(policy.conditionImmunityIds).toContain(FRIGHTENED_CONDITION_ID)
    expect(policy.rollModes.attacks).toEqual({
      MELEE: 'DISADVANTAGE',
      RANGED: 'DISADVANTAGE',
      SPELL: 'DISADVANTAGE',
      UNARMED: 'DISADVANTAGE'
    })
  })

  it('raises its maximum hit points by Aid and clamps current hit points when it ends', () => {
    expect(effectiveHitPointMaximum(12, [aid()])).toBe(17)
    const hitpoints = { current: 17, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES }
    const planned = planEncounterMaintenanceOwner({
      owner: { kind: 'CHARACTER', characterId: HOLDER_ID },
      removed: [aid()],
      remaining: [],
      actors: [],
      character: {
        currentStreamVersion: 3,
        beforeStreamVersion: 3,
        state: { conditions: [], hitpoints },
        maximumHitPoints: 12
      }
    })
    expect(planned.character).toMatchObject({
      hitpoints: { current: 12 },
      changed: true,
      streamVersion: 4
    })
  })

  it('walks farther by Longstrider through its policy', () => {
    const walk = (facts: typeof fighter.facts) =>
      evaluateDnd5e2014CharacterPolicy(facts).movement.speeds.find(
        ({ speedId }) => speedId === WALK_SPEED_ID
      )?.amount
    expect(walk(withCharacterActiveGrants(fighter.facts, [longstrider()]))).toBe(
      (walk(fighter.facts) ?? 0) + 10
    )
  })

  it('sees in the dark out to 60 feet while it holds the Darkvision spell', () => {
    const darkvisionRanges = (facts: typeof fighter.facts) =>
      evaluateDnd5e2014CharacterPolicy(facts)
        .senses.filter((sense) => sense.senseDefinitionId === SRD_DARKVISION_SENSE_ID)
        .map((sense) => sense.range)
    expect(darkvisionRanges(fighter.facts)).toEqual([])
    expect(
      darkvisionRanges(
        withCharacterActiveGrants(fighter.facts, [
          darkvisionEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
        ])
      )
    ).toMatchObject([{ amount: 60, unit: 'FEET' }])
  })

  it('returns the same facts when the holder carries no grant', () => {
    expect(withCharacterActiveGrants(fighter.facts, [])).toBe(fighter.facts)
    expect(constitutionSaves(fighter.facts).some((save) => 'conditionTypeId' in save)).toBe(false)
  })
})
