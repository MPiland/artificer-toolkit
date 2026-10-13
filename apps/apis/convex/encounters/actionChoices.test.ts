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
import { domainRejection } from '../../tests/fixtures/playerControl'
import {
  checkpointLiveRoom,
  executeInRoom,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

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
  useLocalRoomWorker()

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
      const base = await nativeDisarmFixture('AUTO_ROLL', characterTarget, characterSource)
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
      // The Disarm fixture authors an unlimited range; Character and Creature choices both carry it.
      expect(catalogue.actions.find(({ id }) => id === base.command.actionId)).toMatchObject({
        range: { kind: 'UNLIMITED' },
        rangeLabel: 'Unlimited'
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

  it('lets only a controlling player and never an outsider read discovery choices, without writes', async () => {
    const base = await nativeDisarmFixture('PROMPT')
    const uncontrolled = inputs(base)
    const beforeRefusal = await disarmRecords(base)
    await expect(
      domainRejection(base.player.caller.query(getNativeActionChoices, uncontrolled.catalogue))
    ).resolves.toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
    await expect(
      domainRejection(
        base.player.caller.query(getNativeOptionalActionChoices, uncontrolled.optional)
      )
    ).resolves.toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
    expect(await disarmRecords(base)).toEqual(beforeRefusal)

    const granted = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.command.expectedVersion,
        actorId: base.actor.id,
        controllerUserIds: [base.player.userId]
      }
    })
    // Convex's queries read the room's committed Run once it checkpoints.
    await checkpointLiveRoom(base.campaign.id)
    const catalogueInput = {
      ...uncontrolled.catalogue,
      expectedVersion: granted.projection.version
    }
    const optionalInput = { ...uncontrolled.optional, expectedVersion: granted.projection.version }
    const before = await disarmRecords(base)
    await expect(base.player.caller.query(getNativeActionChoices, catalogueInput)).resolves.toEqual(
      await base.owner.caller.query(getNativeActionChoices, catalogueInput)
    )
    await expect(
      base.player.caller.query(getNativeOptionalActionChoices, optionalInput)
    ).resolves.toEqual(await base.owner.caller.query(getNativeOptionalActionChoices, optionalInput))
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
        await expect(ctx.runQuery(getNativeActionChoices, catalogueInput)).rejects.toThrow()
        await expect(ctx.runQuery(getNativeOptionalActionChoices, optionalInput)).rejects.toThrow()
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
    const disabled = await executeInRoom(base.owner.caller, {
      command: {
        type: 'REPLACE_OPTIONAL_COMBAT_RULES',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.command.expectedVersion,
        definitionIds: []
      }
    })
    await checkpointLiveRoom(base.campaign.id)
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
