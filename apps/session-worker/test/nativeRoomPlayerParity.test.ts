import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterCommandInputDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import type { RoomNativeEncounterCommand } from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { encounterActorTokenBindingCommandInputDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * ATTACK-2.5 player parity (ADR 0034 decision 1): every Encounter command the room accepts is probed
 * for the Character's controlling player, another player and an uncontrolled actor. The command
 * types come from the schema registry itself, and a command type with no entry here fails the drift
 * test, so a new command cannot ship without a decision about who may issue it.
 */

type CommandType = RoomNativeEncounterCommand['type']
type Command = Record<string, unknown> & { commandId: string }
type Sender = 'GM' | 'CONTROLLER' | 'OTHER_PLAYER'

const CHARACTER_ACTOR_ID = testUuid(0xc10)
const CHARACTER_ID = testUuid(0xc11)
/** A Wolf the room's second player controls. */
const OTHER_PLAYERS_WOLF_ID = testUuid(0xc12)
/** A Wolf no player controls. */
const UNCONTROLLED_WOLF_ID = testUuid(0xc13)
/** An id the Run holds nothing under. */
const SOME_ID = crypto.randomUUID()
const NO_CHECKSUM = '0'.repeat(64)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Character acts first; a second player controls one Wolf and another Wolf has no controller. */
function parityRoom(options: { attackPending?: boolean } = {}) {
  return actionRoom({
    actors: [
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: OTHER_PLAYERS_WOLF_ID, creature: plainWolf }),
      srdCreatureActor({ id: UNCONTROLLED_WOLF_ID, creature: plainWolf })
    ],
    otherPlayerControlledActorIds: [OTHER_PLAYERS_WOLF_ID],
    characterPlay: { equipped: true },
    characterAction: (action) => action.label.includes('Club'),
    ...(options.attackPending ? {} : { autoRoll: 'BOTH' as const, fallbackRoll: 0 })
  })
}
type Room = Awaited<ReturnType<typeof parityRoom>>

/** The Character's Club attack, held for the Character's own d20 roll. */
async function pendingAttack(room: Room) {
  // No Scene is bound to measure the Club's reach (D11).
  const started = await room.startAction(OTHER_PLAYERS_WOLF_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack d20.')
  return { decision, request: decision.pending.request }
}

interface Probe {
  room: Room
  /** The actor the command is for. */
  actorId: string
  /** The pending attack decision, when the entry asks for one. */
  pending: Awaited<ReturnType<typeof pendingAttack>> | null
  version: number
}

const base = ({ room, version }: Probe) => ({
  encounterId: room.room.encounterId,
  commandId: crypto.randomUUID(),
  expectedVersion: version
})

const pendingBase = (probe: Probe) => ({
  ...base(probe),
  expectedVersion: probe.pending!.decision.encounterVersion,
  occurrenceId: probe.pending!.decision.occurrence.id,
  expectedOccurrenceVersion: probe.pending!.decision.occurrence.version
})

/** Builds the command the GM issues for `probe.actorId`. */
type Build = (probe: Probe) => Promise<Command> | Command

type Entry = {
  build: Build
  /** The command is for the Character's actor: a probe against an uncontrolled actor is meaningful. */
  actorScoped: boolean
  /** The room starts with the Character's attack held at its d20. */
  attackPending?: boolean
} & (
  | {
      /** The Character's controlling player may issue it for their own actor. */
      access: 'CONTROLLER'
      /** The command is only for the actor whose turn it is. */
      ownTurn?: boolean
    }
  | {
      access: 'GM_ONLY'
      /** The decision or ADR that makes the command GM-only; null is an open question for Phase 8. */
      decision: string | null
    }
  | {
      /** The GM cannot issue it for a Character either: the Sheet owns a Character's play state. */
      access: 'CREATURE_ONLY'
    }
)

const ADR_0034_UNDO_VOID = 'ADR 0034 decision 2: the GM can undo or void results and stuck prompts'

const PARITY: Record<CommandType, Entry> = {
  ROLL_ACTOR_INITIATIVE: {
    access: 'CONTROLLER',
    actorScoped: true,
    build: (probe) => ({ ...base(probe), type: 'ROLL_ACTOR_INITIATIVE', actorId: probe.actorId })
  },
  SET_INITIATIVE: {
    access: 'CONTROLLER',
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'SET_INITIATIVE',
      actorId: probe.actorId,
      initiative: 12
    })
  },
  ADVANCE_TURN: {
    access: 'CONTROLLER',
    ownTurn: true,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'ADVANCE_TURN' })
  },
  RESOLVE_ACTION: {
    access: 'CONTROLLER',
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      acknowledgedWarnings: ['TARGET_RANGE_UNCHECKED'],
      actorId: probe.actorId,
      target: { kind: 'ACTOR', actorId: OTHER_PLAYERS_WOLF_ID },
      actionId: probe.room.actionId,
      optionalCombatIntent: null,
      sceneContext: null
    })
  },
  ROLL_RULE_EVIDENCE: {
    access: 'CONTROLLER',
    actorScoped: false,
    attackPending: true,
    build: (probe) => ({
      ...pendingBase(probe),
      type: 'ROLL_RULE_EVIDENCE',
      requestId: probe.pending!.request.requestId,
      rollMode: null
    })
  },
  RESOLVE_RULE_OCCURRENCE: {
    access: 'CONTROLLER',
    actorScoped: false,
    attackPending: true,
    build: (probe) =>
      probe.room.resolveCommand(probe.pending!.decision, {
        kind: 'ENTER_DICE',
        requestId: probe.pending!.request.requestId,
        rawFaces: probe.pending!.request.rollMode === 'NORMAL' ? [10] : [10, 10],
        rollMode: probe.pending!.request.rollMode
      })
  },
  ESCAPE_RELATIONSHIP: {
    access: 'CONTROLLER',
    ownTurn: true,
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'ESCAPE_RELATIONSHIP',
      actorId: probe.actorId,
      activeEffectId: SOME_ID,
      checkDefinitionId: SOME_ID
    })
  },
  END_HELD_GRANT: {
    access: 'CONTROLLER',
    ownTurn: true,
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'END_HELD_GRANT',
      actorId: probe.actorId,
      activeEffectId: SOME_ID
    })
  },
  VOID_RULE_OCCURRENCE: {
    access: 'GM_ONLY',
    decision: ADR_0034_UNDO_VOID,
    actorScoped: false,
    attackPending: true,
    build: (probe) => ({ ...pendingBase(probe), type: 'VOID_RULE_OCCURRENCE' })
  },
  REVERT_LAST_ACTION: {
    access: 'GM_ONLY',
    decision: ADR_0034_UNDO_VOID,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'REVERT_LAST_ACTION' })
  },
  REMOVE_AREA_TARGET: {
    access: 'GM_ONLY',
    decision: 'D103: the GM removes a creature from a pending area',
    actorScoped: false,
    attackPending: true,
    build: (probe) => ({
      ...pendingBase(probe),
      type: 'REMOVE_AREA_TARGET',
      expectedCaughtChecksum: NO_CHECKSUM,
      actorId: probe.actorId
    })
  },
  SET_CONCEALMENT_OBSERVERS: {
    access: 'GM_ONLY',
    decision: 'D116: Hide and Search concealment is adjusted by the GM and is undoable',
    actorScoped: false,
    build: (probe) => ({
      ...base(probe),
      type: 'SET_CONCEALMENT_OBSERVERS',
      activeEffectId: SOME_ID,
      add: [],
      remove: []
    })
  },
  UPDATE_ACTOR: {
    access: 'GM_ONLY',
    decision: 'D87: what the GM prepares stays hidden until the GM reveals it',
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'UPDATE_ACTOR',
      actorId: probe.actorId,
      public: true
    })
  },
  REMOVE_ACTOR: {
    access: 'GM_ONLY',
    decision: null,
    actorScoped: true,
    build: (probe) => ({ ...base(probe), type: 'REMOVE_ACTOR', actorId: probe.actorId })
  },
  REINFORCE: {
    access: 'GM_ONLY',
    decision: null,
    actorScoped: false,
    build: (probe) => ({
      ...base(probe),
      type: 'REINFORCE',
      enemy: { kind: 'CUSTOM', label: 'Reinforcement', maxHitPoints: 5 }
    })
  },
  REORDER: {
    access: 'GM_ONLY',
    decision: null,
    actorScoped: false,
    build: (probe) => ({
      ...base(probe),
      type: 'REORDER',
      actorIds: [CHARACTER_ACTOR_ID, OTHER_PLAYERS_WOLF_ID, UNCONTROLLED_WOLF_ID]
    })
  },
  START: {
    access: 'GM_ONLY',
    decision: null,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'START' })
  },
  COMPLETE: {
    access: 'GM_ONLY',
    decision: null,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'COMPLETE' })
  },
  PREVIOUS_TURN: {
    access: 'GM_ONLY',
    decision: null,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'PREVIOUS_TURN' })
  },
  SET_CURRENT_ACTOR: {
    access: 'GM_ONLY',
    decision: null,
    actorScoped: true,
    build: (probe) => ({ ...base(probe), type: 'SET_CURRENT_ACTOR', actorId: probe.actorId })
  },
  SET_ROUND: {
    access: 'GM_ONLY',
    decision: null,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'SET_ROUND', round: 2 })
  },
  REPLACE_OPTIONAL_COMBAT_RULES: {
    access: 'GM_ONLY',
    decision: null,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'REPLACE_OPTIONAL_COMBAT_RULES', definitionIds: [] })
  },
  UPSERT_REMINDER: {
    access: 'GM_ONLY',
    decision: null,
    actorScoped: false,
    build: (probe) => ({
      ...base(probe),
      type: 'UPSERT_REMINDER',
      reminder: { label: 'Reminder', timing: 'ROUND_START' }
    })
  },
  REMOVE_REMINDER: {
    access: 'GM_ONLY',
    decision: null,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'REMOVE_REMINDER', reminderId: SOME_ID })
  },
  SET_HEALTH_DISPLAY_DEFAULT: {
    access: 'GM_ONLY',
    decision: null,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'SET_HEALTH_DISPLAY_DEFAULT', level: 'HIDDEN' })
  },
  SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING: {
    access: 'GM_ONLY',
    decision: null,
    actorScoped: true,
    build: ({ room, actorId, version }) => ({
      type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
      actorId,
      commandId: crypto.randomUUID(),
      encounterId: room.room.encounterId,
      expectedEncounterVersion: version,
      sceneId: room.room.scene.id,
      tokenId: room.room.scene.tokens[0]!.id
    })
  },
  REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING: {
    access: 'GM_ONLY',
    decision: null,
    actorScoped: true,
    build: ({ room, actorId, version }) => ({
      type: 'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
      actorId,
      commandId: crypto.randomUUID(),
      encounterId: room.room.encounterId,
      expectedEncounterVersion: version,
      sceneId: room.room.scene.id
    })
  },
  REPLACE_CREATURE_EQUIPMENT: {
    access: 'CREATURE_ONLY',
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'REPLACE_CREATURE_EQUIPMENT',
      actorId: probe.actorId,
      loadoutEntryId: SOME_ID,
      equipmentId: SOME_ID
    })
  },
  ADJUST_FEATURE_RESOURCE: {
    access: 'CREATURE_ONLY',
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'ADJUST_FEATURE_RESOURCE',
      actorId: probe.actorId,
      featureId: 'feature',
      direction: 'USE',
      amount: 1
    })
  },
  ROLL_ENEMY_ACTION: {
    access: 'CREATURE_ONLY',
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'ROLL_ENEMY_ACTION',
      actorId: probe.actorId,
      featureId: 'feature',
      rollDefinitionId: 'roll',
      visibility: 'PUBLIC'
    })
  }
}

/** Every command type the room executes natively, read from the schemas that parse them. */
const REGISTRY_TYPES: CommandType[] = [
  ...encounterCommandInputDtoSchema.def.options.flatMap((option) => option.shape.type.def.values),
  ...encounterActorTokenBindingCommandInputDtoSchema.def.options.flatMap(
    (option) => option.shape.type.def.values
  )
]

/** What the room answered: accepted, or the reason it refused. */
async function outcome(room: Room, sender: Sender, command: Command) {
  const answer =
    sender === 'GM'
      ? await room.send(command)
      : await room.sendAsPlayer(command, sender === 'CONTROLLER' ? 'PLAYER' : 'OTHER_PLAYER')
  return answer.type === 'COMMAND_COMMITTED' ? 'ACCEPTED' : answer.reason
}

async function openProbe(entry: Entry, actorId: string): Promise<Probe> {
  const room = await parityRoom({ attackPending: entry.attackPending })
  const pending = entry.attackPending ? await pendingAttack(room) : null
  // An uncontrolled actor's turn: the Character's and the other player's Wolf's have passed.
  if (actorId === UNCONTROLLED_WOLF_ID && 'ownTurn' in entry && entry.ownTurn) {
    await room.advanceTurn()
    await room.advanceTurn()
  }
  return { room, actorId, pending, version: await room.version() }
}

describe('registry', () => {
  it('lists every command type once', () => {
    expect(new Set(REGISTRY_TYPES).size).toBe(REGISTRY_TYPES.length)
    expect(REGISTRY_TYPES.length).toBeGreaterThan(0)
  })

  it('classifies exactly the registry’s command types', () => {
    expect(Object.keys(PARITY).sort()).toEqual([...REGISTRY_TYPES].sort())
  })

  it('names every GM-only command without a covering decision, for the architect to rule on', () => {
    const open = Object.entries(PARITY)
      .flatMap(([type, entry]) => (entry.access === 'GM_ONLY' && !entry.decision ? [type] : []))
      .sort()
    expect(open).toEqual([
      'COMPLETE',
      'PREVIOUS_TURN',
      'REINFORCE',
      'REMOVE_ACTOR',
      'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
      'REMOVE_REMINDER',
      'REORDER',
      'REPLACE_OPTIONAL_COMBAT_RULES',
      'SET_CURRENT_ACTOR',
      'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
      'SET_HEALTH_DISPLAY_DEFAULT',
      'SET_ROUND',
      'START',
      'UPSERT_REMINDER'
    ])
  })
})

describe('room command authorization by player (ADR 0034 decision 1)', () => {
  it.each(REGISTRY_TYPES)(
    '%s',
    { timeout: 120_000 },
    async (type) => {
      const entry = PARITY[type]
      /** A fresh room's answer: the command may be accepted and change the Run. */
      const answered = async (sender: Sender, actorId: string) => {
        const probe = await openProbe(entry, actorId)
        return outcome(probe.room, sender, await entry.build(probe))
      }
      /** One room's answers to commands it refuses: a refusal changes nothing. */
      const refusals = async (actorId: string) => {
        const probe = await openProbe(entry, actorId)
        return async (sender: Sender) => {
          const before = await probe.room.version()
          const answer = await outcome(probe.room, sender, await entry.build(probe))
          expect(await probe.room.version(), `${sender}'s refusal changes nothing`).toBe(before)
          return answer
        }
      }

      if (entry.access === 'CONTROLLER') {
        // The controlling player is treated as the GM is, for the Character's own actor.
        const viaGm = await answered('GM', CHARACTER_ACTOR_ID)
        const viaPlayer = await answered('CONTROLLER', CHARACTER_ACTOR_ID)
        expect(viaPlayer, 'the controller is treated as the GM is').toBe(viaGm)
        expect(viaPlayer).not.toBe('NOT_ACTOR_CONTROLLER')
        expect(viaPlayer).not.toBe('GM_ONLY')
        expect(await (await refusals(CHARACTER_ACTOR_ID))('OTHER_PLAYER')).toBe(
          'NOT_ACTOR_CONTROLLER'
        )
        if (entry.actorScoped)
          expect(await (await refusals(UNCONTROLLED_WOLF_ID))('CONTROLLER')).toBe(
            'NOT_ACTOR_CONTROLLER'
          )
      } else if (entry.access === 'GM_ONLY') {
        const refuse = await refusals(CHARACTER_ACTOR_ID)
        expect(await refuse('CONTROLLER')).toBe('GM_ONLY')
        expect(await refuse('OTHER_PLAYER')).toBe('GM_ONLY')
        if (entry.actorScoped)
          expect(await (await refusals(UNCONTROLLED_WOLF_ID))('CONTROLLER')).toBe('GM_ONLY')
      } else {
        // Not a Character command: the room refuses the GM's and the player's alike.
        const refuse = await refusals(CHARACTER_ACTOR_ID)
        expect(await refuse('GM')).not.toBe('ACCEPTED')
        expect(await refuse('CONTROLLER')).not.toBe('ACCEPTED')
      }
    }
  )
})
