import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EncounterCommandInputDto } from '@artificer-toolkit/schema/api/encounters'
import { api } from '../_generated/api'
import {
  playerControlFixture,
  setActorControllers,
  type PlayerControlFixture
} from '../../tests/fixtures/playerControl'
import { encounterConformanceCorpus } from '../../tests/fixtures/encounterConformanceCorpus'
import { executeInRoom, useLocalRoomWorker } from '../../tests/fixtures/localRoomWorker'
import { encounterWriteTransaction } from './encounterPorts'
import { encounterReadTransaction } from './encounterReadPorts'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import {
  projectNativeGm,
  readEncounterGmProjection
} from '@artificer-toolkit/encounter-persistence/nativeProjection'

/**
 * What every member reads after each conformance operation: the GM and player projections, the
 * timeline and the pending decision. The goldens were recorded while the Run stored its projection
 * and each command its whole result, so building them on read must reproduce them exactly.
 */

// Registered before the hooks below: hooks after each test run in reverse, so the room closes on
// restored mocks and real timers.
useLocalRoomWorker()

let uuidSequence = 0
beforeEach(() => {
  uuidSequence = 0
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () =>
      `00000000-0000-4000-8000-${(++uuidSequence).toString(16).padStart(12, '0')}` as ReturnType<
        typeof crypto.randomUUID
      >
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

/** Replaces UUIDs and checksums with stable tokens in order of appearance, and every timestamp. */
function golden(value: unknown) {
  const tokens = new Map<string, string>()
  const token = (kind: string) => (match: string) => {
    let name = tokens.get(match)
    if (!name) {
      name = `<${kind}:${tokens.size}>`
      tokens.set(match, name)
    }
    return name
  }
  return JSON.parse(
    JSON.stringify(value)
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, token('uuid'))
      .replace(/\b[0-9a-f]{64}\b/g, token('sha'))
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, '<time>')
  )
}

async function memberViews(base: PlayerControlFixture) {
  const encounterId = base.run.id
  const view = async (member: PlayerControlFixture['owner']) => ({
    projection: await member.caller.query(api.encounters.projectionReads.get, { encounterId }),
    pending: await member.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
      encounterId
    })
  })
  return {
    gm: await view(base.owner),
    player: await view(base.player),
    other: await view(base.other)
  }
}

describe('Encounter projections built on read', () => {
  for (const { name, setup } of encounterConformanceCorpus)
    it(name, async () => {
      const { base, operation } = await setup()
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-27T12:00:00.000Z') })
      const result = await base.owner.caller.run((ctx) => operation(encounterWriteTransaction(ctx)))
      vi.useRealTimers()
      expect(golden({ result: result ?? null, views: await memberViews(base) })).toMatchSnapshot()
      await expectProjectionFactsCurrent(base)
    })
})

/**
 * The stored projection facts project exactly what projecting the actor documents does, so no write
 * path left an actor's facts behind (ADR 0035 Amendment 12).
 */
async function expectProjectionFactsCurrent(base: PlayerControlFixture) {
  await base.owner.caller.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!run) throw new Error('Missing parity Run.')
    const state = readRunState(run)
    const actors = await readRunActors({ db: createConvexEncounterStoreReader(ctx) }, state)
    const facts = buildEncounterActorRuleFacts({ actors })
    const rules = reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
      facts
    )
    const transaction = encounterReadTransaction(ctx)
    expect(await readEncounterGmProjection(transaction, state)).toEqual(
      await projectNativeGm(transaction, state, actors, rules)
    )
  })
}

describe('Encounter command replay', () => {
  async function expectExactReplay(
    member: PlayerControlFixture['owner'],
    command: EncounterCommandInputDto
  ) {
    const original = await executeInRoom(member.caller, { command })
    const replay = await executeInRoom(member.caller, { command })
    expect(JSON.stringify(replay)).toBe(JSON.stringify(original))
    return original
  }

  it('returns the same bytes to the GM for GM tools, actions and turns', async () => {
    const base = await playerControlFixture()
    await expectExactReplay(base.owner, {
      type: 'UPDATE_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await base.version(),
      actorId: base.enemy.id,
      currentHitPoints: 7
    })
    await expectExactReplay(base.owner, await base.bite(base.companion.id, base.enemy.id))
    await expectExactReplay(base.owner, {
      type: 'ADVANCE_TURN',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await base.version()
    })
    await expectExactReplay(base.owner, {
      type: 'REMOVE_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await base.version(),
      actorId: base.lurker.id
    })
  })

  it('returns the same bytes to a player for their action', async () => {
    const base = await playerControlFixture()
    await setActorControllers(base, base.companion.id, [base.player.userId])
    await expectExactReplay(base.player, await base.bite(base.companion.id, base.enemy.id))
  })

  it('returns the same bytes for a paused action', async () => {
    const base = await playerControlFixture({ bite: 'ATTACK', promptRolls: true })
    const paused = await expectExactReplay(
      base.owner,
      await base.bite(base.companion.id, base.enemy.id)
    )
    expect(paused.occurrence?.pending).not.toBeNull()
  })
})
