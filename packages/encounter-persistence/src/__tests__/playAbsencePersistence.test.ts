import { describe, expect, it } from 'vitest'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { skippedEncounterActorIds } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import {
  CAMPAIGN_ID,
  ENCOUNTER_ID,
  SRD_SYSTEM_ID,
  srdEncounterState,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  actors,
  GM_USER_ID,
  GOBLIN_ID
} from '@artificer-toolkit/rules-runtime/testing/encounterTurnZoneFixture'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import { insertRunActor, readRunActors, readRunState, writeRunActor } from '../documents.js'
import { createActiveRuleEffectStore } from '../effectStore.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterCharacterWriteTransaction } from '../ports.js'

const OCCURRED_AT = '2026-10-22T00:00:00.000Z'
const state = srdEncounterState({ actors, currentActorId: GOBLIN_ID, turnSequence: 1 })
const goblin = actors.find((actor) => actor.id === GOBLIN_ID)!
const owner = turnEffectOwner(goblin, ENCOUNTER_ID)

/** A memory store holding the Run and its actors, the real effect store over it, and a way to hold removal effects. */
async function seeded() {
  const memory = createMemoryEncounterStore()
  const ctx = {
    db: memory.store,
    ports: {
      requireIdentity: async () => ({ userId: GM_USER_ID }),
      requireCampaignAuthority: async () => ({
        campaign: {
          id: CAMPAIGN_ID,
          status: 'ACTIVE',
          gameSystemId: SRD_SYSTEM_ID,
          ownerUserId: GM_USER_ID
        }
      })
    }
  } as unknown as EncounterCharacterWriteTransaction
  const run = encounterRunStateSchema.parse(state)
  await memory.store.insert('encounterRuns', {
    id: run.id,
    campaignId: run.campaignId,
    gameSystemId: run.gameSystemId,
    status: run.status,
    version: run.version,
    stateJson: JSON.stringify(run),
    stateChecksum: checksumCanonicalJson(run),
    createCommandId: testUuid(0x5001),
    createCommandFingerprint: 'b'.repeat(64),
    concentrationCasterCharacterIds: [],
    createdAt: OCCURRED_AT,
    updatedAt: OCCURRED_AT
  })
  for (const actor of actors) await insertRunActor(ctx, actor)
  const store = createActiveRuleEffectStore(ctx)
  const hold = (id: number, keepsTurn: boolean) =>
    store.create({
      id: testUuid(id),
      owner,
      definition: {
        ...plannedModifierGrant({
          encounterId: ENCOUNTER_ID,
          sourceActorId: GOBLIN_ID,
          holderActorId: GOBLIN_ID,
          rounds: 10
        }).definition,
        stateContributions: [{ kind: 'PLAY_ABSENCE', keepsTurn }]
      },
      lifecycle: { schemaVersion: 1, remainingTicks: 10 },
      occurredAt: OCCURRED_AT
    })
  const absence = async () =>
    (await readRunActors(ctx, readRunState((await currentRun(ctx))!))).find(
      (actor) => actor.id === GOBLIN_ID
    )!.absence
  const remove = async (effect: Awaited<ReturnType<typeof hold>>) =>
    store.deleteCas({ id: effect.id, owner, expectedVersion: effect.version, removal: 'ENDED' })
  return { ctx, store, hold, absence, remove }
}

async function currentRun(ctx: EncounterCharacterWriteTransaction) {
  return ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', ENCOUNTER_ID))
    .unique()
}

describe('the removal effect and the holder absence (SPELLS-4.T2h1, D178)', () => {
  it('takes the holder out of play when it is created and returns it when it ends', async () => {
    const scene = await seeded()
    expect(await scene.absence()).toBe(null)
    const effect = await scene.hold(0x5101, false)
    expect(await scene.absence()).toBe('EFFECT')
    await scene.remove(effect)
    expect(await scene.absence()).toBe(null)
  })

  it('keeps the turn while every removal held keeps it, and skips it once any does not', async () => {
    const scene = await seeded()
    const keeping = await scene.hold(0x5102, true)
    expect(await scene.absence()).toBe('EFFECT_KEEPS_TURN')
    const skipping = await scene.hold(0x5103, false)
    expect(await scene.absence()).toBe('EFFECT')
    await scene.remove(skipping)
    expect(await scene.absence()).toBe('EFFECT_KEEPS_TURN')
    await scene.remove(keeping)
    expect(await scene.absence()).toBe(null)
  })

  it('stays out of play while a second removal is held, whichever ends first', async () => {
    const scene = await seeded()
    const first = await scene.hold(0x5104, false)
    const second = await scene.hold(0x5105, false)
    await scene.remove(first)
    expect(await scene.absence()).toBe('EFFECT')
    await scene.remove(second)
    expect(await scene.absence()).toBe(null)
  })

  it.each(['GM_REMOVED', 'DEPARTED'] as const)(
    'never returns an actor the table or a departure %s when the effect ends',
    async (absence) => {
      const scene = await seeded()
      const effect = await scene.hold(0x5106, false)
      const rows = await scene.ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', ENCOUNTER_ID).eq('id', GOBLIN_ID)
        )
        .unique()
      await writeRunActor(scene.ctx, rows!._id, { ...goblin, absence })
      await scene.remove(effect)
      expect(await scene.absence()).toBe(absence)
    }
  )

  it('skips an effect-absent actor in initiative unless the effect keeps its turn', () => {
    const skipped = (absence: 'EFFECT' | 'EFFECT_KEEPS_TURN') =>
      skippedEncounterActorIds([{ ...goblin, absence }], new Set())
    expect(skipped('EFFECT')).toContain(GOBLIN_ID)
    expect(skipped('EFFECT_KEEPS_TURN')).not.toContain(GOBLIN_ID)
  })
})
