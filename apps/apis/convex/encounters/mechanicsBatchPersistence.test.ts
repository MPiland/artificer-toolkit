import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readReceiptHeaders } from '../lib/receiptLedgers'
import { describe, expect, it } from 'vitest'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import type { MutationCtx } from '../_generated/server'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readCharacterRow } from '../characters/stateDocuments'
import {
  persistEncounterMechanicsBatchPlan,
  readEncounterMechanicsBatchTarget
} from '@artificer-toolkit/encounter-persistence/mechanicsBatchPersistence'
import { encounterWriteTransaction } from './encounterPorts'

async function storedState(
  ctx: MutationCtx,
  fixture: Awaited<ReturnType<typeof setupCharacterRun>>
) {
  const [run, actor, character, assignment, receipts] = await Promise.all([
    ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.run.id))
      .unique(),
    ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
      )
      .unique(),
    readCharacterRow(ctx, fixture.character.id),
    ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', fixture.character.id))
      .unique(),
    ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (q) => q.eq('characterId', fixture.character.id))
      .collect()
      .then((headers) => readReceiptHeaders(ctx, 'characterCommandReceipts', headers))
  ])
  if (!run || !actor || !character) throw new Error('Fixture state is unavailable.')
  return {
    run,
    actor,
    character,
    assignment,
    receipts
  }
}

describe('persistEncounterMechanicsBatchPlan freshness', () => {
  it.each([
    ['actor', 'Encounter mechanics target changed before settlement.'],
    ['character', 'Encounter Character changed before settlement.'],
    ['run', 'Encounter version is stale.'],
    ['assignment', 'Assigned Character not found.']
  ] as const)('rejects a stale %s without settlement writes', async (changed, message) => {
    const fixture = await setupCharacterRun()
    await fixture.owner.caller.run(async (ctx) => {
      const input = {
        encounterId: fixture.run.id,
        targetActorId: fixture.actor.id,
        expectedEncounterVersion: fixture.run.version,
        occurrenceId: crypto.randomUUID(),
        sourceCommandId: crypto.randomUUID(),
        commandId: crypto.randomUUID(),
        occurredAt: '2026-09-12T00:00:00.000Z',
        expectedCharacterStreamVersion: fixture.characterStreamVersion,
        effectiveMaximumHitPoints: fixture.actor.maxHitPoints,
        forceVersionAdvance: false,
        applications: [
          {
            sourceNodeId: 'freshness-test',
            sourceOperationKey: 'damage',
            authoredPath: null,
            resolvedPath: 'TEST',
            kind: 'DAMAGE' as const,
            targetActorId: fixture.actor.id,
            requestedAmount: 1,
            resolvedAmount: 1,
            appliedAmount: 1,
            beforeCurrentHitPoints: fixture.actor.currentHitPoints,
            afterCurrentHitPoints: fixture.actor.currentHitPoints - 1,
            beforeTemporaryHitPoints: fixture.actor.tempHitPoints,
            afterTemporaryHitPoints: fixture.actor.tempHitPoints,
            maximumHitPoints: fixture.actor.maxHitPoints,
            damageTypeId: crypto.randomUUID(),
            damageDisposition: 'NORMAL' as const,
            incomingHalved: false,
            critical: false
          }
        ]
      }
      const target = await readEncounterMechanicsBatchTarget(encounterWriteTransaction(ctx), input)
      const loaded = await loadCharacterSheetFacts(
        ctx,
        fixture.owner.userId,
        fixture.character.id,
        fixture.campaign.id
      )
      if (!loaded) throw new Error('Fixture Character facts are unavailable.')
      const plan = planEncounterMechanicsBatch({
        batch: input,
        actor: target.actor,
        userId: target.userId,
        characterFacts: loaded
      })
      expect(plan.characterUpdate).not.toBeNull()

      if (changed === 'actor') {
        const next = { ...target.actor, gmNotes: 'Changed before settlement' }
        await writeRunActor({ db: createConvexEncounterStore(ctx) }, target.actorRow._id, next)
      } else if (changed === 'character') {
        await ctx.db.patch(loaded.active.play._id, {
          streamVersion: loaded.active.play.streamVersion + 1
        })
      } else if (changed === 'run') {
        await ctx.db.patch(target.runRow._id, { version: target.runRow.version + 1 })
      } else {
        const assignment = await ctx.db
          .query('campaignCharacterAssignments')
          .withIndex('by_characterId', (q) => q.eq('characterId', fixture.character.id))
          .unique()
        if (!assignment) throw new Error('Fixture assignment is unavailable.')
        await ctx.db.delete(assignment._id)
      }

      const before = await storedState(ctx, fixture)
      await expect(
        persistEncounterMechanicsBatchPlan(encounterWriteTransaction(ctx), target, {
          actor: target.actor,
          character: loaded.active,
          plan
        })
      ).rejects.toThrow(message)
      expect(await storedState(ctx, fixture)).toEqual(before)
    })
  })
})
