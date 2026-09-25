import { describe, expect, it } from 'vitest'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { applyEncounterMechanicsBatch } from '../encounters/mechanicsBatch'
import { applyLiveEncounterMechanicsBatch } from './encounterActionMechanics'

type Fixture = Awaited<ReturnType<typeof setupCharacterRun>>

function batch(fixture: Fixture): EncounterMechanicsBatchInput {
  const actor = fixture.actor
  const owner = { kind: 'AUTHORED_GRANT' as const, resourceGrantId: crypto.randomUUID() }
  return {
    encounterId: fixture.run.id,
    targetActorId: actor.id,
    expectedEncounterVersion: fixture.run.version,
    occurrenceId: crypto.randomUUID(),
    sourceCommandId: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    occurredAt: '2026-09-12T00:00:00.000Z',
    expectedCharacterStreamVersion: fixture.characterStreamVersion,
    effectiveMaximumHitPoints: actor.maxHitPoints,
    forceVersionAdvance: false,
    applications: [
      {
        sourceNodeId: 'terminal-mechanics-test',
        sourceOperationKey: 'damage',
        authoredPath: null,
        resolvedPath: 'TEST',
        kind: 'DAMAGE',
        targetActorId: actor.id,
        requestedAmount: 1,
        resolvedAmount: 1,
        appliedAmount: 1,
        beforeCurrentHitPoints: actor.currentHitPoints,
        afterCurrentHitPoints: actor.currentHitPoints - 1,
        beforeTemporaryHitPoints: actor.tempHitPoints,
        afterTemporaryHitPoints: actor.tempHitPoints,
        maximumHitPoints: actor.maxHitPoints,
        damageTypeId: crypto.randomUUID(),
        damageDisposition: 'NORMAL'
      }
    ],
    characterResourceConsumption: {
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
  }
}

async function stored(fixture: Fixture) {
  return fixture.owner.caller.run(async (ctx) => {
    const [run, actor, character, receipts] = await Promise.all([
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
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
        .unique(),
      ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', fixture.character.id))
        .collect()
    ])
    if (!run || !actor || !character) throw new Error('Mechanics fixture is unavailable.')
    return { run, actor, character, receipts }
  })
}

describe('applyLiveEncounterMechanicsBatch', () => {
  it('matches native Character damage and resource output, then commits the Character and receipt together', async () => {
    const fixture = await setupCharacterRun()
    const input = batch(fixture)
    const before = await stored(fixture)
    const probe: { native?: Awaited<ReturnType<typeof applyEncounterMechanicsBatch>> } = {}
    await expect(
      fixture.owner.caller.run(async (ctx) => {
        probe.native = await applyEncounterMechanicsBatch(ctx, input)
        throw new Error('Roll back native parity probe.')
      })
    ).rejects.toThrow('Roll back native parity probe.')
    if (!probe.native) throw new Error('Native parity probe did not complete.')
    expect(await stored(fixture)).toEqual(before)

    const live = await fixture.owner.caller.run((ctx) =>
      applyLiveEncounterMechanicsBatch(ctx, input)
    )
    expect({ ...live, characterReceiptId: null }).toEqual({
      ...probe.native,
      characterReceiptId: null
    })
    expect(live.characterReceiptId).not.toBeNull()
    const after = await stored(fixture)
    expect(after.run).toEqual(before.run)
    expect(JSON.parse(after.actor.stateJson)).toEqual(live.updatedActor)
    expect(after.actor.stateChecksum).toBe(checksumCanonicalJson(live.updatedActor))
    expect(after.character.streamVersion).toBe(fixture.characterStreamVersion + 1)
    expect(JSON.parse(after.character.documentJson).state.hitpoints.current).toBe(
      fixture.actor.currentHitPoints - 1
    )
    expect(after.receipts).toHaveLength(before.receipts.length + 1)
    expect(after.receipts.at(-1)).toMatchObject({
      id: live.characterReceiptId,
      characterId: fixture.character.id,
      commandId: input.commandId
    })
    if (!after.character.sheetState) throw new Error('Character Sheet state is unavailable.')
    const sheet = characterSheetStateSchema.parse(
      JSON.parse(after.character.sheetState.documentJson)
    )
    expect(sheet.resourceUsage).toEqual([expect.objectContaining({ used: 1 })])
  })

  it('rejects exact retry and command-ID collision without another write', async () => {
    const fixture = await setupCharacterRun()
    const input = batch(fixture)
    await fixture.owner.caller.run((ctx) => applyLiveEncounterMechanicsBatch(ctx, input))
    const committed = await stored(fixture)
    await expect(
      fixture.owner.caller.run((ctx) => applyLiveEncounterMechanicsBatch(ctx, input))
    ).rejects.toThrow(/stale|already exists/)
    await expect(
      fixture.owner.caller.run((ctx) =>
        applyLiveEncounterMechanicsBatch(ctx, {
          ...input,
          commandId: input.commandId,
          forceVersionAdvance: true,
          applications: [],
          characterResourceConsumption: undefined,
          effectiveMaximumHitPoints: committed.character.maximumHitPoints
        })
      )
    ).rejects.toThrow('Encounter Character outcome command already exists.')
    expect(await stored(fixture)).toEqual(committed)
  })

  it('refuses stale Run and Character versions with no partial writes', async () => {
    const fixture = await setupCharacterRun()
    const input = batch(fixture)
    const before = await stored(fixture)
    await expect(
      fixture.owner.caller.run((ctx) =>
        applyLiveEncounterMechanicsBatch(ctx, {
          ...input,
          expectedEncounterVersion: input.expectedEncounterVersion + 1
        })
      )
    ).rejects.toThrow('Encounter version is stale.')
    expect(await stored(fixture)).toEqual(before)

    await fixture.t.run(async (ctx) => {
      await ctx.db.patch(before.character._id, {
        streamVersion: before.character.streamVersion + 1
      })
    })
    const changed = await stored(fixture)
    await expect(
      fixture.owner.caller.run((ctx) => applyLiveEncounterMechanicsBatch(ctx, input))
    ).rejects.toThrow(/stale|unavailable/)
    expect(await stored(fixture)).toEqual(changed)
  })
})
