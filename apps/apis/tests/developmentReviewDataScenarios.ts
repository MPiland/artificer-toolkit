import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import type { AuthoredSubjectKind } from '@artificer-toolkit/schema/projections/identity'
import type { SceneDefinitionDto } from '@artificer-toolkit/schema/api/vttScenes'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import { dragonborn } from '@artificer-toolkit/source-data/srd/races/dragonborn.js'
import { acolyte as acolyteCreature } from '@artificer-toolkit/source-data/srd/creatures/acolyte.js'
import { goblin } from '@artificer-toolkit/source-data/srd/creatures/goblin.js'
import { ogre } from '@artificer-toolkit/source-data/srd/creatures/ogre.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { SRD_DND5E_SPEED_FACTOR_INITIATIVE_POLICY_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/initiativePolicies.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { holdPerson } from '@artificer-toolkit/source-data/srd/spells/hold-person.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { thunderwave } from '@artificer-toolkit/source-data/srd/spells/thunderwave.js'
import { sailingShip } from '@artificer-toolkit/source-data/srd/vehicles/sailing-ship.js'
import * as Equipment from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import { shortswordPlus1 } from '@artificer-toolkit/source-data/srd/equipment/shortsword-plus-1.js'
import type { BaseEquipmentAuthoringInputDto } from '@artificer-toolkit/schema/subjects/equipment'

/**
 * Local-only review accounts. The seeded backend is the user's own Docker container, so these fixed
 * credentials guard nothing: they exist so a re-run signs in to the accounts a previous run made.
 */
export const REVIEW_PASSWORD = 'Review_Local_1!pass'

export type ReviewAccountSpec = { key: string; username: string; email?: string }

export const REVIEW_GM: ReviewAccountSpec = { key: 'gm', username: 'Review_Gm_Rowan' }
export const REVIEW_PLAYERS: readonly ReviewAccountSpec[] = [
  { key: 'player1', username: 'Review_Pl_Aria' },
  { key: 'player2', username: 'Review_Pl_Bryn' },
  { key: 'player3', username: 'Review_Pl_Cade' }
]
/** Promoted to superadmin; joins no Campaign. */
export const REVIEW_ADMIN: ReviewAccountSpec = { key: 'admin', username: 'Review_Admin_Sol' }
/** Players outside every Campaign: strangers to apply to listings, fresh free-tier accounts, accounts to delete. */
export const REVIEW_SPARES: readonly ReviewAccountSpec[] = [
  { key: 'spare1', username: 'Review_Pl_Dara' },
  { key: 'spare2', username: 'Review_Pl_Eli' }
]
/**
 * The account Storybook backend stories sign in as (D221). Its email is spelled out because the
 * Storybook preview signs in with it.
 */
export const REVIEW_STORY_READER = {
  key: 'storyReader',
  username: 'Review_Story_Reader',
  email: 'review_story_reader@example.invalid'
} satisfies ReviewAccountSpec
/** Hosts the player Campaign the story reader joins; a separate account because the FREE tier hosts one Campaign. */
export const REVIEW_STORY_HOST = {
  key: 'storyHost',
  username: 'Review_Story_Host'
} satisfies ReviewAccountSpec

/** An owned record the story account copies from master content, at a fixed id its stories open. */
export type StoryRecordSpec = { subjectId: string; label: string }

/**
 * The owned records Storybook backend stories edit, per authored domain (D221). The story account
 * copies `masterId` into `ownedActive`, which it activates, and into `ownedDraft`, which it activates
 * and then edits again, so the draft waits on top of the active record.
 */
export const STORY_RECORDS = {
  background: {
    subjectKind: 'BACKGROUND',
    masterId: acolyte.id,
    ownedActive: { subjectId: '3f1c2d8e-5a47-4b19-8c02-6d1e0a7b9c41', label: 'Story Acolyte' },
    ownedDraft: { subjectId: '7a90e4b2-1c6d-4f38-9e15-2b8c4d7a0f63', label: 'Story Acolyte Draft' }
  },
  class: {
    subjectKind: 'CLASS',
    masterId: wizard.id,
    ownedActive: { subjectId: 'e27f03fd-6fb4-41fb-bb51-c52fa2c776a4', label: 'Story Wizard' },
    ownedDraft: { subjectId: 'f0920561-d812-474c-b6a9-3a777e4c77e7', label: 'Story Wizard Draft' }
  },
  creature: {
    subjectKind: 'CREATURE',
    masterId: acolyteCreature.id,
    ownedActive: { subjectId: '8a16ced6-023e-4453-93ff-948002be887e', label: 'Story Priest' },
    ownedDraft: { subjectId: '42aef54a-a60f-46e9-a5c3-cd6540f7b628', label: 'Story Priest Draft' }
  },
  equipment: {
    subjectKind: 'EQUIPMENT',
    masterId: shortswordPlus1.id,
    ownedActive: {
      subjectId: '449a42f5-21ab-4c40-a4c7-91f7a83917e4',
      label: 'Story Shortsword +1'
    },
    ownedDraft: {
      subjectId: '0760f32e-79e8-492a-9d11-df78532bb9c1',
      label: 'Story Shortsword +1 Draft'
    }
  },
  feat: {
    subjectKind: 'FEAT',
    masterId: grappler.id,
    ownedActive: { subjectId: '6b7dcc3d-d414-4016-ae7d-d6e134d15d41', label: 'Story Grappler' },
    ownedDraft: { subjectId: '06d83125-4d4a-40ee-8f3b-d255e0b0bb5d', label: 'Story Grappler Draft' }
  },
  race: {
    subjectKind: 'RACE',
    masterId: dragonborn.id,
    ownedActive: { subjectId: '196ef7af-30d4-4ee7-ab9a-9ed131101000', label: 'Story Dragonborn' },
    ownedDraft: {
      subjectId: 'eef6cec0-ee4b-4758-89a7-b2b54c26227d',
      label: 'Story Dragonborn Draft'
    }
  },
  spell: {
    subjectKind: 'SPELL',
    masterId: fireball.id,
    ownedActive: { subjectId: '5d2b7c19-8e40-4a6f-b3d1-0c9e2f4a7b85', label: 'Story Fireball' },
    ownedDraft: { subjectId: 'c4e81a06-3b9f-4d27-a5c8-7f1d0e2b6a94', label: 'Story Fireball Draft' }
  },
  vehicle: {
    subjectKind: 'VEHICLE',
    masterId: sailingShip.id,
    ownedActive: { subjectId: 'ae98637e-225d-4622-904b-9309bac10a0f', label: 'Story Sailing Ship' },
    ownedDraft: {
      subjectId: '3066cb80-a765-4ee5-b5f5-13cef9679281',
      label: 'Story Sailing Ship Draft'
    }
  }
} as const satisfies Record<
  string,
  {
    subjectKind: AuthoredSubjectKind
    masterId: string
    ownedActive: StoryRecordSpec
    ownedDraft: StoryRecordSpec
  }
>

/** What a story Campaign's seed needs: its Run's ids derive from slug. */
export type StoryCampaignSpec = {
  slug: string
  name: string
  blueprintName: string
  enemyLabel: string
  scene: {
    name: string
    allyLabel: string
    allyPosition: { x: number; y: number }
    enemyPosition: { x: number; y: number }
    board: ReviewBoard
  }
  playSettings: { normalCadenceDays: number; expectedDurationMinutes: number; quorum: number }
}

/** A fogged board split by a wall with a closed door, as the Sandbox review board is. */
const STORY_BOARD: ReviewBoard = {
  fogMode: 'PER_PLAYER',
  ambientIllumination: 'DIM',
  barriers: [
    {
      kind: 'WALL',
      a: { x: 400, y: 0 },
      b: { x: 400, y: 250 },
      blocksLight: true,
      blocksMovement: true
    },
    {
      kind: 'DOOR',
      a: { x: 400, y: 250 },
      b: { x: 400, y: 350 },
      blocksLightWhenClosed: true,
      blocksMovementWhenClosed: true,
      initialState: 'CLOSED',
      openAngleDegrees: 90
    },
    {
      kind: 'WALL',
      a: { x: 400, y: 350 },
      b: { x: 400, y: 600 },
      blocksLight: true,
      blocksMovement: true
    }
  ],
  lights: []
}

const astralTearId = '4f37fd9c-8671-422b-b504-cf55c48fdbd1'

/**
 * A homebrew weapon the story account authored from scratch and saved without activating (D221):
 * the dense equipment structure the authoring stories walk, with an attack, its magic bonuses,
 * charges and features that spend them. The save stamps the account, System and draft status.
 */
export const STORY_DRAFT_ONLY = {
  subjectKind: 'EQUIPMENT' as const,
  subjectId: astralTearId,
  label: 'The Astral Tear Awakened',
  payload: {
    kind: 'EQUIPMENT',
    id: astralTearId,
    label: 'The Astral Tear Awakened',
    description:
      'This mighty blade belongs to the Astral Champion of Vedur. While attuned to it, its wielder can call it to hand from a special demiplane.',
    category: Equipment.EQUIPMENT_CATEGORY_CODE.WEAPON,
    attributes: [Equipment.EQUIPMENT_ATTRIBUTE.LIMITED_USE],
    properties: [
      Equipment.EQUIPMENT_PROPERTY_CODE.FINESSE,
      Equipment.EQUIPMENT_PROPERTY_CODE.LIGHT,
      Equipment.EQUIPMENT_PROPERTY_CODE.VEX
    ],
    effects: Equipment.meleeWeaponEffects(
      astralTearId,
      'RADIANT',
      '1d6',
      Equipment.EQUIPMENT_GRIP.ONE_HANDED
    ),
    modifiers: Equipment.meleeMagicWeaponModifiers(astralTearId, 1),
    charges: {
      id: '7912761e-3fe6-4dc4-8bd7-d0e59e0e69cd',
      resetKind: 'DAWN',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      amount: 3
    },
    features: [
      {
        id: 'ec55fcfb-64b4-45f1-ae1c-93839b24881e',
        label: 'Warping Strike',
        description:
          'While holding the sword, you can expend 1 of its charges as part of making an attack with it. You can teleport to an unoccupied space you can see within 30 feet either before or after the attack. On a hit, the target also takes 4d6 force damage.',
        attributes: [Equipment.EQUIPMENT_ATTRIBUTE.LIMITED_USE],
        charges: {
          id: 'd0edc9c0-b0ff-4f4c-81c9-143fe15b3e25',
          limitKind: 'SOURCE_CHARGES',
          scalingKind: 'NONE',
          cost: 1
        },
        section: 'OTHER',
        order: 1
      },
      {
        id: 'ec2d2727-7fb0-40ad-9e40-9582da99ec1a',
        label: 'Spells',
        description:
          'While holding the sword, you can use an action to expend 1 of its charges to cast a 2nd-level or lower spell without expending a spell slot.',
        attributes: [Equipment.EQUIPMENT_ATTRIBUTE.LIMITED_USE],
        charges: {
          id: '9bd76c0f-aa76-4625-a799-6adb05df20cc',
          limitKind: 'SOURCE_CHARGES',
          scalingKind: 'NONE',
          cost: 1
        },
        section: 'ACTION',
        order: 2
      }
    ],
    cost: Equipment.gp(2000),
    weight: Equipment.lbs(2),
    requiresAttunement: true,
    rarityId: Equipment.RARITY_VERY_RARE,
    systemId: Equipment.SRD_SYSTEM_ID
  } satisfies BaseEquipmentAuthoringInputDto
}
/**
 * The Sense definitions the story account authors for the System detail stories (D221), one per
 * state a definition reaches through product commands. Their ids are random, so stories find them by
 * label.
 */
export const STORY_DEFINITIONS = {
  fresh: { label: 'Story Keen Sight', description: 'A homebrew visual sense, not yet drafted.' },
  drafted: { label: 'Story Dim Sight', description: 'A homebrew visual sense with a saved draft.' },
  published: { label: 'Story Sharp Sight', description: 'A homebrew visual sense, published.' }
} as const
/**
 * The played Characters Storybook backend sheet stories read (PLATFORM-28.T6), owned by the story
 * account at fixed ids. `seedStoryData` builds each through the Builder commit; the stories open
 * them by id and find them by label.
 */
export const STORY_CHARACTERS = {
  fighter: { characterId: '823e1766-9a56-4d22-a512-4e655983c1fe', label: 'Story Fighter' },
  multiclass: { characterId: 'f1a6b1fc-d7f7-4942-bf6c-6c10e441c837', label: 'Story Multiclass' },
  caster: { characterId: 'ef327a5a-0c6f-44b2-8ccd-5548188c305a', label: 'Story Caster' },
  /** A Fighter reopened in the Builder, so a draft waits on top of its active Sheet. */
  draftPending: {
    characterId: 'ef0fc5fd-ee78-4d0d-aa52-18d54f218548',
    label: 'Story Draft Pending'
  }
} as const

/**
 * The Campaign Storybook backend stories open by name (D221), because its id is random: the story
 * account hosts it with play settings, one Encounter Blueprint whose Run is started, a loot table
 * on that Run's creature, and a presented Scene (a real map, scene.board's barriers and fog mode)
 * that the Run is bound to: the creature's token is bound to its actor and the ally token is the
 * story account's own. The FREE tier hosts one Campaign, so every story shares it.
 */
export const STORY_CAMPAIGN = {
  slug: 'story',
  name: 'Story Campaign',
  blueprintName: 'Story Encounter',
  enemyLabel: 'Story Cultist',
  scene: {
    name: 'Story Scene',
    allyLabel: 'Story Ally',
    allyPosition: { x: 100, y: 200 },
    enemyPosition: { x: 550, y: 250 },
    board: STORY_BOARD
  },
  playSettings: { normalCadenceDays: 14, expectedDurationMinutes: 240, quorum: 3 },
  lootTable: { name: 'Story pockets', coinAmount: 12 }
} as const satisfies StoryCampaignSpec & { lootTable: { name: string; coinAmount: number } }

/**
 * The Campaign the story reader plays in rather than hosts (D221): hosted by REVIEW_STORY_HOST, joined
 * through the invitation commands, with a started Run and a presented Scene whose ally token the reader controls.
 */
export const STORY_PLAYER_CAMPAIGN = {
  slug: 'story-player',
  name: 'Story Player Campaign',
  blueprintName: 'Story Player Encounter',
  enemyLabel: 'Story Player Cultist',
  scene: { ...STORY_CAMPAIGN.scene, name: 'Story Player Scene', allyLabel: 'Story Reader Hero' },
  playSettings: STORY_CAMPAIGN.playSettings
} as const satisfies StoryCampaignSpec

/** The last Session every review Campaign gets: its presence is what marks the Campaign finished. */
export const REVIEW_READY_TITLE = 'Review data ready'

type Point = { x: number; y: number }

export type ReviewSpell = { id: string; label: string }

export type ReviewHero = {
  /** Names the Character in steps and derives its stable id. */
  slug: string
  label: string
  /** Index into the review players: who owns and controls the Character. */
  player: number
  position: Point
  /** A spell Character knows and prepares these; absent for a plain Fighter. */
  spells?: {
    list: readonly ReviewSpell[]
    slots: readonly { spellLevel: number; slotCount: number }[]
  }
}

export type ReviewCreature = {
  key: string
  sourceId: string
  position: Point
  /** Token width and height in grid squares (default 1). */
  squares?: number
  /** The token starts hidden from players. */
  hidden?: true
}

/** Scene entity ids are minted per run, as token ids are. */
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never

export type ReviewBoard = {
  fogMode: SceneDefinitionDto['fogMode']
  ambientIllumination: SceneDefinitionDto['ambientIllumination']
  barriers: readonly WithoutId<SceneDefinitionDto['barriers'][number]>[]
  lights: readonly WithoutId<SceneDefinitionDto['lights'][number]>[]
}

export type ReviewPlay = {
  automationMode: AutomationModeDto
  /** Null is the System's standard initiative. */
  initiativePolicyDefinitionId: string | null
}

/** A player sees only explored tokens (D87); the open board shows everything. */
const OPEN_BOARD: ReviewBoard = {
  fogMode: 'OFF',
  ambientIllumination: 'BRIGHT',
  barriers: [],
  lights: []
}

const ASSISTED_SPEED_FACTOR: ReviewPlay = {
  automationMode: 'ASSISTED',
  initiativePolicyDefinitionId: SRD_DND5E_SPEED_FACTOR_INITIATIVE_POLICY_DEFINITION_ID
}

export type ReviewStep =
  | {
      /** A hero slug or creature key. */
      actor: string
      /** Start of the action choice's label; absent picks the actor's first attack. */
      action?: string
      target: string
      /** The d20 every roll of this step shows (default 14). */
      d20?: number
    }
  | { actor: string; advance: true }

export type ReviewScenario = {
  campaign: string
  play: ReviewPlay
  board: ReviewBoard
  heroes: readonly ReviewHero[]
  creatures: readonly ReviewCreature[]
  steps: readonly ReviewStep[]
}

export const REVIEW_SCENARIOS: readonly ReviewScenario[] = [
  {
    campaign: 'Review: Party in the Field',
    play: ASSISTED_SPEED_FACTOR,
    board: OPEN_BOARD,
    heroes: [
      { slug: 'aria', label: 'Aria', player: 0, position: { x: 100, y: 100 } },
      { slug: 'bryn', label: 'Bryn', player: 1, position: { x: 100, y: 250 } },
      { slug: 'cade', label: 'Cade', player: 2, position: { x: 100, y: 400 } }
    ],
    creatures: [
      { key: 'wolf', sourceId: wolf.id, position: { x: 150, y: 100 } },
      { key: 'goblin', sourceId: goblin.id, position: { x: 150, y: 250 } }
    ],
    steps: [
      { actor: 'aria', target: 'wolf' },
      { actor: 'aria', advance: true },
      { actor: 'bryn', target: 'goblin' },
      { actor: 'bryn', advance: true },
      { actor: 'cade', advance: true },
      { actor: 'wolf', target: 'aria' },
      { actor: 'wolf', advance: true },
      { actor: 'goblin', target: 'bryn' },
      { actor: 'goblin', advance: true }
    ]
  },
  {
    campaign: 'Review: Shield and Hold',
    play: ASSISTED_SPEED_FACTOR,
    board: OPEN_BOARD,
    heroes: [
      {
        slug: 'ember',
        label: 'Ember',
        player: 0,
        position: { x: 100, y: 100 },
        spells: {
          list: [shield, holdPerson],
          slots: [
            { spellLevel: 1, slotCount: 4 },
            { spellLevel: 2, slotCount: 2 }
          ]
        }
      }
    ],
    creatures: [
      { key: 'wolf', sourceId: wolf.id, position: { x: 150, y: 100 } },
      { key: 'goblin', sourceId: goblin.id, position: { x: 250, y: 100 } }
    ],
    steps: [
      // A failed save: the goblin is paralyzed and Ember concentrates on the spell.
      { actor: 'ember', action: 'Hold Person', target: 'goblin', d20: 3 },
      { actor: 'ember', advance: true },
      // The wolf's bite raises Ember's Shield reaction, which the room asks Ember's player for.
      { actor: 'wolf', target: 'ember', d20: 12 },
      { actor: 'wolf', advance: true }
    ]
  },
  {
    campaign: 'Review: Fire and Thunder',
    play: ASSISTED_SPEED_FACTOR,
    board: OPEN_BOARD,
    heroes: [
      {
        slug: 'pyra',
        label: 'Pyra',
        player: 1,
        position: { x: 100, y: 100 },
        spells: {
          list: [fireball, thunderwave],
          slots: [
            { spellLevel: 1, slotCount: 2 },
            { spellLevel: 3, slotCount: 2 }
          ]
        }
      }
    ],
    creatures: [
      { key: 'wolf', sourceId: wolf.id, position: { x: 150, y: 100 } },
      { key: 'goblin1', sourceId: goblin.id, position: { x: 400, y: 100 } },
      { key: 'goblin2', sourceId: goblin.id, position: { x: 450, y: 100 } },
      { key: 'goblin3', sourceId: goblin.id, position: { x: 400, y: 150 } }
    ],
    steps: [
      // A point area: all three goblins fail their saves.
      { actor: 'pyra', action: 'Fireball', target: 'goblin1', d20: 4 },
      { actor: 'pyra', advance: true },
      // Everyone else's turn passes, so the round wraps and Pyra has an action again.
      { actor: 'wolf', advance: true },
      { actor: 'goblin1', advance: true },
      { actor: 'goblin2', advance: true },
      { actor: 'goblin3', advance: true },
      // A directed area from Pyra's side catches the adjacent wolf.
      { actor: 'pyra', action: 'Thunderwave', target: 'wolf', d20: 4 },
      { actor: 'pyra', advance: true }
    ]
  },
  {
    // A dim, fogged board split by a wall with a closed door: the party starts in the west room,
    // a lit east room holds a Large Ogre and two hidden creatures. Started, nobody has acted.
    campaign: 'Review: Sandbox',
    play: { automationMode: 'MANUAL', initiativePolicyDefinitionId: null },
    board: {
      fogMode: 'PER_PLAYER',
      ambientIllumination: 'DIM',
      barriers: [
        {
          kind: 'WALL',
          a: { x: 400, y: 0 },
          b: { x: 400, y: 250 },
          blocksLight: true,
          blocksMovement: true
        },
        {
          kind: 'DOOR',
          a: { x: 400, y: 250 },
          b: { x: 400, y: 350 },
          blocksLightWhenClosed: true,
          blocksMovementWhenClosed: true,
          initialState: 'CLOSED',
          openAngleDegrees: 90
        },
        {
          kind: 'WALL',
          a: { x: 400, y: 350 },
          b: { x: 400, y: 600 },
          blocksLight: true,
          blocksMovement: true
        },
        // Rubble across the west room: double movement cost.
        { kind: 'TERRAIN', a: { x: 200, y: 400 }, b: { x: 200, y: 600 }, movementCostMultiplier: 2 }
      ],
      lights: [
        {
          kind: 'POINT',
          position: { x: 600, y: 300 },
          brightRadius: 100,
          dimRadius: 200,
          color: '#ffcc66',
          intensity: 0.8
        }
      ]
    },
    heroes: [
      { slug: 'iris', label: 'Iris', player: 0, position: { x: 100, y: 200 } },
      { slug: 'juno', label: 'Juno', player: 1, position: { x: 100, y: 300 } },
      { slug: 'kit', label: 'Kit', player: 2, position: { x: 100, y: 400 } }
    ],
    creatures: [
      { key: 'ogre', sourceId: ogre.id, position: { x: 550, y: 250 }, squares: 2 },
      { key: 'goblin', sourceId: goblin.id, position: { x: 700, y: 100 }, hidden: true },
      { key: 'wolf', sourceId: wolf.id, position: { x: 700, y: 500 }, hidden: true }
    ],
    steps: []
  }
]

/** The review Campaigns of one managed tester set; set 0 is the local data and keeps its names. */
export function reviewScenariosForSet(set: number): readonly ReviewScenario[] {
  if (set === 0) return REVIEW_SCENARIOS
  return REVIEW_SCENARIOS.map((scenario) => ({
    ...scenario,
    campaign: `${scenario.campaign} (set ${set})`
  }))
}
