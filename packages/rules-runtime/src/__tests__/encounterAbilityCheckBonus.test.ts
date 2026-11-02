import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { prepareEncounterEscapeCheck } from '../encounterEscapeCheck.js'
import type { CharacterMovementFacts } from '../encounterMovementTargets.js'
import { buildMovementTarget } from '../encounterMovementTargets.js'
import { halfProficiencyRace } from '../testing/abilityCheckBonusRace.js'
import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture
} from '../testing/characterContextFixtures.js'
import {
  CAMPAIGN_ID,
  ENCOUNTER_ID,
  SRD_SYSTEM_ID,
  characterActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

/**
 * SPELLS-31.T5q-B: every encounter check a Character rolls (passage, contest, escape, the CHECK
 * action) reads its plain ability check through `actorContestFacts`, so the ability check BONUS
 * must reach it, not only the Sheet.
 */

const system = systemAuthoredDtoSchema.parse(srdSystemRecord)
const STRENGTH = SRD_ABILITY_DEFINITION_IDS.STRENGTH

describe('an encounter ability check a Character rolls', () => {
  it('carries the ability check bonus, which the ability modifier leaves out', async () => {
    const fixture = readyFighterFixture()
    const documents = { ...fixture.documents, RACE: [halfProficiencyRace] }
    const { character } = await prepareFixtureBuilder({ character: fixture.character, documents })
    const sheet = await prepareFixtureSheet({ character, documents })
    const strength = sheet.ruleEvaluation.output.derivedStats.abilities.find(
      (entry) => entry.abilityId === 'STRENGTH'
    )
    if (!strength) throw new Error('The fixture Character has no Strength.')
    // A level 1 proficiency bonus of +2 gives the half bonus, +1.
    expect(strength.check.effective).toBe(strength.modifier.effective + 1)

    const characterFacts: CharacterMovementFacts = {
      active: { id: fixture.character.id, checksum: 'a'.repeat(64), play: { streamVersion: 1 } },
      character: sheet.prepared.character,
      campaignContext: { conditions: [], adjustments: [], attunementSlotOverride: null },
      prepared: sheet.prepared,
      ruleEvaluation: sheet.ruleEvaluation
    }
    const actor = characterActor({ id: testUuid(5), characterId: fixture.character.id })
    const effect = activeEffect({
      id: testUuid(20),
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: actor.id },
      createdOrdinal: 1,
      stateContributions: [
        {
          kind: 'ACTOR_RELATIONSHIP',
          relationshipOutcomeId: testUuid(21),
          sealedReachFeet: 5,
          modules: [
            {
              id: testUuid(22),
              order: 0,
              kind: 'ESCAPE_CHECK',
              activation: { code: 'ACTION', amount: 1 },
              checks: { skillIds: [], abilityDefinitionIds: [STRENGTH] },
              dc: { kind: 'FIXED', value: 13 },
              actorKinds: ['TARGET']
            }
          ],
          conditionIds: [],
          capabilitySuppressions: []
        }
      ]
    })
    const holder = buildMovementTarget({
      actor,
      activeEffects: [effect],
      characterFacts,
      campaignId: CAMPAIGN_ID,
      gameSystemId: SRD_SYSTEM_ID
    })

    const context = prepareEncounterEscapeCheck({
      gameSystemId: SRD_SYSTEM_ID,
      commandId: testUuid(901),
      commandFingerprint: 'b'.repeat(64),
      system,
      holder,
      activeEffectId: effect.id,
      checkDefinitionId: STRENGTH
    })

    expect(context.d20.modifier).toBe(strength.check.effective)
  })
})
