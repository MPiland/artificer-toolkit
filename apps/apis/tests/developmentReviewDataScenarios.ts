import { goblin } from '@artificer-toolkit/source-data/srd/creatures/goblin.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { holdPerson } from '@artificer-toolkit/source-data/srd/spells/hold-person.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { thunderwave } from '@artificer-toolkit/source-data/srd/spells/thunderwave.js'

/**
 * Local-only review accounts. The seeded backend is the user's own Docker container, so these fixed
 * credentials guard nothing: they exist so a re-run signs in to the accounts a previous run made.
 */
export const REVIEW_PASSWORD = 'Review_Local_1!pass'

export type ReviewAccountSpec = { key: string; username: string }

export const REVIEW_GM: ReviewAccountSpec = { key: 'gm', username: 'Review_Gm_Rowan' }
export const REVIEW_PLAYERS: readonly ReviewAccountSpec[] = [
  { key: 'player1', username: 'Review_Pl_Aria' },
  { key: 'player2', username: 'Review_Pl_Bryn' },
  { key: 'player3', username: 'Review_Pl_Cade' }
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

export type ReviewCreature = { key: string; sourceId: string; position: Point }

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
  heroes: readonly ReviewHero[]
  creatures: readonly ReviewCreature[]
  steps: readonly ReviewStep[]
}

export const REVIEW_SCENARIOS: readonly ReviewScenario[] = [
  {
    campaign: 'Review: Party in the Field',
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
      // A directed area from Pyra's side catches the adjacent wolf.
      { actor: 'pyra', action: 'Thunderwave', target: 'wolf', d20: 4 },
      { actor: 'pyra', advance: true }
    ]
  }
]
