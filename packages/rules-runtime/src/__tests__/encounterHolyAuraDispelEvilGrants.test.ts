import { describe, expect, it } from 'vitest'
import { ATTACK_DOMAIN_CODE } from '@artificer-toolkit/shared'
import { SRD_SPEEDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { creatureTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'

import { sourceQualifierAdmits } from '../encounterActiveGrants.js'
import { withEncounterHolderDefense } from '../encounterHolderDefense.js'
import { buildMovementTarget } from '../encounterMovementTargets.js'
import {
  CAMPAIGN_ID,
  SRD_SYSTEM_ID,
  srdCreatureActor,
  srdDefinitions,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { dispelEvilAndGoodEffect, holyAuraEffect } from './antitoxinEffectFixture.js'

/**
 * SPELLS-4.T2j2a: Holy Aura and Dispel Evil and Good as authored attack-disadvantage grants (and
 * Holy Aura's save advantage), decided by the same source qualifier as Protection from Evil and Good.
 */

const HOLDER_ID = testUuid(0xd6b1)
const EFFECT_ID = testUuid(0xd6b2)
const ogre = srdByLabel(SRD.creatures, 'Ogre')
const ATTACK_DOMAINS = Object.values(ATTACK_DOMAIN_CODE)

const defended = (effect: ReturnType<typeof holyAuraEffect>) =>
  withEncounterHolderDefense({
    target: buildMovementTarget({
      actor: srdCreatureActor({ id: HOLDER_ID, creature: ogre }),
      activeEffects: [effect],
      gameSystemId: SRD_SYSTEM_ID,
      campaignId: CAMPAIGN_ID,
      characterFacts: null
    }),
    gameSystemId: SRD_SYSTEM_ID,
    definitions: srdDefinitions,
    speedDefinitions: SRD_SPEEDS,
    runEffectsByActorId: new Map(),
    readTurnMovedFeet: async () => 0
  })

describe('Holy Aura as authored grants', () => {
  it('gives attacks of every domain against the holder disadvantage, whatever the attacker', async () => {
    const { attackAgainstContributors } = await defended(
      holyAuraEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
    )
    expect(attackAgainstContributors.map(({ attackDomain }) => attackDomain).sort()).toEqual(
      [...ATTACK_DOMAINS].sort()
    )
    for (const { sourceQualifier, contributor } of attackAgainstContributors) {
      expect(contributor?.influence).toBe('DISADVANTAGE')
      expect(sourceQualifierAdmits(sourceQualifier, { creatureTypeIds: [] })).toBe(true)
      expect(
        sourceQualifierAdmits(sourceQualifier, { creatureTypeIds: [creatureTypeId('HUMANOID')] })
      ).toBe(true)
    }
  })
})

describe('Holy Aura saving throws', () => {
  it('gives the holder advantage on a saving throw of every ability', async () => {
    const { targetDerivedFacts } = await defended(
      holyAuraEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
    )
    const rows = (targetDerivedFacts.savingThrowDefinitions as readonly unknown[]).filter(
      (row): row is { contributors: readonly { influence: string }[] } =>
        typeof row === 'object' && row !== null && 'contributors' in row
    )
    expect(rows).toHaveLength(6)
    for (const { contributors } of rows)
      expect(contributors.map(({ influence }) => influence)).toContain('ADVANTAGE')
  })
})

describe('Dispel Evil and Good as authored grants', () => {
  it("gives only celestials', elementals', fey, fiends' and undead's attacks disadvantage", async () => {
    const { attackAgainstContributors } = await defended(
      dispelEvilAndGoodEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
    )
    expect(attackAgainstContributors.map(({ attackDomain }) => attackDomain).sort()).toEqual(
      [...ATTACK_DOMAINS].sort()
    )
    for (const { sourceQualifier, contributor } of attackAgainstContributors) {
      expect(contributor?.influence).toBe('DISADVANTAGE')
      for (const code of ['CELESTIAL', 'ELEMENTAL', 'FEY', 'FIEND', 'UNDEAD'])
        expect(
          sourceQualifierAdmits(sourceQualifier, { creatureTypeIds: [creatureTypeId(code)] })
        ).toBe(true)
      for (const code of ['HUMANOID', 'ABERRATION'])
        expect(
          sourceQualifierAdmits(sourceQualifier, { creatureTypeIds: [creatureTypeId(code)] })
        ).toBe(false)
    }
  })
})
