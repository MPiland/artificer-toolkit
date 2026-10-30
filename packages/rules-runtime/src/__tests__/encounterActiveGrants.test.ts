import { describe, expect, it } from 'vitest'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { glibness } from '@artificer-toolkit/source-data/srd/spells/glibness.js'
import { bestowCurse } from '@artificer-toolkit/source-data/srd/spells/bestow-curse.js'
import {
  SRD_ABILITIES,
  SRD_ABILITY_DEFINITION_IDS,
  SRD_ACROBATICS_SKILL_ID,
  SRD_ATHLETICS_SKILL_ID,
  SRD_DAMAGE_TYPES,
  SRD_DARKVISION_SENSE_ID,
  SRD_SPEEDS,
  SRD_STEALTH_SKILL_ID,
  SRD_SYSTEM_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  abilityCheckMinimumRoll,
  activeAttackRollDice,
  activeSavingThrowDice,
  effectiveHitPointMaximum
} from '../character/activeEffectGrantTotals.js'
import { resolveCharacterRulePolicyRollModes } from '../character/characterRuleRollProjection.js'
import {
  creatureActiveGrantAttackContributors,
  creatureActiveGrantCheckContributors,
  encounterActiveGrantCapabilitySuppressions,
  encounterAttackAddedDice,
  encounterGrantsEnabledDomain,
  encounterSavingThrowAddedDice,
  encounterSourceSightSaveGrants,
  withActiveGrantSpeeds,
  withCreatureActiveGrantSaves,
  withCreatureActiveGrantSkillTotal,
  withHolderStateGrantSaves
} from '../encounterActiveGrants.js'
import { withCharacterActiveGrants } from '../character/characterRuleEvaluation.js'
import { planEncounterMaintenanceOwner } from '../encounterActionMaintenance.js'
import { rollModeSourceKey } from '../encounterRollModeReasons.js'
import { buildMovementTarget } from '../encounterMovementTargets.js'
import { checkAbilityCode } from '../encounterMovementPassagePreparation.js'
import { evaluateDnd5e2014CharacterPolicy } from '../systems/dnd5e/characterPolicy.js'
import { dnd5eAttackRollContributors } from '../systems/dnd5e/characterRollModes.js'
import { selectDnd5eTargetSavingThrow } from '../systems/dnd5e/effectActionCompiler.js'
import { DND5E_CHARACTER_WIDE_TARGET } from '../systems/dnd5e/modifierApplicability.js'
import { DND5E_ABILITY_DEFINITION_ID_BY_CODE, DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { ENCOUNTER_ID, creatureActor, creatureRuleFacts } from '../testing/dnd5eSrdEncounter.js'
import {
  aidEffect,
  antitoxinEffect,
  baneEffect,
  blessEffect,
  darkvisionEffect,
  disengageEffect,
  goldWeakeningEffect,
  helpEffect,
  heroismEffect,
  longstriderEffect,
  passWithoutTraceEffect,
  plannedGrantEffect,
  protectionFromEnergyEffect,
  shimmeringShieldEffect,
  speedFractionEffect,
  viciousMockeryEffect
} from './antitoxinEffectFixture.js'
import { withGrantModifiers } from '../testing/modifierGrantFixture.js'
import {
  evaluateSrdCharacter,
  srdFeature,
  srdRegistry,
  vocabulary
} from '../testing/dnd5eSrdCharacter.js'
import { FRIGHTENED_CONDITION_ID, POISONED_CONDITION_ID } from './encounterActiveEffectFixtures.js'

const srdSystem = systemAuthoredDtoSchema.parse(srdSystemRecord)
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
    expect(definition.stateContributions).toMatchObject([
      { kind: 'MODIFIER_GRANT', sourceLabel: 'Antitoxin (vial)', modifiers: expect.any(Array) }
    ])
  })
})

describe('rolled dice from active grants (D156)', () => {
  const bless = () => blessEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
  const bane = () => baneEffect({ id: OTHER_EFFECT_ID, holderActorId: HOLDER_ID })
  const blessDie = { label: 'Bless', count: 1, faces: 4, sign: 'ADD' }
  const baneDie = { label: 'Bane', count: 1, faces: 4, sign: 'SUBTRACT' }

  it('adds a d4 to every attack domain and every save under Bless, and nothing without it', () => {
    for (const attackDomain of ['MELEE', 'RANGED', 'SPELL', 'UNARMED'])
      expect(activeAttackRollDice([bless()], attackDomain, 'STRENGTH')).toEqual([blessDie])
    for (const ability of Object.keys(SRD_ABILITY_DEFINITION_IDS))
      expect(activeSavingThrowDice([bless()], ability)).toEqual([blessDie])
    // Bless covers every save, so an ability-less death save takes its die too.
    expect(activeSavingThrowDice([bless()], null)).toEqual([blessDie])
    expect(activeAttackRollDice([], 'MELEE', null)).toEqual([])
    expect(activeSavingThrowDice([], 'WISDOM')).toEqual([])
  })

  it('subtracts a d4 under Bane, and stacks it beside Bless in label order', () => {
    expect(activeSavingThrowDice([bless(), bane()], 'CHARISMA')).toEqual([baneDie, blessDie])
    expect(activeAttackRollDice([bane(), bless()], 'RANGED', 'DEXTERITY')).toEqual([
      baneDie,
      blessDie
    ])
  })

  it('gives one die for two effects of the same spell (two casters of Bless)', () => {
    const second = blessEffect({ id: THIRD_EFFECT_ID, holderActorId: HOLDER_ID })
    expect(activeAttackRollDice([bless(), second], 'MELEE', 'STRENGTH')).toEqual([blessDie])
  })

  it('names a hidden source "Unseen source"', () => {
    const hidden = bless()
    const definition = {
      ...hidden.definition,
      stateContributions: hidden.definition.stateContributions.map((contribution) =>
        contribution.kind === 'MODIFIER_GRANT'
          ? { ...contribution, sourceHidden: true }
          : contribution
      )
    }
    expect(activeSavingThrowDice([{ ...hidden, definition }], 'WISDOM')).toEqual([
      { ...blessDie, label: 'Unseen source' }
    ])
  })

  it('keys the Encounter facts by attack domain and by ability definition id', () => {
    expect(encounterAttackAddedDice([bane(), bless()], 'STRENGTH')).toEqual({
      MELEE: [baneDie, blessDie],
      RANGED: [baneDie, blessDie],
      SPELL: [baneDie, blessDie],
      UNARMED: [baneDie, blessDie]
    })
    expect(encounterSavingThrowAddedDice(DND5E_SYSTEM_ID, [bless()])).toEqual(
      Object.fromEntries(Object.values(SRD_ABILITY_DEFINITION_IDS).map((id) => [id, [blessDie]]))
    )
    expect(encounterAttackAddedDice([], null)).toEqual({})
    expect(encounterSavingThrowAddedDice(DND5E_SYSTEM_ID, [])).toEqual({})
  })

  it('ignores fixed bonuses and roll modes on the same domains', () => {
    expect(
      activeAttackRollDice(
        [viciousMockeryEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })],
        'MELEE',
        null
      )
    ).toEqual([])
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
          influence: 'ADVANTAGE',
          source: { kind: 'ACTIVE_EFFECT', id: EFFECT_ID, holderActorId: HOLDER_ID }
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

  it('adds a skill grant (Pass without Trace) to that skill total only, only while held', () => {
    const veil = passWithoutTraceEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
    expect(withCreatureActiveGrantSkillTotal(4, SRD_STEALTH_SKILL_ID, [veil])).toBe(14)
    expect(withCreatureActiveGrantSkillTotal(4, SRD_ATHLETICS_SKILL_ID, [veil])).toBe(4)
    expect(withCreatureActiveGrantSkillTotal(4, SRD_STEALTH_SKILL_ID, [])).toBe(4)
    // A stat block with no total for the skill gains none from the grant.
    expect(withCreatureActiveGrantSkillTotal(undefined, SRD_STEALTH_SKILL_ID, [veil])).toBe(
      undefined
    )
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

  it('halves every speed, rounded down, by a speed fraction grant (Slowing Breath)', () => {
    const speeds = [
      { speedId: WALK_SPEED_ID, amount: 35, unit: 'FEET' },
      { speedId: FLY_SPEED_ID, amount: 60, unit: 'FEET' }
    ]
    const halved = speedFractionEffect({
      id: EFFECT_ID,
      holderActorId: HOLDER_ID,
      fraction: { numerator: 1, denominator: 2 }
    })
    expect(withActiveGrantSpeeds(speeds, [halved])).toEqual([
      { speedId: WALK_SPEED_ID, amount: 17, unit: 'FEET' },
      { speedId: FLY_SPEED_ID, amount: 30, unit: 'FEET' }
    ])
  })

  it('scales only the speed a fraction grant names, after a bonus, with one rounding', () => {
    const speeds = [
      { speedId: WALK_SPEED_ID, amount: 30, unit: 'FEET' },
      { speedId: FLY_SPEED_ID, amount: 60, unit: 'FEET' }
    ]
    const thirdOfWalk = speedFractionEffect({
      id: OTHER_EFFECT_ID,
      holderActorId: HOLDER_ID,
      fraction: { numerator: 1, denominator: 3 },
      speedId: WALK_SPEED_ID
    })
    const halved = speedFractionEffect({
      id: THIRD_EFFECT_ID,
      holderActorId: HOLDER_ID,
      fraction: { numerator: 1, denominator: 2 }
    })
    // 30 + 10 (Longstrider) = 40, times 1/3 times 1/2 = 6.67, rounded down once.
    expect(withActiveGrantSpeeds(speeds, [longstrider(), thirdOfWalk, halved])).toEqual([
      { speedId: WALK_SPEED_ID, amount: 6, unit: 'FEET' },
      { speedId: FLY_SPEED_ID, amount: 30, unit: 'FEET' }
    ])
  })

  it('rolls Strength attacks, checks and saves at disadvantage under Weakening Breath only', () => {
    const weakened = goldWeakeningEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
    const disadvantage = [
      {
        sourceId: `ACTIVE_EFFECT:${EFFECT_ID}`,
        domainKey: `active-grant:${HOLDER_ID}`,
        influence: 'DISADVANTAGE'
      }
    ]
    for (const attackDomain of ['MELEE', 'RANGED', 'UNARMED']) {
      expect(
        creatureActiveGrantAttackContributors(HOLDER_ID, attackDomain, 'STRENGTH', [weakened])
      ).toMatchObject(disadvantage)
      expect(
        creatureActiveGrantAttackContributors(HOLDER_ID, attackDomain, 'DEXTERITY', [weakened])
      ).toEqual([])
      expect(
        creatureActiveGrantAttackContributors(HOLDER_ID, attackDomain, null, [weakened])
      ).toEqual([])
    }
    expect(creatureActiveGrantCheckContributors(HOLDER_ID, 'STRENGTH', [weakened])).toMatchObject(
      disadvantage
    )
    expect(creatureActiveGrantCheckContributors(HOLDER_ID, 'DEXTERITY', [weakened])).toEqual([])
    const saves = target([weakened]).targetDerivedFacts.savingThrowDefinitions
    const select = (abilityDefinitionId: string) =>
      selectDnd5eTargetSavingThrow({
        savingThrowDefinitions: saves,
        abilityDefinitionId,
        conditionIds: []
      })
    expect(select(SRD_ABILITY_DEFINITION_IDS.STRENGTH)).toMatchObject({
      rollMode: 'DISADVANTAGE',
      contributors: disadvantage
    })
    expect(select(WISDOM)).toMatchObject({ rollMode: 'NORMAL', contributors: [] })
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

  it('keeps the authored content a defense is limited to, and treats an empty list as unfiltered (REACTION-4.1)', () => {
    const withSources = (effect: ReturnType<typeof protectionFromEnergyEffect>, ids: string[]) => {
      return {
        ...effect,
        definition: {
          ...effect.definition,
          stateContributions: effect.definition.stateContributions.map((contribution) =>
            contribution.kind === 'MODIFIER_GRANT'
              ? {
                  ...contribution,
                  modifiers: contribution.modifiers.map((modifier) => {
                    const { payload } = modifier
                    if (payload === undefined || !('damageTypeId' in payload))
                      throw new Error('A defense grant names its damage type.')
                    return {
                      ...modifier,
                      payload: { damageTypeId: payload.damageTypeId, sourceEffectIds: ids }
                    }
                  })
                }
              : contribution
          )
        }
      }
    }
    const fire = protectionFromEnergyEffect({
      id: EFFECT_ID,
      holderActorId: HOLDER_ID,
      energyLabel: 'Fire'
    })
    expect(target([withSources(fire, ['spell:b', 'spell:a'])]).defenses).toEqual([
      {
        kind: 'RESISTANCE',
        damageTypeId: FIRE_DAMAGE_TYPE_ID,
        sourceEffectIds: ['spell:a', 'spell:b']
      }
    ])
    expect(target([withSources(fire, [])]).defenses).toEqual([
      { kind: 'RESISTANCE', damageTypeId: FIRE_DAMAGE_TYPE_ID }
    ])
  })

  it('rolls its own attacks of each mocked domain with disadvantage (Vicious Mockery)', () => {
    const mockery = viciousMockeryEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
    for (const attackDomain of ['MELEE', 'RANGED', 'SPELL', 'UNARMED']) {
      expect(
        creatureActiveGrantAttackContributors(HOLDER_ID, attackDomain, null, [mockery])
      ).toMatchObject([
        {
          sourceId: `ACTIVE_EFFECT:${EFFECT_ID}`,
          domainKey: `active-grant:${HOLDER_ID}`,
          influence: 'DISADVANTAGE',
          source: { kind: 'ACTIVE_EFFECT', id: EFFECT_ID, holderActorId: HOLDER_ID }
        }
      ])
    }
    expect(creatureActiveGrantAttackContributors(HOLDER_ID, 'MELEE', null, [antitoxin()])).toEqual(
      []
    )
  })

  it('rolls its ability checks with the advantage of a Help, and only an ability check', () => {
    const help = helpEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
    const contributor = {
      sourceId: `ACTIVE_EFFECT:${EFFECT_ID}`,
      domainKey: `active-grant:${HOLDER_ID}`,
      influence: 'ADVANTAGE',
      source: { kind: 'ACTIVE_EFFECT', id: EFFECT_ID, holderActorId: HOLDER_ID }
    }
    // An ability-less check grant applies to a skill check (null) and to any ability's check.
    expect(creatureActiveGrantCheckContributors(HOLDER_ID, null, [help])).toMatchObject([
      contributor
    ])
    expect(creatureActiveGrantCheckContributors(HOLDER_ID, 'STRENGTH', [help])).toMatchObject([
      contributor
    ])
    // A save grant (Antitoxin) and no grant at all leave the check alone.
    expect(creatureActiveGrantCheckContributors(HOLDER_ID, null, [antitoxin()])).toEqual([])
    expect(creatureActiveGrantCheckContributors(HOLDER_ID, null, [])).toEqual([])
    // The attack reader reads the Help's attack modifier, never its check modifier.
    expect(creatureActiveGrantAttackContributors(HOLDER_ID, 'MELEE', null, [help])).toHaveLength(1)
  })

  it('applies a Strength check grant to its Athletics skill check, and to no other skill', () => {
    const help = helpEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
    const strengthHelp = {
      ...help,
      definition: {
        ...help.definition,
        stateContributions: help.definition.stateContributions.map((contribution) =>
          contribution.kind === 'MODIFIER_GRANT'
            ? {
                ...contribution,
                modifiers: contribution.modifiers.map((modifier) =>
                  modifier.valueDomainCode === 'ABILITY_CHECK'
                    ? { ...modifier, domain: { ability: 'STRENGTH' as const } }
                    : modifier
                )
              }
            : contribution
        )
      }
    }
    const check = (skillId: string) =>
      creatureActiveGrantCheckContributors(
        HOLDER_ID,
        checkAbilityCode(srdSystem, 'SKILL', skillId),
        [strengthHelp]
      )
    expect(check(SRD_ATHLETICS_SKILL_ID)).toMatchObject([{ influence: 'ADVANTAGE' }])
    expect(check(SRD_ACROBATICS_SKILL_ID)).toEqual([])
    expect(checkAbilityCode(srdSystem, 'ABILITY', SRD_ABILITY_DEFINITION_IDS.STRENGTH)).toBe(
      'STRENGTH'
    )
  })
})

describe('opportunity attack immunity from active grants', () => {
  it('holds while the holder carries the real Disengage grant, and only then', () => {
    const disengage = disengageEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
    expect(encounterGrantsEnabledDomain([disengage], 'OPPORTUNITY_ATTACK_IMMUNITY')).toBe(true)
    expect(encounterGrantsEnabledDomain([], 'OPPORTUNITY_ATTACK_IMMUNITY')).toBe(false)
    expect(encounterGrantsEnabledDomain([antitoxin(), aid()], 'OPPORTUNITY_ATTACK_IMMUNITY')).toBe(
      false
    )
    expect(encounterGrantsEnabledDomain([disengage], 'SPELLCASTING_LOCK')).toBe(false)
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
        contributors: [{ source: { kind: 'ACTIVE_EFFECT', id: EFFECT_ID } }]
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

  it('folds a Help into a Character ability checks, skill checks and attack rolls', () => {
    const policy = resolveCharacterRulePolicyRollModes(
      evaluateDnd5e2014CharacterPolicy(
        withCharacterActiveGrants(fighter.facts, [
          helpEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
        ])
      ),
      vocabulary
    )
    expect(policy.rollModes.abilityChecks.STRENGTH).toBe('ADVANTAGE')
    expect(policy.rollModes.skillChecks.athletics).toBe('ADVANTAGE')
    expect(policy.rollContributorEvidence.skillChecks.athletics).toMatchObject([
      {
        sourceId: `ACTIVE_EFFECT:${EFFECT_ID}`,
        influence: 'ADVANTAGE',
        source: { kind: 'ACTIVE_EFFECT', id: EFFECT_ID, holderActorId: null }
      }
    ])
    expect(policy.rollModes.attacks.MELEE).toBe('ADVANTAGE')
  })

  it('names one active effect by one source id and one reason key for a Creature and a Character holder', () => {
    const help = helpEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
    const [creatureContributor] = creatureActiveGrantCheckContributors(HOLDER_ID, 'STRENGTH', [
      help
    ])
    const policy = resolveCharacterRulePolicyRollModes(
      evaluateDnd5e2014CharacterPolicy(withCharacterActiveGrants(fighter.facts, [help])),
      vocabulary
    )
    const [characterContributor] = policy.rollContributorEvidence.skillChecks.athletics!
    expect(characterContributor!.sourceId).toBe(creatureContributor!.sourceId)
    expect(rollModeSourceKey(characterContributor!.source)).toBe(
      rollModeSourceKey(creatureContributor!.source)
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

  it('leaves its attacks normal under Bestow Curse, whose disadvantage waits for its caster as the target', () => {
    const curse = plannedGrantEffect({
      id: EFFECT_ID,
      holderActorId: HOLDER_ID,
      effect: bestowCurse.effects?.[0],
      sourceLabel: bestowCurse.label,
      choiceLabel: 'Attacks Against You',
      sourceActorId: OTHER_EFFECT_ID
    })
    const policy = evaluateDnd5e2014CharacterPolicy(
      withCharacterActiveGrants(fighter.facts, [curse])
    )
    expect(policy.rollModes.attacks).toEqual({
      MELEE: 'NORMAL',
      RANGED: 'NORMAL',
      SPELL: 'NORMAL',
      UNARMED: 'NORMAL'
    })
    expect(creatureActiveGrantAttackContributors(HOLDER_ID, 'MELEE', null, [curse])).toEqual([])
  })

  it('rolls Strength attacks, checks and saves at disadvantage under Weakening Breath only', () => {
    const policy = evaluateDnd5e2014CharacterPolicy(
      withCharacterActiveGrants(fighter.facts, [
        goldWeakeningEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
      ])
    )
    expect(policy.rollModes.abilityChecks.STRENGTH).toBe('DISADVANTAGE')
    expect(policy.rollModes.abilityChecks.DEXTERITY).toBe('NORMAL')
    expect(policy.rollModes.savingThrows.STRENGTH).toBe('DISADVANTAGE')
    expect(policy.rollModes.savingThrows.DEXTERITY).toBe('NORMAL')
    // No attack in particular is evaluated Character-wide, so a Strength-only grant waits for one.
    expect(policy.rollModes.attacks).toEqual({
      MELEE: 'NORMAL',
      RANGED: 'NORMAL',
      SPELL: 'NORMAL',
      UNARMED: 'NORMAL'
    })
    const attackWith = (attackKind: 'MELEE' | 'RANGED' | 'SPELL' | 'UNARMED', ability: string) =>
      dnd5eAttackRollContributors(policy, attackKind, {
        ...DND5E_CHARACTER_WIDE_TARGET,
        attackAbility: ability
      }).map((contributor) => contributor.influence)
    for (const attackKind of ['MELEE', 'RANGED', 'UNARMED'] as const) {
      expect(attackWith(attackKind, 'STRENGTH')).toEqual(['DISADVANTAGE'])
      expect(attackWith(attackKind, 'DEXTERITY')).toEqual([])
    }
    expect(attackWith('SPELL', 'STRENGTH')).toEqual([])
  })

  it('walks at the fraction of a speed grant (Slowing Breath) once the bonuses are added', () => {
    const walk = (effects: Parameters<typeof withCharacterActiveGrants>[1]) =>
      evaluateDnd5e2014CharacterPolicy(
        withCharacterActiveGrants(fighter.facts, effects)
      ).movement.speeds.find(({ speedId }) => speedId === WALK_SPEED_ID)?.amount ?? 0
    const base = walk([])
    const halved = speedFractionEffect({
      id: OTHER_EFFECT_ID,
      holderActorId: HOLDER_ID,
      fraction: { numerator: 1, denominator: 2 }
    })
    expect(walk([halved])).toBe(Math.floor(base / 2))
    expect(walk([longstrider(), halved])).toBe(Math.floor((base + 10) / 2))
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

describe('a held d20 floor on ability checks', () => {
  const { CHARISMA, WISDOM: WISDOM_CODE } = { CHARISMA: 'CHARISMA', WISDOM: 'WISDOM' }
  /** Glibness's real effect, its floor raised to `amount` when given. */
  const glibnessHeld = (id: string, amount = 15) =>
    plannedGrantEffect({
      id,
      holderActorId: HOLDER_ID,
      effect: withGrantModifiers(glibness.effects?.[0], { payload: { amount } }),
      sourceLabel: glibness.label
    })

  const floorOf = (
    effects: Parameters<typeof abilityCheckMinimumRoll>[0]['effects'],
    abilityCode: string | null,
    character: Parameters<typeof abilityCheckMinimumRoll>[0]['character'] = null,
    proficient = false
  ) => abilityCheckMinimumRoll({ effects, character, abilityCode, proficient })

  it('floors only the checks of the ability the grant names', () => {
    const held = [glibnessHeld(EFFECT_ID)]
    expect(floorOf(held, CHARISMA)).toEqual({ amount: 15, label: 'Glibness', sourceId: EFFECT_ID })
    expect(floorOf(held, WISDOM_CODE)).toBeNull()
    expect(floorOf(held, null)).toBeNull()
  })

  it('is null when nothing floors the roll, and ignores a rolled-die grant', () => {
    expect(floorOf([], CHARISMA)).toBeNull()
    expect(floorOf([blessEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })], CHARISMA)).toBeNull()
  })

  it('reduces several floors to the highest', () => {
    const held = [glibnessHeld(EFFECT_ID), glibnessHeld(OTHER_EFFECT_ID, 17)]
    expect(floorOf(held, CHARISMA)).toMatchObject({ amount: 17, sourceId: OTHER_EFFECT_ID })
  })

  it('breaks a tie by the lowest effect id', () => {
    const lowest = glibnessHeld(THIRD_EFFECT_ID)
    const tied = glibnessHeld(EFFECT_ID)
    expect(floorOf([lowest, tied], CHARISMA)?.sourceId).toBe(EFFECT_ID)
    expect(floorOf([tied, lowest], CHARISMA)?.sourceId).toBe(EFFECT_ID)
  })

  describe("a Character feature's floor (Reliable Talent, SPELLS-31.T5c)", () => {
    const reliableTalent = srdFeature({
      owner: 'CLASS',
      classLabel: 'Rogue',
      featureLabel: 'Reliable Talent',
      level: 11
    })
    const rogue = evaluateSrdCharacter({
      classes: [{ label: 'Rogue', level: 11 }],
      features: [reliableTalent]
    })
    const character = { grantFold: rogue.output.grantFold, registry: srdRegistry }
    const folded = rogue.output.grantFold.modifiers.find(
      (modifier) => modifier.modifierKind === 'MINIMUM_ROLL'
    )

    it('floors a check that adds proficiency at 10, under the feature label', () => {
      expect(folded?.source).toMatchObject({ definitionId: reliableTalent.featureId })
      expect(floorOf([], CHARISMA, character, true)).toEqual({
        amount: 10,
        label: 'Reliable Talent',
        sourceId: folded?.sourceId
      })
      expect(floorOf([], null, character, true)).toMatchObject({ amount: 10 })
    })

    it('leaves a check without proficiency, or a Creature, unfloored', () => {
      expect(floorOf([], CHARISMA, character, false)).toBeNull()
      expect(floorOf([], CHARISMA, null, true)).toBeNull()
    })

    it('yields to a higher held floor and outranks a lower one', () => {
      expect(floorOf([glibnessHeld(EFFECT_ID)], CHARISMA, character, true)).toMatchObject({
        amount: 15,
        sourceId: EFFECT_ID
      })
      expect(floorOf([glibnessHeld(EFFECT_ID, 8)], CHARISMA, character, true)).toMatchObject({
        amount: 10,
        label: 'Reliable Talent'
      })
    })
  })
})

describe('active grants on a System that does not install their policy', () => {
  const unknownSystemId = '00000000-0000-4000-8000-0000000000ff'

  it('fails closed instead of reading another System allowances, abilities or save scope', () => {
    expect(() => encounterActiveGrantCapabilitySuppressions(unknownSystemId, [])).toThrow(
      'The Game System does not provide action-economy policy.'
    )
    expect(() => withCreatureActiveGrantSaves(unknownSystemId, [], 'holder', [], [])).toThrow(
      'The Game System does not provide ability-score policy.'
    )
    expect(() =>
      withHolderStateGrantSaves(unknownSystemId, [], 'holder', [], {
        kind: 'CREATURE',
        creatureTypeIds: [],
        canAct: true,
        speedAboveZero: true,
        freeHand: true,
        turnMovement: { usedFeet: 0, speedFeet: 0 },
        activeAuthoredEffectIds: [],
        stowableHeldItemInstanceId: null
      })
    ).toThrow('The Game System does not provide ability-score policy.')
    expect(() =>
      encounterSourceSightSaveGrants({
        gameSystemId: unknownSystemId,
        holderActorId: 'holder',
        effects: [],
        grantFold: null
      })
    ).toThrow('The Game System does not provide ability-score policy.')
  })
})
