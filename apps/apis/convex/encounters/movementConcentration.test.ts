// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  concentrationAction,
  concentrationRecords,
  seedConcentration,
  setupConcentration
} from '../../tests/fixtures/concentration'
import { seedActiveInitiative } from '../../tests/fixtures/activeInitiative'
import { api, internal } from '../_generated/api'
import { readRunState } from './documents'
import { loadMovementTargets } from './movementTargets'
import { loadNativeConcentrationState, prepareNativeConcentrationEnd } from './concentrationState'
import { projectNativeMovementConcentrationEnd } from './movementMaintenance'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: vi.fn(() => 0) }))

async function setupFixture() {
  const fixture = await setupConcentration('ASSISTED')
  await fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', fixture.run.id))
      .unique()
    if (!row) throw new Error('Concentration fixture Run is unavailable.')
    await seedActiveInitiative(ctx, readRunState(row), [fixture.actor.id, fixture.target.id])
  })
  return fixture
}
it('forecasts Concentration cleanup without writes and matches the committed failure', async () => {
  const fixture = await setupFixture()
  const seeded = await seedConcentration(fixture)
  await fixture.owner.caller.mutation(internal.encounters.commands.execute, {
    command: concentrationAction(fixture)
  })
  const before = await concentrationRecords(fixture)
  const pending = before.pending[0]
  if (!before.run || !pending?.pendingSnapshotJson)
    throw new Error('Concentration failure fixture is unavailable.')
  const state = readRunState(before.run)
  const snapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse(
    JSON.parse(pending.pendingSnapshotJson)
  )
  const context = snapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK')
    throw new Error('Expected Concentration evidence.')
  const identity = await fixture.owner.caller.query(api.account.identity, {})
  if (!identity) throw new Error('Missing owner identity.')
  const forecast = await fixture.owner.caller.run(async (ctx) => {
    const targets = await loadMovementTargets(ctx, {
      encounterId: state.id,
      expectedEncounterVersion: state.version,
      targetActorIds: state.actorIds
    })
    const maintenance = await prepareNativeConcentrationEnd(ctx, { state, context, targets })
    const projected = projectNativeMovementConcentrationEnd({
      maintenance,
      targets,
      campaignId: state.campaignId,
      gameSystemId: state.gameSystemId,
      occurredAt: state.updatedAt
    })
    const target = projected.targets.get(fixture.target.id)
    if (!target) throw new Error('Projected Concentration owner is unavailable.')
    expect(target.state.conditions).not.toContain(seeded.blinded.id)
    expect(target.state.conditions).toContain(seeded.poisoned.id)
    expect(target.activeEffects.map((effect) => effect.id)).toEqual([seeded.independent.id])
    expect(target.characterFacts?.active.streamVersion).toBe(before.character!.streamVersion + 1)
    const currentInput = {
      state,
      readVersion: state.version,
      targetActorId: fixture.target.id,
      userId: identity.userId
    }
    expect(
      await loadNativeConcentrationState(ctx, {
        ...currentInput,
        targets: projected.targets,
        projection: projected.projection
      })
    ).toBeNull()
    await expect(
      prepareNativeConcentrationEnd(ctx, {
        state,
        context,
        targets: projected.targets,
        projection: projected.projection
      })
    ).rejects.toThrow('The concentration state changed before cleanup.')
    // The ended forecast must override an intact stored slot, including on repeated reads.
    expect((await loadNativeConcentrationState(ctx, currentInput))?.maintained.id).toBe(
      seeded.state.id
    )
    const replacedSlots = new Map(projected.projection.slots)
    replacedSlots.set(`${fixture.target.id}:${seeded.state.maintenanceDefinitionId}`, {
      state: { ...seeded.state, id: crypto.randomUUID() },
      dependents: []
    })
    await expect(
      prepareNativeConcentrationEnd(ctx, {
        state,
        context,
        targets: projected.targets,
        projection: { ...projected.projection, slots: replacedSlots }
      })
    ).rejects.toThrow('The concentration state changed before cleanup.')
    const owner = projected.projection.owners.get(checksumCanonicalJson(seeded.dependent.owner))
    return {
      cleanup: projected.cleanup,
      target: {
        actor: target.actor,
        state: target.state,
        activeEffects: target.activeEffects,
        characterCurrentness: target.characterCurrentness,
        effectiveRulePolicyOutput: target.effectiveRulePolicyOutput,
        characterChecksum: target.characterFacts!.active.checksum
      },
      owner: {
        streamVersion: owner!.character!.streamVersion,
        checksum: owner!.character!.checksum
      }
    }
  })
  expect(await concentrationRecords(fixture)).toEqual(before)

  const command = {
    type: 'RESOLVE_RULE_OCCURRENCE' as const,
    encounterId: state.id,
    commandId: crypto.randomUUID(),
    expectedVersion: state.version,
    occurrenceId: pending.id,
    expectedOccurrenceVersion: pending.version,
    correlationId: null,
    resolution: { kind: 'SYSTEM_ROLL' as const, requestId: snapshot.request.requestId }
  }
  const result = await fixture.player.caller.mutation(internal.encounters.commands.execute, {
    command
  })
  expect(result.occurrence?.outcome).toBe('SAVE_FAILURE')
  const after = await concentrationRecords(fixture)
  const receipt = after.receipts.find((entry) => entry.commandId === command.commandId)
  if (!receipt || !after.run) throw new Error('Committed Concentration failure is unavailable.')
  const execution = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  expect(execution).toMatchObject({ applicationOutputs: { cleanup: forecast.cleanup } })
  const committedTarget = await fixture.owner.caller.run(async (ctx) => {
    const target = (
      await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: after.run!.version,
        targetActorIds: [fixture.target.id]
      })
    ).get(fixture.target.id)
    if (!target) throw new Error('Committed Concentration owner is unavailable.')
    return {
      actor: target.actor,
      state: target.state,
      activeEffects: target.activeEffects,
      characterCurrentness: target.characterCurrentness,
      effectiveRulePolicyOutput: target.effectiveRulePolicyOutput,
      characterChecksum: target.characterFacts!.active.checksum
    }
  })
  expect(committedTarget).toEqual(forecast.target)
  expect(after.character?.checksum).toBe(forecast.target.characterChecksum)
  expect(forecast.owner).toEqual({
    streamVersion: after.character?.streamVersion,
    checksum: after.character?.checksum
  })
  expect(
    await fixture.player.caller.mutation(internal.encounters.commands.execute, { command })
  ).toEqual(result)
  expect(await concentrationRecords(fixture)).toEqual(after)
}, 60_000)
