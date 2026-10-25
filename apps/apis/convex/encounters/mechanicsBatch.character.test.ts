import { readReceiptHeaders } from '../lib/receiptLedgers'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { describe, expect, it, vi } from 'vitest'
import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounters'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { api } from '../_generated/api'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import {
  applyEncounterMechanicsBatch,
  type EncounterMechanicsBatchInput
} from '../../tests/fixtures/mechanicsBatch'

function damage(input: { actorId: string; current: number; temporary: number; maximum: number }) {
  return {
    sourceNodeId: 'native-test',
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

function command(
  run: EncounterGmProjectionDto,
  actor: EncounterGmProjectionDto['actors'][number],
  characterStreamVersion: number | null
) {
  return {
    encounterId: run.id,
    targetActorId: actor.id,
    expectedEncounterVersion: run.version,
    occurrenceId: crypto.randomUUID(),
    sourceCommandId: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    occurredAt: '2026-09-12T00:00:00.000Z',
    expectedCharacterStreamVersion: characterStreamVersion,
    effectiveMaximumHitPoints: actor.maxHitPoints,
    forceVersionAdvance: false
  } satisfies Omit<EncounterMechanicsBatchInput, 'applications'>
}

async function storedCharacterState(fixture: Awaited<ReturnType<typeof setupCharacterRun>>) {
  return fixture.t.run(async (ctx) => {
    const row = await readCharacterRow(ctx, fixture.character.id)
    if (!row) throw new Error('Missing Character.')
    return readCharacterRecord(row).state
  })
}

describe('applyEncounterMechanicsBatch Character persistence', () => {
  it('persists a Character outcome from current Character state', async () => {
    const fixture = await setupCharacterRun()
    const input = command(fixture.run, fixture.actor, fixture.characterStreamVersion)
    const result = await fixture.owner.caller.run((ctx) =>
      applyEncounterMechanicsBatch(ctx, {
        ...input,
        applications: [
          damage({
            actorId: fixture.actor.id,
            current: fixture.actor.currentHitPoints,
            temporary: fixture.actor.tempHitPoints,
            maximum: fixture.actor.maxHitPoints
          })
        ]
      })
    )
    expect((await storedCharacterState(fixture)).hitpoints.current).toBe(
      fixture.actor.currentHitPoints - 1
    )
    expect(result.characterStreamVersion).toBeGreaterThan(fixture.characterStreamVersion)
    // The Encounter keeps its own history: the batch leaves no Sheet receipt.
    await expect(
      fixture.t.run((ctx) =>
        ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) => q.eq('characterId', fixture.character.id))
          .collect()
      )
    ).resolves.toEqual([])
  })

  it('reuses authored sources while rereading same-mutation Character state', async () => {
    const fixture = await setupCharacterRun()
    const result = await fixture.owner.caller.run(async (ctx) => {
      const queries = vi.spyOn(ctx.db, 'query')
      const prepared = await loadCharacterSheetFacts(
        ctx,
        fixture.owner.userId,
        fixture.character.id,
        fixture.campaign.id
      )
      if (!prepared) throw new Error('Missing Character facts.')
      const condition = prepared.sourceContext.context.registry.system?.conditionTypes[0]
      if (!condition) throw new Error('Missing System condition.')
      const authoredReads = queries.mock.calls.filter(([table]) => table === 'authoredRoots').length
      const character = readCharacterRecord(prepared.active)
      if (character.state.hitpoints.current < 2)
        throw new Error('Character fixture requires at least 2 HP.')
      const currentHitPoints = character.state.hitpoints.current - 1
      const streamVersion = prepared.active.play.streamVersion + 1
      character.state.hitpoints.current = currentHitPoints
      character.state.conditions = [{ conditionTypeId: condition.id }]
      await writeCharacterRecord(ctx, prepared.active, { document: character, streamVersion })
      const applied = await applyEncounterMechanicsBatch(
        ctx,
        {
          ...command(fixture.run, fixture.actor, streamVersion),
          applications: [
            damage({
              actorId: fixture.actor.id,
              current: currentHitPoints,
              temporary: character.state.hitpoints.temp,
              maximum: prepared.active.play.maximumHitPoints
            }),
            {
              sourceNodeId: 'condition',
              sourceOperationKey: 'remove-current-condition',
              authoredPath: null,
              resolvedPath: null,
              kind: 'CONDITION_REMOVE',
              targetActorId: fixture.actor.id,
              conditionId: condition.id,
              sourceActiveEffectId: crypto.randomUUID()
            }
          ]
        },
        prepared.sourceContext
      )
      expect(queries.mock.calls.filter(([table]) => table === 'authoredRoots')).toHaveLength(
        authoredReads
      )
      queries.mockRestore()
      return applied
    })
    const stored = await storedCharacterState(fixture)
    expect(stored.hitpoints.current).toBe(fixture.actor.currentHitPoints - 2)
    expect(stored.conditions).toEqual([])
    expect(result.characterStreamVersion).toBe(fixture.characterStreamVersion + 2)
  })

  it('rejects mismatched bindings and non-Character source-context use', async () => {
    const fixture = await setupCharacterRun()
    await fixture.owner.caller.run(async (ctx) => {
      const prepared = await loadCharacterSheetFacts(
        ctx,
        fixture.owner.userId,
        fixture.character.id,
        fixture.campaign.id
      )
      if (!prepared) throw new Error('Missing Character facts.')
      const { sourceContext } = prepared
      const system = sourceContext.context.registry.system
      const campaign = sourceContext.context.sourceAccess.campaign
      if (!system || !campaign) throw new Error('Missing bound Character source context.')
      const mismatches = [
        { ...sourceContext, characterId: crypto.randomUUID() },
        { ...sourceContext, ownerUserId: crypto.randomUUID() },
        {
          ...sourceContext,
          context: {
            ...sourceContext.context,
            registry: {
              ...sourceContext.context.registry,
              system: { ...system, id: crypto.randomUUID() }
            }
          }
        },
        {
          ...sourceContext,
          context: {
            ...sourceContext.context,
            sourceAccess: {
              ...sourceContext.context.sourceAccess,
              campaign: { ...campaign, id: crypto.randomUUID() }
            }
          }
        }
      ]
      for (const mismatch of mismatches) {
        await expect(
          applyEncounterMechanicsBatch(
            ctx,
            {
              ...command(fixture.run, fixture.actor, fixture.characterStreamVersion),
              commandId: crypto.randomUUID(),
              applications: []
            },
            mismatch
          )
        ).rejects.toThrow('Character Sheet source context binding mismatch.')
      }
      const nonCharacter = fixture.run.actors.find((actor) => actor.kind !== 'CHARACTER')
      if (!nonCharacter) throw new Error('Missing non-Character actor.')
      await expect(
        applyEncounterMechanicsBatch(
          ctx,
          { ...command(fixture.run, nonCharacter, null), applications: [] },
          sourceContext
        )
      ).rejects.toThrow('Character Sheet source context requires a Character target.')
    })
  })

  it('rejects stale root and actor state, but forces a no-op Character stream advance', async () => {
    const fixture = await setupCharacterRun()
    const base = command(fixture.run, fixture.actor, fixture.characterStreamVersion)
    await expect(
      fixture.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...base,
          expectedEncounterVersion: base.expectedEncounterVersion + 1,
          applications: []
        })
      )
    ).rejects.toThrow(/version is stale/)
    const forced = await fixture.owner.caller.run((ctx) =>
      applyEncounterMechanicsBatch(ctx, {
        ...base,
        commandId: crypto.randomUUID(),
        forceVersionAdvance: true,
        applications: []
      })
    )
    expect(forced.characterStreamVersion).toBe(fixture.characterStreamVersion + 1)
    await fixture.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (query) =>
          query.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
        )
        .unique()
      if (!row) throw new Error('Fixture actor row is unavailable.')
      const state = JSON.parse(row.stateJson) as { label: string }
      state.label = 'Changed label'
      await ctx.db.patch(row._id, { stateJson: JSON.stringify(state) })
    })
    await expect(
      fixture.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, { ...base, applications: [] })
      )
    ).rejects.toThrow(/checksum/i)
  })

  it('rolls back Character, actor, and compact receipt writes when its terminal caller fails later', async () => {
    const fixture = await setupCharacterRun()
    const input = command(fixture.run, fixture.actor, fixture.characterStreamVersion)
    const before = await fixture.t.run(async (ctx) => {
      const [character, actor, receipts] = await Promise.all([
        readCharacterRow(ctx, fixture.character.id),
        ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (query) =>
            query.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
          )
          .unique(),
        ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (query) =>
            query.eq('characterId', fixture.character.id)
          )
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'characterCommandReceipts', headers))
      ])
      return { character, actor, receipts }
    })
    await expect(
      fixture.owner.caller.run(async (ctx) => {
        await applyEncounterMechanicsBatch(ctx, {
          ...input,
          applications: [
            damage({
              actorId: fixture.actor.id,
              current: fixture.actor.currentHitPoints,
              temporary: fixture.actor.tempHitPoints,
              maximum: fixture.actor.maxHitPoints
            })
          ]
        })
        throw new Error('later terminal write failed')
      })
    ).rejects.toThrow('later terminal write failed')
    const after = await fixture.t.run(async (ctx) => {
      const [character, actor, receipts] = await Promise.all([
        readCharacterRow(ctx, fixture.character.id),
        ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (query) =>
            query.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
          )
          .unique(),
        ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (query) =>
            query.eq('characterId', fixture.character.id)
          )
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'characterCommandReceipts', headers))
      ])
      return { character, actor, receipts }
    })
    expect(after).toEqual(before)
  })

  it('preserves a no-op and commits a spell slot spend only against the planned Character version', async () => {
    const fixture = await setupCharacterRun()
    const read = () =>
      fixture.t.run(async (ctx) => ({
        character: await readCharacterRow(ctx, fixture.character.id),
        actor: await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
          )
          .unique()
      }))
    const before = await read()
    const input = {
      ...command(fixture.run, fixture.actor, fixture.characterStreamVersion),
      applications: []
    }
    const noop = await fixture.owner.caller.run((ctx) => applyEncounterMechanicsBatch(ctx, input))
    expect(noop.characterStreamVersion).toBeNull()
    expect(await read()).toEqual(before)
    const spend = {
      characterId: fixture.character.id,
      spellId: crypto.randomUUID(),
      candidateId: 'candidate',
      slotKey: 'STANDARD:1',
      beforeUsed: 0,
      afterUsed: 1,
      expectedStreamVersion: fixture.characterStreamVersion
    }
    const slots = [{ slotKey: 'STANDARD:1', used: 1 }]
    const result = await fixture.owner.caller.run((ctx) =>
      applyEncounterMechanicsBatch(ctx, { ...input, characterSpellConsumptions: [spend] })
    )
    expect(result.characterStreamVersion).toBe(fixture.characterStreamVersion + 1)
    const after = await read()
    if (!before.character || !after.character) throw new Error('Missing Character.')
    const original = readCharacterRecord(before.character)
    expect(readCharacterRecord(after.character)).toEqual({
      ...original,
      state: {
        ...original.state,
        conditions: original.state.conditions ?? [],
        hitpoints: { ...original.state.hitpoints, temp: original.state.hitpoints.temp },
        spellSlots: slots
      }
    })
    expect(after.character.sheetState).toEqual(before.character.sheetState)
    await expect(
      fixture.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...command(fixture.run, fixture.actor, fixture.characterStreamVersion + 1),
          applications: [],
          characterSpellConsumptions: [
            { ...spend, expectedStreamVersion: fixture.characterStreamVersion + 1 }
          ]
        })
      )
    ).rejects.toThrow('Encounter Character spell slot consumption is stale.')
    expect(await read()).toEqual(after)
  })

  it('rejects a Character that changed after its outcome was planned', async () => {
    const fixture = await setupCharacterRun()
    await fixture.t.run(async (ctx) => {
      const row = await readCharacterRow(ctx, fixture.character.id)
      if (!row) throw new Error('Missing Character.')
      await ctx.db.patch(row.play._id, { streamVersion: row.play.streamVersion + 1 })
    })
    await expect(
      fixture.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...command(fixture.run, fixture.actor, fixture.characterStreamVersion),
          applications: []
        })
      )
    ).rejects.toThrow('changed after the outcome was planned')
  })

  it.each([false, true])(
    'persists Character condition replacement with retained contribution: %s',
    async (retained) => {
      const fixture = await setupCharacterRun()
      const [oldCondition, nextCondition] = srdSystemRecord.conditionTypes
      if (!oldCondition || !nextCondition) throw new Error('Missing System conditions.')
      await fixture.t.run(async (ctx) => {
        const characterRow = await readCharacterRow(ctx, fixture.character.id)
        if (!characterRow) throw new Error('Missing target state.')
        const character = readCharacterRecord(characterRow)
        character.state.conditions = [{ conditionTypeId: oldCondition.id }]
        await writeCharacterRecord(ctx, characterRow, { document: character })
      })
      const trace = {
        sourceNodeId: 'condition',
        sourceOperationKey: 'condition',
        authoredPath: null,
        resolvedPath: null
      }
      const result = await fixture.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...command(fixture.run, fixture.actor, fixture.characterStreamVersion),
          retainedConditionIds: retained ? [oldCondition.id] : [],
          applications: [
            {
              ...trace,
              kind: 'CONDITION_REMOVE',
              targetActorId: fixture.actor.id,
              conditionId: oldCondition.id,
              sourceActiveEffectId: crypto.randomUUID()
            },
            {
              ...trace,
              kind: 'CONDITION_APPLY',
              targetActorId: fixture.actor.id,
              conditionId: nextCondition.id
            }
          ]
        })
      )
      expect(result.characterStreamVersion).toBe(fixture.characterStreamVersion + 1)
      const expectedIds = [...(retained ? [oldCondition.id] : []), nextCondition.id]
      const stored = await fixture.t.run(async (ctx) => {
        const row = await readCharacterRow(ctx, fixture.character.id)
        if (!row) throw new Error('Missing Character.')
        return readCharacterRecord(row)
      })
      expect(stored.state.conditions?.map((condition) => condition.conditionTypeId)).toEqual(
        expectedIds
      )
      expect(result.updatedActor).not.toHaveProperty('conditions')
    }
  )

  it('retains modifier applications for the parent without a Sheet receipt', async () => {
    const fixture = await setupCharacterRun()
    const actorBefore = await fixture.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (query) =>
          query.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
        )
        .unique()
      if (!row) throw new Error('Missing Character actor.')
      return await readTestActor(ctx, row)
    })
    const input = command(fixture.run, fixture.actor, fixture.characterStreamVersion)
    const result = await fixture.owner.caller.run((ctx) =>
      applyEncounterMechanicsBatch(ctx, {
        ...input,
        applications: [
          {
            sourceNodeId: 'reduction',
            sourceOperationKey: 'reduce-maximum',
            authoredPath: null,
            resolvedPath: null,
            targetActorId: fixture.actor.id,
            kind: 'HIT_POINT_MAXIMUM_REDUCTION',
            reductionAmount: 1,
            sourceDamageOutcomeId: crypto.randomUUID(),
            sourceDamageNodeId: 'damage',
            sourceDamageOperationKey: 'damage',
            recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM']
          }
        ]
      })
    )
    expect(result.receiptApplications).toEqual([
      expect.objectContaining({
        kind: 'HIT_POINT_MAXIMUM_REDUCTION',
        beforeMaximumHitPoints: fixture.actor.maxHitPoints,
        afterMaximumHitPoints: fixture.actor.maxHitPoints - 1
      })
    ])
    // The Character actor carries no maximum; the reduction persists as the parent's rule effect.
    expect(result.updatedActor).toEqual(actorBefore)
    await expect(
      fixture.t.run((ctx) =>
        ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) =>
            q.eq('characterId', fixture.character.id).eq('commandId', input.commandId)
          )
          .unique()
      )
    ).resolves.toBeNull()
  })

  it('reads a Character maximum change made after Run creation live instead of refusing it', async () => {
    const fixture = await setupCharacterRun()
    const adjusted = await fixture.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: fixture.character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: fixture.characterStreamVersion,
        adjustment: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: 2 }
      }
    })
    expect(adjusted).not.toHaveProperty('sheet')
    const adjustedSheet = (await fixture.player.caller.query(api.characters.sheet.get, {
      id: adjusted.characterId
    }))!
    const effectiveMaximumHitPoints = adjustedSheet.overview.maxHitPoints
    expect(effectiveMaximumHitPoints).toBe(fixture.actor.maxHitPoints + 2)
    const characterRow = await fixture.t.run((ctx) => readCharacterRow(ctx, fixture.character.id))
    expect(characterRow?.play.maximumHitPoints).toBe(effectiveMaximumHitPoints)
    const input = command(fixture.run, fixture.actor, fixture.characterStreamVersion + 1)
    const result = await fixture.owner.caller.run((ctx) =>
      applyEncounterMechanicsBatch(ctx, {
        ...input,
        effectiveMaximumHitPoints,
        applications: [
          damage({
            actorId: fixture.actor.id,
            current: fixture.actor.currentHitPoints,
            temporary: fixture.actor.tempHitPoints,
            maximum: effectiveMaximumHitPoints
          })
        ]
      })
    )
    expect(result.characterStreamVersion).toBe(fixture.characterStreamVersion + 2)
    expect((await storedCharacterState(fixture)).hitpoints.current).toBe(
      fixture.actor.currentHitPoints - 1
    )
  })
})
