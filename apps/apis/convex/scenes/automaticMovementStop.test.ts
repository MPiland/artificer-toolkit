import { expect, it, vi } from 'vitest'
import { setupAutomaticCharacterMovement } from '../../tests/fixtures/automaticCharacterMovement'
import { useMovementReactions } from '../../tests/fixtures/automaticSceneMovement'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { joinCharacterPlay } from '../characters/stateDocuments'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: (sides: number) => (sides === 20 ? 14 : 0) }))

it.each([false, true])(
  'stops native Character movement at a used automatic reaction with spatial prefix %s and replays without writes',
  async (withSpatialPrefix) => {
    const value = await setupAutomaticCharacterMovement(['AUTOMATIC', 'AUTOMATIC'], true)
    const prefix = withSpatialPrefix
      ? await seedSpatialEffect({ ...value.base, sceneId: value.sceneId }, { x: 230, y: 50 }, 5)
      : null
    const suffix = withSpatialPrefix
      ? await seedSpatialEffect({ ...value.base, sceneId: value.sceneId }, { x: 375, y: 50 }, 5)
      : null
    // Assisted play offers the authored automatic reaction as Use/Decline; the GM uses it, and the
    // root publication at that choice already settled any spatial prefix.
    const { publish, prepared } = await useMovementReactions(value, 1)
    const snapshot = () =>
      value.base.t.run(async (ctx) => ({
        characters: await Promise.all(
          (await ctx.db.query('characters').collect()).map((row) => joinCharacterPlay(ctx, row))
        ),
        spatialEffects: await ctx.db.query('encounterSpatialRuleEffects').collect(),
        characterReceipts: await ctx.db.query('characterCommandReceipts').collect(),
        runs: await ctx.db.query('encounterRuns').collect(),
        actors: await ctx.db.query('encounterRunActors').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        runCommands: await ctx.db.query('encounterRunCommands').collect(),
        liveStates: await ctx.db.query('sceneLiveStates').collect(),
        fog: await ctx.db.query('sceneFogLayers').collect(),
        receipts: await ctx.db.query('encounterRuleReceipts').collect(),
        entities: await ctx.db.query('sceneLiveEntities').collect(),
        commands: await ctx.db.query('sceneLiveCommands').collect()
      }))
    const before = await snapshot()
    const beforeCharacter = before.characters.find((row) => row.id === value.base.character.id)
    const beforeRun = before.runs.find((row) => row.id === value.base.run.id)
    if (!beforeCharacter || !beforeRun) throw new Error('Automatic Character state is unavailable.')

    expect(prepared.outcome.kind).toBe('TERMINAL')
    if (prepared.outcome.kind !== 'TERMINAL') throw new Error('Expected automatic STOP terminal.')
    const reaction = prepared.outcome.result.reactionExecutions[0]
    if (!reaction) throw new Error('Expected first automatic reaction execution.')
    expect(prepared.outcome.result.reactionExecutions).toHaveLength(1)
    if (prefix) {
      if (prepared.outcome.result.status !== 'BATCH_COMPLETE')
        throw new Error('Expected retained spatial prefix at STOP.')
      expect(
        prepared.outcome.result.executions.map((entry) => entry.candidate.candidate.effectId)
      ).toEqual([prefix.id])
      expect(prepared.outcome.result.executions[0]!.candidate.candidate.pathDistance).toBeLessThan(
        reaction.option.candidate.pathDistance
      )
    }
    expect(reaction.option.candidate.reactorActorId).toBe(value.base.reactors[0]!.id)
    const [origin, destination] = value.rootInput.path
    if (!origin || !destination) throw new Error('Expected Character movement path.')
    const pathLength = Math.hypot(destination.x - origin.x, destination.y - origin.y)
    const contact = {
      x:
        origin.x +
        ((destination.x - origin.x) * reaction.option.candidate.pathDistance) / pathLength,
      y:
        origin.y +
        ((destination.y - origin.y) * reaction.option.candidate.pathDistance) / pathLength
    }
    expect(reaction.option.candidate.pathDistance).toBeGreaterThan(0)
    expect(reaction.option.candidate.pathDistance).toBeLessThan(pathLength)
    expect(prepared.outcome.result.terminalPosition).toEqual(contact)
    expect(prepared.outcome.result.terminalPosition).not.toEqual(destination)
    expect(await snapshot()).toEqual(before)

    const result = await publish()
    expect(result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    const after = await snapshot()
    const characterCommands = 1
    expect(after.characterReceipts).toHaveLength(
      before.characterReceipts.length + characterCommands
    )
    expect(
      after.characters.find((row) => row.id === value.base.character.id)?.play.streamVersion
    ).toBe(beforeCharacter.play.streamVersion + characterCommands)
    expect(after.runs.find((row) => row.id === value.base.run.id)?.version).toBe(
      beforeRun.version + 1
    )
    expect(after.receipts).toHaveLength(before.receipts.length + 1)
    if (suffix) expect(after.spatialEffects.map((effect) => effect.id)).toEqual([suffix.id])
    expect(after.entities).toMatchObject([
      { entityId: value.moverTokenId, value: { entity: { position: contact } } }
    ])

    await expect(publish()).resolves.toMatchObject({
      replayed: true
    })
    expect(await snapshot()).toEqual(after)
  },
  30_000
)
