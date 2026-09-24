import { describe, expect, it, vi } from 'vitest'
import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounters'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { requireSnapshotIdentity } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { applyEncounterMechanicsBatch, type EncounterMechanicsBatchInput } from './mechanicsBatch'

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
    damageDisposition: 'NORMAL' as const
  }
}

function command(run: EncounterGmProjectionDto, actor: EncounterGmProjectionDto['actors'][number]) {
  return {
    encounterId: run.id,
    targetActorId: actor.id,
    expectedEncounterVersion: run.version,
    occurrenceId: crypto.randomUUID(),
    sourceCommandId: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    occurredAt: '2026-09-12T00:00:00.000Z',
    effectiveMaximumHitPoints: actor.maxHitPoints,
    forceVersionAdvance: false
  } satisfies Omit<EncounterMechanicsBatchInput, 'applications'>
}

describe('applyEncounterMechanicsBatch Character persistence', () => {
  it('persists a Character outcome, compact receipt, and actor mirror from current state', async () => {
    const fixture = await setupCharacterRun()
    const input = command(fixture.run, fixture.actor)
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
    expect(result.updatedActor.currentHitPoints).toBe(fixture.actor.currentHitPoints - 1)
    expect(result.characterStreamVersion).toBeGreaterThan(fixture.actorSourceRevision)
    expect(result.characterReceiptId).not.toBeNull()
    await expect(
      fixture.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, { ...input, applications: [] })
      )
    ).rejects.toThrow(/already exists/)
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
      const actorRow = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (query) =>
          query.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
        )
        .unique()
      if (!actorRow) throw new Error('Missing Character actor.')
      const actor = encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson))
      if (actor.currentHitPoints < 2) throw new Error('Character fixture requires at least 2 HP.')
      const currentHitPoints = actor.currentHitPoints - 1
      const streamVersion = prepared.active.streamVersion + 1
      const character = characterAuthoredDtoSchema.parse(JSON.parse(prepared.active.documentJson))
      character.state.hitpoints.current = currentHitPoints
      character.state.conditions = [{ conditionTypeId: condition.id }]
      await ctx.db.patch(prepared.active._id, {
        documentJson: canonicalizeRuleDocument(character),
        checksum: checksumRuleDocument(character),
        streamVersion
      })
      const currentActor = encounterRunActorStateSchema.parse({
        ...actor,
        sourceRevision: streamVersion,
        snapshot: { ...requireSnapshotIdentity(actor), sourceRevision: streamVersion },
        currentHitPoints,
        conditions: [{ conditionTypeId: condition.id, label: condition.label }]
      })
      await ctx.db.patch(actorRow._id, {
        stateJson: JSON.stringify(currentActor),
        stateChecksum: checksumCanonicalJson(currentActor)
      })
      const applied = await applyEncounterMechanicsBatch(
        ctx,
        {
          ...command(fixture.run, fixture.actor),
          applications: [
            damage({
              actorId: fixture.actor.id,
              current: currentHitPoints,
              temporary: currentActor.tempHitPoints,
              maximum: currentActor.maxHitPoints
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
    expect(result.updatedActor.currentHitPoints).toBe(fixture.actor.currentHitPoints - 2)
    expect(result.updatedActor.conditions).toEqual([])
    expect(result.characterStreamVersion).toBe(fixture.actorSourceRevision + 2)
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
              ...command(fixture.run, fixture.actor),
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
          { ...command(fixture.run, nonCharacter), applications: [] },
          sourceContext
        )
      ).rejects.toThrow('Character Sheet source context requires a Character target.')
    })
  })

  it('rejects stale root and actor state, but forces a no-op Character stream advance', async () => {
    const fixture = await setupCharacterRun()
    const base = command(fixture.run, fixture.actor)
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
    expect(forced.characterStreamVersion).toBe(fixture.actorSourceRevision + 1)
    expect(forced.characterReceiptId).toBeNull()
    await fixture.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (query) =>
          query.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
        )
        .unique()
      if (!row) throw new Error('Fixture actor row is unavailable.')
      const state = JSON.parse(row.stateJson) as { sourceRevision: number }
      state.sourceRevision += 1
      await ctx.db.patch(row._id, { stateJson: JSON.stringify(state) })
    })
    await expect(
      fixture.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, { ...base, applications: [] })
      )
    ).rejects.toThrow(/checksum|mirror|actor/i)
  })

  it('rolls back Character, actor, and compact receipt writes when its terminal caller fails later', async () => {
    const fixture = await setupCharacterRun()
    const input = command(fixture.run, fixture.actor)
    const before = await fixture.t.run(async (ctx) => {
      const [character, actor, receipts] = await Promise.all([
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (query) => query.eq('id', fixture.character.id))
          .unique(),
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
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (query) => query.eq('id', fixture.character.id))
          .unique(),
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
      ])
      return { character, actor, receipts }
    })
    expect(after).toEqual(before)
  })

  it('preserves a no-op and commits only validated sealed spell-slot state', async () => {
    const fixture = await setupCharacterRun()
    const read = () =>
      fixture.t.run(async (ctx) => ({
        character: await ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
          .unique(),
        actor: await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
          )
          .unique()
      }))
    const before = await read()
    const input = { ...command(fixture.run, fixture.actor), applications: [] }
    const noop = await fixture.owner.caller.run((ctx) => applyEncounterMechanicsBatch(ctx, input))
    expect(noop.characterStreamVersion).toBeNull()
    expect(await read()).toEqual(before)
    const slots = [{ slotKey: 'STANDARD:1', used: 1 }]
    const result = await fixture.owner.caller.run((ctx) =>
      applyEncounterMechanicsBatch(ctx, {
        ...input,
        spellSlotUsage: slots
      })
    )
    expect(result.characterStreamVersion).toBe(fixture.actorSourceRevision + 1)
    expect(result.characterReceiptId).toBeNull()
    const after = await read()
    if (!before.character || !after.character) throw new Error('Missing Character.')
    const original = characterAuthoredDtoSchema.parse(JSON.parse(before.character.documentJson))
    expect(JSON.parse(after.character.documentJson)).toEqual({
      ...original,
      state: {
        ...original.state,
        conditions: original.state.conditions ?? [],
        hitpoints: { ...original.state.hitpoints, temp: original.state.hitpoints.temp ?? 0 },
        spellSlots: slots
      }
    })
    expect(after.character.sheetState).toEqual(before.character.sheetState)
    await expect(
      fixture.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...input,
          commandId: crypto.randomUUID(),
          spellSlotUsage: [{ slotKey: 'STANDARD:1', used: -1 }]
        })
      )
    ).rejects.toThrow()
    expect(await read()).toEqual(after)
  })

  it('rejects a valid Character stream advance missing from its actor mirror', async () => {
    const fixture = await setupCharacterRun()
    await fixture.t.run(async (ctx) => {
      const row = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
        .unique()
      if (!row) throw new Error('Missing Character.')
      await ctx.db.patch(row._id, { streamVersion: row.streamVersion + 1 })
    })
    await expect(
      fixture.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...command(fixture.run, fixture.actor),
          applications: []
        })
      )
    ).rejects.toThrow('state mirror is stale')
  })

  it.each([false, true])(
    'persists Character condition replacement with retained contribution: %s',
    async (retained) => {
      const fixture = await setupCharacterRun()
      const [oldCondition, nextCondition] = srdSystemRecord.conditionTypes
      if (!oldCondition || !nextCondition) throw new Error('Missing System conditions.')
      await fixture.t.run(async (ctx) => {
        const characterRow = await ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
          .unique()
        const actorRow = await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
          )
          .unique()
        if (!characterRow || !actorRow) throw new Error('Missing target state.')
        const character = characterAuthoredDtoSchema.parse(JSON.parse(characterRow.documentJson))
        character.state.conditions = [{ conditionTypeId: oldCondition.id }]
        await ctx.db.patch(characterRow._id, {
          documentJson: canonicalizeRuleDocument(character),
          checksum: checksumRuleDocument(character)
        })
        const actor = encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson))
        const updated = {
          ...actor,
          conditions: [{ conditionTypeId: oldCondition.id, label: 'Existing metadata' }]
        }
        await ctx.db.patch(actorRow._id, {
          stateJson: JSON.stringify(updated),
          stateChecksum: checksumCanonicalJson(updated)
        })
      })
      const trace = {
        sourceNodeId: 'condition',
        sourceOperationKey: 'condition',
        authoredPath: null,
        resolvedPath: null
      }
      const result = await fixture.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...command(fixture.run, fixture.actor),
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
      expect(result.characterStreamVersion).toBe(fixture.actorSourceRevision + 1)
      expect(result.characterReceiptId).not.toBeNull()
      const expectedIds = [...(retained ? [oldCondition.id] : []), nextCondition.id]
      const stored = await fixture.t.run(async (ctx) => {
        const row = await ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
          .unique()
        if (!row) throw new Error('Missing Character.')
        return characterAuthoredDtoSchema.parse(JSON.parse(row.documentJson))
      })
      expect(stored.state.conditions?.map((condition) => condition.conditionTypeId)).toEqual(
        expectedIds
      )
      expect(result.updatedActor.conditions).toEqual([
        ...(retained
          ? [
              expect.objectContaining({
                conditionTypeId: oldCondition.id,
                label: oldCondition.label
              })
            ]
          : []),
        expect.objectContaining({ conditionTypeId: nextCondition.id, label: nextCondition.label })
      ])
    }
  )

  it('retains modifier applications for the parent while preserving compact history semantics', async () => {
    const fixture = await setupCharacterRun()
    const input = command(fixture.run, fixture.actor)
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
      expect.objectContaining({ kind: 'HIT_POINT_MAXIMUM_REDUCTION' })
    ])
    expect(result.updatedActor.maxHitPoints).toBe(fixture.actor.maxHitPoints - 1)
    const receipt = await fixture.t.run((ctx) =>
      ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) =>
          q.eq('characterId', fixture.character.id).eq('commandId', input.commandId)
        )
        .unique()
    )
    expect(JSON.parse(receipt!.historyJson).summary).toBe('Rule outcomes applied: 0 results')
  })

  it('accepts the parent-supplied effective maximum and rejects a mismatched maximum', async () => {
    const fixture = await setupCharacterRun()
    const effectiveMaximumHitPoints = fixture.actor.maxHitPoints - 1
    await fixture.t.run(async (ctx) => {
      const [row, characterRow] = await Promise.all([
        ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (query) =>
            query.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
          )
          .unique(),
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (query) => query.eq('id', fixture.character.id))
          .unique()
      ])
      if (!row || !characterRow) throw new Error('Fixture source row is unavailable.')
      const character = characterAuthoredDtoSchema.parse(JSON.parse(characterRow.documentJson))
      character.state.hitpoints.current = effectiveMaximumHitPoints
      await ctx.db.patch(characterRow._id, {
        documentJson: canonicalizeRuleDocument(character),
        checksum: checksumRuleDocument(character)
      })
      const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
      const next = encounterRunActorStateSchema.parse({
        ...actor,
        currentHitPoints: effectiveMaximumHitPoints,
        maxHitPoints: effectiveMaximumHitPoints
      })
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify(next),
        stateChecksum: checksumCanonicalJson(next)
      })
    })
    const input = command(fixture.run, fixture.actor)
    await expect(
      fixture.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...input,
          commandId: crypto.randomUUID(),
          effectiveMaximumHitPoints,
          forceVersionAdvance: true,
          applications: []
        })
      )
    ).resolves.toMatchObject({ characterStreamVersion: fixture.actorSourceRevision + 1 })
    await expect(
      fixture.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...input,
          commandId: crypto.randomUUID(),
          effectiveMaximumHitPoints: effectiveMaximumHitPoints + 1,
          applications: []
        })
      )
    ).rejects.toThrow(/maximum hit points are stale/)
  })
})
