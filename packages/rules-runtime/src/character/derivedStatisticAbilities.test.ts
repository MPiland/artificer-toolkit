import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'
import { SRD_ABILITIES, SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { abilityScoreCapabilityRegistry } from '../platformPolicyModules.js'
import { srdRegistry } from '../testing/dnd5eSrdCharacter.js'
import { buildCharacterArmorClassRuleFacts } from './characterArmorClassRuleFacts.js'
import { buildCharacterDerivedRuleFacts } from './characterDerivedRuleFacts.js'
import { buildCharacterHitPointRuleFacts } from './characterHitPointRuleFacts.js'

/** A second installed System whose derived statistics add other abilities than D&D's. */
const STRICT_SYSTEM_ID = '00000000-0000-4000-8000-0000000000e5'
const requireInstalled = abilityScoreCapabilityRegistry.require.bind(abilityScoreCapabilityRegistry)

function installStrictSystem() {
  const dnd5e = requireInstalled(SRD_SYSTEM_ID)
  vi.spyOn(abilityScoreCapabilityRegistry, 'require').mockImplementation((gameSystemId) =>
    gameSystemId === STRICT_SYSTEM_ID
      ? {
          ...dnd5e,
          gameSystemId: STRICT_SYSTEM_ID,
          derivedStatisticAbilityCodes: {
            armorClass: 'WISDOM',
            initiative: 'INTELLIGENCE',
            hitPoints: 'STRENGTH'
          }
        }
      : requireInstalled(gameSystemId)
  )
}

function snapshot(systemId: string): CharacterBuildSnapshot {
  return {
    characterId: 'derived-statistics',
    systemId,
    totalLevel: 1,
    classes: [],
    abilities: Object.fromEntries(SRD_ABILITIES.map(({ code }) => [code, 10])),
    hitpoints: [],
    features: [],
    equipmentItems: []
  }
}

function derivedAbilities(systemId: string) {
  const character = snapshot(systemId)
  const abilityIds = Object.keys(character.abilities)
  const { armorClassFacts } = buildCharacterArmorClassRuleFacts(character)
  const { initiative } = buildCharacterDerivedRuleFacts(character, srdRegistry)
  const { hitPointFacts } = buildCharacterHitPointRuleFacts(character)
  return {
    armorClass: abilityIds[armorClassFacts!.dexterityAbilityIndex!],
    initiative: initiative.abilityId,
    initiativeIndex: initiative.abilityIndex,
    hitPoints: hitPointFacts!.constitutionAbilityId,
    hitPointsIndex: hitPointFacts!.constitutionAbilityIndex,
    indexOf: (code: string) => abilityIds.indexOf(code)
  }
}

describe('derived statistic abilities come from the System (RULES-2.T9e)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads armor class, initiative and hit point abilities from D&D', () => {
    const derived = derivedAbilities(SRD_SYSTEM_ID)

    expect(derived.armorClass).toBe('DEXTERITY')
    expect(derived.initiative).toBe('DEXTERITY')
    expect(derived.initiativeIndex).toBe(derived.indexOf('DEXTERITY'))
    expect(derived.hitPoints).toBe('CONSTITUTION')
    expect(derived.hitPointsIndex).toBe(derived.indexOf('CONSTITUTION'))
  })

  it("names only the System's own abilities", () => {
    const { abilityDefinitionIdByCode, derivedStatisticAbilityCodes } =
      abilityScoreCapabilityRegistry.require(SRD_SYSTEM_ID)

    for (const code of Object.values(derivedStatisticAbilityCodes))
      expect(abilityDefinitionIdByCode).toHaveProperty(code)
  })

  it('finds no index for an ability the Character lacks, and keeps the code as its hit point key', () => {
    const character = { ...snapshot(SRD_SYSTEM_ID), abilities: { STR: 10, WIS: 12 } }

    expect(
      buildCharacterArmorClassRuleFacts(character).armorClassFacts!.dexterityAbilityIndex
    ).toBe(null)
    expect(buildCharacterHitPointRuleFacts(character).hitPointFacts).toMatchObject({
      constitutionAbilityId: 'CONSTITUTION',
      constitutionAbilityIndex: null
    })
  })

  it('matches a short ability key to the code the System names', () => {
    const character = { ...snapshot(SRD_SYSTEM_ID), abilities: { STR: 10, DEX: 14, CON: 12 } }

    expect(
      buildCharacterArmorClassRuleFacts(character).armorClassFacts!.dexterityAbilityIndex
    ).toBe(1)
    expect(buildCharacterHitPointRuleFacts(character).hitPointFacts).toMatchObject({
      constitutionAbilityId: 'CON',
      constitutionAbilityIndex: 2
    })
  })

  it("reads another System's abilities instead of D&D's", () => {
    installStrictSystem()
    const derived = derivedAbilities(STRICT_SYSTEM_ID)

    expect(derived.armorClass).toBe('WISDOM')
    expect(derived.initiative).toBe('INTELLIGENCE')
    expect(derived.initiativeIndex).toBe(derived.indexOf('INTELLIGENCE'))
    expect(derived.hitPoints).toBe('STRENGTH')
    expect(derived.hitPointsIndex).toBe(derived.indexOf('STRENGTH'))
  })
})
