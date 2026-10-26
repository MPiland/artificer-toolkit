import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { describe, expect, it } from 'vitest'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import {
  applyEncounterMechanicsBatch,
  type EncounterMechanicsBatchInput
} from '../../tests/fixtures/mechanicsBatch'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'

function command(input: {
  encounterId: string
  targetActorId: string
  expectedEncounterVersion: number
  maximumHitPoints: number
  characterStreamVersion: number | null
}): Omit<EncounterMechanicsBatchInput, 'applications'> {
  return {
    encounterId: input.encounterId,
    targetActorId: input.targetActorId,
    expectedEncounterVersion: input.expectedEncounterVersion,
    occurrenceId: crypto.randomUUID(),
    sourceCommandId: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    occurredAt: '2026-09-12T00:00:00.000Z',
    expectedCharacterStreamVersion: input.characterStreamVersion,
    effectiveMaximumHitPoints: input.maximumHitPoints,
    forceVersionAdvance: false
  }
}

function damage(input: { actorId: string; current: number; temporary: number; maximum: number }) {
  return {
    sourceNodeId: 'plan-test',
    sourceOperationKey: 'damage',
    authoredPath: null,
    resolvedPath: 'TEST',
    kind: 'DAMAGE' as const,
    targetActorId: input.actorId,
    requestedAmount: 1,
    resolvedAmount: 1,
    appliedAmount: 1,
    beforeCurrentHitPoints: input.current,
    afterCurrentHitPoints: input.current - 1,
    beforeTemporaryHitPoints: input.temporary,
    afterTemporaryHitPoints: input.temporary,
    maximumHitPoints: input.maximum,
    damageTypeId: crypto.randomUUID(),
    damageDisposition: 'NORMAL' as const,
    incomingHalved: false,
    critical: false
  }
}

async function currentActor(
  fixture: Awaited<ReturnType<typeof setupCharacterRun>>,
  actorId: string
) {
  return fixture.owner.caller.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', fixture.run.id))
      .unique()
    if (!run) throw new Error('Fixture Run is unavailable.')
    return readRunActor({ db: createConvexEncounterStoreReader(ctx) }, readRunState(run), actorId)
  })
}

describe('planEncounterMechanicsBatch', () => {
  it('predicts a Character resource and outcome commit without mutating loaded state', async () => {
    const fixture = await setupCharacterRun()
    const input = {
      ...command({
        encounterId: fixture.run.id,
        targetActorId: fixture.actor.id,
        expectedEncounterVersion: fixture.run.version,
        maximumHitPoints: fixture.actor.maxHitPoints,
        characterStreamVersion: fixture.characterStreamVersion
      }),
      applications: [
        damage({
          actorId: fixture.actor.id,
          current: fixture.actor.currentHitPoints,
          temporary: fixture.actor.tempHitPoints,
          maximum: fixture.actor.maxHitPoints
        })
      ],
      characterResourceConsumption: (() => {
        const owner = { kind: 'AUTHORED_GRANT' as const, resourceGrantId: crypto.randomUUID() }
        return {
          poolId: createCharacterResourceOwnerKey(owner),
          chargeId: crypto.randomUUID(),
          cost: 1,
          owner,
          usageId: crypto.randomUUID(),
          beforeUsed: 0,
          afterUsed: 1,
          beforeRemaining: 2,
          afterRemaining: 1,
          characterId: fixture.character.id,
          expectedStreamVersion: fixture.characterStreamVersion
        }
      })()
    } satisfies EncounterMechanicsBatchInput
    const plan = await fixture.owner.caller.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (query) => query.eq('id', fixture.run.id))
        .unique()
      if (!run) throw new Error('Fixture Run is unavailable.')
      const actor = await readRunActor(
        { db: createConvexEncounterStoreReader(ctx) },
        readRunState(run),
        fixture.actor.id
      )
      const loaded = await loadCharacterSheetFacts(
        ctx,
        fixture.owner.userId,
        fixture.character.id,
        fixture.campaign.id
      )
      if (!loaded) throw new Error('Fixture Character is unavailable.')
      const before = JSON.stringify({
        actor,
        character: loaded.character,
        sheetState: loaded.sheetState
      })
      const result = planEncounterMechanicsBatch({
        batch: input,
        actor,
        userId: fixture.owner.userId,
        characterFacts: loaded
      })
      expect(() =>
        planEncounterMechanicsBatch({
          batch: { ...input, expectedCharacterStreamVersion: fixture.characterStreamVersion + 1 },
          actor,
          userId: fixture.owner.userId,
          characterFacts: loaded
        })
      ).toThrow('changed after the outcome was planned')
      expect(() =>
        planEncounterMechanicsBatch({
          batch: {
            ...input,
            characterResourceConsumption: {
              ...input.characterResourceConsumption,
              beforeUsed: 1,
              afterUsed: 2
            }
          },
          actor,
          userId: fixture.owner.userId,
          characterFacts: loaded
        })
      ).toThrow('resource usage is stale')
      expect(
        JSON.stringify({ actor, character: loaded.character, sheetState: loaded.sheetState })
      ).toBe(before)
      return result
    })
    const committed = await fixture.owner.caller.run((ctx) =>
      applyEncounterMechanicsBatch(ctx, input)
    )
    expect(committed.updatedActor).toEqual(plan.updatedActor)
    expect(committed.receiptApplications).toEqual(plan.receiptApplications)
    expect(committed.targetTransition).toEqual(plan.targetTransition)
    expect(committed.characterStreamVersion).toBe(plan.characterStreamVersion)
    expect(plan.characterUpdate?.sheetState?.resourceUsage).toEqual([
      expect.objectContaining({ used: 1 })
    ])
  })

  it('predicts a non-Character batch without a Character source', async () => {
    const fixture = await setupCharacterRun()
    const actor = fixture.run.actors.find((candidate) => candidate.kind === 'CUSTOM')
    if (!actor) throw new Error('Fixture target is unavailable.')
    const input = {
      ...command({
        encounterId: fixture.run.id,
        targetActorId: actor.id,
        expectedEncounterVersion: fixture.run.version,
        maximumHitPoints: actor.maxHitPoints,
        characterStreamVersion: null
      }),
      applications: [
        damage({
          actorId: actor.id,
          current: actor.currentHitPoints,
          temporary: actor.tempHitPoints,
          maximum: actor.maxHitPoints
        })
      ]
    } satisfies EncounterMechanicsBatchInput
    const plan = planEncounterMechanicsBatch({
      batch: input,
      actor: await currentActor(fixture, actor.id),
      userId: fixture.owner.userId
    })
    const committed = await fixture.owner.caller.run((ctx) =>
      applyEncounterMechanicsBatch(ctx, input)
    )
    expect(committed.updatedActor).toEqual(plan.updatedActor)
    expect(committed.targetTransition).toEqual(plan.targetTransition)
    expect(plan.characterUpdate).toBeNull()
  })
})
