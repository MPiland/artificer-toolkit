import { describe, expect, it } from 'vitest'
import {
  encounterActionChoicesDtoSchema,
  encounterOptionalActionChoicesDtoSchema,
  type GetEncounterOptionalActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import {
  disarmRecords,
  getNativeActionChoices,
  getNativeOptionalActionChoices,
  nativeDisarmFixture
} from '../../tests/fixtures/nativeDisarm'
import { api } from '../_generated/api'

function inputs(base: Awaited<ReturnType<typeof nativeDisarmFixture>>) {
  if (!base.command.optionalCombatIntent) throw new Error('Missing Disarm intent.')
  const catalogue = {
    encounterId: base.run.id,
    expectedVersion: base.command.expectedVersion,
    actorId: base.actor.id
  }
  const optional: GetEncounterOptionalActionChoicesInputDto = {
    ...catalogue,
    actionId: base.command.actionId,
    targetActorId: base.target.id,
    definitionId: base.command.optionalCombatIntent.definitionId,
    sceneContext: base.command.sceneContext
  }
  return { catalogue, optional }
}

describe('native public Encounter action choices', () => {
  it.each([
    {
      label: 'Creature source and Creature target',
      characterSource: false,
      characterTarget: false
    },
    {
      label: 'Character source and Creature target',
      characterSource: true,
      characterTarget: false
    },
    { label: 'Creature source and Character target', characterSource: false, characterTarget: true }
  ])(
    'offers labeled actions and exact held-item choices without writes: $label',
    async ({ characterSource, characterTarget }) => {
      const base = await nativeDisarmFixture('AUTOMATIC', characterTarget, characterSource)
      const before = await disarmRecords(base)
      const input = inputs(base)
      const catalogue = await base.owner.caller.query(getNativeActionChoices, input.catalogue)
      const optional = await base.owner.caller.query(getNativeOptionalActionChoices, input.optional)
      expect(encounterActionChoicesDtoSchema.parse(catalogue)).toEqual(catalogue)
      expect(encounterOptionalActionChoicesDtoSchema.parse(optional)).toEqual(optional)
      expect(catalogue).toMatchObject({
        encounterId: base.run.id,
        encounterVersion: base.command.expectedVersion,
        actorId: base.actor.id,
        actions: expect.arrayContaining([
          expect.objectContaining({
            id: base.command.actionId,
            label: expect.stringMatching(characterSource ? /club/i : /bite/i),
            attackBonus: base.contest.initiator.modifier
          })
        ]),
        optionalRules: [{ definitionId: input.optional.definitionId, label: 'Disarm' }]
      })
      expect(optional.label).toBe('Disarm')
      expect(optional.fields).toHaveLength(2)
      expect(optional.fields.find((field) => field.label === 'Held item')?.options).toEqual([
        { id: base.heldItemId, label: 'Club' }
      ])
      expect(
        optional.fields
          .find((field) => field.label === 'Defender check')
          ?.options.map((choice) => choice.label)
          .sort()
      ).toEqual(['Acrobatics', 'Athletics'])
      expect(base.command.optionalCombatIntent).toMatchObject({
        definitionId: optional.definitionId,
        optionId: optional.optionId,
        selectionContract: optional.selectionContract
      })
      for (const selection of base.command.optionalCombatIntent!.selections) {
        if (selection.value.kind !== 'ENTITY') throw new Error('Expected an entity selection.')
        expect(
          optional.fields
            .find((field) => field.fieldId === selection.fieldId)
            ?.options.map((choice) => choice.id)
        ).toContain(selection.value.entityId)
      }
      expect(await disarmRecords(base)).toEqual(before)
    },
    30000
  )

  it('denies a current PLAYER and an authenticated outsider both discovery reads without writes', async () => {
    const base = await nativeDisarmFixture('ASSISTED', false, true)
    const input = inputs(base)
    const before = await disarmRecords(base)
    await expect(
      base.player.caller.query(getNativeActionChoices, input.catalogue)
    ).rejects.toThrow()
    await expect(
      base.player.caller.query(getNativeOptionalActionChoices, input.optional)
    ).rejects.toThrow()
    expect(await disarmRecords(base)).toEqual(before)
    await expect(
      base.player.caller.run(async (ctx) => {
        const membership = await ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_userId', (q) =>
            q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
          )
          .unique()
        if (!membership) throw new Error('Missing fixture membership.')
        await ctx.db.delete(membership._id)
        await expect(ctx.runQuery(getNativeActionChoices, input.catalogue)).rejects.toThrow()
        await expect(ctx.runQuery(getNativeOptionalActionChoices, input.optional)).rejects.toThrow()
        throw new Error('restore discovery outsider fixture')
      })
    ).rejects.toThrow('restore discovery outsider fixture')
    expect(await disarmRecords(base)).toEqual(before)
  }, 30000)

  it('returns no catalogue for superseded scopes while rejecting unavailable optional selections without writes', async () => {
    const base = await nativeDisarmFixture()
    const input = inputs(base)
    const before = await disarmRecords(base)
    for (const changed of [
      { expectedVersion: input.catalogue.expectedVersion + 1 },
      { actorId: base.target.id }
    ]) {
      await expect(
        base.owner.caller.query(getNativeActionChoices, { ...input.catalogue, ...changed })
      ).resolves.toBeNull()
      await expect(
        base.owner.caller.query(getNativeOptionalActionChoices, { ...input.optional, ...changed })
      ).rejects.toThrow()
    }
    for (const changed of [
      { actionId: crypto.randomUUID() },
      { targetActorId: crypto.randomUUID() },
      { targetActorId: base.actor.id },
      { definitionId: crypto.randomUUID() }
    ]) {
      await expect(
        base.owner.caller.query(getNativeOptionalActionChoices, { ...input.optional, ...changed })
      ).rejects.toThrow()
    }
    expect(await disarmRecords(base)).toEqual(before)
    const disabled = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'REPLACE_OPTIONAL_COMBAT_RULES',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.command.expectedVersion,
        definitionIds: []
      }
    })
    const afterDisable = await disarmRecords(base)
    const expectedVersion = disabled.projection.version
    await expect(
      base.owner.caller.query(getNativeActionChoices, input.catalogue)
    ).resolves.toBeNull()
    await expect(
      base.owner.caller.query(getNativeActionChoices, { ...input.catalogue, expectedVersion })
    ).resolves.toMatchObject({ optionalRules: [] })
    await expect(
      base.owner.caller.query(getNativeOptionalActionChoices, {
        ...input.optional,
        expectedVersion
      })
    ).rejects.toThrow()
    expect(await disarmRecords(base)).toEqual(afterDisable)
  }, 30000)
})
