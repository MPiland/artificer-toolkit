import { SRD_BASIC_ACTION_IDS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { SRD_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/movementReaction.js'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { describe, expect, it } from 'vitest'

import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscovery.js'
import { discoverEncounterBasicActions } from '../encounterBasicActionCapabilityDiscovery.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { discoverEncounterFeatureActionCapabilities } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { readEncounterMovementBasicReactions } from '../encounterMovementReactionFacts.js'
import {
  discoverEncounterMovementReactionSources,
  type EncounterMovementReactionCharacterSource
} from '../encounterMovementReactionSources.js'
import { DND5E_OPPORTUNITY_ATTACK_DEFINITION_ID } from '../systems/dnd5e/reactionEligibilityPolicy.js'
import { SRD, evaluateSrdCharacter, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor,
  srdDefinitions,
  srdEncounterState,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'

/**
 * MOVE-1.T1b (D231): the System's opportunity attack is made with each melee attack the reactor
 * has, so a published SRD actor offers one with no authored reaction of its own.
 */

const WOLF_ID = testUuid(0x7b01)
const WOLF_TOKEN_ID = testUuid(0x7b02)
const FIGHTER_ID = testUuid(0x7b03)
const FIGHTER_TOKEN_ID = testUuid(0x7b04)
const CHARACTER_ID = testUuid(0x7b05)

const conditionDefinitionIds = SRD_CONDITION_TYPES.map((condition) => condition.id)
const abilityDefinitions = SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
const basicReactionEntries = await readEncounterMovementBasicReactions({
  gameSystemId: SRD_SYSTEM_ID,
  readCurrentDefinition: (definitionId) => srdDefinitions.requireCurrent(definitionId)
})

const wolfCreature = srdByLabel(SRD.creatures, 'Wolf')
const bite = creatureFeature(wolfCreature, 'Bite')
const wolf = srdCreatureActor({ id: WOLF_ID, creature: wolfCreature })

const fighter = evaluateSrdCharacter({
  classes: [{ label: 'Fighter', level: 1 }],
  abilities: { STRENGTH: 16 },
  items: [{ label: 'Longsword', equipped: true }, { label: 'Dagger' }]
})
const fighterActor = characterActor({ id: FIGHTER_ID, characterId: CHARACTER_ID })
const lockedFighter: EncounterMovementReactionCharacterSource = {
  id: CHARACTER_ID,
  systemId: SRD_SYSTEM_ID,
  streamVersion: 1,
  actor: fighterActor,
  activeConditionDefinitionIds: [],
  mechanics: {
    rulePolicyInput: { actionCandidates: fighter.facts.actionCandidates },
    compiledActionEntryPoints: compileCharacterActionEntryPoints({
      gameSystemId: SRD_SYSTEM_ID,
      candidates: fighter.facts.actionCandidates,
      descriptors: discoverCharacterActionCapabilities({
        gameSystemId: SRD_SYSTEM_ID,
        candidates: fighter.facts.actionCandidates,
        conditionDefinitionIds,
        abilityDefinitions,
        entryPoints: fighter.entryPoints
      })
    })
  }
}

function sources(input: {
  actors: readonly EncounterRunActorState[]
  legendaryFeatureIds?: readonly string[]
  entries?: typeof basicReactionEntries
}) {
  const state = srdEncounterState({ actors: input.actors, currentActorId: null })
  return discoverEncounterMovementReactionSources({
    encounter: { ...state, actors: input.actors },
    actorIdByTokenId: new Map([
      [WOLF_TOKEN_ID, WOLF_ID],
      [FIGHTER_TOKEN_ID, FIGHTER_ID]
    ]),
    tokens: [{ id: WOLF_TOKEN_ID }, { id: FIGHTER_TOKEN_ID }],
    lockedCharacters: input.actors.some(({ id }) => id === FIGHTER_ID)
      ? new Map([[CHARACTER_ID, lockedFighter]])
      : new Map(),
    encounterFeatureCapabilities: input.actors.flatMap((actor) =>
      actor.kind === 'CREATURE'
        ? discoverEncounterFeatureActionCapabilities({
            actor,
            conditionDefinitionIds,
            abilityDefinitions,
            spells: new Map()
          })
        : []
    ),
    basicReactions: {
      entries: input.entries ?? basicReactionEntries,
      legendaryFeatureIds: new Set(input.legendaryFeatureIds ?? [])
    }
  })
}

describe('the System opportunity attack as a movement reaction (D231)', () => {
  it('is the published SRD basic reaction the D&D System names, bound to the leave-reach graph', () => {
    expect(DND5E_OPPORTUNITY_ATTACK_DEFINITION_ID).toBe(SRD_BASIC_ACTION_IDS.OPPORTUNITY_ATTACK)
    const [entry] = basicReactionEntries
    expect(basicReactionEntries).toHaveLength(1)
    expect(entry!.document.actionCost).toBe('REACTION')
    expect(
      entry!.document.effects.map((effect) =>
        effect.invocation.kind === 'ACTION' ? effect.invocation.reactionTrigger : null
      )
    ).toEqual([
      expect.objectContaining({
        kind: 'MOVEMENT',
        stage: 'BEFORE_LEAVE_REACH',
        eligibilityDefinitionId: SRD_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID
      }),
      expect.objectContaining({
        kind: 'MOVEMENT',
        stage: 'BEFORE_LEAVE_REACH',
        eligibilityDefinitionId: SRD_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID
      })
    ])
  })

  it('is made with an unpatched SRD Wolf’s Bite, at the Bite’s own reach', () => {
    const found = sources({ actors: [wolf] })
    expect(found).toHaveLength(1)
    const [source] = found
    if (source?.action.kind !== 'ENCOUNTER_FEATURE') throw new Error('Expected the Wolf’s Bite.')
    expect(source.action.capability.ownerFeatureId).toBe(bite.id)
    expect(source.source.capability.actionId).toBe(source.action.capability.actionId)
    expect(source.source.binding).toMatchObject({
      stage: 'BEFORE_LEAVE_REACH',
      eligibilityDefinitionId: SRD_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID
    })
    expect(source.range).toEqual(source.action.capability.compiledEffect.invocation.range)
    expect(source.range).toMatchObject({ rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' })
  })

  it('is made with the Character’s wielded weapon and unarmed strike, not a carried one', () => {
    const found = sources({ actors: [fighterActor] })
    const itemInstanceIds = new Set(
      found.map((source) =>
        source.action.kind === 'CHARACTER_ACTION'
          ? source.action.candidate.equipment?.itemInstanceId
          : null
      )
    )
    expect(itemInstanceIds).toEqual(
      new Set([fighter.itemInstanceId('Longsword'), fighter.snapshot.naturalWeapon?.instanceId])
    )
    for (const source of found) {
      if (source.action.kind !== 'CHARACTER_ACTION') throw new Error('Expected a Character action.')
      expect(source.action.candidate.mechanicFacts.invocation.activation?.code).toBe('ACTION')
      expect(source.range).toEqual(source.action.entry.targetPolicy?.range)
      expect(source.source.binding.eligibilityDefinitionId).toBe(
        SRD_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID
      )
    }
  })

  it('is not made by a defeated creature, nor with a Legendary Action Feature', () => {
    const defeatedWolf = srdCreatureActor({ id: WOLF_ID, creature: wolfCreature, defeated: true })
    expect(sources({ actors: [defeatedWolf] })).toEqual([])
    expect(sources({ actors: [wolf], legendaryFeatureIds: [bite.id] })).toEqual([])
  })

  it('offers nothing when the System names no basic reaction', () => {
    expect(sources({ actors: [wolf, fighterActor], entries: [] })).toEqual([])
  })

  it('reads none the System has not published, as the turn’s catalogue offers none', async () => {
    const unpublished = await readEncounterMovementBasicReactions({
      gameSystemId: SRD_SYSTEM_ID,
      readCurrentDefinition: async () => null
    })
    expect(unpublished).toEqual([])
  })

  it('is never offered from the turn as a basic action', () => {
    const turn = discoverEncounterBasicActions({
      actorId: WOLF_ID,
      gameSystemId: SRD_SYSTEM_ID,
      entries: basicReactionEntries,
      conditionDefinitionIds,
      abilityDefinitions
    })
    expect(turn.available).toEqual([])
    expect(turn.unavailable).toEqual([])
  })
})
