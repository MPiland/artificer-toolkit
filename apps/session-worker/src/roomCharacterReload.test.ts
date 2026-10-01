import { expect, it, vi } from 'vitest'
import {
  liveRoomCharacterPartSchema,
  type LiveRoomInputsResponse,
  type LiveRoomInputsScope
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import { liveSessionRoomWriteSetSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import {
  characterDocumentSchema,
  encodeCharacterRecord,
  readCharacterPlay,
  readCharacterRecord,
  readCharacterSheetState,
  readCharacterSheetStructure
} from '@artificer-toolkit/schema/projections/characterStoredState'
import {
  characterStoredHeadSchema,
  characterStoredPlayStateSchema
} from '@artificer-toolkit/schema/projections/characterPersistence'
import { characterActiveRuleEffectStoredSchema } from '@artificer-toolkit/schema/projections/activeRuleEffectStorage'
import { parentClassAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { reconcileCharacterHitDice } from '@artificer-toolkit/rules-runtime/character/builderHitPoints'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { prepareLiveCharacterSheetFacts } from './nativeCharacterRules.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { characterPageFixture } from './testing/characterPageFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'

const native = vi.hoisted(() => ({ prepare: vi.fn() }))
vi.mock('./nativeCharacterRules.js', () => ({ prepareLiveCharacterSheetFacts: native.prepare }))

function builderPart(level: number, revision: string, updatedAt: string, label: string) {
  const page = liveRoomCharacterPartSchema.parse(characterPageFixture)
  if (page.status !== 'ASSIGNED' || !page.inputs) throw new Error('Missing Character fixture.')
  const previous = page.inputs.owner
  const document = readCharacterRecord(previous)
  const classId = document.intent.classes[0]!.classId
  const edited = characterDocumentSchema.parse({
    ...document,
    label,
    intent: {
      ...document.intent,
      classes: [{ ...document.intent.classes[0], classLevel: level }],
      hitpoints: {
        ...document.intent.hitpoints,
        levels: Array.from({ length: level }, (_, index) => ({
          classId,
          classLevel: index + 1,
          level: index + 1,
          value: 11
        }))
      }
    },
    state: {
      ...document.state,
      hitpoints: { current: level * 11, hitDice: [{ die: 10, total: level, used: 0 }] }
    }
  })
  const owner = encodeCharacterRecord(
    {
      ...previous,
      label,
      play: { ...previous.play, maximumHitPoints: level * 11 }
    },
    { document: edited, sheetState: page.inputs.sheetState, streamVersion: 1, updatedAt }
  )
  return {
    ...page,
    revisions: page.revisions.map((entry) =>
      entry.scope === 'CHARACTER' ? { ...entry, revision } : entry
    ),
    inputs: { ...page.inputs, owner }
  }
}

function evidence(store: RoomEncounterStore) {
  return {
    head: store.documents('characters'),
    play: store.documents('characterPlayStates'),
    effects: store.documents('characterActiveRuleEffects'),
    records: store.records('ROOM_INPUT'),
    sequence: store.sequence,
    checksum: store.checksum,
    logRows: store.logRows
  }
}

it.each([
  { level: 1, expectedHitPoints: 11 },
  { level: 2, expectedHitPoints: 18 },
  { level: 3, expectedHitPoints: 18 }
])(
  'retains native play across a Builder reload to level $level, atomically and after SQLite recovery',
  async ({ level, expectedHitPoints }) => {
    const initial = builderPart(2, uuid(0x901), '2026-09-30T00:00:00.000Z', 'Initial Builder')
    const fresh = builderPart(level, uuid(0x902), '2026-09-30T00:00:20.000Z', 'Edited Builder')
    const owner = initial.inputs.owner
    const campaignId = initial.inputs.campaign.id
    const epoch = uuid(0x903)
    const classId = readCharacterRecord(owner).intent.classes[0]!.classId
    const authoredClass = parentClassAuthoredDtoSchema.parse({
      id: classId,
      systemId: owner.systemId,
      userId: owner.userId,
      label: 'Hit-dice fixture class',
      category: 'BASE',
      hitpoint: { ability: 'CONSTITUTION', dieConfig: '1d10' },
      startingGold: { multiplier: 1, currencyId: uuid(0x904), dieConfig: '1d4' },
      startingEquipment: { id: uuid(0x905), sets: [] },
      multiclass: { id: uuid(0x906), requirementGroups: { groups: [] } }
    })
    const system = systemAuthoredDtoSchema.parse({
      id: owner.systemId,
      userId: owner.userId,
      label: 'Reload fixture System',
      rulesetCode: 'DND5E',
      rulesetVersion: '2014',
      alignments: [],
      challengeRatings: [],
      conditionTypes: [],
      creatureTypes: [],
      currencies: [],
      damageTypes: [],
      heritages: [],
      languages: [],
      lifestyles: [],
      magicSchools: [],
      passives: [],
      rarities: [],
      senses: [],
      skills: [],
      speeds: [],
      terrains: []
    })
    const systemInput: Extract<LiveRoomInputsResponse, { kind: 'SYSTEM' }> = {
      kind: 'SYSTEM',
      system,
      vocabulary: null,
      revisions: initial.revisions.filter(({ scope }) => scope !== 'CHARACTER')
    }
    const lifecycle = { schemaVersion: 1, remainingTicks: null }
    const effect = characterActiveRuleEffectStoredSchema.parse({
      id: uuid(0x907),
      characterId: owner.id,
      sourceEncounterId: null,
      maintainedEffectStateId: null,
      createdOrdinal: 1,
      version: 1,
      definitionJson: '{}',
      definitionChecksum: checksumRuleDocument({}),
      lifecycle,
      lifecycleChecksum: checksumRuleDocument(lifecycle),
      createdAt: owner.createdAt,
      updatedAt: owner.createdAt
    })
    const { storage, database } = createNodeSqliteRoomStorage()
    const store = new RoomEncounterStore(storage)
    const { _id, _creationTime, documentJson: _document, sheetState: _sheet, play, ...head } = owner
    const { _id: playId, _creationTime: playCreated, ...playFields } = play
    store.hydrate({
      epoch,
      documents: [
        {
          table: 'characters',
          id: _id,
          creationTime: _creationTime,
          fields: characterStoredHeadSchema.parse({
            ...head,
            sheetStateChecksum: checksumRuleDocument(readCharacterSheetStructure(owner.sheetState))
          })
        },
        { table: 'characterPlayStates', id: playId, creationTime: playCreated, fields: playFields },
        {
          table: 'characterActiveRuleEffects',
          id: 'fixture:effect',
          creationTime: _creationTime,
          fields: effect
        }
      ],
      records: [
        {
          kind: 'ROOM_INPUT',
          key: `CHARACTER:${owner.id}`,
          revision: JSON.stringify(initial.revisions),
          json: JSON.stringify(initial)
        },
        {
          kind: 'ROOM_INPUT',
          key: 'SYSTEM:SYSTEM',
          revision: JSON.stringify(systemInput.revisions),
          json: JSON.stringify(systemInput)
        }
      ]
    })
    const usage = (id: string, resourceGrantId: string, used: number) => ({
      id,
      characterId: owner.id,
      createdBy: owner.userId,
      updatedBy: owner.userId,
      createdAt: owner.createdAt,
      updatedAt: owner.createdAt,
      owner: { kind: 'AUTHORED_GRANT' as const, resourceGrantId },
      used
    })
    const retainedUsage = usage(uuid(0x908), uuid(0x909), 5)
    const orphanedUsage = usage(uuid(0x90a), uuid(0x90b), 9)
    const retainedPool = createCharacterResourceOwnerKey(retainedUsage.owner)
    const localPlay = characterStoredPlayStateSchema.parse({
      ...playFields,
      state: {
        ...playFields.state,
        hitpoints: {
          ...playFields.state.hitpoints,
          current: 18,
          temp: 3,
          hitDice: [{ die: 10, total: 2, used: 1 }]
        },
        conditions: [{ conditionTypeId: uuid(0x90c), notes: 'Native condition' }],
        spellSlots: [{ slotKey: 'spell:1', used: 2 }],
        resourceUsage: [retainedUsage, orphanedUsage]
      }
    })
    localPlay.checksum = checksumRuleDocument(localPlay.state)
    localPlay.streamVersion = playFields.streamVersion + 1
    localPlay.updatedAt = '2026-09-30T00:00:10.000Z'
    const read = vi.fn(
      async (_epoch: string, scope: LiveRoomInputsScope): Promise<LiveRoomInputsResponse> => {
        if (scope.kind !== 'CHARACTERS') throw new Error('Unexpected reload input scope.')
        expect(scope.characterIds).toEqual([owner.id])
        return {
          kind: 'CHARACTERS',
          continueCursor: null,
          parts: [
            {
              ...fresh,
              documents: [
                {
                  table: 'characterActiveRuleEffects',
                  id: 'fixture:effect',
                  creationTime: _creationTime,
                  fields: { ...effect, version: 2 }
                }
              ]
            }
          ]
        }
      }
    )
    const inputs = new RoomInputs(store, read, async () => [])
    native.prepare.mockImplementation(
      async (
        _input: Parameters<typeof prepareLiveCharacterSheetFacts>[0],
        capture: Parameters<typeof prepareLiveCharacterSheetFacts>[1]
      ) => {
        const captured = await capture({ kind: 'INPUTS' })
        if (captured.kind !== 'INPUTS') throw new Error('Missing native preparation inputs.')
        const character = readCharacterRecord(captured.owner)
        const hitDice = reconcileCharacterHitDice(
          character.intent.classes,
          [authoredClass],
          character.state.hitpoints.hitDice
        )
        return {
          active: captured.owner,
          prepared: {
            character: {
              ...character,
              state: { ...character.state, hitpoints: { ...character.state.hitpoints, hitDice } }
            }
          },
          ruleEvaluation: {
            facts: { movementFacts: { speeds: [] } },
            output: {
              resources: [{ poolId: retainedPool }],
              derivedStats: {
                maxHitPoints: { effective: character.intent.classes[0]!.classLevel * 11 }
              },
              movement: { speeds: [] }
            }
          }
        }
      }
    )
    try {
      const storedPlay = store.documents('characterPlayStates')[0]
      if (!storedPlay) throw new Error('Missing native Character play.')
      await store.transact(async () => {
        await store.store.replace(storedPlay._id, localPlay)
      })
      const before = evidence(store)
      const scope = {
        campaignId,
        authorityEpoch: epoch,
        characterId: owner.id,
        expectedUserId: owner.userId,
        expectedRole: 'PLAYER' as const
      }
      await expect(
        store.transact(async (transaction) => {
          await prepareRoomLiveCharacterSheet(store, inputs, scope, fresh.revisions, transaction)
          const staged = await inputs.character(owner.id, fresh.revisions, transaction)
          if (!staged.inputs) throw new Error('Missing staged Character.')
          expect(readCharacterRecord(staged.inputs.owner).label).toBe('Edited Builder')
          expect(readCharacterRecord(staged.inputs.owner).state.hitpoints.current).toBe(
            expectedHitPoints
          )
          expect(inputs.characterBuilderSnapshot(owner.id)?.label).toBe('Initial Builder')
          throw new Error('Parent command refused.')
        })
      ).rejects.toThrow('Parent command refused.')
      expect(evidence(store)).toEqual(before)
      await store.transact(async (transaction) => {
        await prepareRoomLiveCharacterSheet(store, inputs, scope, fresh.revisions, transaction)
      })
      const part = await inputs.character(owner.id, fresh.revisions)
      if (!part.inputs) throw new Error('Missing committed Character.')
      const document = readCharacterRecord(part.inputs.owner)
      const finalPlay = part.inputs.owner.play
      expect(document).toMatchObject({
        label: 'Edited Builder',
        intent: { classes: [{ classLevel: level }] }
      })
      expect(document.state.hitpoints).toEqual({
        current: expectedHitPoints,
        temp: 3,
        hitDice: [{ die: 10, total: level, used: 1 }]
      })
      expect(document.state.conditions).toEqual(localPlay.state.conditions)
      expect(document.state.spellSlots).toEqual(localPlay.state.spellSlots)
      expect(readCharacterSheetState(part.inputs.owner).resourceUsage).toEqual([retainedUsage])
      expect(finalPlay.maximumHitPoints).toBe(level * 11)
      expect(finalPlay.streamVersion).toBe(localPlay.streamVersion + 1)
      expect(Date.parse(finalPlay.updatedAt)).toBeGreaterThan(Date.parse(localPlay.updatedAt))
      expect(finalPlay.checksum).toBe(checksumRuleDocument(readCharacterPlay(finalPlay)))
      expect(store.sequence).toBe(before.sequence + 1)
      expect(store.logRows).toBe(before.logRows + 1)
      expect(store.documents('characters')[0]).toMatchObject({
        label: fresh.inputs.owner.label,
        checksum: fresh.inputs.owner.checksum,
        updatedAt: fresh.inputs.owner.updatedAt
      })
      const row = storage.sql
        .exec('SELECT json FROM room_writeset_log WHERE sequence = ?', store.sequence)
        .toArray()[0]
      if (typeof row?.json !== 'string') throw new Error('Missing reload write set.')
      const writes = liveSessionRoomWriteSetSchema.parse(JSON.parse(row.json))
      expect(writes).toContainEqual(expect.objectContaining({ op: 'RESTORE', table: 'characters' }))
      expect(
        writes.filter((write) => write.op === 'REPLACE' && write.id === storedPlay._id)
      ).toHaveLength(1)
      expect(store.documents('characterActiveRuleEffects')).toEqual(before.effects)
      expect(read).toHaveBeenCalledTimes(2)
      const recovered = new RoomEncounterStore(storage)
      expect(evidence(recovered)).toEqual(evidence(store))
      const recoveredInputs = new RoomInputs(recovered, read, async () => [])
      const recoveredPart = await recoveredInputs.character(owner.id, fresh.revisions)
      if (!recoveredPart.inputs) throw new Error('Missing recovered Character.')
      expect(readCharacterRecord(recoveredPart.inputs.owner)).toEqual(document)
      expect(readCharacterSheetState(recoveredPart.inputs.owner).resourceUsage).toEqual([
        retainedUsage
      ])
      expect(read).toHaveBeenCalledTimes(2)
    } finally {
      native.prepare.mockReset()
      database.close()
    }
  }
)
