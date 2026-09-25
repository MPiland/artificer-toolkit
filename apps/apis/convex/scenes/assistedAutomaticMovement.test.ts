import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import type {
  PendingEncounterRuleOccurrenceSummaryDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  SceneGeometryBeginResult,
  SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setupReactionMovementScene } from '../../tests/fixtures/automaticSceneMovement'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

type Request = ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
const prepare = makeFunctionReference<'mutation', Request, SceneSpatialPreparation>(
  'scenes/spatialPreparation:prepare'
)
const finish = makeFunctionReference<'mutation', Request, SceneGeometryCommandResult>(
  'scenes/geometryCommands:finish'
)
const begin = makeFunctionReference<
  'mutation',
  ResolveRuleOccurrenceInputDto,
  SceneGeometryBeginResult | null
>('scenes/movementResolutionStaging:begin')
const observe = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')
const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

function command(input: {
  encounterId: string
  pending: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number }
  resolution: ResolveRuleOccurrenceInputDto['resolution']
}): ResolveRuleOccurrenceInputDto {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: input.encounterId,
    expectedVersion: input.pending.encounterVersion,
    occurrenceId: input.pending.occurrenceId,
    expectedOccurrenceVersion: input.pending.occurrenceVersion,
    correlationId: null,
    resolution: input.resolution
  }
}

async function actorChecksums(value: Awaited<ReturnType<typeof setupReactionMovementScene>>) {
  return value.base.t.run(async (ctx) =>
    (
      await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
        .collect()
    ).map((actor) => actor.stateChecksum)
  )
}

async function reactorChecksum(
  value: Awaited<ReturnType<typeof setupReactionMovementScene>>,
  reactorId: string
) {
  return value.base.t.run(async (ctx) => {
    const reactor = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', value.base.run.id).eq('id', reactorId)
      )
      .unique()
    if (!reactor) throw new Error('Missing reactor actor.')
    return reactor.stateChecksum
  })
}

it.each(['PROMPT', 'AUTO_ROLL'] as const)(
  'offers a System-automatic reaction to its controller as Use/Decline in Assisted mode, then applies it on Use (%s dice)',
  async (rolls) => {
    const base = await setupCreatureReactionRun(null, false, false, 'AUTOMATIC', 'AUTOMATIC', {
      outcomeDice: true
    })
    // The GM controls both Creatures, so it answers the choice and rolls the reaction dice.
    if (rolls === 'PROMPT') await setAutoRollDice(base.t, base.owner.userId, false)
    const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
    await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
    const beforePause = await actorChecksums(value)
    expect((await value.owner.caller.mutation(prepare, value.request)).outcome.kind).toBe('PENDING')
    const choice = (await value.owner.caller.mutation(finish, value.request)).occurrence?.pending
    expect(await actorChecksums(value)).toEqual(beforePause)
    if (!choice || choice.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected the Assisted Use/Decline choice for the automatic reaction.')
    expect(choice.choice).toMatchObject({
      reactorActorId: base.reactor.id,
      options: [expect.objectContaining({ actionSourceKind: 'ENCOUNTER_FEATURE' })]
    })
    expect(choice.choice.options).toHaveLength(1)
    // The decision is addressed to the reactor's controller (the GM), not the mover's token player.
    expect(
      await value.owner.caller.query(pendingRuleOccurrence, { encounterId: base.run.id })
    ).toEqual(choice)
    expect(
      await value.player.caller.query(pendingRuleOccurrence, { encounterId: base.run.id })
    ).toBeNull()
    const use = command({
      encounterId: base.run.id,
      pending: choice,
      resolution: { kind: 'OPTION', optionId: choice.choice.options[0]!.optionId }
    })
    await expect(value.player.caller.mutation(begin, use)).rejects.toThrow()
    const used = await value.owner.caller.mutation(begin, use)
    if (!used || used.kind !== 'READY') throw new Error('Expected the reaction Use staging.')
    const usedRequest = { ...value.request, saveId: used.saveId }
    await value.owner.caller.mutation(observe, { saveId: used.saveId, characterRevisions: [] })
    expect((await value.owner.caller.mutation(prepare, usedRequest)).outcome.kind).toBe('PENDING')
    const initial = (await value.owner.caller.mutation(finish, usedRequest)).occurrence?.pending
    expect(await actorChecksums(value)).toEqual(beforePause)
    let resistance = initial
    if (rolls === 'PROMPT') {
      if (!initial || initial.kind !== 'D20_EVIDENCE')
        throw new Error('Expected TEST evidence for the used automatic reaction.')
      const enterTest = command({
        encounterId: base.run.id,
        pending: initial,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: initial.request.requestId,
          rawFaces: initial.request.rollMode === 'NORMAL' ? [1] : [1, 1],
          rollMode: initial.request.rollMode
        }
      })
      await expect(value.player.caller.mutation(begin, enterTest)).rejects.toThrow(
        'another controller'
      )
      const testStage = await value.owner.caller.mutation(begin, enterTest)
      if (!testStage || testStage.kind !== 'READY')
        throw new Error('Expected TEST evidence staging.')
      const rolledRequest = { ...value.request, saveId: testStage.saveId }
      await value.owner.caller.mutation(observe, {
        saveId: testStage.saveId,
        characterRevisions: []
      })
      expect((await value.owner.caller.mutation(prepare, rolledRequest)).outcome.kind).toBe(
        'PENDING'
      )
      resistance = (await value.owner.caller.mutation(finish, rolledRequest)).occurrence?.pending
      expect(await actorChecksums(value)).toEqual(beforePause)
    }
    if (!resistance || resistance.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
      throw new Error('Expected the reaction consequence choice after its TEST.')
    const declineCommand = command({
      encounterId: base.run.id,
      pending: resistance,
      resolution: { kind: 'DECLINE' }
    })
    const decline = await value.owner.caller.mutation(begin, declineCommand)
    if (!decline || decline.kind !== 'READY')
      throw new Error('Expected consequence response staging.')
    let request = { ...value.request, saveId: decline.saveId }
    let complete: SceneGeometryCommandResult | null = null
    let outcomeEvidenceCount = 0
    for (let index = 0; index < 20; index++) {
      await value.owner.caller.mutation(observe, { saveId: request.saveId, characterRevisions: [] })
      expect((await value.owner.caller.mutation(prepare, request)).outcome.kind).toMatch(
        /PENDING|TERMINAL/
      )
      const result = await value.owner.caller.mutation(finish, request)
      if (result.occurrence?.status === 'COMPLETE') {
        complete = result
        break
      }
      const outcomeEvidence = result.occurrence?.pending
      if (!outcomeEvidence || outcomeEvidence.kind !== 'ACTION_OUTCOME_EVIDENCE')
        throw new Error('Expected Assisted OUTCOME evidence.')
      expect(await actorChecksums(value)).toEqual(beforePause)
      outcomeEvidenceCount++
      const staged = await value.owner.caller.mutation(
        begin,
        command({
          encounterId: base.run.id,
          pending: outcomeEvidence,
          resolution: {
            kind: 'ENTER_INTEGER',
            requestId: outcomeEvidence.request.requestId,
            value: outcomeEvidence.request.min
          }
        })
      )
      if (!staged || staged.kind !== 'READY') throw new Error('Expected OUTCOME evidence staging.')
      request = { ...value.request, saveId: staged.saveId }
    }
    if (!complete) throw new Error('Assisted automatic reaction did not complete.')
    if (rolls === 'PROMPT') expect(outcomeEvidenceCount).toBeGreaterThan(0)
    else expect(outcomeEvidenceCount).toBe(0)
    expect(complete.delta).toMatchObject({
      tokenId: value.moverTokenId,
      position: { x: 450, y: 50 }
    })
    await expect(value.owner.caller.mutation(finish, request)).resolves.toMatchObject({
      replayed: true
    })
    await expect(
      value.owner.caller.mutation(begin, {
        ...declineCommand,
        commandId: crypto.randomUUID(),
        expectedOccurrenceVersion: declineCommand.expectedOccurrenceVersion + 1
      })
    ).resolves.toBeNull()
  },
  30_000
)

it('skips a declined System-automatic reaction in Assisted mode without rolling or spending it', async () => {
  const base = await setupCreatureReactionRun(null, false, false, 'AUTOMATIC', 'AUTOMATIC', {
    outcomeDice: true
  })
  const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
  const reactorBefore = await reactorChecksum(value, base.reactor.id)
  expect((await value.owner.caller.mutation(prepare, value.request)).outcome.kind).toBe('PENDING')
  const choice = (await value.owner.caller.mutation(finish, value.request)).occurrence?.pending
  if (!choice || choice.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected the Assisted Use/Decline choice for the automatic reaction.')
  const declined = await value.owner.caller.mutation(
    begin,
    command({ encounterId: base.run.id, pending: choice, resolution: { kind: 'DECLINE' } })
  )
  if (!declined || declined.kind !== 'READY') throw new Error('Expected the Decline staging.')
  const request = { ...value.request, saveId: declined.saveId }
  await value.owner.caller.mutation(observe, { saveId: request.saveId, characterRevisions: [] })
  expect((await value.owner.caller.mutation(prepare, request)).outcome.kind).toBe('TERMINAL')
  const complete = await value.owner.caller.mutation(finish, request)
  expect(complete.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  expect(complete.delta).toMatchObject({
    tokenId: value.moverTokenId,
    position: { x: 450, y: 50 }
  })
  expect(await reactorChecksum(value, base.reactor.id)).toBe(reactorBefore)
}, 30_000)
