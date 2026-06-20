import type {
  BackgroundResponseDto,
  ClassResponseDto,
  CreatureResponseDto,
  EquipmentResponseDto,
  FeatResponseDto,
  RaceResponseDto,
  SpellResponseDto,
  VehicleResponseDto
} from '@artificer-toolkit/schema/api/content'
import type { SystemListResponseDto } from '@artificer-toolkit/schema/api/systems'
import type { BackgroundAuthoredDto } from '@artificer-toolkit/schema/subjects/background'
import type { ClassAuthoredDto } from '@artificer-toolkit/schema/subjects/class'
import type { CreatureAuthoredDto } from '@artificer-toolkit/schema/subjects/creature'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { FeatAuthoredDto } from '@artificer-toolkit/schema/subjects/feat'
import type { RaceAuthoredDto } from '@artificer-toolkit/schema/subjects/race'
import type { SpellAuthoredDto } from '@artificer-toolkit/schema/subjects/spell'
import type { VehicleAuthoredDto } from '@artificer-toolkit/schema/subjects/vehicle'
import type {
  BackgroundEditLoaderData,
  ClassEditLoaderData,
  CreatureEditLoaderData,
  EquipmentEditLoaderData,
  FeatEditLoaderData,
  RaceEditLoaderData,
  SpellEditLoaderData,
  VehicleEditLoaderData
} from '#app/routes/-routeLoaderData'
import { createAuthoredFormRouteLoaderData } from '#forms/layout/authoredFormRouteContext'
import type { AuthoredFormDomain } from '#forms/factories/authoredFormFactories.types'

export const seedStoryUserId = '00000000-0000-0000-0000-000000000000'
export const seedStorySystemId = '00000000-0000-0000-0000-000000000001'

export const authoredRouteStoryUser = {
  id: 'story-author',
  email: 'author@example.test'
}

export const authoredRouteStorySystems = [
  {
    id: seedStorySystemId,
    label: 'D&D 5e SRD',
    description: 'Seed-derived SRD system used for authoring route stories.',
    userId: seedStoryUserId
  }
] satisfies SystemListResponseDto

export const authoredCreateRouteLoaderData = createAuthoredFormRouteLoaderData({
  systems: authoredRouteStorySystems
})

export const seedAcolyteBackground = {
  kind: 'BACKGROUND',
  id: '00000000-0000-0000-0040-000100000000',
  label: 'Acolyte',
  description:
    '<p>You have spent your life in the service of a temple to a specific god or pantheon of gods.</p>',
  status: 'ACTIVE',
  proficiencies: [],
  features: [
    {
      id: '00000000-0000-0000-8040-010201000000',
      label: 'Shelter of the Faithful',
      description:
        '<p>As an acolyte, you command the respect of those who share your faith and can perform religious ceremonies.</p>',
      order: 0
    }
  ],
  details: [
    {
      id: '00000000-0000-0000-8040-010401000000',
      label: 'Personality Trait 1',
      description:
        "I idolize a particular hero of my faith, and constantly refer to that person's deeds and example.",
      order: 0
    }
  ],
  userId: seedStoryUserId,
  systemId: seedStorySystemId
} satisfies BackgroundAuthoredDto

export const seedWizardClass = {
  id: '00000000-0000-0000-0010-000c00000000',
  label: 'Wizard',
  category: 'BASE',
  attributes: ['SPELLCASTER'],
  description: 'A scholarly magic-user capable of manipulating the structures of reality.',
  status: 'ACTIVE',
  details: [],
  proficiencies: [],
  features: [
    {
      id: '00000000-0000-0000-c00c-010100000000',
      label: 'Spellcasting',
      description:
        '<p>As a student of arcane magic, you have a spellbook containing spells that show the first glimmerings of your true power.</p>',
      order: 1
    }
  ],
  hitpoint: {
    ability: 'CONSTITUTION',
    dieConfig: 'd6'
  },
  startingGold: {
    multiplier: 10,
    currencyId: '00000000-0000-0000-0003-000400000000',
    dieConfig: '4d4'
  },
  startingEquipment: {
    id: '00000000-0000-0000-c00c-620100000000',
    sets: []
  },
  multiclass: {
    id: '00000000-0000-0000-c00c-630100000000',
    requirementGroups: { groups: [] },
    proficiencies: []
  },
  userId: seedStoryUserId,
  systemId: seedStorySystemId
} satisfies ClassAuthoredDto

export const seedAcolyteCreature = {
  id: '00000000-0000-0000-0070-000200000000',
  label: 'Acolyte',
  userId: seedStoryUserId,
  systemId: seedStorySystemId,
  status: 'ACTIVE',
  recordKind: 'STAT_BLOCK',
  category: 'NPC',
  creatureTypeId: '00000000-0000-0000-000f-000a00000000',
  size: 'MEDIUM',
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 10,
    CONSTITUTION: 10,
    INTELLIGENCE: 10,
    WISDOM: 14,
    CHARISMA: 11,
    SPELLCASTING: 0
  },
  armorClass: 10,
  hitPoints: 9,
  hitDice: '2d8',
  speeds: [
    {
      speedId: '00000000-0000-0000-000c-000100000000',
      amount: 30,
      unit: 'FEET'
    }
  ],
  proficiencies: [],
  passivePerception: 12,
  challengeRatingId: '00000000-0000-0000-000e-000300000000',
  xp: 50,
  features: [
    {
      id: '00000000-0000-0000-0070-000200010000',
      label: 'Spellcasting',
      description:
        'The acolyte is a 1st-level spellcaster. Its spellcasting ability is Wisdom.',
      order: 1
    }
  ]
} satisfies CreatureAuthoredDto

export const seedLongswordEquipment = {
  kind: 'EQUIPMENT',
  id: '00000000-0000-0000-0060-001600000000',
  label: 'Longsword',
  description: 'A versatile sword usable one- or two-handed.',
  category: 'WEAPON',
  properties: ['MARTIAL', 'MELEE', 'VERSATILE'],
  modifiers: [],
  effects: [],
  cost: {
    amount: 15,
    currencyId: '00000000-0000-0000-0003-000400000000'
  },
  weight: {
    amount: 3,
    unit: 'POUNDS'
  },
  rarityId: '00000000-0000-0000-0009-000100000000',
  status: 'ACTIVE',
  userId: seedStoryUserId,
  systemId: seedStorySystemId
} satisfies EquipmentAuthoredDto

export const seedGrapplerFeat = {
  id: '00000000-0000-0000-0050-000b00000000',
  label: 'Grappler',
  description:
    "You've developed the skills necessary to hold your own in close-quarters grappling. Prerequisite: Strength 13 or higher.",
  details: [],
  features: [
    {
      id: '00000000-0000-0000-0050-110100000000',
      label: 'Advantage on Grappled Target',
      description: 'You have advantage on attack rolls against a creature you are grappling.',
      order: 0
    },
    {
      id: '00000000-0000-0000-0050-110200000000',
      label: 'Pin',
      description: 'You can use your action to try to pin a creature grappled by you.',
      order: 1
    }
  ],
  status: 'ACTIVE',
  effects: [],
  userId: seedStoryUserId,
  systemId: seedStorySystemId
} satisfies FeatAuthoredDto

export const seedDragonbornRace = {
  id: '00000000-0000-0000-0030-000500000000',
  label: 'Dragonborn',
  quote: 'Proud dragonkin shaped by clan and ancestry.',
  description:
    '<p>Dragonborn look very much like dragons standing erect in humanoid form, though they lack wings or a tail.</p>',
  status: 'ACTIVE',
  category: 'BASE',
  selectionMode: 'DIRECT',
  heritageIds: [],
  size: 'MEDIUM',
  speeds: [
    {
      speedId: '00000000-0000-0000-000c-000100000000',
      amount: 30,
      unit: 'FEET'
    }
  ],
  details: [
    {
      id: 'dragonborn-detail-size',
      label: 'Size',
      description:
        'Dragonborn are taller and heavier than humans, standing well over 6 feet tall.',
      order: 3
    }
  ],
  features: [
    {
      id: 'dragonborn-feature-ability-score',
      label: 'Ability Score Increase',
      description: 'Your Strength score increases by 2, and your Charisma score increases by 1.',
      order: 1
    }
  ],
  userId: seedStoryUserId,
  systemId: seedStorySystemId
} satisfies RaceAuthoredDto

export const seedFireballSpell = {
  kind: 'SPELL',
  id: '00000000-0000-0000-0020-007c00000000',
  label: 'Fireball',
  description:
    '<p>A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.</p>',
  castingTime: {
    unit: 'ROUND',
    amount: 1
  },
  level: 3,
  classIds: [
    '00000000-0000-0000-0010-000a00000000',
    '00000000-0000-0000-0010-000c00000000'
  ],
  components: ['VERBAL', 'SOMATIC', 'MATERIAL'],
  materialDescription: 'a tiny ball of bat guano and sulfur',
  magicSchoolId: '00000000-0000-0000-0007-000500000000',
  effects: [],
  status: 'ACTIVE',
  userId: seedStoryUserId,
  systemId: seedStorySystemId
} satisfies SpellAuthoredDto

export const seedSailingShipVehicle = {
  id: '00000000-0000-0000-0080-000500000000',
  label: 'Sailing Ship',
  description: 'A large ocean-going vessel powered by wind, suitable for long voyages and heavy cargo.',
  status: 'ACTIVE',
  userId: seedStoryUserId,
  systemId: seedStorySystemId,
  category: 'WATER',
  armorClass: 15,
  hitPoints: 300,
  speed: 2,
  speedNote: '2 mph',
  crewMin: 20,
  crewMax: 20,
  passengerCapacity: 20,
  cargoCapacity: '100 tons',
  cost: {
    amount: 10000,
    currencyId: '00000000-0000-0000-0003-000400000000'
  },
  properties: []
} satisfies VehicleAuthoredDto

export const authoredRouteStoryRecords = {
  background: seedAcolyteBackground,
  class: seedWizardClass,
  creature: seedAcolyteCreature,
  equipment: seedLongswordEquipment,
  feat: seedGrapplerFeat,
  race: seedDragonbornRace,
  spell: seedFireballSpell,
  vehicle: seedSailingShipVehicle
} satisfies AuthoredRouteStoryRecordMap

export const authoredRouteStoryResponses = {
  background: createResponse(seedAcolyteBackground),
  class: createResponse(seedWizardClass),
  creature: createResponse(seedAcolyteCreature),
  equipment: createResponse(seedLongswordEquipment),
  feat: createResponse(seedGrapplerFeat),
  race: createResponse(seedDragonbornRace),
  spell: createResponse(seedFireballSpell),
  vehicle: createResponse(seedSailingShipVehicle)
} satisfies AuthoredRouteStoryResponseMap

export const authoredEditRouteLoaderData = {
  background: createEditLoaderData('background'),
  class: createEditLoaderData('class'),
  creature: createEditLoaderData('creature'),
  equipment: createEditLoaderData('equipment'),
  feat: createEditLoaderData('feat'),
  race: createEditLoaderData('race'),
  spell: createEditLoaderData('spell'),
  vehicle: createEditLoaderData('vehicle')
} satisfies {
  background: BackgroundEditLoaderData
  class: ClassEditLoaderData
  creature: CreatureEditLoaderData
  equipment: EquipmentEditLoaderData
  feat: FeatEditLoaderData
  race: RaceEditLoaderData
  spell: SpellEditLoaderData
  vehicle: VehicleEditLoaderData
}

export const authoredRouteStoryParams = {
  background: {
    backgroundPublicId: 'acolyte',
    backgroundSlug: 'acolyte'
  },
  class: {
    classPublicId: 'wizard',
    classSlug: 'wizard'
  },
  creature: {
    creaturePublicId: 'acolyte',
    creatureSlug: 'acolyte'
  },
  equipment: {
    equipmentPublicId: 'longsword',
    equipmentSlug: 'longsword'
  },
  feat: {
    featPublicId: 'grappler',
    featSlug: 'grappler'
  },
  race: {
    racePublicId: 'dragonborn',
    raceSlug: 'dragonborn'
  },
  spell: {
    spellPublicId: 'fireball',
    spellSlug: 'fireball'
  },
  vehicle: {
    vehiclePublicId: 'sailing-ship',
    vehicleSlug: 'sailing-ship'
  }
} as const

export type AuthoredRouteStoryRecordMap = {
  background: BackgroundAuthoredDto
  class: ClassAuthoredDto
  creature: CreatureAuthoredDto
  equipment: EquipmentAuthoredDto
  feat: FeatAuthoredDto
  race: RaceAuthoredDto
  spell: SpellAuthoredDto
  vehicle: VehicleAuthoredDto
}

type AuthoredRouteStoryResponseMap = {
  background: NonNullable<BackgroundResponseDto>
  class: NonNullable<ClassResponseDto>
  creature: NonNullable<CreatureResponseDto>
  equipment: NonNullable<EquipmentResponseDto>
  feat: NonNullable<FeatResponseDto>
  race: NonNullable<RaceResponseDto>
  spell: NonNullable<SpellResponseDto>
  vehicle: NonNullable<VehicleResponseDto>
}

type AuthoredRouteStoryRecord = AuthoredRouteStoryRecordMap[AuthoredFormDomain]

function createResponse<TRecord extends AuthoredRouteStoryRecord>(record: TRecord) {
  return {
    publicId: record.label.toLowerCase().replaceAll(' ', '-'),
    item: record,
    provenance: {
      kind: 'MASTER' as const,
      ownerUserId: null
    },
    permissions: {
      canView: true,
      canEdit: true,
      canCopy: true,
      canDelete: true
    }
  }
}

function createEditLoaderData<TDomain extends AuthoredFormDomain>(domain: TDomain) {
  const response = authoredRouteStoryResponses[domain]

  return createAuthoredFormRouteLoaderData({
    breadcrumbLabel: response.item.label,
    draft: null,
    response,
    subjectId: response.item.id
  })
}
