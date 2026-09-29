import { describe, expect, it } from 'vitest'
import {
  liveRoomInputsResponseSchema,
  type LiveRoomInputsDocument,
  type LiveRoomInputsResponse,
  type LiveRoomInputsScope
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { characterPageFixture } from './testing/characterPageFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'

const uuid = (index: number) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
const EPOCH = uuid(0x900)
const ENCOUNTER = uuid(1)
const FIRST_CHARACTER = uuid(0x201)
const SECOND_CHARACTER = uuid(0x202)
const RUN_PAGE_SIZE = 4

const characterPage = (() => {
  const page = liveRoomInputsResponseSchema.parse(characterPageFixture)
  if (page.kind !== 'CHARACTER') throw new Error('The Character fixture is not a page.')
  return page
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

function runDocuments(actorSources: readonly (string | null)[]) {
  return [
    document('encounterRuns', 'convex:run', {
      id: ENCOUNTER,
      campaignId: uuid(2),
      gameSystemId: uuid(3),
      status: 'ACTIVE',
      version: 1,
      stateJson: '{}',
      stateChecksum: checksum('run'),
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z'
    }),
    ...actorSources.map((sourceId, index) =>
      document('encounterRunActors', `convex:${0x100 + index}`, {
        id: uuid(0x100 + index),
        encounterId: ENCOUNTER,
        stateJson: JSON.stringify(
          sourceId ? { kind: 'CHARACTER', sourceId } : { kind: 'CREATURE', sourceId: uuid(0x300) }
        ),
        stateChecksum: checksum(`actor:${index}`)
      })
    )
  ]
}

const effect = (characterId: string, ordinal: number) =>
  document('characterActiveRuleEffects', `convex:${0x400 + ordinal}`, {
    id: uuid(0x400 + ordinal),
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

/** A Convex that serves the room's inputs from mutable state and records every read. */
function fakeConvex(actorSources: readonly (string | null)[]) {
  const state = {
    run: runDocuments(actorSources),
    runVersion: 1,
    /** Called before each Run page is served, to change the Run between pages. */
    onRunPage: (_pageIndex: number) => {},
    label: 1,
    characters: new Map<string, LiveRoomInputsDocument[]>([
      [FIRST_CHARACTER, [effect(FIRST_CHARACTER, 1), effect(FIRST_CHARACTER, 2)]],
      [SECOND_CHARACTER, []]
    ])
  }
  const reads: { epoch: string; scope: LiveRoomInputsScope }[] = []
  const read = async (
    epoch: string,
    scope: LiveRoomInputsScope
  ): Promise<LiveRoomInputsResponse> => {
    reads.push({ epoch, scope })
    switch (scope.kind) {
      case 'RUN': {
        const pageIndex = scope.cursor?.tableIndex ?? 0
        state.onRunPage(pageIndex)
        const start = pageIndex * RUN_PAGE_SIZE
        const next = start + RUN_PAGE_SIZE
        return {
          kind: 'RUN',
          encounterVersion: state.runVersion,
          documents: state.run.slice(start, next),
          continueCursor:
            next < state.run.length ? { tableIndex: pageIndex + 1, paginationCursor: null } : null
        }
      }
      case 'CHARACTER': {
        const effects = state.characters.get(scope.characterId) ?? []
        const first = scope.cursor === null
        return {
          ...characterPage,
          revisions: revisions(state.label, scope.characterId),
          inputs: first ? characterPage.inputs : null,
          documents: first ? [] : effects,
          continueCursor: first ? { tableIndex: 0, paginationCursor: null } : null
        }
      }
      case 'CAMPAIGN_PLAY':
        return {
          kind: 'CAMPAIGN_PLAY',
          revisions: revisions(state.label),
          campaign: {
            id: uuid(2),
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
  return { state, reads, read }
}

function open(actorSources: readonly (string | null)[]) {
  const convex = fakeConvex(actorSources)
  const { storage } = createNodeSqliteRoomStorage()
  const store = new RoomEncounterStore(storage)
  return { ...convex, storage, store, inputs: new RoomInputs(store, convex.read) }
}

const kinds = (reads: readonly { scope: LiveRoomInputsScope }[]) =>
  reads.map(({ scope }) => scope.kind)

describe('room inputs (ADR 0035 S2)', () => {
  describe('hydrate', () => {
    it('reads the Run pages, each Character once, the play scope and the System', async () => {
      const convex = open([FIRST_CHARACTER, null, SECOND_CHARACTER, FIRST_CHARACTER, null])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })

      expect(convex.store.epoch).toBe(EPOCH)
      expect(convex.reads.every((read) => read.epoch === EPOCH)).toBe(true)
      const count = (kind: LiveRoomInputsScope['kind']) =>
        kinds(convex.reads).filter((read) => read === kind).length
      // Six Run documents in pages of four.
      expect(count('RUN')).toBe(2)
      // Two distinct Characters, two pages each; a duplicate actor does not read again.
      expect(count('CHARACTER')).toBe(4)
      expect(count('CAMPAIGN_PLAY')).toBe(1)
      expect(count('SYSTEM')).toBe(2)

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
      expect(kinds(convex.reads).filter((kind) => kind === 'RUN')).toHaveLength(4)
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
        return response.kind === 'CHARACTER' ? { ...response, inputs: null } : response
      })
      await expect(inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })).rejects.toThrow(
        'Character inputs are missing'
      )
      expect(convex.store.epoch).toBeNull()
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
      expect(play.campaign.id).toBe(uuid(2))
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
      expect(kinds(convex.reads)).toEqual(['CHARACTER', 'CHARACTER'])
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
