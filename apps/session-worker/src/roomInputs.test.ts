import { describe, expect, it } from 'vitest'
import {
  liveRoomCharacterPartSchema,
  type LiveRoomInputsDocument,
  type LiveRoomInputsInput,
  type LiveRoomInputsResponse,
  type LiveRoomInputsScope
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import { readRoomInputsBatch } from '@artificer-toolkit/schema/api/liveRoomInputsBatch'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { characterPageFixture } from './testing/characterPageFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'

const uuid = (index: number) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
const EPOCH = uuid(0x900)
const CAMPAIGN = uuid(2)
const ENCOUNTER = uuid(1)
const FIRST_CHARACTER = uuid(0x201)
const SECOND_CHARACTER = uuid(0x202)
/** A query page holds four Run documents and one Character effect, so every read spans pages. */
const RUN_PAGE_SIZE = 4
const EFFECT_PAGE_SIZE = 1
/** Workers Free allows 50 subrequests per invocation; a Run's hydrate must leave the room room. */
const HYDRATE_SUBREQUEST_BUDGET = 10

const characterPage = (() => {
  const part = liveRoomCharacterPartSchema.parse(characterPageFixture)
  if (part.status !== 'ASSIGNED') throw new Error('The Character fixture is not assigned.')
  return part
})()

const revisions = (label: number, characterId?: string): LiveSessionRulesRevisions => [
  { scope: 'SYSTEM', id: uuid(0x10), revision: uuid(0x1000 + label) },
  { scope: 'CAMPAIGN', id: uuid(0x11), revision: uuid(0x2000 + label) },
  characterId
    ? { scope: 'CHARACTER', id: characterId, revision: uuid(0x3000 + label) }
    : { scope: 'PLAY', id: uuid(0x12), revision: uuid(0x4000 + label) }
]

const checksum = (label: string) => sha256Hex(label)
let creationTime = 1_780_000_000_000
const document = (
  table: string,
  id: string,
  fields: Record<string, unknown>
): LiveRoomInputsDocument => ({ table, id, creationTime: creationTime++, fields })

/** A Run actor: a creature (`null`), a Character, or a Character whose state is frozen in the actor. */
type ActorSpec = null | string | { sourceId: string; frozen: true }

const frozenState = { currentHitPoints: 7, maxHitPoints: 11, tempHitPoints: 0, conditions: [] }

function actorState(actor: ActorSpec, padding: number) {
  const filler = 'a'.repeat(padding)
  if (actor === null) return { kind: 'CREATURE', sourceId: uuid(0x300), filler }
  if (typeof actor === 'string')
    return { kind: 'CHARACTER', sourceId: actor, frozenState: null, filler }
  return { kind: 'CHARACTER', sourceId: actor.sourceId, frozenState, filler }
}

function runDocuments(actors: readonly ActorSpec[], padding: number) {
  return [
    document('encounterRuns', 'convex:run', {
      id: ENCOUNTER,
      campaignId: CAMPAIGN,
      gameSystemId: uuid(3),
      status: 'ACTIVE',
      version: 1,
      stateJson: '{}',
      stateChecksum: checksum('run'),
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z'
    }),
    ...actors.map((actor, index) =>
      document('encounterRunActors', `convex:${0x100 + index}`, {
        id: uuid(0x100 + index),
        encounterId: ENCOUNTER,
        stateJson: JSON.stringify(actorState(actor, padding)),
        stateChecksum: checksum(`actor:${index}`)
      })
    )
  ]
}

const effect = (characterId: string, ordinal: number) =>
  document('characterActiveRuleEffects', `convex:${0x4000 + ordinal}`, {
    id: uuid(0x4000 + ordinal),
    maintainedEffectStateId: null,
    createdOrdinal: ordinal,
    version: 1,
    definitionJson: '{}',
    definitionChecksum: checksum(`effect:${ordinal}`),
    lifecycle: { schemaVersion: 1, remainingTicks: null },
    lifecycleChecksum: checksum(`lifecycle:${ordinal}`),
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    characterId,
    sourceEncounterId: null
  })

/**
 * A Convex that serves the room's inputs from mutable state. `page` answers one query; `read`
 * answers one route call, which joins pages the way the real route does, so `reads.length` is the
 * number of Worker subrequests.
 */
function fakeConvex(actors: readonly ActorSpec[], padding: number, runPageSize: number) {
  const state = {
    run: runDocuments(actors, padding),
    runVersion: 1,
    /** Called before each Run page is served, to change the Run between pages. */
    onRunPage: (_pageIndex: number) => {},
    /** Called before each Character is served, to change the Campaign during the hydrate. */
    onCharacterPage: (_characterId: string) => {},
    label: 1,
    unassigned: new Set<string>(),
    characters: new Map<string, LiveRoomInputsDocument[]>([
      [FIRST_CHARACTER, [effect(FIRST_CHARACTER, 1), effect(FIRST_CHARACTER, 2)]],
      [SECOND_CHARACTER, []]
    ])
  }
  const reads: { epoch: string; scope: LiveRoomInputsScope }[] = []
  const pages: LiveRoomInputsScope[] = []
  const page = async ({ scope }: LiveRoomInputsInput): Promise<LiveRoomInputsResponse> => {
    pages.push(scope)
    switch (scope.kind) {
      case 'RUN': {
        const pageIndex = scope.cursor?.position ?? 0
        state.onRunPage(pageIndex)
        const start = pageIndex * runPageSize
        const next = start + runPageSize
        return {
          kind: 'RUN',
          encounterVersion: state.runVersion,
          documents: state.run.slice(start, next),
          continueCursor:
            next < state.run.length ? { position: pageIndex + 1, paginationCursor: null } : null
        }
      }
      case 'CHARACTERS': {
        const position = scope.cursor?.position ?? 0
        const characterId = scope.characterIds[position]
        if (!characterId) throw new Error('Room input cursor is invalid.')
        state.onCharacterPage(characterId)
        const nextCharacter =
          position + 1 < scope.characterIds.length
            ? { position: position + 1, paginationCursor: null }
            : null
        if (state.unassigned.has(characterId))
          return {
            kind: 'CHARACTERS',
            parts: [{ status: 'UNASSIGNED', characterId }],
            continueCursor: nextCharacter
          }
        const effects = state.characters.get(characterId) ?? []
        const offset = Number(scope.cursor?.paginationCursor ?? 0)
        const end = offset + EFFECT_PAGE_SIZE
        return {
          kind: 'CHARACTERS',
          parts: [
            {
              ...characterPage,
              characterId,
              revisions: revisions(state.label, characterId),
              inputs: offset === 0 ? characterPage.inputs : null,
              documents: effects.slice(offset, end)
            }
          ],
          continueCursor:
            end < effects.length ? { position, paginationCursor: String(end) } : nextCharacter
        }
      }
      case 'CAMPAIGN_PLAY':
        return {
          kind: 'CAMPAIGN_PLAY',
          revisions: revisions(state.label),
          campaign: {
            id: CAMPAIGN,
            gameSystemId: uuid(3),
            ownerUserId: uuid(4),
            contentMaturity: 'STANDARD',
            attunementSlotOverride: null,
            currencyOptions: []
          }
        }
      case 'SYSTEM':
        return { kind: 'SYSTEM', revisions: revisions(state.label), system: null, vocabulary: null }
      case 'DEFINITION':
        return { kind: 'DEFINITION', revisions: revisions(state.label), definition: null }
    }
  }
  const read = (epoch: string, scope: LiveRoomInputsScope) => {
    reads.push({ epoch, scope })
    return readRoomInputsBatch(page, { campaignId: CAMPAIGN, epoch, scope })
  }
  return { state, reads, pages, read }
}

function open(actors: readonly ActorSpec[], { padding = 0, runPageSize = RUN_PAGE_SIZE } = {}) {
  const convex = fakeConvex(actors, padding, runPageSize)
  const { storage } = createNodeSqliteRoomStorage()
  const store = new RoomEncounterStore(storage)
  return { ...convex, storage, store, inputs: new RoomInputs(store, convex.read) }
}

const kinds = (reads: readonly { scope: LiveRoomInputsScope }[] | readonly LiveRoomInputsScope[]) =>
  reads.map((read) => ('scope' in read ? read.scope.kind : read.kind))
const count = (
  reads: readonly { scope: LiveRoomInputsScope }[] | readonly LiveRoomInputsScope[],
  kind: LiveRoomInputsScope['kind']
) => kinds(reads).filter((read) => read === kind).length

/** Marks the actor of `sourceId` frozen in the Run, as the Campaign departure does. */
function freezeActor(run: LiveRoomInputsDocument[], sourceId: string) {
  const index = run.findIndex(
    (row) =>
      row.table === 'encounterRunActors' &&
      typeof row.fields.stateJson === 'string' &&
      row.fields.stateJson.includes(sourceId)
  )
  const row = run[index]
  if (!row || typeof row.fields.stateJson !== 'string') throw new Error('The actor is missing.')
  run[index] = {
    ...row,
    fields: {
      ...row.fields,
      stateJson: JSON.stringify({ ...JSON.parse(row.fields.stateJson), frozenState })
    }
  }
}

describe('room inputs (ADR 0035 S2)', () => {
  describe('hydrate', () => {
    it('reads the Run, each Character once, the play scope and the System', async () => {
      const convex = open([FIRST_CHARACTER, null, SECOND_CHARACTER, FIRST_CHARACTER, null])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })

      expect(convex.store.epoch).toBe(EPOCH)
      expect(convex.reads.every((read) => read.epoch === EPOCH)).toBe(true)
      // Six Run documents in pages of four join into one call; the two distinct Characters, whose
      // effects arrive one per page, into another (a duplicate actor does not read again).
      expect(count(convex.reads, 'RUN')).toBe(1)
      expect(count(convex.reads, 'CHARACTERS')).toBe(1)
      expect(count(convex.reads, 'CAMPAIGN_PLAY')).toBe(1)
      expect(count(convex.reads, 'SYSTEM')).toBe(2)
      expect(count(convex.pages, 'RUN')).toBe(2)
      expect(count(convex.pages, 'CHARACTERS')).toBe(3)

      expect(convex.store.documents('encounterRunActors')).toHaveLength(5)
      expect(convex.store.documents('characterActiveRuleEffects')).toHaveLength(2)
      expect(convex.store.records('ROOM_INPUT').map((record) => record.key)).toEqual([
        'CAMPAIGN_PLAY',
        `CHARACTER:${FIRST_CHARACTER}`,
        `CHARACTER:${SECOND_CHARACTER}`,
        'SYSTEM:SYSTEM',
        'SYSTEM:VOCABULARY'
      ])
    })

    it('holds only the epoch when no Encounter is bound, without reading Convex', async () => {
      const convex = open([FIRST_CHARACTER])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null })
      expect(convex.reads).toEqual([])
      expect(convex.store.epoch).toBe(EPOCH)
      expect(convex.store.documents('encounterRuns')).toEqual([])
    })

    it('reads the Run again when a command changed it between pages', async () => {
      const convex = open([FIRST_CHARACTER, null, SECOND_CHARACTER, null, null])
      let changed = false
      convex.state.onRunPage = (pageIndex) => {
        if (pageIndex === 1 && !changed) {
          changed = true
          convex.state.runVersion += 1
        }
      }
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })
      // The torn first read takes two calls (the batch stops at the version change); the second, one.
      expect(count(convex.reads, 'RUN')).toBe(3)
      expect(convex.store.documents('encounterRuns')).toHaveLength(1)
    })

    it('fails, leaving the store untouched, when the Run never holds still', async () => {
      const convex = open([FIRST_CHARACTER, null, null, null, null])
      convex.state.onRunPage = (pageIndex) => {
        if (pageIndex === 1) convex.state.runVersion += 1
      }
      await expect(convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })).rejects.toThrow(
        'changed while it was being read'
      )
      expect(convex.store.epoch).toBeNull()
    })

    it('refuses a Character without stored inputs', async () => {
      const convex = open([FIRST_CHARACTER])
      const read = convex.read
      const inputs = new RoomInputs(convex.store, async (epoch, scope) => {
        const response = await read(epoch, scope)
        return response.kind === 'CHARACTERS'
          ? {
              ...response,
              parts: response.parts.map((part) =>
                part.status === 'ASSIGNED' ? { ...part, inputs: null } : part
              )
            }
          : response
      })
      await expect(inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })).rejects.toThrow(
        'Character inputs are missing'
      )
      expect(convex.store.epoch).toBeNull()
    })
  })

  describe('subrequest budget', () => {
    const characters = Array.from({ length: 12 }, (_, index) => uuid(0x201 + index))

    it('hydrates a Run of 11 actors in a handful of subrequests', async () => {
      const convex = open([...characters.slice(0, 3), ...Array<null>(8).fill(null)])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })
      // The play scope, the System and its vocabulary, one Run call and one Characters call.
      expect(convex.reads).toHaveLength(5)
      expect(convex.store.documents('encounterRunActors')).toHaveLength(11)
    })

    it('hydrates a Run of 100 actors with 12 Characters within the subrequest budget', async () => {
      const convex = open([...characters, ...Array<null>(88).fill(null)], {
        padding: 6_000,
        runPageSize: 8
      })
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })

      expect(convex.reads.length).toBeLessThanOrEqual(HYDRATE_SUBREQUEST_BUDGET)
      expect(count(convex.reads, 'RUN')).toBe(1)
      expect(count(convex.reads, 'CHARACTERS')).toBe(1)
      // The query pages behind those calls are what a per-page route would have spent.
      expect(count(convex.pages, 'RUN')).toBe(13)
      expect(count(convex.pages, 'CHARACTERS')).toBeGreaterThanOrEqual(12)
      expect(convex.store.documents('encounterRunActors')).toHaveLength(100)
      expect(
        convex.store.records('ROOM_INPUT').filter((record) => record.key.startsWith('CHARACTER:'))
      ).toHaveLength(12)
    })

    it('spends a further call per byte budget on a Run of very large actors', async () => {
      // Each actor is about 300 KB, so two pages of three actors exceed the 2 MB batch budget.
      const convex = open([...characters.slice(0, 2), ...Array<null>(10).fill(null)], {
        padding: 300_000,
        runPageSize: 4
      })
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })
      expect(count(convex.reads, 'RUN')).toBe(2)
      expect(count(convex.pages, 'RUN')).toBe(4)
      expect(convex.store.documents('encounterRunActors')).toHaveLength(12)
    })
  })

  describe('a Character that left the Campaign', () => {
    it('reads no inputs for an actor whose state is frozen', async () => {
      const convex = open([FIRST_CHARACTER, { sourceId: SECOND_CHARACTER, frozen: true }, null])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })

      expect([
        ...new Set(
          convex.pages.flatMap((scope) => (scope.kind === 'CHARACTERS' ? scope.characterIds : []))
        )
      ]).toEqual([FIRST_CHARACTER])
      expect(convex.store.records('ROOM_INPUT').map((record) => record.key)).not.toContain(
        `CHARACTER:${SECOND_CHARACTER}`
      )
      const frozen = convex.store
        .documents('encounterRunActors')
        .map((row) => JSON.parse(row.stateJson) as { frozenState: unknown })
        .filter((actor) => actor.frozenState !== null && actor.frozenState !== undefined)
      expect(frozen).toHaveLength(1)
    })

    it('reads the Run again when the Character left between the Run and its Characters', async () => {
      const convex = open([FIRST_CHARACTER, SECOND_CHARACTER, null])
      convex.state.onCharacterPage = (characterId) => {
        if (characterId !== SECOND_CHARACTER || convex.state.unassigned.has(characterId)) return
        convex.state.unassigned.add(characterId)
        freezeActor(convex.state.run, characterId)
      }
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })

      expect(count(convex.reads, 'RUN')).toBe(2)
      expect(convex.store.records('ROOM_INPUT').map((record) => record.key)).toEqual([
        'CAMPAIGN_PLAY',
        `CHARACTER:${FIRST_CHARACTER}`,
        'SYSTEM:SYSTEM',
        'SYSTEM:VOCABULARY'
      ])
      const actors = convex.store
        .documents('encounterRunActors')
        .map((row) => JSON.parse(row.stateJson) as { sourceId: string; frozenState?: unknown })
      expect(actors.find((actor) => actor.sourceId === SECOND_CHARACTER)?.frozenState).toEqual(
        frozenState
      )
    })

    it('fails closed when a Character is unassigned but its actor is not frozen', async () => {
      const convex = open([FIRST_CHARACTER, SECOND_CHARACTER])
      convex.state.unassigned.add(SECOND_CHARACTER)
      await expect(convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })).rejects.toThrow(
        'unassigned but not frozen'
      )
      expect(convex.store.epoch).toBeNull()
    })

    it('refuses a demand read of a Character that left the Campaign', async () => {
      const convex = open([FIRST_CHARACTER])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })
      convex.state.unassigned.add(FIRST_CHARACTER)
      await expect(convex.inputs.character(FIRST_CHARACTER, null)).rejects.toThrow(
        'no longer assigned'
      )
    })
  })

  describe('revision-keyed cache', () => {
    async function hydrated() {
      const convex = open([FIRST_CHARACTER, SECOND_CHARACTER])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })
      convex.reads.length = 0
      return convex
    }

    it('serves a scope from the store while the observed revisions include its own', async () => {
      const convex = await hydrated()
      const held = revisions(1)
      const extra = [...held, { scope: 'PLAY' as const, id: uuid(0x13), revision: uuid(0x5000) }]
      const play = await convex.inputs.play(extra)
      expect(play.campaign.id).toBe(CAMPAIGN)
      expect(await convex.inputs.system('SYSTEM', held)).toMatchObject({ kind: 'SYSTEM' })
      expect(convex.reads).toEqual([])
    })

    it('reads a scope again when a revision changed, and stores the new read', async () => {
      const convex = await hydrated()
      convex.state.label = 2
      await convex.inputs.play(revisions(2))
      expect(kinds(convex.reads)).toEqual(['CAMPAIGN_PLAY'])
      convex.reads.length = 0
      await convex.inputs.play(revisions(2))
      expect(convex.reads).toEqual([])
    })

    it('reads a scope again when nothing is observed', async () => {
      const convex = await hydrated()
      await convex.inputs.definition(uuid(0x600), null)
      await convex.inputs.play(null)
      expect(kinds(convex.reads)).toEqual(['DEFINITION', 'CAMPAIGN_PLAY'])
    })

    it('replaces a Character’s effects and record in one room command, once', async () => {
      const convex = await hydrated()
      const rowsBefore = convex.store.logRows
      convex.state.characters.set(FIRST_CHARACTER, [effect(FIRST_CHARACTER, 3)])
      convex.state.label = 2

      const loaded = await convex.inputs.character(FIRST_CHARACTER, revisions(2, FIRST_CHARACTER))
      expect(loaded.inputs).toEqual(characterPage.inputs)
      expect(kinds(convex.reads)).toEqual(['CHARACTERS'])
      expect(
        convex.store.documents('characterActiveRuleEffects').map((row) => row.createdOrdinal)
      ).toEqual([3])
      expect(convex.store.logRows).toBe(rowsBefore + 1)

      // The change is durable: a restarted store holds the same effects and record.
      const restarted = new RoomEncounterStore(convex.storage)
      expect(restarted.documents('characterActiveRuleEffects')).toEqual(
        convex.store.documents('characterActiveRuleEffects')
      )
      expect(restarted.records('ROOM_INPUT')).toEqual(convex.store.records('ROOM_INPUT'))
      expect(restarted.checksum).toBe(convex.store.checksum)

      convex.reads.length = 0
      await convex.inputs.character(FIRST_CHARACTER, revisions(2, FIRST_CHARACTER))
      expect(convex.reads).toEqual([])
      expect(convex.store.logRows).toBe(rowsBefore + 1)
    })

    it('refuses a demand read before the store is hydrated', async () => {
      const convex = open([FIRST_CHARACTER])
      await expect(convex.inputs.play(null)).rejects.toThrow('has not been hydrated')
    })
  })
})
