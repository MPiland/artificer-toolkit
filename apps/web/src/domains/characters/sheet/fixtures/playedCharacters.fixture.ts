import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  previewFixtureRest,
  readyFighterFixture
} from '@artificer-toolkit/rules-runtime/testing/characterContextFixtures'
import { buildCharacterSheetPanel } from '@artificer-toolkit/rules-runtime/character/sheetPanel'
import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import {
  characterRestPreviewResponseDtoSchema,
  type CharacterRestPreviewRequestDto,
  type CharacterRestPreviewResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import {
  characterSheetResponseDtoSchema,
  type CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import { toCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { srdCreatures } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { rogue } from '@artificer-toolkit/source-data/srd/classes/rogue.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'

const srdWolf = srdCreatures.find((creature) => creature.label === 'Wolf')
if (!srdWolf) throw new Error('Expected the SRD Wolf.')
const wolf = srdWolf
if (rogue.category !== 'BASE') throw new Error('Expected the canonical parent Rogue class.')

/**
 * Plays a ready Character through the real Builder and Sheet projection: a carried Longsword and
 * Backpack, a companion Wolf, 10 hit points below its maximum plus 3 temporary hit points, and a
 * spent Second Wind.
 */
async function playCharacter(
  fixture: Parameters<typeof prepareFixtureBuilder>[0],
  adjustments?: CharacterSheetState['adjustments']
) {
  const { character: built } = await prepareFixtureBuilder(fixture)
  const playedInput = {
    streamVersion: 4,
    adjustments,
    character: {
      ...built,
      state: {
        ...built.state,
        equipment: {
          ...built.state.equipment,
          inventory: [
            { id: crypto.randomUUID(), equipmentId: longsword.id, quantity: 1 },
            { id: crypto.randomUUID(), equipmentId: backpack.id, quantity: 1 }
          ]
        },
        hitpoints: { ...built.state.hitpoints, current: 10, temp: 3 },
        creatures: [
          {
            id: crypto.randomUUID(),
            creatureId: wolf.id,
            relationshipKind: 'COMPANION' as const,
            originKind: 'WORLD' as const,
            hitDice: [{ die: 8, total: 2, used: 1 }]
          }
        ]
      }
    },
    documents: { ...fixture.documents, EQUIPMENT: [longsword, backpack], CREATURE: [wolf] }
  }
  const secondWind = (await prepareFixtureSheet(playedInput)).sheet.resources.items[0]
  if (!secondWind) throw new Error('Expected the Second Wind Resource on the Sheet.')
  const played = await prepareFixtureSheet({
    ...playedInput,
    resourceUsage: [{ owner: toCharacterResourceOwnerKey(secondWind.owner), used: 1 }]
  })
  const sheet = characterSheetResponseDtoSchema.parse(played.sheet)

  return {
    createSheet: (): CharacterSheetResponseDto => structuredClone(sheet),
    /** The real Movement panel, built from the same rule evaluation as the Sheet. */
    createMovementPanel: (): CharacterSheetPanelDto =>
      buildCharacterSheetPanel({
        character: played.prepared.character,
        resolution: played.prepared.resolution,
        sheet,
        ruleProjection: played.ruleProjection,
        knownSpellEligibleIdsByClass: new Map(),
        adjustments: played.adjustments,
        movementDisplayPreference: played.sheetState.movementDisplayPreference,
        target: { kind: 'MOVEMENT' },
        editable: true
      }),
    /** The real rest preview, parsed through the transport schema. */
    createRestPreview: async (
      request: CharacterRestPreviewRequestDto
    ): Promise<CharacterRestPreviewResponseDto> =>
      characterRestPreviewResponseDtoSchema.parse(await previewFixtureRest(played, request))
  }
}

const fighterFixture = readyFighterFixture({ resourceLabel: 'Second Wind' })

/** The played level 1 Fighter: 10 of 11 hit points, 3 temporary hit points and a spent Second Wind. */
export const { createSheet, createMovementPanel, createRestPreview } =
  await playCharacter(fighterFixture)

const [fighterClass] = fighterFixture.documents.CLASS
if (!fighterClass) throw new Error('Expected the ready Fighter class.')
const multiclassFighter = fighterFixture.character
const multiclassCharacter = {
  ...multiclassFighter,
  id: crypto.randomUUID(),
  label: 'Rook',
  intent: {
    ...multiclassFighter.intent,
    classes: [
      { classId: fighterClass.id, classLevel: 2 },
      { classId: rogue.id, classLevel: 1 }
    ],
    hitpoints: {
      method: 'FIXED' as const,
      levels: [
        { level: 1, classId: fighterClass.id, classLevel: 1, value: 10 },
        { level: 2, classId: fighterClass.id, classLevel: 2, value: 6 },
        { level: 3, classId: rogue.id, classLevel: 1, value: 5 }
      ]
    }
  }
}
const timestamp = new Date(0).toISOString()

/**
 * The played Fighter 2 / Rogue 1 with a manual maximum hit point modifier of -2, so the rest dialog
 * offers mixed hit dice and the Max HP adjustment.
 */
export const {
  createSheet: createMulticlassSheet,
  createRestPreview: createMulticlassRestPreview
} = await playCharacter(
  {
    character: multiclassCharacter,
    documents: {
      ...fighterFixture.documents,
      CLASS: [
        fighterClass,
        {
          ...structuredClone(rogue),
          features: [],
          proficiencies: [],
          startingEquipment: { id: crypto.randomUUID(), sets: [] },
          multiclass: rogue.multiclass && { ...rogue.multiclass, proficiencies: [] }
        }
      ]
    }
  },
  [
    {
      id: crypto.randomUUID(),
      characterId: multiclassCharacter.id,
      family: 'HIT_POINTS',
      field: 'MAXIMUM_MODIFIER',
      value: -2,
      createdBy: multiclassCharacter.userId,
      updatedBy: multiclassCharacter.userId,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ]
)
