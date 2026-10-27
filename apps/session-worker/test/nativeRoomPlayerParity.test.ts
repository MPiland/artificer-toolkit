import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { ROOM_CHARACTER_PLAY_COMMAND_TYPES } from '@artificer-toolkit/schema/api/characterSheetLiveCommands'
import { encounterCommandInputDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import type { RoomNativeEncounterCommand } from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { encounterActorTokenBindingCommandInputDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { zoneParts } from '@artificer-toolkit/rules-runtime/testing/authoredZoneFixture'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'

/**
 * ATTACK-2.5 player parity (ADR 0034 decision 1): every Encounter command the room accepts is probed
 * for the Character's controlling player, another player and an uncontrolled actor. The command
 * types come from the schema registry itself, and a command type with no entry here fails the drift
 * test, so a new command cannot ship without a decision about who may issue it.
 *
 * Each type is one of three classes:
 * - PLAYER: an actor-scoped command a player issues for their own Character.
 * - SHEET: play state the Sheet command owns; the Encounter command stays the GM's.
 * - TABLE: Encounter administration, outside ATTACK-2.5's scope; the player is refused.
 *
 * The PREPARED-run window in which a player enters their own initiative is proved against the real
 * room executor in `src/roomEncounterPlayerInitiative.test.ts`; the Run here is ACTIVE.
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
      access: 'PLAYER'
      /** What another player gets; a decision they are not party to reads as not pending. */
      otherPlayerRefusal?: 'DECISION_NOT_PENDING'
    }
  | {
      /** The Sheet command owns it; the Encounter command stays the GM's. */
      access: 'SHEET'
      /** The Sheet live play commands that cover it for the player. */
      sheetCommands: readonly (typeof ROOM_CHARACTER_PLAY_COMMAND_TYPES)[number][]
    }
  | {
      /** The decision or ownership rule that keeps it with the GM. */
      access: 'TABLE'
      rule: string
    }
)

const AC_2_5_SCOPE =
  "ATTACK-2.5 covers a player's own Characters in play, not Encounter administration"
const table = (citation: string) => `${citation}; ${AC_2_5_SCOPE}`
const TABLE_ADMIN = table('ADR 0034 decision 1: the GM administers the Encounter')
const UNDO_VOID = table('ADR 0034 decision 2: the GM can undo or void results and stuck prompts')

const PARITY: Record<CommandType, Entry> = {
  ROLL_ACTOR_INITIATIVE: {
    access: 'TABLE',
    rule: table(
      'ADR 0034 decision 1: a player rolls their own actor once while initiative is collected (proved in roomEncounterPlayerInitiative.test.ts); in a live Run a re-roll is the GM’s'
    ),
    actorScoped: true,
    build: (probe) => ({ ...base(probe), type: 'ROLL_ACTOR_INITIATIVE', actorId: probe.actorId })
  },
  SET_INITIATIVE: {
    access: 'TABLE',
    rule: table(
      'ADR 0034 decision 1: a player enters their own value once while initiative is collected (proved in roomEncounterPlayerInitiative.test.ts); in a live Run the GM corrects it'
    ),
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'SET_INITIATIVE',
      actorId: probe.actorId,
      initiative: 12
    })
  },
  ADVANCE_TURN: {
    access: 'PLAYER',
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'ADVANCE_TURN' })
  },
  RESOLVE_ACTION: {
    access: 'PLAYER',
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
    access: 'PLAYER',
    otherPlayerRefusal: 'DECISION_NOT_PENDING',
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
    access: 'PLAYER',
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
  ESCAPE: {
    access: 'PLAYER',
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'ESCAPE',
      actorId: probe.actorId,
      activeEffectId: SOME_ID,
      checkDefinitionId: SOME_ID
    })
  },
  END_HELD_GRANT: {
    access: 'PLAYER',
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'END_HELD_GRANT',
      actorId: probe.actorId,
      activeEffectId: SOME_ID
    })
  },
  CHANGE_FACING: {
    access: 'PLAYER',
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'CHANGE_FACING',
      actorId: probe.actorId,
      rotationDegrees: 90,
      acknowledgedWarnings: []
    })
  },
  MOVE_HELD_EFFECT: {
    access: 'PLAYER',
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'MOVE_HELD_EFFECT',
      actorId: probe.actorId,
      effectId: SOME_ID,
      offerIndex: 0,
      target: { kind: 'ACTOR', actorId: SOME_ID }
    })
  },
  RELEASE_RELATIONSHIP: {
    access: 'PLAYER',
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'RELEASE_RELATIONSHIP',
      actorId: probe.actorId,
      heldActorId: SOME_ID,
      activeEffectId: SOME_ID
    })
  },
  VOID_RULE_OCCURRENCE: {
    access: 'TABLE',
    rule: UNDO_VOID,
    actorScoped: false,
    attackPending: true,
    build: (probe) => ({ ...pendingBase(probe), type: 'VOID_RULE_OCCURRENCE' })
  },
  REVERT_LAST_ACTION: {
    access: 'TABLE',
    rule: UNDO_VOID,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'REVERT_LAST_ACTION' })
  },
  REMOVE_AREA_TARGET: {
    access: 'TABLE',
    rule: table('D103: the GM removes a creature from a pending area'),
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
    access: 'TABLE',
    rule: table('D116: Hide and Search concealment is adjusted by the GM and is undoable'),
    actorScoped: false,
    build: (probe) => ({
      ...base(probe),
      type: 'SET_CONCEALMENT_OBSERVERS',
      activeEffectId: SOME_ID,
      add: [],
      remove: []
    })
  },
  PLACE_ZONE: {
    access: 'TABLE',
    rule: table('ADR 0038: the GM places environmental zones on the Scene and can undo them'),
    actorScoped: false,
    build: (probe) => ({
      ...base(probe),
      type: 'PLACE_ZONE',
      zone: zoneParts(caltropsBagOf20).zone,
      point: { x: 0, y: 0 }
    })
  },
  SET_ZONE_DCS: {
    access: 'TABLE',
    rule: table('MOVE-3.3: the GM sets the spot and disarm DCs that conceal a placed zone'),
    actorScoped: false,
    build: (probe) => ({
      ...base(probe),
      type: 'SET_ZONE_DCS',
      spatialEffectId: SOME_ID,
      spotDc: { value: 15, source: 'FLAT' },
      disarmDc: null
    })
  },
  DISMISS_ZONE_SIGHTING: {
    access: 'TABLE',
    rule: table('MOVE-3.5: the GM dismisses a Character sighting of a concealed zone'),
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'DISMISS_ZONE_SIGHTING',
      spatialEffectId: SOME_ID,
      actorId: probe.actorId
    })
  },
  REVEAL_ZONE: {
    access: 'TABLE',
    rule: table('MOVE-3.7: the GM shows a concealed zone to chosen Characters'),
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'REVEAL_ZONE',
      spatialEffectId: SOME_ID,
      actorIds: [probe.actorId]
    })
  },
  DISARM_ZONE: {
    access: 'TABLE',
    rule: table('MOVE-3.7: the GM disarms a zone, which removes it'),
    actorScoped: false,
    build: (probe) => ({
      ...base(probe),
      type: 'DISARM_ZONE',
      spatialEffectId: SOME_ID
    })
  },
  MORALE_SAVE: {
    access: 'TABLE',
    rule: table(
      'ENCOUNTER-6.1: the GM checks morale for creatures; players decide for their own Characters'
    ),
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'MORALE_SAVE',
      actorId: probe.actorId,
      triggerKind: 'INDIVIDUAL_SURPRISED',
      leaderActorId: null,
      overwhelmingOpposition: false,
      escapePossible: true,
      roll: { kind: 'AUTO_ROLL' },
      visibility: 'PUBLIC'
    })
  },
  CONFIRM_MORALE: {
    access: 'TABLE',
    rule: table('ENCOUNTER-6.2: the GM confirms a morale outcome'),
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'CONFIRM_MORALE',
      actorId: probe.actorId,
      disposition: 'FLEE'
    })
  },
  RESOLVE_CONSEQUENCE_ROLL_OFFER: {
    access: 'TABLE',
    rule: table('ATTACK-15.1: the GM rolls or declines a consequence table offer'),
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'RESOLVE_CONSEQUENCE_ROLL_OFFER',
      actorId: probe.actorId,
      sourceCommandId: SOME_ID,
      definitionId: SOME_ID,
      decision: 'DECLINE',
      visibility: 'PUBLIC'
    })
  },
  UPDATE_ACTOR: {
    access: 'TABLE',
    rule: table(
      'AGENTS.md: the Builder owns structural character changes, and D87 keeps what the GM prepares hidden'
    ),
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'UPDATE_ACTOR',
      actorId: probe.actorId,
      public: true
    })
  },
  REMOVE_ACTOR: {
    access: 'TABLE',
    rule: table('D82: the GM removes an actor (GM_REMOVED) and returns a Character to initiative'),
    actorScoped: true,
    build: (probe) => ({ ...base(probe), type: 'REMOVE_ACTOR', actorId: probe.actorId })
  },
  REINFORCE: {
    access: 'TABLE',
    rule: TABLE_ADMIN,
    actorScoped: false,
    build: (probe) => ({
      ...base(probe),
      type: 'REINFORCE',
      enemy: { kind: 'CUSTOM', label: 'Reinforcement', maxHitPoints: 5 }
    })
  },
  REORDER: {
    access: 'TABLE',
    rule: TABLE_ADMIN,
    actorScoped: false,
    build: (probe) => ({
      ...base(probe),
      type: 'REORDER',
      actorIds: [CHARACTER_ACTOR_ID, OTHER_PLAYERS_WOLF_ID, UNCONTROLLED_WOLF_ID]
    })
  },
  START: {
    access: 'TABLE',
    rule: TABLE_ADMIN,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'START' })
  },
  COMPLETE: {
    access: 'TABLE',
    rule: TABLE_ADMIN,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'COMPLETE' })
  },
  PREVIOUS_TURN: {
    access: 'TABLE',
    rule: TABLE_ADMIN,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'PREVIOUS_TURN' })
  },
  SET_CURRENT_ACTOR: {
    access: 'TABLE',
    rule: TABLE_ADMIN,
    actorScoped: true,
    build: (probe) => ({ ...base(probe), type: 'SET_CURRENT_ACTOR', actorId: probe.actorId })
  },
  SET_ROUND: {
    access: 'TABLE',
    rule: TABLE_ADMIN,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'SET_ROUND', round: 2 })
  },
  REPLACE_OPTIONAL_COMBAT_RULES: {
    access: 'TABLE',
    rule: TABLE_ADMIN,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'REPLACE_OPTIONAL_COMBAT_RULES', definitionIds: [] })
  },
  UPSERT_REMINDER: {
    access: 'TABLE',
    rule: TABLE_ADMIN,
    actorScoped: false,
    build: (probe) => ({
      ...base(probe),
      type: 'UPSERT_REMINDER',
      reminder: { label: 'Reminder', timing: 'ROUND_START' }
    })
  },
  REMOVE_REMINDER: {
    access: 'TABLE',
    rule: TABLE_ADMIN,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'REMOVE_REMINDER', reminderId: SOME_ID })
  },
  SET_HEALTH_DISPLAY_DEFAULT: {
    access: 'TABLE',
    rule: TABLE_ADMIN,
    actorScoped: false,
    build: (probe) => ({ ...base(probe), type: 'SET_HEALTH_DISPLAY_DEFAULT', level: 'HIDDEN' })
  },
  SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING: {
    access: 'TABLE',
    rule: TABLE_ADMIN,
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
    access: 'TABLE',
    rule: TABLE_ADMIN,
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
    access: 'TABLE',
    rule: TABLE_ADMIN,
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
    access: 'SHEET',
    sheetCommands: ['USE_RESOURCE', 'RESTORE_RESOURCE'],
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
  CREATURE_REST: {
    access: 'TABLE',
    rule: TABLE_ADMIN,
    actorScoped: true,
    build: (probe) => ({
      ...base(probe),
      type: 'CREATURE_REST',
      restKind: 'SHORT',
      actorIds: [probe.actorId]
    })
  },
  ROLL_ENEMY_ACTION: {
    access: 'TABLE',
    rule: TABLE_ADMIN,
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

/** The Character's Sheet play-state stream version in the live room. */
function sheetStreamVersion(room: Room) {
  return runInDurableObject(room.room.base.stub, (_instance, context) => {
    const play = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((row) => row.characterId === CHARACTER_ID)
    if (!play) throw new Error('Missing room Character play state.')
    return play.streamVersion
  })
}

/** What the room answered to a Sheet hit point change on the Character, sent by `sender`. */
async function sheetOutcome(room: Room, sender: Exclude<Sender, 'GM'>) {
  const player = await connectPlayer(
    room.room.base,
    sender === 'CONTROLLER' ? 'PLAYER' : 'OTHER_PLAYER'
  )
  const commandId = crypto.randomUUID()
  const first = player.messages.length
  player.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'CHARACTER_SHEET',
        characterId: CHARACTER_ID,
        encounterId: room.room.encounterId,
        command: {
          type: 'ADJUST_HIT_POINTS',
          mode: 'DAMAGE',
          amount: 1,
          commandId,
          expectedVersion: await sheetStreamVersion(room)
        }
      }
    })
  )
  return vi.waitFor(() => {
    const answer = player.messages
      .slice(first)
      .find(
        (message) =>
          (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
          message.commandId === commandId
      )
    if (!answer) throw new Error('The room has not answered the Sheet command.')
    return answer.type
  })
}

async function openProbe(entry: Entry, actorId: string): Promise<Probe> {
  const room = await parityRoom({ attackPending: entry.attackPending })
  const pending = entry.attackPending ? await pendingAttack(room) : null
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

  it('cites a rule for every TABLE command, and the player classes are the approved ones', () => {
    const typesOf = (access: Entry['access']) =>
      Object.entries(PARITY)
        .filter(([, entry]) => entry.access === access)
        .map(([type]) => type)
        .sort()
    for (const entry of Object.values(PARITY))
      if (entry.access === 'TABLE') expect(entry.rule).toContain(AC_2_5_SCOPE)
    expect(typesOf('PLAYER')).toEqual([
      'ADVANCE_TURN',
      'CHANGE_FACING',
      'END_HELD_GRANT',
      'ESCAPE',
      'MOVE_HELD_EFFECT',
      'RELEASE_RELATIONSHIP',
      'RESOLVE_ACTION',
      'RESOLVE_RULE_OCCURRENCE',
      'ROLL_RULE_EVIDENCE'
    ])
    expect(typesOf('SHEET')).toEqual(['ADJUST_FEATURE_RESOURCE'])
  })
})

describe('room command authorization by player (ADR 0034 decision 1)', () => {
  it.each(REGISTRY_TYPES)('%s', { timeout: 120_000 }, async (type) => {
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

    if (entry.access === 'PLAYER') {
      // The controlling player is treated as the GM is, for the Character's own actor.
      const viaGm = await answered('GM', CHARACTER_ACTOR_ID)
      const viaPlayer = await answered('CONTROLLER', CHARACTER_ACTOR_ID)
      expect(viaPlayer, 'the controller is treated as the GM is').toBe(viaGm)
      expect(viaPlayer).not.toBe('NOT_ACTOR_CONTROLLER')
      expect(viaPlayer).not.toBe('GM_ONLY')
      expect(await (await refusals(CHARACTER_ACTOR_ID))('OTHER_PLAYER')).toBe(
        entry.otherPlayerRefusal ?? 'NOT_ACTOR_CONTROLLER'
      )
      if (entry.actorScoped)
        expect(await (await refusals(UNCONTROLLED_WOLF_ID))('CONTROLLER')).toBe(
          'NOT_ACTOR_CONTROLLER'
        )
    } else {
      // TABLE, and the Encounter command of a SHEET row: the player is refused as not the GM.
      const refuse = await refusals(CHARACTER_ACTOR_ID)
      expect(await refuse('CONTROLLER')).toBe('GM_ONLY')
      expect(await refuse('OTHER_PLAYER')).toBe('GM_ONLY')
      if (entry.actorScoped)
        expect(await (await refusals(UNCONTROLLED_WOLF_ID))('CONTROLLER')).toBe('GM_ONLY')
    }

    if (entry.access === 'SHEET') {
      for (const sheetCommand of entry.sheetCommands)
        expect(ROOM_CHARACTER_PLAY_COMMAND_TYPES).toContain(sheetCommand)
      // The Sheet path itself works for the player in a live Encounter, and only for them.
      const { room } = await openProbe(entry, CHARACTER_ACTOR_ID)
      expect(await sheetOutcome(room, 'OTHER_PLAYER')).toBe('COMMAND_REJECTED')
      expect(await sheetOutcome(room, 'CONTROLLER')).toBe('COMMAND_COMMITTED')
    }
  })
})
