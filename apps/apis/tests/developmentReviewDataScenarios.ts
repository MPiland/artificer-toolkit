import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import type { SceneDefinitionDto } from '@artificer-toolkit/schema/api/vttScenes'
import { goblin } from '@artificer-toolkit/source-data/srd/creatures/goblin.js'
import { ogre } from '@artificer-toolkit/source-data/srd/creatures/ogre.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { SRD_DND5E_SPEED_FACTOR_INITIATIVE_POLICY_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/initiativePolicies.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { holdPerson } from '@artificer-toolkit/source-data/srd/spells/hold-person.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { thunderwave } from '@artificer-toolkit/source-data/srd/spells/thunderwave.js'

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
