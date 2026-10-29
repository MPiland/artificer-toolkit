import { describe, expect, it } from 'vitest'
import type { EncounterStoreDocuments } from '@artificer-toolkit/schema/projections/encounterStore'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { decodeCheckpointRecord } from '../checkpointRecords.js'

const characterId = '00000000-0000-4000-8000-000000000001'
const userId = '00000000-0000-4000-8000-000000000002'
const checksum = 'a'.repeat(64)
const updatedAt = '2026-09-30T00:00:00.000Z'
const play: EncounterStoreDocuments['characterPlayStates'] = {
  characterId,
  userId,
  streamVersion: 7,
  maximumHitPoints: 10,
  speeds: [{ speedId: '00000000-0000-4000-8000-000000000003', amount: 30, unit: 'FEET' as const }],
  state: {
    hitpoints: { current: 10, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES },
    equipped: [],
    attuned: [],
    resourceUsage: [],
    itemUsage: [],
    itemDegradation: [],
    partyVisibility: { sheet: false, health: 'HIDDEN' }
  },
  checksum,
  updatedAt
}

describe('checkpoint record decoding', () => {
  it('decodes stored JSON into canonical values and preserves content fields named streamVersion', () => {
    const fields = {
      id: characterId,
      encounterId: userId,
      stateJson: '{ "z": { "b": 2, "a": 1 }, "streamVersion": 7, "a": null }',
      stateChecksum: checksum,
      snapshotChecksum: checksum,
      formOriginSnapshotChecksum: null,
      sourceFactsChecksum: null
    }
    const original = structuredClone(fields)
    const decoded = decodeCheckpointRecord('encounterRunActors', fields)
    expect(decoded).toEqual({
      id: characterId,
      encounterId: userId,
      stateJson: { a: null, streamVersion: 7, z: { a: 1, b: 2 } },
      stateChecksum: checksum,
      snapshotChecksum: checksum,
      formOriginSnapshotChecksum: null,
      sourceFactsChecksum: null
    })
    expect(Object.keys(decoded)).toEqual([
      'encounterId',
      'formOriginSnapshotChecksum',
      'id',
      'snapshotChecksum',
      'sourceFactsChecksum',
      'stateChecksum',
      'stateJson'
    ])
    expect(JSON.stringify(decoded.stateJson)).toBe('{"a":null,"streamVersion":7,"z":{"a":1,"b":2}}')
    expect(
      decodeCheckpointRecord('encounterRunActors', {
        ...fields,
        stateJson: '{"a":null,"streamVersion":7,"z":{"a":1,"b":2}}'
      })
    ).toEqual(decoded)
    expect(fields).toEqual(original)
  })

  it('carries the Character play stream version with its content and other metadata', () => {
    const decoded = decodeCheckpointRecord('characterPlayStates', play)
    expect(decoded).toEqual(play)
    const advanced = decodeCheckpointRecord('characterPlayStates', { ...play, streamVersion: 20 })
    expect(advanced.streamVersion).toBe(20)
    expect(checksumCanonicalJson(advanced)).not.toBe(checksumCanonicalJson(decoded))
    for (const metadata of [
      { maximumHitPoints: 11 },
      {
        speeds: [
          { speedId: '00000000-0000-4000-8000-000000000003', amount: 35, unit: 'FEET' as const }
        ]
      },
      { checksum: 'b'.repeat(64) },
      { updatedAt: '2026-09-30T00:00:01.000Z' }
    ])
      expect(decodeCheckpointRecord('characterPlayStates', { ...play, ...metadata })).not.toEqual(
        decoded
      )
    expect(() =>
      decodeCheckpointRecord('characterPlayStates', { ...play, streamVersion: -1 })
    ).toThrow()
    expect(() =>
      decodeCheckpointRecord('characterPlayStates', { ...play, streamVersion: undefined })
    ).toThrow()
  })

  it('omits undefined optional fields and preserves explicit nulls', () => {
    const decoded = decodeCheckpointRecord('characters', {
      id: characterId,
      userId,
      systemId: userId,
      label: 'Character',
      status: 'ACTIVE',
      portraitAssetId: undefined,
      createdAt: updatedAt
    })
    expect(Object.hasOwn(decoded, 'portraitAssetId')).toBe(false)
    expect(decoded.label).toBe('Character')
    expect(
      decodeCheckpointRecord('encounterActorSnapshots', {
        encounterId: userId,
        checksum,
        snapshotJson: 'null'
      })
    ).toEqual({ encounterId: userId, checksum, snapshotJson: null })
  })

  it('rejects invalid stored rows and malformed or non-finite decoded JSON', () => {
    const fields = {
      id: characterId,
      encounterId: userId,
      stateJson: '{}',
      stateChecksum: checksum
    }
    for (const stateJson of ['broken', '{"value":1e400}', { value: 1 }])
      expect(() => decodeCheckpointRecord('encounterRunActors', { ...fields, stateJson })).toThrow()
    expect(() =>
      decodeCheckpointRecord('encounterRunActors', { ...fields, stateChecksum: 'invalid' })
    ).toThrow()
    expect(() =>
      decodeCheckpointRecord('encounterRunActors', { ...fields, id: 'invalid' })
    ).toThrow()
    expect(() =>
      decodeCheckpointRecord('encounterRunActors', { ...fields, unrecognizedField: true })
    ).toThrow()
  })
})
