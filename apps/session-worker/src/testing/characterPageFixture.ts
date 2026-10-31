import { characterStoredRowSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import {
  characterDocumentSchema,
  encodeCharacterRecord
} from '@artificer-toolkit/schema/projections/characterStoredState'
import {
  characterSheetStateSchema,
  type CharacterSheetState
} from '@artificer-toolkit/schema/projections/characterSheetState'
import { splitCharacterPlayState } from '@artificer-toolkit/schema/projections/characterPlayState'
import type { CharacterDeathSaves } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import { EQUIPMENT_PROPERTY_CODE, nextEquipSlot } from '@artificer-toolkit/shared/core'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { pinnedRetainedRulesJson } from '@artificer-toolkit/rules-runtime/testing/pinnedRetainedRules'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import type { ClassAuthored, EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { SRD_SPEEDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'

/** A level 1 Character capture; the private transport row below uses the canonical storage codec. */
const capturedPage = {
  status: 'ASSIGNED',
  characterId: 'f84fd6f1-8c90-4578-b9c5-2593b797bcb9',
  documents: [],
  contentSnapshots: {
    systemId: '00000000-0000-0000-0000-000000000001',
    sources: [],
    campaign: {
      id: '6ac2c5e6-6b7a-4af7-809d-bafb66543183',
      contentMaturity: 'STANDARD',
      head: null
    }
  },
  inputs: {
    campaign: {
      attunementSlotOverride: null,
      contentMaturity: 'STANDARD',
      currencyOptions: [],
      id: '6ac2c5e6-6b7a-4af7-809d-bafb66543183',
      state: { adjustments: [], conditions: [] },
      status: 'ACTIVE'
    },
    character: {
      id: 'f84fd6f1-8c90-4578-b9c5-2593b797bcb9',
      intent: {
        abilities: {
          assignments: [
            { ability: 'STRENGTH', option: '15' },
            { ability: 'DEXTERITY', option: '14' },
            { ability: 'CONSTITUTION', option: '13' },
            { ability: 'INTELLIGENCE', option: '12' },
            { ability: 'WISDOM', option: '10' },
            { ability: 'CHARISMA', option: '8' }
          ],
          method: 'STANDARD_ARRAY'
        },
        advancement: { method: 'MILESTONE' },
        background: { backgroundId: '00000000-0000-0000-0040-000100000000' },
        classes: [{ classId: '00000000-0000-0000-0010-000500000000', classLevel: 1 }],
        featureAcquisitions: [],
        hitpoints: {
          levels: [
            { classId: '00000000-0000-0000-0010-000500000000', classLevel: 1, level: 1, value: 11 }
          ],
          method: 'FIXED'
        },
        race: { raceId: '00000000-0000-0000-0030-000400000000' },
        startingEquipment: {
          background: {
            applied: true,
            groups: [
              {
                groupId: '3b74a8d0-eb08-47c9-b103-8d3ec46bd283',
                optionId: '319962bb-3446-4b1e-bc19-3f3d5e78a36d'
              }
            ],
            source: 'BACKGROUND',
            tookGold: false
          },
          class: {
            applied: true,
            gold: { goldOption: '5d4', totalGold: 100 },
            source: 'CLASS',
            tookGold: true
          }
        }
      },
      label: 'Aria',
      profile: {},
      state: {
        currency: [
          {
            currencies: [
              { amount: 115, currencyId: '00000000-0000-0000-0003-000400000000', kind: 'RULESET' }
            ],
            id: '07653bb9-429c-4ab6-910c-cd693b82ec10'
          }
        ],
        equipment: {
          attuned: [],
          equipped: [],
          inventory: [
            {
              equipmentId: '00000000-0000-0000-0060-000100000000',
              id: '992d362a-d18b-42d0-aea9-56368b7710b9',
              quantity: 2,
              retainedRulesJson: pinnedRetainedRulesJson({
                systemId: club.systemId,
                equipment: club
              })
            }
          ]
        },
        hitpoints: {
          current: 11,
          temp: 0,
          hitDice: [{ die: 10, total: 1, used: 0 }],
          deathSaves: NO_DEATH_SAVES
        }
      },
      status: 'ACTIVE',
      systemId: '00000000-0000-0000-0000-000000000001',
      userId: '4b355870-c307-4b42-a70f-e73cecc6c459'
    },
    sheetState: {
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      partyVisibility: { health: 'HIDDEN', sheet: false },
      resourceUsage: [],
      itemUsage: [],
      itemDegradation: [],
      spellCustomizations: []
    },
    streamVersion: 1,
    updatedAt: '2026-09-29T07:35:48.348Z'
  },
  revisions: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      revision: 'a88b25c0-78a8-4111-8001-b9567dddf396',
      scope: 'SYSTEM'
    },
    {
      id: '6ac2c5e6-6b7a-4af7-809d-bafb66543183',
      revision: '37126bb7-6fac-466e-9ad1-9d51079e2993',
      scope: 'CAMPAIGN'
    },
    {
      id: '6ac2c5e6-6b7a-4af7-809d-bafb66543183',
      revision: '45bba7ed-c069-431d-baad-43cdc9b2f18e',
      scope: 'PLAY'
    },
    {
      id: 'f84fd6f1-8c90-4578-b9c5-2593b797bcb9',
      revision: '9962f99a-db00-45a3-b8db-94c4b6448b99',
      scope: 'CHARACTER'
    }
  ]
}

const sheetState = characterSheetStateSchema.parse(capturedPage.inputs.sheetState)
const updatedAt = capturedPage.inputs.updatedAt
const capturedRevisions = capturedPage.revisions

/** The level 1 Fighter's stored speeds: walking 30 ft. */
export const fixtureSpeeds = [
  {
    speedId: SRD_SPEEDS.find((speed) => speed.code === 'WALK')!.id,
    amount: 30,
    unit: 'FEET' as const
  }
]

/** The play state a room's Character starts with, where it differs from the capture. */
export interface CharacterPlayOverrides {
  /** Equips the first inventory item (the Club). */
  equipped?: boolean
  /** Further SRD Equipment the Character carries, equipped, one of each. */
  carried?: readonly EquipmentAuthored[]
  /** How many of each carried item (default 1). */
  carriedQuantity?: number
  currentHitPoints?: number
  /** The Character's death saves (default none); three failures leave it dead (D96). */
  deathSaves?: CharacterDeathSaves
  /** The SRD Class the Character's levels are in (default the captured Fighter); its source must publish it. */
  characterClass?: ClassAuthored
  /** The SRD subclass the Character follows (its source publishes it with the Class); its levels come with the Class level. */
  characterSubclass?: ClassAuthored
  /** The Character's Class level (default 1); each level after the first adds 7 fixed hit points and a hit die. */
  classLevel?: number
  /** Standard-array options that replace the captured assignments (default Strength 15, Dexterity 14, Charisma 8), by ability code; keep the array's values a permutation. */
  abilityScores?: Readonly<Record<string, number>>
  /** Sheet conditions the Character already carries. */
  conditions?: { conditionTypeId: string; label: string }[]
  /** The Character's Exhaustion level on its Sheet. */
  exhaustionLevel?: number
  /** The spells the Character's Class has learned and prepared. */
  spells?: { learned: readonly string[]; prepared: readonly string[] }
  /** Spell slots already spent, by slot key (for example `STANDARD:4`). */
  spellSlots?: readonly { slotKey: string; used: number }[]
  /** Sheet resource usage already spent (the Sheet's stored `resourceUsage` records, without their metadata). */
  resourceUsage?: readonly Pick<CharacterSheetState['resourceUsage'][number], 'owner' | 'used'>[]
}

/** The captured Sheet state, carrying the spent resource usage `play` names. */
function sheetStateFor(characterId: string, userId: string, play: CharacterPlayOverrides = {}) {
  return {
    ...sheetState,
    resourceUsage: (play.resourceUsage ?? []).map(({ owner, used }) => ({
      id: crypto.randomUUID(),
      characterId,
      createdBy: userId,
      updatedBy: userId,
      createdAt: updatedAt,
      updatedAt,
      owner,
      used
    }))
  }
}

/** The captured Character's private stored row (structure with its play record), re-keyed to an owner. */
export function characterOwnerRowFor({
  characterId = capturedPage.characterId,
  userId = capturedPage.inputs.character.userId,
  play: playOverrides = {}
}: { characterId?: string; userId?: string; play?: CharacterPlayOverrides } = {}) {
  const {
    equipped = false,
    carried = [],
    carriedQuantity = 1,
    characterClass,
    characterSubclass,
    classLevel = 1,
    abilityScores = {},
    conditions,
    exhaustionLevel,
    spells,
    spellSlots
  } = playOverrides
  const [capturedClass] = capturedPage.inputs.character.intent.classes
  const classId = characterClass?.id ?? capturedClass!.classId
  const [capturedLevel] = capturedPage.inputs.character.intent.hitpoints.levels
  const maximumHitPoints = capturedLevel!.value + 7 * (classLevel - 1)
  const capturedInventory = capturedPage.inputs.character.state.equipment.inventory
  const carriedInventory = carried.map((item) => ({
    id: crypto.randomUUID(),
    equipmentId: item.id,
    quantity: carriedQuantity
  }))
  const { currentHitPoints = maximumHitPoints, deathSaves = NO_DEATH_SAVES } = playOverrides
  const character = characterDocumentSchema.parse({
    ...capturedPage.inputs.character,
    id: characterId,
    userId,
    intent: {
      ...capturedPage.inputs.character.intent,
      abilities: {
        ...capturedPage.inputs.character.intent.abilities,
        assignments: capturedPage.inputs.character.intent.abilities.assignments.map(
          (assignment) => ({
            ...assignment,
            option: String(abilityScores[assignment.ability] ?? assignment.option)
          })
        )
      },
      classes: [
        {
          ...capturedClass!,
          classId,
          classLevel,
          ...(characterSubclass && { subclassId: characterSubclass.id })
        }
      ],
      hitpoints: {
        ...capturedPage.inputs.character.intent.hitpoints,
        levels: Array.from({ length: classLevel }, (_, index) => ({
          ...capturedLevel!,
          classId,
          classLevel: index + 1,
          level: index + 1,
          value: index === 0 ? capturedLevel!.value : 7
        }))
      }
    },
    state: {
      ...capturedPage.inputs.character.state,
      equipment: {
        ...capturedPage.inputs.character.state.equipment,
        inventory: [...capturedInventory, ...carriedInventory],
        equipped: carriedInventory.reduce<
          { itemId: string; slot: 'MAIN_HAND' | 'OFF_HAND' | 'WORN' }[]
        >(
          (entries, { id }, index) => {
            const item = carried[index]!
            const assignment = nextEquipSlot(
              {
                id,
                category: item.category,
                twoHanded: (item.properties ?? []).includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED)
              },
              entries.flatMap(({ itemId, slot }) =>
                slot === 'WORN' ? [] : [{ id: itemId, slot, twoHanded: false }]
              )
            )
            if ('conflict' in assignment)
              throw new Error(`Carried "${item.label}" cannot be equipped: ${assignment.conflict}.`)
            return [...entries, { itemId: id, slot: assignment.slot }]
          },
          equipped
            ? capturedInventory
                .slice(0, 1)
                .map(({ id }) => ({ itemId: id, slot: 'MAIN_HAND' as const }))
            : capturedPage.inputs.character.state.equipment.equipped
        )
      },
      hitpoints: {
        current: currentHitPoints,
        temp: 0,
        hitDice: [{ die: 10, total: classLevel, used: 0 }],
        deathSaves
      },
      ...(conditions && { conditions }),
      ...(exhaustionLevel && { exhaustion: { level: exhaustionLevel } }),
      ...(spellSlots && { spellSlots: [...spellSlots] }),
      ...(spells && {
        classes: [
          {
            classId,
            spells: { learned: [...spells.learned], prepared: [...spells.prepared] }
          }
        ]
      })
    }
  })
  const play = splitCharacterPlayState({ state: character.state, sheetState }).play
  return characterStoredRowSchema.parse(
    encodeCharacterRecord(
      {
        _id: 'fixture:character',
        _creationTime: Date.parse(updatedAt),
        id: character.id,
        userId: character.userId,
        systemId: character.systemId,
        label: character.label,
        status: 'ACTIVE',
        createdAt: updatedAt,
        updatedAt,
        documentJson: JSON.stringify(character),
        checksum: checksumRuleDocument(character),
        play: {
          _id: 'fixture:character-play',
          _creationTime: Date.parse(updatedAt),
          characterId: character.id,
          userId: character.userId,
          streamVersion: capturedPage.inputs.streamVersion,
          maximumHitPoints,
          speeds: fixtureSpeeds,
          state: play,
          checksum: checksumRuleDocument(play),
          updatedAt
        }
      },
      {
        document: character,
        sheetState: sheetStateFor(characterId, userId, playOverrides),
        streamVersion: capturedPage.inputs.streamVersion,
        updatedAt
      }
    )
  )
}

/**
 * The assigned Character's first room-input part, including its complete private owner capture.
 * The capture can be re-keyed to another Character, owner and Campaign, and given the content
 * manifest and revisions of the room that serves it; the defaults are the capture itself.
 */
export function characterPageFixtureFor({
  characterId = capturedPage.characterId,
  userId = capturedPage.inputs.character.userId,
  campaignId = capturedPage.inputs.campaign.id,
  contentSnapshots = {
    ...capturedPage.contentSnapshots,
    campaign: { ...capturedPage.contentSnapshots.campaign, id: campaignId }
  },
  revisions = capturedRevisions.map((revision) => ({
    ...revision,
    id:
      revision.scope === 'CHARACTER'
        ? characterId
        : revision.scope === 'SYSTEM'
          ? revision.id
          : campaignId
  })),
  play
}: {
  characterId?: string
  userId?: string
  campaignId?: string
  contentSnapshots?: unknown
  revisions?: unknown
  play?: CharacterPlayOverrides
} = {}): unknown {
  return {
    status: capturedPage.status,
    characterId,
    documents: capturedPage.documents,
    contentSnapshots,
    inputs: {
      owner: characterOwnerRowFor({ characterId, userId, play }),
      campaign: { ...capturedPage.inputs.campaign, id: campaignId },
      sheetState: sheetStateFor(characterId, userId, play)
    },
    revisions
  }
}

export const characterPageFixture: unknown = characterPageFixtureFor()
