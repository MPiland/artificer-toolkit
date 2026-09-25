import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
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

it.each(['PROMPT', 'AUTO_ROLL'] as const)(
  'fires a System-automatic reaction in Assisted mode without a controller choice (%s dice)',
  async (rolls) => {
    const base = await setupCreatureReactionRun(null, false, false, 'AUTOMATIC', 'AUTOMATIC', {
      outcomeDice: true
    })
    // The mover initiates the movement and therefore rolls its reaction dice.
    if (rolls === 'PROMPT') await setAutoRollDice(base.t, base.owner.userId, false)
    const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
    await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
    const beforePause = await actorChecksums(value)
    expect((await value.owner.caller.mutation(prepare, value.request)).outcome.kind).toBe('PENDING')
    const initial = (await value.owner.caller.mutation(finish, value.request)).occurrence?.pending
    expect(await actorChecksums(value)).toEqual(beforePause)
    let resistance = initial
    if (rolls === 'PROMPT') {
      if (!initial || initial.kind !== 'D20_EVIDENCE')
        throw new Error('Expected TEST evidence for the automatic reaction without a choice.')
      const enterTest = command({
        encounterId: base.run.id,
        pending: initial,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: initial.request.requestId,
          rawFaces: [initial.request.min]
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
          resolution: { kind: 'SYSTEM_ROLL', requestId: outcomeEvidence.request.requestId }
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
