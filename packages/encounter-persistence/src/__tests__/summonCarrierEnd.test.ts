import { describe, expect, it } from 'vitest'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import {
  ENCOUNTER_ID,
  creatureActor,
  srdEncounterState
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import {
  encounterActorTokenBindingSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { haste } from '@artificer-toolkit/source-data/srd/spells/haste.js'
import { insertRunActor, readRunActors, readRunState } from '../documents.js'
import { createActiveRuleEffectStore } from '../effectStore.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import { endOrphanedConjuredActors } from '../summonRemoval.js'

const CASTER_ID = '00000000-0000-4000-8000-0000000b5011'
const SUMMON_ID = '00000000-0000-4000-8000-0000000b5012'
const PET_ID = '00000000-0000-4000-8000-0000000b5013'
const CARRIER_ID = '00000000-0000-4000-8000-0000000b5014'
const GM_USER_ID = '00000000-0000-4000-8000-0000000b5015'
const SCENE_ID = '00000000-0000-4000-8000-0000000b5016'
const TOKEN_ID = '00000000-0000-4000-8000-0000000b5017'
const OCCURRED_AT = '2026-10-23T00:00:00.000Z'

const caster = creatureActor({ id: CASTER_ID, kind: 'CUSTOM', snapshot: {} })
const carriedBy = (id: string, sourceEffectId?: string) => ({
  ...creatureActor({ id, kind: 'CUSTOM', snapshot: { label: 'Spectral Hand' } }),
  owner: { ownerActorId: CASTER_ID, ...(sourceEffectId && { sourceEffectId }) }
})
const sweepInput = { encounterId: ENCOUNTER_ID, userId: GM_USER_ID, occurredAt: OCCURRED_AT }

async function insertRun(
  memory: ReturnType<typeof createMemoryEncounterStore>,
  state: ReturnType<typeof srdEncounterState>
) {
  await memory.store.insert('encounterRuns', {
    id: state.id,
    campaignId: state.campaignId,
    gameSystemId: state.gameSystemId,
    status: state.status,
    version: state.version,
    stateJson: JSON.stringify(state),
    stateChecksum: checksumCanonicalJson(state),
    createCommandId: CARRIER_ID,
    createCommandFingerprint: 'b'.repeat(64),
    concentrationCasterCharacterIds: [],
    createdAt: OCCURRED_AT,
    updatedAt: OCCURRED_AT
  })
}

/** A Run with a caster holding a carrier effect, the creature it conjured, and a pet that names no effect. */
async function conjuringRun() {
  const memory = createMemoryEncounterStore()
  const removed: unknown[] = []
  const ctx = {
    db: memory.store,
    ports: { removeSummonTokens: async (input: unknown) => void removed.push(input) }
  }
  const actors = [caster, carriedBy(SUMMON_ID, CARRIER_ID), carriedBy(PET_ID)]
  await insertRun(memory, srdEncounterState({ actors, currentActorId: null }))
  for (const actor of actors) await insertRunActor(ctx, actor)
  await memory.store.insert(
    'encounterActorTokenBindings',
    encounterActorTokenBindingSchema.parse({
      actorId: SUMMON_ID,
      encounterId: ENCOUNTER_ID,
      sceneId: SCENE_ID,
      tokenId: TOKEN_ID
    })
  )
  const [effect] = haste.effects ?? []
  const carrier = await createActiveRuleEffectStore(ctx).create({
    id: CARRIER_ID,
    owner: turnEffectOwner(caster, ENCOUNTER_ID),
    definition: plannedModifierGrant({
      encounterId: ENCOUNTER_ID,
      sourceActorId: CASTER_ID,
      holderActorId: CASTER_ID,
      lifecycle: {},
      effect,
      rounds: 10
    }).definition,
    lifecycle: { schemaVersion: 1, remainingTicks: 10 }
  })
  return { memory, ctx, removed, carrier, sweep: () => endOrphanedConjuredActors(ctx, sweepInput) }
}

describe('ending the creatures whose carrier effect ended (D187b)', () => {
  it('removes nothing while the carrier still stands', async () => {
    const { memory, removed, sweep } = await conjuringRun()
    expect(await sweep()).toBe(false)
    expect(removed).toEqual([])
    expect(memory.documents('encounterRunActors')).toHaveLength(3)
  })

  it('removes the creature once its carrier is gone, records the ids, and leaves the pet and the caster', async () => {
    const { memory, ctx, removed, carrier, sweep } = await conjuringRun()
    await createActiveRuleEffectStore(ctx).deleteCas({
      id: carrier.id,
      owner: turnEffectOwner(caster, ENCOUNTER_ID),
      expectedVersion: carrier.version,
      removal: 'ENDED'
    })
    const versionBefore = readRunState(memory.documents('encounterRuns')[0]!).version

    expect(await sweep()).toBe(true)

    expect(removed).toHaveLength(1)
    expect(memory.documents('encounterActorTokenBindings')).toEqual([])
    const run = memory.documents('encounterRuns')[0]!
    expect(readRunState(run).version).toBe(versionBefore + 1)
    expect((await readRunActors(ctx, readRunState(run))).map(({ id }) => id).sort()).toEqual(
      [CASTER_ID, PET_ID].sort()
    )
    const [entry] = memory
      .documents('encounterRunCommands')
      .map(({ _id, _creationTime, ...row }) => encounterStoredRunCommandSchema.parse(row))
    expect(entry).toMatchObject({
      commandType: 'SUMMONS_ENDED',
      version: versionBefore + 1,
      receipt: { removedActorIds: [SUMMON_ID] }
    })
    // Nothing is left to sweep, so a later command records nothing more.
    expect(await sweep()).toBe(false)
    expect(memory.documents('encounterRunCommands')).toHaveLength(1)
  })

  it('removes a creature whose caster has left the Run', async () => {
    const memory = createMemoryEncounterStore()
    const removed: unknown[] = []
    const ctx = {
      db: memory.store,
      ports: { removeSummonTokens: async (input: unknown) => void removed.push(input) }
    }
    const actors = [carriedBy(SUMMON_ID, CARRIER_ID)]
    await insertRun(memory, srdEncounterState({ actors, currentActorId: null }))
    for (const actor of actors) await insertRunActor(ctx, actor)
    await memory.store.insert(
      'encounterActorTokenBindings',
      encounterActorTokenBindingSchema.parse({
        actorId: SUMMON_ID,
        encounterId: ENCOUNTER_ID,
        sceneId: SCENE_ID,
        tokenId: TOKEN_ID
      })
    )
    expect(await endOrphanedConjuredActors(ctx, sweepInput)).toBe(true)
    expect(removed).toHaveLength(1)
    expect(memory.documents('encounterRunActors')).toEqual([])
  })

  it('touches nothing in a Run whose actors name no carrier', async () => {
    const memory = createMemoryEncounterStore()
    const ctx = { db: memory.store, ports: {} }
    const actors = [caster, carriedBy(PET_ID)]
    await insertRun(memory, srdEncounterState({ actors, currentActorId: null }))
    for (const actor of actors) await insertRunActor(ctx, actor)
    expect(await endOrphanedConjuredActors(ctx, sweepInput)).toBe(false)
    expect(memory.documents('encounterRunActors')).toHaveLength(2)
  })
})
