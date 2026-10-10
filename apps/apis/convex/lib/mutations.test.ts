import { convexTest } from '../../tests/convexTest'
import { expect, it } from 'vitest'

import type { MutationCtx } from '../_generated/server'
import schema from '../schema'
import { withSceneVisionTracking } from './mutations'

it('refreshes only the owning Character or Campaign play revision for Rule Effect and occurrence changes', async () => {
  const t = convexTest(schema)
  const characterId = crypto.randomUUID()
  const otherCharacterId = crypto.randomUUID()
  const campaignId = crypto.randomUUID()
  const otherCampaignId = crypto.randomUUID()
  const encounterId = crypto.randomUUID()
  const now = new Date().toISOString()
  const checksum = 'a'.repeat(64)

  await t.run(async (ctx) => {
    await ctx.db.insert('encounterRuns', {
      id: encounterId,
      campaignId,
      gameSystemId: crypto.randomUUID(),
      status: 'ACTIVE',
      version: 0,
      stateJson: '{}',
      stateChecksum: checksum,
      createCommandId: crypto.randomUUID(),
      createCommandFingerprint: checksum,
      concentrationCasterCharacterIds: [],
      createdAt: now,
      updatedAt: now
    })
    for (const [scope, id] of [
      ['CHARACTER', characterId],
      ['CHARACTER', otherCharacterId],
      ['PLAY', campaignId],
      ['PLAY', otherCampaignId]
    ] as const) {
      await ctx.db.insert('sceneVisionRevisions', { scope, id, revision: crypto.randomUUID() })
    }
  })

  const revisions = () =>
    t.run(async (ctx) => {
      const read = async (scope: 'CHARACTER' | 'PLAY', id: string) =>
        (
          await ctx.db
            .query('sceneVisionRevisions')
            .withIndex('by_scope_id', (q) => q.eq('scope', scope).eq('id', id))
            .unique()
        )?.revision
      return {
        character: await read('CHARACTER', characterId),
        otherCharacter: await read('CHARACTER', otherCharacterId),
        play: await read('PLAY', campaignId),
        otherPlay: await read('PLAY', otherCampaignId)
      }
    })
  // A marker is observable only after its transaction commits, so each write is its own transaction.
  const check = async <T>(owner: 'character' | 'play', write: (ctx: MutationCtx) => Promise<T>) => {
    const before = await revisions()
    const result = await t.run((ctx) => write(withSceneVisionTracking(ctx)))
    const after = await revisions()
    for (const key of ['character', 'otherCharacter', 'play', 'otherPlay'] as const) {
      if (key === owner) expect(after[key]).not.toBe(before[key])
      else expect(after[key]).toBe(before[key])
    }
    return result
  }

  const effect = {
    id: crypto.randomUUID(),
    createdOrdinal: 1,
    version: 1,
    definitionJson: '{}',
    definitionChecksum: checksum,
    lifecycle: { schemaVersion: 1 as const, remainingTicks: null },
    lifecycleChecksum: checksum,
    createdAt: now,
    updatedAt: now
  }
  const characterEffectId = await check('character', (ctx) =>
    ctx.db.insert('characterActiveRuleEffects', {
      ...effect,
      characterId,
      maintainedEffectStateId: null,
      sourceEncounterId: null
    })
  )
  await check('character', (ctx) => ctx.db.patch(characterEffectId, { version: 2 }))
  await check('character', (ctx) => ctx.db.delete(characterEffectId))

  const encounterEffectId = await check('play', (ctx) =>
    ctx.db.insert('encounterActiveRuleEffects', {
      ...effect,
      id: crypto.randomUUID(),
      encounterId,
      maintainedEffectStateId: null,
      targetActorId: crypto.randomUUID()
    })
  )
  await check('play', (ctx) => ctx.db.patch(encounterEffectId, { version: 2 }))
  await check('play', (ctx) => ctx.db.delete(encounterEffectId))

  const maintainedId = await check('play', (ctx) =>
    ctx.db.insert('encounterMaintainedEffectStates', {
      id: crypto.randomUUID(),
      encounterId,
      ownerActorId: crypto.randomUUID(),
      maintenanceDefinitionId: crypto.randomUUID(),
      descriptorJson: '{}',
      descriptorChecksum: checksum,
      version: 1,
      createdAt: now,
      updatedAt: now
    })
  )
  await check('play', (ctx) => ctx.db.patch(maintainedId, { version: 2 }))
  await check('play', (ctx) => ctx.db.delete(maintainedId))

  const spatialId = await check('play', (ctx) =>
    ctx.db.insert('encounterSpatialRuleEffects', {
      ...effect,
      id: crypto.randomUUID(),
      encounterId,
      sceneId: crypto.randomUUID(),
      placement: {
        schemaVersion: 1,
        anchorKind: 'FIXED',
        sourceTokenId: null,
        geometry: {
          frame: 'SCENE_ABSOLUTE',
          shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 5 }
        },
        triggerModes: ['ENTER'],
        movementKinds: ['VOLUNTARY'],
        activation: 'ONE_SHOT',
        visibility: 'PUBLIC',
        revealOnTrigger: false
      },
      placementChecksum: checksum,
      spatialState: { schemaVersion: 1, revealed: false },
      spatialStateChecksum: checksum
    })
  )
  await check('play', (ctx) => ctx.db.patch(spatialId, { version: 2 }))
  await check('play', (ctx) => ctx.db.delete(spatialId))

  const occurrenceId = await check('play', (ctx) =>
    ctx.db.insert('encounterRuleOccurrences', {
      id: crypto.randomUUID(),
      campaignId,
      encounterId,
      rootCommandId: crypto.randomUUID(),
      state: 'PENDING',
      version: 0,
      expectedEncounterVersion: 0,
      pendingSnapshotChecksum: checksum,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    })
  )
  await check('play', (ctx) => ctx.db.patch(occurrenceId, { version: 1 }))
  await check('play', (ctx) => ctx.db.delete(occurrenceId))
})
