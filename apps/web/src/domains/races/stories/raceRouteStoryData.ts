import type { AuthoredDraftDto, RaceResponseDto } from '@artificer-toolkit/schema/api/content'
import type { RaceAuthoredDto } from '@artificer-toolkit/schema/subjects/race'
import type { RaceDetailLoaderData } from '#app/routes/-routeLoaderData'

const STORY_USER_ID = 'storybook-user'
const STORY_SYSTEM_ID = 'dnd5e-2014'
const DRAGONBORN_ID = 'srd-race-dragonborn'
const DRAGONBORN_PUBLIC_ID = 'dragonborn'

export const raceRouteStoryUser = {
  id: STORY_USER_ID,
  email: 'author@example.test'
}

const raceStoryReferences = {
  heritages: [
    { value: 'heritage-draconic', label: 'Draconic' },
    { value: 'heritage-elven', label: 'Elven' }
  ],
  races: [
    { value: DRAGONBORN_ID, label: 'Dragonborn' },
    { value: 'srd-race-elf', label: 'Elf' }
  ],
  speeds: [
    { value: 'speed-walk', label: 'Walk' },
    { value: 'speed-fly', label: 'Fly' },
    { value: 'speed-swim', label: 'Swim' }
  ]
} satisfies NonNullable<NonNullable<RaceResponseDto>['meta']>

const seedDerivedDragonbornRace = {
  id: DRAGONBORN_ID,
  label: 'Dragonborn',
  quote: 'Proud dragonkin shaped by clan and ancestry.',
  description:
    '<p>Dragonborn look very much like dragons standing erect in humanoid form, though they lack wings or a tail.</p>',
  status: 'ACTIVE',
  category: 'BASE',
  selectionMode: 'DIRECT',
  heritageIds: ['heritage-draconic'],
  size: 'MEDIUM',
  speeds: [
    {
      speedId: 'speed-walk',
      amount: 30,
      unit: 'FEET'
    }
  ],
  ancestry: {
    id: 'dragonborn-draconic-ancestry',
    label: 'Draconic Ancestry',
    description:
      'Choose one type of dragon as your ancestor. Your breath weapon and damage resistance are determined by that dragon type.',
    options: [
      {
        id: 'dragonborn-ancestry-red',
        label: 'Red',
        description: 'Fire damage in a 15-foot cone.',
        order: 1,
        features: [
          {
            id: 'dragonborn-red-breath-weapon',
            label: 'Breath Weapon',
            description:
              'You can use your action to exhale destructive energy tied to your draconic ancestry.',
            attributes: ['LIMITED_USE'],
            availableAtLevel: 1,
            charges: {
              id: 'dragonborn-red-breath-weapon-charges',
              resetKind: 'SHORT_REST',
              limitKind: 'FIXED_AMOUNT',
              scalingKind: 'NONE',
              amount: 1,
              bonuses: []
            },
            order: 1
          }
        ]
      },
      {
        id: 'dragonborn-ancestry-gold',
        label: 'Gold',
        description: 'Fire damage in a 15-foot cone.',
        order: 2,
        features: []
      },
      {
        id: 'dragonborn-ancestry-blue',
        label: 'Blue',
        description: 'Lightning damage in a 5-by-30-foot line.',
        order: 3,
        features: []
      }
    ]
  },
  details: [
    {
      id: 'dragonborn-detail-age',
      label: 'Age',
      description: 'Young dragonborn grow quickly and live to be around 80.',
      order: 1
    },
    {
      id: 'dragonborn-detail-alignment',
      label: 'Alignment',
      description:
        'Dragonborn tend to extremes, making a conscious choice for one side or the other in cosmic conflicts.',
      order: 2
    },
    {
      id: 'dragonborn-detail-size',
      label: 'Size',
      description:
        'Dragonborn are taller and heavier than humans, standing well over 6 feet tall and averaging almost 250 pounds.',
      order: 3
    }
  ],
  features: [
    {
      id: 'dragonborn-feature-ability-score',
      label: 'Ability Score Increase',
      description: 'Your Strength score increases by 2, and your Charisma score increases by 1.',
      availableAtLevel: 1,
      grants: {
        modifiers: [
          {
            id: 'dragonborn-strength-increase',
            grantKind: 'MODIFIER_GRANT',
            valueDomainCode: 'ABILITY_SCORE',
            domain: { ability: 'STRENGTH' },
            modifierKind: 'BONUS',
            scope: 'GLOBAL',
            selectionKind: 'GRANTED',
            payload: { valueKind: 'FIXED', amount: 2 },
            order: 1
          },
          {
            id: 'dragonborn-charisma-increase',
            grantKind: 'MODIFIER_GRANT',
            valueDomainCode: 'ABILITY_SCORE',
            domain: { ability: 'CHARISMA' },
            modifierKind: 'BONUS',
            scope: 'GLOBAL',
            selectionKind: 'GRANTED',
            payload: { valueKind: 'FIXED', amount: 1 },
            order: 2
          }
        ],
        proficiencies: [
          {
            id: 'dragonborn-language-draconic',
            grantKind: 'PROFICIENCY_GRANT',
            proficiencyKind: 'LANGUAGE',
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            level: 'FULL',
            authoringModeKind: 'SELECTED',
            languageIds: ['language-draconic'],
            order: 3
          }
        ]
      },
      order: 1
    },
    {
      id: 'dragonborn-feature-damage-resistance',
      label: 'Damage Resistance',
      description: 'You have resistance to the damage type associated with your draconic ancestry.',
      availableAtLevel: 1,
      order: 2
    },
    {
      id: 'dragonborn-feature-darkvision',
      label: 'Darkvision Variant',
      description:
        'A story-only variant grant used to inspect sense grant rendering in the authoring form.',
      availableAtLevel: 1,
      grants: {
        senses: [
          {
            id: 'dragonborn-darkvision-sense',
            grantKind: 'SENSE_GRANT',
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            authoringModeKind: 'SELECTED',
            senseIds: ['sense-darkvision'],
            range: {
              id: 'dragonborn-darkvision-range',
              rangeKind: 'DISTANCE',
              amount: 60,
              unit: 'FEET'
            },
            order: 1
          }
        ]
      },
      order: 3
    }
  ],
  userId: STORY_USER_ID,
  systemId: STORY_SYSTEM_ID
} satisfies RaceAuthoredDto

const draftDragonbornRace = {
  ...seedDerivedDragonbornRace,
  status: 'DRAFT'
} satisfies RaceAuthoredDto

const raceStoryDraft = {
  subjectKind: 'RACE',
  subjectId: seedDerivedDragonbornRace.id,
  publicId: DRAGONBORN_PUBLIC_ID,
  userId: STORY_USER_ID,
  systemId: STORY_SYSTEM_ID,
  label: draftDragonbornRace.label,
  description: draftDragonbornRace.description,
  status: 'DRAFT',
  category: draftDragonbornRace.category,
  draftState: 'ACTIVE_WITH_DRAFT',
  baseActiveUpdatedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2024-04-01T12:00:00.000Z',
  updatedAt: '2024-04-01T12:00:00.000Z',
  payload: draftDragonbornRace
} satisfies AuthoredDraftDto

const activeRaceResponse = {
  publicId: DRAGONBORN_PUBLIC_ID,
  activeUpdatedAt: '2026-01-01T00:00:00.000Z',
  hasDraft: true,
  item: seedDerivedDragonbornRace,
  draft: raceStoryDraft,
  meta: raceStoryReferences,
  provenance: {
    kind: 'OWNED',
    ownerUserId: STORY_USER_ID
  },
  permissions: {
    canView: true,
    canEdit: true,
    canCopy: true,
    canDelete: true
  }
} satisfies NonNullable<RaceResponseDto>

const draftRaceResponse = {
  ...activeRaceResponse,
  item: draftDragonbornRace
} satisfies NonNullable<RaceResponseDto>

export const activeRaceDetailLoaderData = {
  breadcrumbLabel: seedDerivedDragonbornRace.label,
  draft: raceStoryDraft,
  raceId: seedDerivedDragonbornRace.id,
  response: activeRaceResponse,
  view: 'active'
} satisfies RaceDetailLoaderData

export const draftRaceDetailLoaderData = {
  breadcrumbLabel: draftDragonbornRace.label,
  draft: raceStoryDraft,
  raceId: seedDerivedDragonbornRace.id,
  response: draftRaceResponse,
  view: 'draft'
} satisfies RaceDetailLoaderData
