import { describe, expect, it } from 'vitest'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { creatureConditionCapabilityRegistry } from '../platformPolicyModules.js'
import { planEncounterPassiveZones } from '../encounterPassiveZones.js'
import { plannedSpatialEffectRecord } from '../encounterPlacedZone.js'
import {
  encounterOccupantAuras,
  withEncounterOccupantAuras,
  type EncounterOccupantAura
} from '../encounterOccupantAuras.js'
import { system } from '../testing/characterContextFixtures.js'
import { evaluateSrdCharacter, SRD, srdByLabel, srdFeature } from '../testing/dnd5eSrdCharacter.js'
import {
  characterActor,
  ENCOUNTER_ID,
  srdCreatureActor,
  srdCreatureTarget,
  srdEncounterState,
  testUuid,
  TIMESTAMP
} from '../testing/dnd5eSrdEncounter.js'
import {
  GOBLIN_ID,
  GOBLIN_TOKEN_ID,
  OCCURRENCE_ID,
  root,
  SCENE_ID,
  SOURCE_ID,
  SOURCE_TOKEN_ID,
  ZONE_POINT
} from '../testing/encounterTurnZoneFixture.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { rebuildEncounterTurnTarget } from '../encounterTurnTarget.js'

const GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}
const PALADIN_CHARACTER_ID = testUuid(0x5c01)
const GOBLIN = srdByLabel(SRD.creatures, 'Goblin')
const paladin = characterActor({ id: SOURCE_ID, characterId: PALADIN_CHARACTER_ID })
const goblinActor = (disposition: EncounterRunActorState['disposition']) =>
  srdCreatureActor({ id: GOBLIN_ID, creature: GOBLIN, disposition })
const actorIdByTokenId = new Map([
  [GOBLIN_TOKEN_ID, GOBLIN_ID],
  [SOURCE_TOKEN_ID, SOURCE_ID]
])
/** The paladin's token, with the goblin's `squaresAway` squares to its left. */
const tokensWithGoblin = (squaresAway: number) => [
  {
    id: GOBLIN_TOKEN_ID,
    position: { x: ZONE_POINT.x - 100 * (squaresAway - 1), y: ZONE_POINT.y },
    width: 100,
    height: 100
  },
  {
    id: SOURCE_TOKEN_ID,
    position: { x: ZONE_POINT.x + 100, y: ZONE_POINT.y },
    width: 100,
    height: 100
  }
]

/** The real SRD Aura of Protection of a 6th-level paladin with Charisma 16, placed and stored. */
const [aura] = planEncounterPassiveZones({
  state: srdEncounterState({ actors: [paladin], currentActorId: SOURCE_ID }),
  occurrenceId: OCCURRENCE_ID,
  rootCommandId: root.rootCommandId,
  actors: [paladin],
  system,
  sceneGrid: GRID,
  tokens: tokensWithGoblin(1),
  actorIdByTokenId,
  characterRules: new Map([
    [
      PALADIN_CHARACTER_ID,
      evaluateSrdCharacter({
        abilities: { CHARISMA: 16 },
        classes: [{ label: 'Paladin', level: 6 }],
        features: [
          srdFeature({
            owner: 'CLASS',
            classLabel: 'Paladin',
            featureLabel: 'Aura of Protection',
            level: 6
          })
        ]
      })
    ]
  ])
}).map((zone) =>
  plannedSpatialEffectRecord(zone, {
    encounterId: ENCOUNTER_ID,
    sceneId: SCENE_ID,
    createdOrdinal: 1,
    createdAt: TIMESTAMP
  })
)

function aurasHolding(
  targetActorId: string,
  actors: readonly EncounterRunActorState[],
  squaresAway = 1
) {
  return encounterOccupantAuras({
    targetActorId,
    actors,
    effects: aura ? [aura] : [],
    tokens: tokensWithGoblin(squaresAway),
    actorIdByTokenId
  })
}

describe('the save-bonus auras holding an actor (SPELLS-20 T5c, D155)', () => {
  const lent = {
    effectId: aura?.id,
    sourceActorId: SOURCE_ID,
    sourceCharacterId: PALADIN_CHARACTER_ID,
    saveBonus: 3,
    conditionImmunityIds: []
  }

  it('holds an ally beside the paladin and the paladin itself', () => {
    const actors = [goblinActor('FRIENDLY'), paladin]
    expect(aurasHolding(GOBLIN_ID, actors)).toEqual([lent])
    expect(aurasHolding(SOURCE_ID, actors)).toEqual([lent])
  })

  it('lends nothing to a hostile or neutral creature beside the paladin', () => {
    expect(aurasHolding(GOBLIN_ID, [goblinActor('HOSTILE'), paladin])).toEqual([])
    expect(aurasHolding(GOBLIN_ID, [goblinActor('NEUTRAL'), paladin])).toEqual([])
  })

  it('lends nothing to an ally beyond its 10 feet, nor to an actor with no token', () => {
    // Three squares away the goblin's footprint only touches the aura's edge.
    expect(aurasHolding(GOBLIN_ID, [goblinActor('FRIENDLY'), paladin], 3)).toEqual([])
    expect(aurasHolding(GOBLIN_ID, [goblinActor('FRIENDLY'), paladin], 2)).toEqual([lent])
    expect(
      encounterOccupantAuras({
        targetActorId: GOBLIN_ID,
        actors: [goblinActor('FRIENDLY'), paladin],
        effects: aura ? [aura] : [],
        tokens: tokensWithGoblin(1),
        actorIdByTokenId: new Map([[SOURCE_TOKEN_ID, SOURCE_ID]])
      })
    ).toEqual([])
  })

  it('lends nothing from a defeated Creature source, and names no Character for a living one', () => {
    const creatureSource = (defeated: boolean) =>
      srdCreatureActor({
        id: SOURCE_ID,
        creature: GOBLIN,
        disposition: 'FRIENDLY',
        ...(defeated ? { defeated: true, currentHitPoints: 0 } : {})
      })
    expect(aurasHolding(GOBLIN_ID, [goblinActor('FRIENDLY'), creatureSource(true)])).toEqual([])
    expect(aurasHolding(GOBLIN_ID, [goblinActor('FRIENDLY'), creatureSource(false)])).toEqual([
      { ...lent, sourceCharacterId: null }
    ])
  })
})

describe('a save inside a save-bonus aura (SPELLS-20 T5c, D155)', () => {
  const target = srdCreatureTarget(goblinActor('FRIENDLY'))
  const rows = target.targetDerivedFacts.savingThrowDefinitions as { modifier: number }[]
  const unconscious =
    creatureConditionCapabilityRegistry.require(DND5E_SYSTEM_ID).zeroHitPointsConditionDefinitionId!
  const characterAura = (amount: number, effectId = testUuid(0x5c10)): EncounterOccupantAura => ({
    effectId,
    sourceActorId: SOURCE_ID,
    sourceCharacterId: PALADIN_CHARACTER_ID,
    saveBonus: amount,
    conditionImmunityIds: []
  })
  const modifiers = (prepared: typeof target) =>
    (prepared.targetDerivedFacts.savingThrowDefinitions as { modifier: number }[]).map(
      ({ modifier }) => modifier
    )

  it('adds the largest bonus of the auras holding the target to every save row', async () => {
    expect(rows.length).toBeGreaterThan(0)
    const read: unknown[] = []
    const prepared = await withEncounterOccupantAuras({
      target,
      gameSystemId: DND5E_SYSTEM_ID,
      auras: [characterAura(1), characterAura(3, testUuid(0x5c11))],
      readCharacterConditionIds: async (source) => {
        read.push(source)
        return []
      }
    })
    expect(modifiers(prepared)).toEqual(rows.map(({ modifier }) => modifier + 3))
    expect(read).toEqual([
      { sourceActorId: SOURCE_ID, sourceCharacterId: PALADIN_CHARACTER_ID },
      { sourceActorId: SOURCE_ID, sourceCharacterId: PALADIN_CHARACTER_ID }
    ])
  })

  it('keeps the bonus on a turn target rebuilt from the prepared one', async () => {
    const prepared = await withEncounterOccupantAuras({
      target,
      gameSystemId: DND5E_SYSTEM_ID,
      auras: [characterAura(3)],
      readCharacterConditionIds: async () => []
    })
    const rebuild = (source: typeof target) =>
      rebuildEncounterTurnTarget({
        source,
        actor: source.actor,
        characterFacts: null,
        activeEffects: [],
        state: srdEncounterState({ actors: [source.actor], currentActorId: GOBLIN_ID })
      })
    expect(modifiers(rebuild(prepared))).toEqual(rows.map(({ modifier }) => modifier + 3))
    expect(modifiers(rebuild(target))).toEqual(rows.map(({ modifier }) => modifier))
  })

  it('lends nothing while the source Character is unconscious', async () => {
    const prepared = await withEncounterOccupantAuras({
      target,
      gameSystemId: DND5E_SYSTEM_ID,
      auras: [characterAura(3)],
      readCharacterConditionIds: async () => [unconscious]
    })
    expect(prepared).toBe(target)
  })

  it('reads no Character for a Creature source and leaves a target with no aura unchanged', async () => {
    const readCharacterConditionIds = async (): Promise<string[]> => {
      throw new Error('A Creature source has no Character to read.')
    }
    const prepared = await withEncounterOccupantAuras({
      target,
      gameSystemId: DND5E_SYSTEM_ID,
      auras: [{ ...characterAura(2), sourceCharacterId: null }],
      readCharacterConditionIds
    })
    expect(modifiers(prepared)).toEqual(rows.map(({ modifier }) => modifier + 2))
    expect(
      await withEncounterOccupantAuras({
        target,
        gameSystemId: DND5E_SYSTEM_ID,
        auras: [],
        readCharacterConditionIds
      })
    ).toBe(target)
  })
})

describe('the condition-immunity auras holding an actor (SPELLS-31.T4r, D155)', () => {
  const frightened = srdSystemRecord.conditionTypes.find(({ code }) => code === 'FRIGHTENED')?.id
  /** The real SRD Aura of Courage of a paladin of `level`, placed and stored. */
  const courage = (level: number) =>
    planEncounterPassiveZones({
      state: srdEncounterState({ actors: [paladin], currentActorId: SOURCE_ID }),
      occurrenceId: OCCURRENCE_ID,
      rootCommandId: root.rootCommandId,
      actors: [paladin],
      system,
      sceneGrid: GRID,
      tokens: tokensWithGoblin(1),
      actorIdByTokenId,
      characterRules: new Map([
        [
          PALADIN_CHARACTER_ID,
          evaluateSrdCharacter({
            classes: [{ label: 'Paladin', level }],
            features: [
              srdFeature({
                owner: 'CLASS',
                classLabel: 'Paladin',
                featureLabel: 'Aura of Courage',
                level: 10
              })
            ]
          })
        ]
      ])
    }).map((zone) =>
      plannedSpatialEffectRecord(zone, {
        encounterId: ENCOUNTER_ID,
        sceneId: SCENE_ID,
        createdOrdinal: 1,
        createdAt: TIMESTAMP
      })
    )
  const holding = (level: number, squaresAway: number) => {
    const effects = courage(level)
    return encounterOccupantAuras({
      targetActorId: GOBLIN_ID,
      actors: [goblinActor('FRIENDLY'), paladin],
      effects,
      tokens: tokensWithGoblin(squaresAway),
      actorIdByTokenId
    }).map(({ effectId, saveBonus, conditionImmunityIds }) => ({
      placed: effects.some(({ id }) => id === effectId),
      saveBonus,
      conditionImmunityIds
    }))
  }

  it('keeps frightened off an ally within 10 feet, and within 30 feet at paladin level 18', () => {
    expect(frightened).toBeDefined()
    const held = [{ placed: true, saveBonus: null, conditionImmunityIds: [frightened] }]
    expect(holding(10, 2)).toEqual(held)
    expect(holding(10, 3)).toEqual([])
    expect(holding(18, 6)).toEqual(held)
  })
})

describe('a target inside a condition-immunity aura (SPELLS-31.T4r, D155)', () => {
  const target = srdCreatureTarget(goblinActor('FRIENDLY'))
  const charmed = testUuid(0x5c20)
  const frightened = testUuid(0x5c21)
  const unconscious =
    creatureConditionCapabilityRegistry.require(DND5E_SYSTEM_ID).zeroHitPointsConditionDefinitionId!
  const immunityAura = (conditionImmunityIds: string[], effectId = testUuid(0x5c22)) => ({
    effectId,
    sourceActorId: SOURCE_ID,
    sourceCharacterId: PALADIN_CHARACTER_ID,
    saveBonus: null,
    conditionImmunityIds
  })

  it('joins the auras’ conditions to its condition immunities and leaves its saves alone', async () => {
    const prepared = await withEncounterOccupantAuras({
      target,
      gameSystemId: DND5E_SYSTEM_ID,
      auras: [immunityAura([frightened]), immunityAura([charmed, frightened], testUuid(0x5c23))],
      readCharacterConditionIds: async () => []
    })
    expect(prepared.conditionImmunityIds).toEqual([
      ...new Set([...target.conditionImmunityIds, charmed, frightened])
    ])
    expect(prepared.occupantConditionImmunityIds).toEqual([charmed, frightened].sort())
    expect(prepared.targetDerivedFacts).toEqual(target.targetDerivedFacts)
    expect(prepared.occupantSaveBonus).toBeUndefined()
  })

  it('keeps them on a turn target rebuilt from the prepared one', async () => {
    const prepared = await withEncounterOccupantAuras({
      target,
      gameSystemId: DND5E_SYSTEM_ID,
      auras: [immunityAura([frightened])],
      readCharacterConditionIds: async () => []
    })
    const rebuild = (source: typeof target) =>
      rebuildEncounterTurnTarget({
        source,
        actor: source.actor,
        characterFacts: null,
        activeEffects: [],
        state: srdEncounterState({ actors: [source.actor], currentActorId: GOBLIN_ID })
      })
    expect(rebuild(prepared).conditionImmunityIds).toContain(frightened)
    expect(rebuild(target).conditionImmunityIds).not.toContain(frightened)
  })

  it('lends nothing while the source Character is unconscious', async () => {
    const prepared = await withEncounterOccupantAuras({
      target,
      gameSystemId: DND5E_SYSTEM_ID,
      auras: [immunityAura([frightened])],
      readCharacterConditionIds: async () => [unconscious]
    })
    expect(prepared).toBe(target)
  })
})
