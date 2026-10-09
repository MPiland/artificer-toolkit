import { describe, expect, it } from 'vitest'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import {
  SRD_ABILITIES,
  SRD_ABILITY_DEFINITION_IDS,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { resolveCharacterRulePolicyRollModes } from '../character/characterRuleRollProjection.js'
import { withCharacterActiveGrants } from '../encounterActiveGrants.js'
import { buildMovementTarget } from '../encounterMovementTargets.js'
import { evaluateDnd5e2014CharacterPolicy } from '../systems/dnd5e/characterPolicy.js'
import { selectDnd5eTargetSavingThrow } from '../systems/dnd5e/effectActionCompiler.js'
import { DND5E_ABILITY_DEFINITION_ID_BY_CODE } from '../systems/dnd5e/identity.js'
import { creatureActor, creatureRuleFacts } from '../testing/dnd5eSrdEncounter.js'
import { antitoxinEffect, shimmeringShieldEffect } from './antitoxinEffectFixture.js'
import { evaluateSrdCharacter, vocabulary } from './dnd5eSrdCharacter.js'
import { FRIGHTENED_CONDITION_ID, POISONED_CONDITION_ID } from './encounterActiveEffectFixtures.js'

const { CONSTITUTION, WISDOM } = SRD_ABILITY_DEFINITION_IDS
const HOLDER_ID = '00000000-0000-4000-8000-00000000c201'
const CAMPAIGN_ID = '00000000-0000-4000-8000-00000000c202'
const EFFECT_ID = '00000000-0000-4000-8000-00000000c203'

const antitoxin = () => antitoxinEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })

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
  const holder = creatureActor({
    id: HOLDER_ID,
    currentHitPoints: 7,
    maxHitPoints: 11,
    tempHitPoints: 0,
    conditions: [],
    snapshot: {
      payload: {
        size: 'MEDIUM',
        armorClass: 12,
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

  it('leaves the saves untouched without a grant', () => {
    expect(target([]).targetDerivedFacts.savingThrowDefinitions).toHaveLength(6)
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

  it('returns the same facts when the holder carries no grant', () => {
    expect(withCharacterActiveGrants(fighter.facts, [])).toBe(fighter.facts)
    expect(constitutionSaves(fighter.facts).some((save) => 'conditionTypeId' in save)).toBe(false)
  })
})
