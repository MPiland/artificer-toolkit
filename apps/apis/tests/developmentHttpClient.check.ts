import assert from 'node:assert/strict'
import { assertDomainRejection } from './developmentClient'
import { openEncounterCommandRoom } from './developmentHttpClient'

const campaignId = '00000000-0000-4000-8000-000000000001'
const encounterId = '00000000-0000-4000-8000-000000000002'
const authorityEpoch = '00000000-0000-4000-8000-000000000003'
const commandIds = [
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000008'
] as const
const origin = 'http://localhost:3000'

class FakeSocket extends EventTarget {
  readonly sent: unknown[] = []
  closedWith: number | null = null

  constructor(readonly init: { headers: { origin: string }; protocols: string[] }) {
    super()
  }

  send(data: string) {
    this.sent.push(JSON.parse(data))
  }

  close(code = 1000) {
    if (this.closedWith !== null) return
    this.closedWith = code
    this.dispatchEvent(new CloseEvent('close', { code }))
  }

  receive(message: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
}

const command = (commandId: string) => ({
  type: 'ADVANCE_TURN' as const,
  encounterId,
  commandId,
  expectedVersion: 4
})
const commandMessage = (commandId: string, expectedSessionSequence: number) => ({
  command: { command: command(commandId), scope: 'ENCOUNTER' },
  expectedSessionSequence,
  type: 'COMMAND'
})
const stateSync = (sequence: number) => ({
  authorityEpoch,
  sequence,
  state: { recipientRole: 'OWNER', scene: null },
  type: 'STATE_SYNC'
})
const result = {
  projection: {
    id: encounterId,
    campaignId,
    gameSystemId: '00000000-0000-4000-8000-000000000008',
    blueprintId: '00000000-0000-4000-8000-000000000009',
    blueprintVersion: 1,
    blueprintChecksum: 'a'.repeat(64),
    name: 'Room check Encounter',
    status: 'ACTIVE',
    automationMode: 'ASSISTED',
    rulePackRevisionId: null,
    initiativePolicy: null,
    optionalCombatRules: [],
    version: 5,
    round: 2,
    currentActorId: null,
    actors: [],
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z'
  },
  roll: null,
  resolution: null,
  occurrence: null
}

const sockets: FakeSocket[] = []
let closedRooms = 0
let accessToken: string | null = 'first-token'
const room = openEncounterCommandRoom({
  url: `ws://127.0.0.1:8787/live-session/${campaignId}`,
  origin,
  issueTicket: async () => ({ expiresAt: '2026-09-24T12:01:00.000Z', ticket: 'signed-ticket' }),
  accessToken: () => accessToken,
  onClosed: () => {
    closedRooms += 1
  },
  openSocket: (_url, init) => {
    const socket = new FakeSocket(init)
    sockets.push(socket)
    return socket
  }
})

// The ticket rides in the subprotocol and the Origin header matches the browser's.
const first = room.execute(command(commandIds[0]))
await new Promise((resolve) => setImmediate(resolve))
const socket = sockets[0]
assert.ok(socket && sockets.length === 1)
assert.deepEqual(socket.init, {
  headers: { origin },
  protocols: ['artificer.live-session.v1', 'artificer.ticket.signed-ticket']
})
socket.dispatchEvent(new Event('open'))
assert.deepEqual(socket.sent, [{ accessToken: 'first-token', type: 'AUTHENTICATE' }])

// Commands wait for TRANSIENT_READY and STATE_SYNC, then carry the synchronized sequence.
socket.receive({ campaignId, type: 'TRANSIENT_READY' })
assert.equal(socket.sent.length, 1)
socket.receive(stateSync(3))
assert.deepEqual(socket.sent[1], commandMessage(commandIds[0], 3))

// Re-authentication uses the client's current token and resends the in-flight command.
accessToken = 'second-token'
socket.receive({ type: 'AUTHENTICATION_REQUIRED' })
assert.deepEqual(socket.sent[2], { accessToken: 'second-token', type: 'AUTHENTICATE' })
socket.receive({ campaignId, type: 'TRANSIENT_READY' })
socket.receive(stateSync(5))
assert.deepEqual(socket.sent[3], commandMessage(commandIds[0], 5))

// COMMAND_COMMITTED resolves with the Encounter result.
socket.receive({
  commandId: commandIds[0],
  delta: { result, scope: 'ENCOUNTER' },
  sequence: 5,
  type: 'COMMAND_COMMITTED'
})
assert.deepEqual(await first, result)

// COMMAND_REJECTED rejects with the room's code and message.
const second = room.execute(command(commandIds[1]))
assert.deepEqual(socket.sent[4], commandMessage(commandIds[1], 5))
socket.receive({
  code: 'STALE_STATE',
  commandId: commandIds[1],
  currentSequence: 5,
  message: 'The Encounter changed; review the current state and try again.',
  reason: null,
  type: 'COMMAND_REJECTED'
})
await assert.rejects(second, /^Error: STALE_STATE: The Encounter changed/)

// A domain rejection rejects with the same ConvexError data a direct Convex call throws.
const domain = room.execute(command(commandIds[4]))
assert.deepEqual(socket.sent[5], commandMessage(commandIds[4], 5))
socket.receive({
  code: 'DOMAIN_REJECTED',
  commandId: commandIds[4],
  currentSequence: 5,
  message: 'Encounter version is stale.',
  reason: 'VERSION_STALE',
  type: 'COMMAND_REJECTED'
})
await assert.rejects(domain, (error) => assertDomainRejection(error, 'VERSION_STALE'))

// A closed socket fails pending commands and releases the room for a fresh connection.
const third = room.execute(command(commandIds[2]))
socket.close(4001)
await assert.rejects(third, /closed the connection \(4001/)
assert.equal(closedRooms, 1)
await assert.rejects(room.execute(command(commandIds[3])), /closed the connection/)

console.log(JSON.stringify({ encounterCommandRoom: 'PASS', socketMessages: socket.sent.length }))
