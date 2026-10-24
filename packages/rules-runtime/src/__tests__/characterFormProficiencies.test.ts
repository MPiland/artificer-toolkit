import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { halfRedDragonVeteran } from '@artificer-toolkit/source-data/srd/creatures/half-red-dragon-veteran.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_ATHLETICS_SKILL_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { characterFormCreatureView } from '../encounterActorForm.js'
import { prepareEncounterEscapeCheck } from '../encounterEscapeCheck.js'
import { buildMovementTarget, type CharacterMovementFacts } from '../encounterMovementTargets.js'
import { savingThrowCapabilityRegistry } from '../platformPolicyModules.js'
import { prepareFixtureSheet, readyFighterFixture } from '../testing/characterContextFixtures.js'
import {
  CAMPAIGN_ID,
  ENCOUNTER_ID,
  SRD_SYSTEM_ID,
  characterActor,
  installedSrdCreature,
  srdCreatureActor,
  srdCreatureTarget,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

const system = systemAuthoredDtoSchema.parse(srdSystemRecord)
const ACTOR_ID = testUuid(0x2d0)
const FORM_EFFECT_ID = testUuid(0x2d1)
const GRAPPLE_ID = testUuid(0x2d2)
const STRENGTH = SRD_ABILITY_DEFINITION_IDS.STRENGTH
/** Strength 16 and Athletics proficiency at CR 5, resistant to fire; it has no save proficiencies. */
const VETERAN = installedSrdCreature(halfRedDragonVeteran)
const savingThrows = savingThrowCapabilityRegistry.require(SRD_SYSTEM_ID)

/** A grapple on the actor that it escapes with Athletics against a fixed DC. */
const grapple = activeEffect({
  id: GRAPPLE_ID,
  owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: ACTOR_ID },
  createdOrdinal: 2,
  stateContributions: [
    {
      kind: 'ACTOR_RELATIONSHIP',
      relationshipOutcomeId: testUuid(0x2d3),
      sealedReachFeet: 5,
      modules: [
        {
          id: testUuid(0x2d4),
          order: 0,
          kind: 'ESCAPE_CHECK',
          activation: { code: 'ACTION', amount: 1 },
          checks: { skillIds: [SRD_ATHLETICS_SKILL_ID], abilityDefinitionIds: [STRENGTH] },
          dc: { kind: 'FIXED', value: 13 },
          actorKinds: ['TARGET']
        }
      ],
      conditionIds: [],
      capabilitySuppressions: []
    }
  ]
})

/**
 * The Fighter fixture wearing the veteran's form, held by an effect authored to keep the Fighter's
 * proficiencies or not; `formEffect: false` leaves the effect out.
 */
async function fighterInForm(retainsProficiencies: boolean, formEffect = true) {
  const fixture = readyFighterFixture()
  const sheet = await prepareFixtureSheet(fixture)
  const characterFacts: CharacterMovementFacts = {
    active: { id: fixture.character.id, checksum: 'a'.repeat(64), play: { streamVersion: 1 } },
    character: sheet.prepared.character,
    campaignContext: { conditions: [], adjustments: [], attunementSlotOverride: null },
    prepared: sheet.prepared,
    ruleEvaluation: sheet.ruleEvaluation
  }
  const sheetActor = characterActor({ id: ACTOR_ID, characterId: fixture.character.id })
  const creature = srdCreatureActor({ id: testUuid(0x2d5), creature: VETERAN })
  if (sheetActor.kind !== 'CHARACTER' || !creature.sourceId || !creature.sourceRevision)
    throw new Error('Expected a Character and an installed Creature.')
  const actor = {
    ...sheetActor,
    form: {
      effectId: FORM_EFFECT_ID,
      excessDamageCarriesOver: true,
      sourceId: creature.sourceId,
      sourceRevision: creature.sourceRevision,
      snapshot: creature.snapshot,
      currentHitPoints: creature.currentHitPoints,
      maxHitPoints: creature.maxHitPoints,
      tempHitPoints: 0
    }
  }
  const form: ActiveRuleEffectRecord = activeEffect({
    id: FORM_EFFECT_ID,
    owner: { kind: 'CHARACTER', characterId: fixture.character.id },
    createdOrdinal: 1,
    stateContributions: [
      {
        kind: 'CREATURE_FORM',
        formOutcomeId: 'form',
        creatureId: VETERAN.id,
        excessDamageCarriesOver: true,
        retainedAbilityIds: [],
        retainsProficiencies
      }
    ]
  })
  const target = (effects: ActiveRuleEffectRecord[], wearer = actor) =>
    buildMovementTarget({
      actor: wearer,
      activeEffects: effects,
      characterFacts,
      campaignId: CAMPAIGN_ID,
      gameSystemId: SRD_SYSTEM_ID
    })
  return {
    build: () => target(formEffect ? [form, grapple] : [grapple]),
    /** The Fighter as its Sheet stands, out of any form. */
    sheet: target([grapple], sheetActor),
    /** The form's stat block, as the Creature path reads it. */
    statBlock: srdCreatureTarget(characterFormCreatureView(actor)!, [grapple])
  }
}

const strengthSave = (rows: readonly { abilityDefinitionId: string; modifier: number }[]) =>
  rows.find(({ abilityDefinitionId }) => abilityDefinitionId === STRENGTH)?.modifier

const escapeModifier = (holder: ReturnType<typeof buildMovementTarget>) =>
  prepareEncounterEscapeCheck({
    gameSystemId: SRD_SYSTEM_ID,
    commandId: testUuid(0x2d6),
    commandFingerprint: 'b'.repeat(64),
    system,
    holder,
    activeEffectId: GRAPPLE_ID,
    checkDefinitionId: SRD_ATHLETICS_SKILL_ID
  }).d20.modifier

// SPELLS-4.T2s2 (D191): Polymorph and True Polymorph replace the Character's proficiencies with the form's.
describe('a Character in a form that replaces its proficiencies uses the stat block', () => {
  it("rolls an effect's save with the form's save rows", async () => {
    const { build, statBlock } = await fighterInForm(false)
    const target = build()
    expect(strengthSave(target.targetDerivedFacts.savingThrowDefinitions ?? [])).toBe(3)
    expect(target.targetDerivedFacts.savingThrowDefinitions).toEqual(
      statBlock.targetDerivedFacts.savingThrowDefinitions
    )
  })

  it("rolls its own held saves (Concentration) with the form's save rows", async () => {
    const { build, statBlock } = await fighterInForm(false)
    expect(strengthSave(savingThrows.holderSaves(build()))).toBe(3)
    expect(savingThrows.holderSaves(build())).toEqual(savingThrows.holderSaves(statBlock))
  })

  it("makes a check with the form's skill total", async () => {
    const { build } = await fighterInForm(false)
    expect(escapeModifier(build())).toBe(6)
  })

  it("takes damage through the form's damage defenses", async () => {
    const { build, statBlock } = await fighterInForm(false)
    const target = build()
    expect(statBlock.defenses).not.toEqual([])
    expect(target.defenses).toEqual(statBlock.defenses)
    expect(target.targetDerivedFacts.targetProtection).toEqual(
      statBlock.targetDerivedFacts.targetProtection
    )
  })

  it('keeps its Character identity and Sheet projection', async () => {
    const { build, sheet } = await fighterInForm(false)
    const target = build()
    expect(target.actor.kind).toBe('CHARACTER')
    expect(target.characterCurrentness?.projectionChecksum).toBe(
      sheet.characterCurrentness?.projectionChecksum
    )
    expect(target.formCreature?.id).toBe(target.actor.id)
  })

  it('refuses a form whose holding effect it cannot read', async () => {
    const { build } = await fighterInForm(false, false)
    expect(build).toThrow('The effect holding the creature form is unavailable.')
  })
})

// Wild Shape and Shapechange keep the Character's proficiencies, applied to the form's scores.
describe('a Character in a form that keeps its proficiencies uses its own', () => {
  it('checks with its own (here none) proficiencies and defends as its Sheet does', async () => {
    const { build, sheet, statBlock } = await fighterInForm(true)
    const target = build()
    expect(target.formCreature).toBeUndefined()
    // The veteran's Strength 16 without the veteran's Athletics proficiency: the Fighter has none.
    expect(escapeModifier(target)).toBe(3)
    expect(escapeModifier(statBlock)).toBe(6)
    expect(target.defenses).toEqual(sheet.defenses)
    expect(target.defenses).not.toEqual(statBlock.defenses)
  })
})
