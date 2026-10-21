import { describe, expect, it } from 'vitest'
import { parsePublicationDocument } from '@artificer-toolkit/rules-runtime/authoredPublicationRead'
import {
  ENCOUNTER_ID,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { storedCompilationOf } from '@artificer-toolkit/rules-runtime/testing/storedCompilations'
import { AUTHORED_LIMITS } from '@artificer-toolkit/shared/utils/authoringLimits'
import { lich } from '@artificer-toolkit/source-data/srd/creatures/lich.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { insertRunActor } from '../documents.js'
import { removeFinishedRunRowsPage } from '../finishedRunRows.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import {
  creatureSnapshotSpellIds,
  ensureEncounterSpellPins,
  hydrateSpellPins,
  readEncounterSpellPinRows,
  readEncounterSpellPins
} from '../spellPins.js'

const USER_ID = 'owner'
const SYSTEM_ID = lich.systemId
const OTHER_ENCOUNTER_ID = '00000000-0000-4000-8000-000000000999'
const LICH_ACTOR_ID = '00000000-0000-4000-8000-0000000b1001'

const spellDocuments = new Map(
  srdBaselineContent.subjects.spells.map((spell) => [spell.id, spell] as const)
)

function storedSpellSource(spellId: string, version = 1) {
  const document = spellDocuments.get(spellId)
  if (!document) throw new Error(`Unknown SRD Spell ${spellId}.`)
  const compilation = storedCompilationOf(parsePublicationDocument('SPELL', document))
  return {
    document,
    checksum: compilation.authoredChecksum,
    version,
    versionId: '00000000-0000-4000-8000-00000000e003',
    compilation
  }
}

function spellReader(version = () => 1) {
  const reads: string[] = []
  return {
    reads,
    read: async (_userId: string, _systemId: string, id: string, kind: string) => {
      if (kind !== 'SPELL') throw new Error(`Unexpected source kind ${kind}.`)
      reads.push(id)
      return storedSpellSource(id, version())
    }
  }
}

const lichActor = srdCreatureActor({ id: LICH_ACTOR_ID, creature: lich })
const lichInput = (encounterId = ENCOUNTER_ID) => ({
  encounterId,
  userId: USER_ID,
  systemId: SYSTEM_ID,
  snapshots: [lichActor.snapshot]
})

describe('Encounter spell pins (D163)', () => {
  it('pins a Lich-class caster once per Spell, each pin far under the Convex document limit', async () => {
    const memory = createMemoryEncounterStore()
    const ctx = { db: memory.store }
    const reader = spellReader()
    const spellIds = creatureSnapshotSpellIds(lichActor.snapshot)
    expect(spellIds.length).toBeGreaterThan(20)

    await insertRunActor(ctx, lichActor)
    await ensureEncounterSpellPins(ctx, reader.read, lichInput())

    const pins = memory.documents('encounterSpellPins')
    expect(pins.map((pin) => pin.spellId).sort()).toEqual([...spellIds].sort())
    for (const pin of pins) {
      expect(JSON.stringify(pin).length).toBeLessThan(AUTHORED_LIMITS.mutationPayloadBytes / 4)
    }
    // The actor holds Spell ids only: no pinned compilation is copied into its rows.
    const actorBytes = memory
      .documents('encounterRunActors')
      .reduce((total, row) => total + JSON.stringify(row).length, 0)
    const pinnedBytes = pins.reduce((total, pin) => total + pin.compilationJson.length, 0)
    expect(actorBytes).toBeLessThan(pinnedBytes)
    for (const pin of pins) {
      expect(
        memory
          .documents('encounterRunActors')
          .some((row) => JSON.stringify(row).includes(pin.compilationJson))
      ).toBe(false)
    }

    const pinned = await readEncounterSpellPins(ctx, ENCOUNTER_ID)
    expect([...pinned.keys()].sort()).toEqual([...spellIds].sort())
    for (const [id, spell] of pinned) expect(spell.id).toBe(id)
  })

  it('reads a Spell once per Run and keeps the first pin when the source changes', async () => {
    const memory = createMemoryEncounterStore()
    const ctx = { db: memory.store }
    let version = 1
    const reader = spellReader(() => version)
    await ensureEncounterSpellPins(ctx, reader.read, lichInput())
    const readsAfterFirst = reader.reads.length
    expect(new Set(reader.reads).size).toBe(readsAfterFirst)

    version = 2
    await ensureEncounterSpellPins(ctx, reader.read, lichInput())
    expect(reader.reads).toHaveLength(readsAfterFirst)
    expect(
      new Set(memory.documents('encounterSpellPins').map((pin) => pin.sourceRevision))
    ).toEqual(new Set([1]))

    await ensureEncounterSpellPins(ctx, reader.read, lichInput(OTHER_ENCOUNTER_ID))
    expect(reader.reads).toHaveLength(readsAfterFirst * 2)
    expect(
      new Set(
        memory
          .documents('encounterSpellPins')
          .filter((pin) => pin.encounterId === OTHER_ENCOUNTER_ID)
          .map((pin) => pin.sourceRevision)
      )
    ).toEqual(new Set([2]))
  })

  it('fails closed on a stale or corrupt pinned compilation', async () => {
    const memory = createMemoryEncounterStore()
    const ctx = { db: memory.store }
    await ensureEncounterSpellPins(ctx, spellReader().read, lichInput())
    const [pin] = memory.documents('encounterSpellPins')
    await ctx.db.patch(pin._id, { sourceChecksum: 'f'.repeat(64) })
    await expect(readEncounterSpellPins(ctx, ENCOUNTER_ID)).rejects.toThrow('stale')
    await ctx.db.patch(pin._id, { sourceChecksum: pin.sourceChecksum, compilationJson: '{' })
    await expect(readEncounterSpellPins(ctx, ENCOUNTER_ID)).rejects.toThrow()
  })

  it('releases a Run’s pins with the Run and leaves another Run’s pins', async () => {
    const memory = createMemoryEncounterStore()
    const ctx = { db: memory.store }
    const reader = spellReader()
    await ensureEncounterSpellPins(ctx, reader.read, lichInput())
    await ensureEncounterSpellPins(ctx, reader.read, lichInput(OTHER_ENCOUNTER_ID))
    const perRun = memory.documents('encounterSpellPins').length / 2

    while (!(await removeFinishedRunRowsPage(ctx, ENCOUNTER_ID, 8)));

    const left = memory.documents('encounterSpellPins')
    expect(left).toHaveLength(perRun)
    expect(left.every((pin) => pin.encounterId === OTHER_ENCOUNTER_ID)).toBe(true)
  })

  it('discovers identical casts after the source Spell is edited or deleted (replay safety)', async () => {
    const memory = createMemoryEncounterStore()
    const ctx = { db: memory.store }
    let version = 1
    const reader = spellReader(() => version)
    await ensureEncounterSpellPins(ctx, reader.read, lichInput())
    const discover = (spells: ReadonlyMap<string, CompiledSpell>) =>
      discoverEncounterFeatureActionCapabilities({
        actor: lichActor,
        conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
        abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
        spells
      })
        .filter((capability) => capability.spellCast !== null)
        .map((capability) => capability.actionId)
    const before = discover(await readEncounterSpellPins(ctx, ENCOUNTER_ID))
    expect(before.length).toBeGreaterThan(20)
    const reads = reader.reads.length

    version = 2
    const deleted = async () => {
      throw new Error('The source Spell was deleted.')
    }
    await ensureEncounterSpellPins(ctx, deleted, lichInput())
    const rows = await readEncounterSpellPinRows(ctx, ENCOUNTER_ID)
    expect(discover(hydrateSpellPins(rows))).toEqual(before)
    expect(discover(await readEncounterSpellPins(ctx, ENCOUNTER_ID))).toEqual(before)
    expect(reader.reads).toHaveLength(reads)
  })
})
