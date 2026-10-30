import { expect, it, vi } from 'vitest'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import type {
  LiveRoomInputsResponse,
  LiveRoomInputsScope
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import { liveSessionRoomWriteSetSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import {
  characterDocumentSchema,
  encodeCharacterRecord,
  readCharacterPlay,
  readCharacterRecord,
  readCharacterSheetState
} from '@artificer-toolkit/schema/projections/characterStoredState'
import { characterStoredPlayStateSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { characterActiveRuleEffectStoredSchema } from '@artificer-toolkit/schema/projections/activeRuleEffectStorage'
import { sourceEncounterIdForDefinition } from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { prepareLiveCharacterSheetFacts } from './nativeCharacterRules.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'
import {
  srdCharacterScope,
  srdRoomCharacter,
  srdRoomHydration
} from './testing/srdRoomCharacter.js'

const srd = srdRoomCharacter({
  characterId: uuid(0x90c),
  userId: uuid(0x90d),
  campaignId: uuid(0x90e),
  secondWind: true
})

/** The SRD Fighter fixture's maximum Hit Points per level, as literal expectations. */
const maximumHitPoints: Record<number, number> = { 1: 11, 2: 18, 3: 25 }
const maximumHitPointsAt = (level: number) => {
  const maximum = maximumHitPoints[level]
  if (maximum === undefined)
    throw new Error(`No maximum Hit Points expectation for level ${level}.`)
  return maximum
}

function builderPart(level: number, revision: string, updatedAt: string, label: string) {
  const page = srd.part
  if (!page.inputs) throw new Error('Missing Character fixture.')
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
          value: index === 0 ? 11 : 7
        }))
      }
    },
    state: {
      ...document.state,
      hitpoints: {
        current: maximumHitPointsAt(level),
        temp: 0,
        hitDice: [{ die: 10, total: level, used: 0 }],
        deathSaves: NO_DEATH_SAVES
      }
    }
  })
  const owner = encodeCharacterRecord(
    {
      ...previous,
      label,
      play: { ...previous.play, maximumHitPoints: maximumHitPointsAt(level) }
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
    const epoch = uuid(0x903)
    const scope = srdCharacterScope({ part: initial }, epoch)
    const [pool, ...otherPools] = (
      await prepareLiveCharacterSheetFacts({
        scope,
        inputs: initial.inputs,
        system: srd.system,
        objects: await srd.loadContent()
      })
    ).ruleEvaluation.output.resources
    if (!pool || pool.ownerKind !== 'AUTHORED_SOURCE' || otherPools.length)
      throw new Error('The SRD Fighter has one authored Resource pool.')
    // A real held grant: reconciliation reads the Character's effects to bound its hit points.
    const { definition, lifecycle } = plannedModifierGrant({
      encounterId: uuid(0x908),
      sourceActorId: uuid(0x909),
      holderActorId: uuid(0x909),
      lifecycle: {}
    })
    const effect = characterActiveRuleEffectStoredSchema.parse({
      id: uuid(0x907),
      characterId: owner.id,
      concentrationCasterCharacterId: null,
      sourceEncounterId: sourceEncounterIdForDefinition(definition, null),
      maintainedEffectStateId: null,
      createdOrdinal: 1,
      version: 1,
      definitionJson: JSON.stringify(definition),
      definitionChecksum: checksumCanonicalJson(definition),
      lifecycle,
      lifecycleChecksum: checksumCanonicalJson(lifecycle),
      createdAt: owner.createdAt,
      updatedAt: owner.createdAt
    })
    const { storage, database } = createNodeSqliteRoomStorage()
    const store = new RoomEncounterStore(storage)
    const hydration = srdRoomHydration({ part: initial, system: srd.system })
    store.hydrate({
      epoch,
      documents: [
        ...hydration.documents,
        {
          table: 'characterActiveRuleEffects',
          id: 'fixture:effect',
          creationTime: owner._creationTime,
          fields: effect
        }
      ],
      records: hydration.records
    })
    const { _id, _creationTime, ...playFields } = owner.play
    const usage = {
      id: uuid(0x908),
      characterId: owner.id,
      createdBy: owner.userId,
      updatedBy: owner.userId,
      createdAt: owner.createdAt,
      updatedAt: owner.createdAt
    }
    const retainedUsage = {
      ...usage,
      owner: { kind: 'AUTHORED_SOURCE' as const, sourceId: pool.sourceId, chargeId: pool.chargeId },
      used: 1
    }
    const orphanedUsage = {
      ...usage,
      id: uuid(0x90a),
      owner: { kind: 'AUTHORED_GRANT' as const, resourceGrantId: uuid(0x90b) },
      used: 9
    }
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
        spellSlots: [{ slotKey: 'STANDARD:1', used: 2 }],
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
                  creationTime: owner._creationTime,
                  fields: { ...effect, version: 2 }
                }
              ]
            }
          ]
        }
      }
    )
    const inputs = new RoomInputs(store, read, srd.loadContent)
    try {
      const storedPlay = store.documents('characterPlayStates')[0]
      if (!storedPlay) throw new Error('Missing native Character play.')
      await store.transact(async () => {
        await store.store.replace(storedPlay._id, localPlay)
      })
      const before = evidence(store)
      await expect(
        store.transact(async (transaction) => {
          await prepareRoomLiveCharacterSheet(store, inputs, scope, fresh.revisions, transaction)
          const staged = await inputs.character(owner.id, fresh.revisions, transaction)
          if (!staged.inputs) throw new Error('Missing staged Character.')
          expect(readCharacterRecord(staged.inputs.owner).label).toBe('Edited Builder')
          expect(readCharacterRecord(staged.inputs.owner).state.hitpoints.current).toBe(
            expectedHitPoints
          )
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
        deathSaves: localPlay.state.hitpoints.deathSaves,
        hitDice: [{ die: 10, total: level, used: 1 }]
      })
      expect(document.state.conditions).toEqual(localPlay.state.conditions)
      expect(document.state.spellSlots).toEqual(localPlay.state.spellSlots)
      expect(readCharacterSheetState(part.inputs.owner).resourceUsage).toEqual([retainedUsage])
      expect(finalPlay.maximumHitPoints).toBe(maximumHitPointsAt(level))
      expect(finalPlay.streamVersion).toBe(localPlay.streamVersion + 1)
      expect(Date.parse(finalPlay.updatedAt)).toBeGreaterThan(Date.parse(localPlay.updatedAt))
      expect(finalPlay.checksum).toBe(checksumRuleDocument(readCharacterPlay(finalPlay)))
      expect(store.sequence).toBe(before.sequence + 1)
      expect(store.logRows).toBe(before.logRows + 1)
      expect(store.documents('characters')[0]).toMatchObject({
        id: fresh.inputs.owner.id,
        userId: fresh.inputs.owner.userId,
        systemId: fresh.inputs.owner.systemId,
        label: fresh.inputs.owner.label,
        status: fresh.inputs.owner.status,
        createdAt: fresh.inputs.owner.createdAt
      })
      // The structure clock lives on the build record, which the held inputs carry.
      expect(store.documents('characters')[0]).not.toHaveProperty('updatedAt')
      expect(part.inputs.owner.updatedAt).toBe(fresh.inputs.owner.updatedAt)
      // Aggregate hashes are derived at assembly, so the reloaded head carries none.
      expect(store.documents('characters')[0]).not.toHaveProperty('checksum')
      expect(store.documents('characters')[0]).not.toHaveProperty('sheetStateChecksum')
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
      const recoveredInputs = new RoomInputs(recovered, read, srd.loadContent)
      const recoveredPart = await recoveredInputs.character(owner.id, fresh.revisions)
      if (!recoveredPart.inputs) throw new Error('Missing recovered Character.')
      expect(readCharacterRecord(recoveredPart.inputs.owner)).toEqual(document)
      expect(readCharacterSheetState(recoveredPart.inputs.owner).resourceUsage).toEqual([
        retainedUsage
      ])
      expect(read).toHaveBeenCalledTimes(2)
    } finally {
      database.close()
    }
  }
)
