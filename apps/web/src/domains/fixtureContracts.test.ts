import { describe, it } from 'vitest'
import { campaignDetailDtoSchema } from '@artificer-toolkit/schema/api/campaignCore'
import {
  characterBuilderPayloadDtoSchema,
  characterBuilderPreviewPayloadDtoSchema,
  characterListResponseDtoSchema
} from '@artificer-toolkit/schema/api/characterBuilder'
import { characterSheetResponseDtoSchema } from '@artificer-toolkit/schema/api/characterSheetData'
import {
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema
} from '@artificer-toolkit/schema/api/encounterData'
import { signedVttMapDeliveryDtoSchema } from '@artificer-toolkit/schema/api/media'
import {
  campaignSceneStateDtoSchema,
  sceneDefinitionDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'
import { authoredDraftDtoSchema } from '@artificer-toolkit/schema/api/authoredDrafts'
import { characterSheetPanelDtoSchema } from '@artificer-toolkit/schema/api/characterSheetPanel'
import {
  backgroundListResponseDtoSchema,
  backgroundResponseDtoSchema,
  classListResponseDtoSchema,
  classResponseDtoSchema,
  creatureListResponseDtoSchema,
  creatureResponseDtoSchema,
  equipmentListResponseDtoSchema,
  equipmentResponseDtoSchema,
  featListResponseDtoSchema,
  featResponseDtoSchema,
  raceListResponseDtoSchema,
  raceResponseDtoSchema,
  spellResponseDtoSchema,
  vehicleListResponseDtoSchema,
  vehicleResponseDtoSchema
} from '@artificer-toolkit/schema/api/content'
import {
  nodeRuntimeNodeDtoSchema,
  nodeRuntimeResolveResponseDtoSchema
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { reusableDefinitionWorkspaceDtoSchema } from '@artificer-toolkit/schema/api/reusableDefinitions'
import {
  systemListResponseDtoSchema,
  systemResponseDtoSchema
} from '@artificer-toolkit/schema/api/systems'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import {
  authoredRouteStoryDrafts,
  authoredRouteStoryEquipmentParentResponse,
  authoredRouteStoryMasterResponses,
  authoredRouteStoryResponses,
  authoredRouteStorySystem,
  authoredRouteStorySystems
} from './authoredRouteStory.fixtures'
import {
  createRuntimeGroupNode,
  createRuntimeInputNode,
  createRuntimeSelectNode
} from './authoredRouteRuntime.fixtures'
import {
  masterBackgroundFixture,
  masterBackgroundResponseFixture,
  ownedBackgroundFixture,
  ownedBackgroundResponseFixture,
  backgroundListResponseFixture
} from './backgrounds/background.fixtures'
import {
  classListFixture,
  classRuntimeFixture,
  createClassRuntimeFixture,
  masterSubclassResponseFixture,
  ownedClassResponseFixture
} from './classes/class.fixtures'
import {
  beastMountFixture,
  companionFixture,
  creatureListResponseFixture,
  creatureRuntimeFixture,
  masterCreatureResponseFixture,
  npcFixture,
  ownedCreatureResponseFixture,
  ownedMonsterFixture,
  summonFixture
} from './creatures/creature.fixtures'
import {
  equipmentListResponseFixture,
  equipmentRuntimeFixture,
  masterEquipmentFixture,
  masterEquipmentResponseFixture,
  ownedEquipmentFixture,
  ownedEquipmentResponseFixture,
  ownedVariantEquipmentFixture,
  ownedVariantEquipmentResponseFixture,
  systemListFixture
} from './equipment/equipment.fixtures'
import {
  featListResponseFixture,
  masterFeatFixture,
  masterFeatResponseFixture,
  ownedFeatFixture,
  ownedFeatResponseFixture
} from './feats/feat.fixtures'
import {
  masterRaceFixture,
  masterRaceResponseFixture,
  ownedBaseRaceFixture,
  ownedBaseRaceResponseFixture,
  ownedSubraceFixture,
  ownedSubraceResponseFixture,
  raceListResponseFixture,
  raceRuntimeFixture
} from './races/race.fixtures'
import {
  activeRaceDetailLoaderData,
  draftRaceDetailLoaderData
} from './races/stories/raceRouteStoryData'
import { spellFixture } from './spells/spellAuthoring.fixtures'
import {
  createDefinitionWorkspace,
  withDefinitionDraft,
  withDefinitionPublication
} from './systems/SystemDefinitionWorkspace.fixtures'
import {
  masterVehicleResponseFixture,
  ownedVehicleResponseFixture,
  vehicleListFixture,
  vehicleRuntimeFixture
} from './vehicles/vehicle.fixtures'
import * as inspectorFixtures from './characters/sheet/inspector/inspector.fixtures'
import {
  characterBuilderDraftPayloadFixture,
  characterBuilderPayloadFixture,
  characterFixture,
  characterPreviewFixture
} from './characters/builder/fixtures/characterBuilder.fixtures'
import { characterListFixture } from './characters/pages/list/characterList.fixtures'
import { astralTearCharacterSheetFixture } from './characters/sheet/fixtures/astralTearSheet.fixtures'
import { characterSheetMulticlassFixture } from './characters/sheet/fixtures/characterRest.fixtures'
import { characterSheetSpellStatesFixture } from './characters/sheet/fixtures/characterSpell.fixtures'
import {
  createTabletopCampaign,
  tabletopGmEncounter,
  tabletopLiveScene,
  tabletopMapDelivery,
  tabletopPlayerEncounter,
  tabletopSceneDefinition
} from './campaigns/vtt/CampaignTabletop.stories.fixtures'

const backgroundResponses = [ownedBackgroundResponseFixture, masterBackgroundResponseFixture]
const classResponses = [ownedClassResponseFixture, masterSubclassResponseFixture]
const creatureResponses = [ownedCreatureResponseFixture, masterCreatureResponseFixture]
const equipmentResponses = [
  ownedEquipmentResponseFixture,
  ownedVariantEquipmentResponseFixture,
  masterEquipmentResponseFixture
]
const featResponses = [ownedFeatResponseFixture, masterFeatResponseFixture]
const raceResponses = [
  ownedBaseRaceResponseFixture,
  ownedSubraceResponseFixture,
  masterRaceResponseFixture
]
const vehicleResponses = [ownedVehicleResponseFixture, masterVehicleResponseFixture]
const inspectorPanels = Object.values(inspectorFixtures)

// Every fixture that stands in for an apps/apis response must satisfy the shared DTO schema, so
// a contract change fails here instead of silently leaving tests and stories on a stale shape.
describe('web fixture contracts', () => {
  it.each([
    ['Sheet: multiclass', characterSheetMulticlassFixture],
    ['Sheet: spell states', characterSheetSpellStatesFixture],
    ['Sheet: Astral Tear', astralTearCharacterSheetFixture]
  ])('parses the %s Sheet fixture', (_name, fixture) => {
    characterSheetResponseDtoSchema.parse(fixture)
  })

  it('parses the Builder fixtures', () => {
    characterAuthoredDtoSchema.parse(characterFixture)
    characterBuilderPayloadDtoSchema.parse(characterBuilderPayloadFixture)
    characterBuilderPayloadDtoSchema.parse(characterBuilderDraftPayloadFixture)
    characterBuilderPreviewPayloadDtoSchema.parse(characterPreviewFixture)
  })

  it('parses the Character list fixture', () => {
    characterListResponseDtoSchema.parse(characterListFixture)
  })

  it('parses the authored response and list fixtures', () => {
    for (const response of backgroundResponses) backgroundResponseDtoSchema.parse(response)
    for (const response of classResponses) classResponseDtoSchema.parse(response)
    for (const response of creatureResponses) creatureResponseDtoSchema.parse(response)
    for (const response of equipmentResponses) equipmentResponseDtoSchema.parse(response)
    for (const response of featResponses) featResponseDtoSchema.parse(response)
    for (const response of raceResponses) raceResponseDtoSchema.parse(response)
    for (const response of vehicleResponses) vehicleResponseDtoSchema.parse(response)
    backgroundListResponseDtoSchema.parse(backgroundListResponseFixture)
    classListResponseDtoSchema.parse(classListFixture)
    creatureListResponseDtoSchema.parse(creatureListResponseFixture)
    equipmentListResponseDtoSchema.parse(equipmentListResponseFixture)
    featListResponseDtoSchema.parse(featListResponseFixture)
    raceListResponseDtoSchema.parse(raceListResponseFixture)
    vehicleListResponseDtoSchema.parse(vehicleListFixture)
  })

  it('parses the authored runtime fixtures', () => {
    for (const runtime of [
      classRuntimeFixture,
      createClassRuntimeFixture('SUBCLASS'),
      raceRuntimeFixture,
      equipmentRuntimeFixture,
      creatureRuntimeFixture,
      vehicleRuntimeFixture
    ])
      nodeRuntimeResolveResponseDtoSchema.parse(runtime)
  })

  it('parses the authored route runtime node factories', () => {
    for (const node of [
      createRuntimeInputNode('name', ['name'], 'Name', 'TEXT', true),
      createRuntimeSelectNode('kind', ['kind'], 'Kind', [{ value: 'a', label: 'A' }]),
      createRuntimeGroupNode('items', ['items'], 'Items', 'ARRAY', 'item-map'),
      createRuntimeGroupNode('detail', ['detail'], 'Detail', 'OBJECT', 'detail-map')
    ])
      nodeRuntimeNodeDtoSchema.parse(node)
  })

  it('parses the authored Subject fixtures', () => {
    for (const equipment of [
      ownedEquipmentFixture,
      ownedVariantEquipmentFixture,
      masterEquipmentFixture
    ])
      equipmentAuthoredDtoSchema.parse(equipment)
    for (const creature of [
      ownedMonsterFixture,
      beastMountFixture,
      npcFixture,
      companionFixture,
      summonFixture
    ])
      creatureAuthoredDtoSchema.parse(creature)
    for (const race of [ownedBaseRaceFixture, ownedSubraceFixture, masterRaceFixture])
      raceAuthoredDtoSchema.parse(race)
    for (const background of [ownedBackgroundFixture, masterBackgroundFixture])
      backgroundAuthoredDtoSchema.parse(background)
    for (const classResponse of classResponses) classAuthoredDtoSchema.parse(classResponse.item)
    for (const feat of [ownedFeatFixture, masterFeatFixture]) featAuthoredDtoSchema.parse(feat)
    spellAuthoredDtoSchema.parse(spellFixture)
    systemListResponseDtoSchema.parse(systemListFixture)
  })

  it('parses the authored route Story fixtures', () => {
    systemListResponseDtoSchema.parse(authoredRouteStorySystems)
    systemResponseDtoSchema.parse(authoredRouteStorySystem)
    const schemas = {
      background: backgroundResponseDtoSchema,
      class: classResponseDtoSchema,
      creature: creatureResponseDtoSchema,
      equipment: equipmentResponseDtoSchema,
      feat: featResponseDtoSchema,
      race: raceResponseDtoSchema,
      spell: spellResponseDtoSchema,
      vehicle: vehicleResponseDtoSchema
    }
    for (const domain of Object.keys(schemas) as (keyof typeof schemas)[]) {
      schemas[domain].parse(authoredRouteStoryResponses[domain])
      schemas[domain].parse(authoredRouteStoryMasterResponses[domain])
      authoredDraftDtoSchema.parse(authoredRouteStoryDrafts[domain])
    }
    equipmentResponseDtoSchema.parse(authoredRouteStoryEquipmentParentResponse)
  })

  it('parses the Race route Story data', () => {
    for (const loaderData of [activeRaceDetailLoaderData, draftRaceDetailLoaderData]) {
      raceResponseDtoSchema.parse(loaderData.response)
      authoredDraftDtoSchema.parse(loaderData.draft)
    }
  })

  it('parses the Sheet inspector panel fixtures', () => {
    for (const panel of inspectorPanels) characterSheetPanelDtoSchema.parse(panel)
  })

  it('parses the reusable definition workspace fixtures', () => {
    const drafted = withDefinitionDraft(createDefinitionWorkspace())
    for (const fixture of [drafted, withDefinitionPublication(drafted)])
      reusableDefinitionWorkspaceDtoSchema.parse(fixture)
  })

  it('parses the tabletop fixtures', () => {
    campaignDetailDtoSchema.parse(createTabletopCampaign('OWNER'))
    campaignDetailDtoSchema.parse(createTabletopCampaign('PLAYER'))
    sceneDefinitionDtoSchema.parse(tabletopSceneDefinition)
    campaignSceneStateDtoSchema.parse(tabletopLiveScene)
    signedVttMapDeliveryDtoSchema.parse(tabletopMapDelivery)
    encounterPlayerProjectionDtoSchema.parse(tabletopPlayerEncounter)
    encounterGmProjectionDtoSchema.parse(tabletopGmEncounter)
  })
})
