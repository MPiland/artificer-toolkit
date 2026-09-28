// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import {
  commitNativeLiveEncounterAction,
  planNativeLiveEncounterAction
} from '../../../session-worker/src/nativeEncounterRules'
import {
  concentrationAction,
  concentrationRecords,
  seedConcentration,
  setupConcentration
} from '../../tests/fixtures/concentration'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { loadMovementTargets } from '../encounters/movementTargets'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'
import { api } from '../_generated/api'

const workerSecret = 'private-concentration-planning-test-secret-at-least-32-bytes'
const authSecret = 'private-concentration-continuation-test-secret-at-least-32-bytes'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

async function runtime() {
  return createPlatformRulesRuntime({
    continuationIntegrityKey: await deriveRulesContinuationKey(
      process.env.RULES_CONTINUATION_SECRET
    ),
    definitions: {
      async requireCurrent() {
        throw new Error('Concentration definitions are supplied by the sealed capture.')
      }
    }
  })
}

it.each([
  { rolls: 'AUTO_ROLL' as const, face: 20, outcome: 'SAVE_SUCCESS' as const },
  { rolls: 'AUTO_ROLL' as const, face: 1, outcome: 'SAVE_FAILURE' as const },
  { rolls: 'PROMPT' as const, face: 20, outcome: 'PENDING' as const }
])(
  'plans and commits $rolls concentration $outcome as the Worker projects it',
  async ({ rolls, face, outcome }) => {
    const fixture = await setupConcentration(rolls)
    const seeded = await seedConcentration(fixture)
    await fixture.t.run((ctx) =>
      insertActiveLiveAuthority(ctx, {
        campaignId: fixture.campaign.id,
        epoch: fixture.run.id,
        createdAt: fixture.campaign.createdAt
      })
    )
    vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
    vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
    stubLiveSessionFetch((pathname, init) => fixture.owner.caller.fetch(pathname, init))
    const command = concentrationAction(fixture)
    const before = await concentrationRecords(fixture)
    const scope = {
      campaignId: fixture.campaign.id,
      authorityEpoch: fixture.run.id,
      expectedUserId: fixture.owner.userId,
      expectedRole: 'OWNER' as const,
      encounterId: fixture.run.id,
      expectedVersion: fixture.run.version
    }
    const planned = await planNativeLiveEncounterAction(
      workerEnvironment(workerSecret),
      'fixture-access-token',
      scope,
      command,
      { runtime: await runtime(), random: () => face - 1 }
    )
    if (planned.kind !== 'PLANNED') throw new Error('Expected completed fixed-damage action plan.')
    expect(await concentrationRecords(fixture)).toEqual(before)
    expect(planned.preparedEffects.stateEffect).toBeNull()
    expect(planned.preparedEffects.recurringEffect).toBeNull()
    expect(planned.preparedEffects.maintenance).toBeNull()
    expect(planned.maintenance).toBeNull()
    expect(planned.settlement.createdEffects).toEqual([])
    expect(planned.settlement.maintainedState).toBeNull()
    const concentration = planned.concentration
    if (outcome === 'PENDING') {
      expect(concentration.completed).toEqual([])
      expect(concentration.cleanups).toEqual([])
      expect(concentration.pending).not.toBeNull()
    } else {
      expect(concentration.completed).toHaveLength(1)
      expect(concentration.pending).toBeNull()
      expect(concentration.completed[0]?.result.applicationOutputs).toMatchObject({ outcome })
      expect(concentration.cleanups).toHaveLength(outcome === 'SAVE_FAILURE' ? 1 : 0)
    }
    await commitNativeLiveEncounterAction(
      workerEnvironment(workerSecret),
      'fixture-access-token',
      scope,
      planned
    )
    await fixture.owner.caller.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (query) => query.eq('id', fixture.run.id))
        .unique()
      if (!row) throw new Error('Concentration Run is unavailable.')
      const state = readRunState(row)
      expect(state).toEqual(planned.nextState)
      const effectsAfter = await createActiveRuleEffectStore(ctx).list({
        kind: 'CHARACTER',
        characterId: fixture.character.id
      })
      expect(effectsAfter).toEqual(concentration.activeEffectsByActorId.get(fixture.target.id))
      const character = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (query) => query.eq('id', fixture.character.id))
        .unique()
      if (!character) throw new Error('Concentration Character is unavailable after settlement.')
      expect(character.streamVersion).toBe(
        before.character!.streamVersion + (outcome === 'SAVE_FAILURE' ? 2 : 1)
      )
      if (outcome === 'SAVE_FAILURE') {
        expect(concentration.cleanups[0]?.removed.map((effect) => effect.id)).toContain(
          seeded.dependent.id
        )
        expect(concentration.cleanups[0]?.characterVersions).toEqual([
          {
            characterId: fixture.character.id,
            beforeStreamVersion: before.character!.streamVersion + 1
          }
        ])
        expect(character).toEqual(
          concentration.maintenanceOwners.find((owner) => owner.owner.kind === 'CHARACTER')
            ?.character
        )
      }
      const authored = characterAuthoredDtoSchema.parse(JSON.parse(character.documentJson))
      expect(authored.state.conditions?.map((condition) => condition.conditionTypeId)).toEqual(
        outcome === 'SAVE_FAILURE' ? [seeded.poisoned.id] : [seeded.blinded.id, seeded.poisoned.id]
      )
      const actualTargets = await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: [fixture.actor.id, fixture.target.id],
        includeReactionSources: true
      })
      for (const [actorId, projected] of concentration.projectedTargets) {
        const actual = actualTargets.get(actorId)
        expect({ ...actual, characterFacts: null }).toEqual({ ...projected, characterFacts: null })
        expect(actual?.characterFacts?.character).toEqual(projected.characterFacts?.character)
        expect(actual?.characterFacts?.sheetState).toEqual(projected.characterFacts?.sheetState)
        expect(actual?.characterFacts?.active?.checksum).toEqual(
          projected.characterFacts?.active?.checksum
        )
      }
    })
    const after = await concentrationRecords(fixture)
    expect(after.states.some((state) => state.id === seeded.state.id)).toBe(
      outcome !== 'SAVE_FAILURE'
    )
    expect(after.effects.some((effect) => effect.id === seeded.dependent.id)).toBe(
      outcome !== 'SAVE_FAILURE'
    )
    expect(after.effects.map((effect) => effect.id)).toContain(seeded.independent.id)
    if (outcome === 'PENDING') {
      expect(after.pending).toHaveLength(1)
      expect(
        serverKernelRuleExecutionPendingSnapshotDtoSchema.parse(
          JSON.parse(after.pending[0]!.pendingSnapshotJson!)
        )
      ).toEqual(concentration.pending)
    } else {
      const child = concentration.completed[0]!
      const receipt = after.receipts.find((entry) => entry.commandId === child.commandId)
      if (!receipt) throw new Error('Concentration receipt is unavailable.')
      expect(storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))).toEqual(
        child.result
      )
      expect(receipt.resultChecksum).toBe(checksumRuleDocument(child.result))
      expect(receipt.commandFingerprint).toBe(child.fingerprint)
      expect(receipt.correlationId).toBe(child.correlationId)
      expect(
        serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
          JSON.parse(receipt.commandMetadataJson)
        )
      ).toEqual(child.metadata)
      expect(after.pending).toEqual([])
    }
    expect(after.run?.version).toBe(before.run!.version + 1)
    expect(after.characterReceipts.length).toBeGreaterThan(before.characterReceipts.length)
    expect(after.character?.checksum).toBe(
      checksumRuleDocument(
        characterAuthoredDtoSchema.parse(JSON.parse(after.character!.documentJson))
      )
    )
    expect(after.actors.map((actor) => checksumCanonicalJson(JSON.parse(actor.stateJson)))).toEqual(
      concentration.actors.map((actor) => checksumCanonicalJson(actor))
    )
  },
  60_000
)

it.each([
  { face: 20, outcome: 'SAVE_SUCCESS' as const },
  { face: 1, outcome: 'SAVE_FAILURE' as const }
])(
  'commits and replays the planned concentration $outcome atomically',
  async ({ face, outcome }) => {
    const fixture = await setupConcentration('AUTO_ROLL')
    const seeded = await seedConcentration(fixture)
    await fixture.t.run((ctx) =>
      insertActiveLiveAuthority(ctx, {
        campaignId: fixture.campaign.id,
        epoch: fixture.run.id,
        createdAt: fixture.campaign.createdAt
      })
    )
    vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
    vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
    stubLiveSessionFetch((pathname, init) => fixture.owner.caller.fetch(pathname, init))
    const environment = workerEnvironment(workerSecret)
    const scope = {
      campaignId: fixture.campaign.id,
      authorityEpoch: fixture.run.id,
      expectedUserId: fixture.owner.userId,
      expectedRole: 'OWNER' as const,
      encounterId: fixture.run.id,
      expectedVersion: fixture.run.version
    }
    const command = concentrationAction(fixture)
    const before = await concentrationRecords(fixture)
    const rulesRuntime = await runtime()
    const occurrenceId = crypto.randomUUID()
    const planUuid = vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(occurrenceId)
    const plan = await planNativeLiveEncounterAction(
      environment,
      'fixture-access-token',
      scope,
      command,
      { runtime: rulesRuntime, random: () => face - 1 }
    ).finally(() => planUuid.mockRestore())
    if (plan.kind !== 'PLANNED') throw new Error('Expected completed concentration plan.')
    expect(plan.occurrenceId).toBe(occurrenceId)
    expect(plan.concentration.completed).toHaveLength(1)
    expect(plan.concentration.completed[0]?.result.applicationOutputs).toMatchObject({ outcome })
    expect(await concentrationRecords(fixture)).toEqual(before)

    await expect(
      commitNativeLiveEncounterAction(
        { ...environment, LIVE_SESSION_WORKER_SECRET: 'wrong-private-test-secret' },
        'fixture-access-token',
        scope,
        plan
      )
    ).rejects.toThrow()
    expect(await concentrationRecords(fixture)).toEqual(before)
    await expect(
      commitNativeLiveEncounterAction(environment, 'fixture-access-token', scope, {
        ...plan,
        concentration: {
          ...plan.concentration,
          completed: [{ ...plan.concentration.completed[0]!, fingerprint: 'f'.repeat(64) }]
        }
      })
    ).rejects.toThrow()
    expect(await concentrationRecords(fixture)).toEqual(before)
    await expect(
      commitNativeLiveEncounterAction(environment, 'fixture-access-token', scope, {
        ...plan,
        revisions: [
          { ...plan.revisions[0]!, revision: crypto.randomUUID() },
          ...plan.revisions.slice(1)
        ]
      })
    ).rejects.toThrow()
    expect(await concentrationRecords(fixture)).toEqual(before)
    await expect(
      commitNativeLiveEncounterAction(
        environment,
        'fixture-access-token',
        {
          ...scope,
          authorityEpoch: crypto.randomUUID()
        },
        plan
      )
    ).rejects.toThrow()
    expect(await concentrationRecords(fixture)).toEqual(before)

    const committed = await commitNativeLiveEncounterAction(
      environment,
      'fixture-access-token',
      scope,
      plan
    )
    expect(
      await commitNativeLiveEncounterAction(environment, 'fixture-access-token', scope, plan)
    ).toEqual(committed)
    await expect(
      commitNativeLiveEncounterAction(environment, 'fixture-access-token', scope, {
        ...plan,
        command: { ...plan.command, actionId: crypto.randomUUID() }
      })
    ).rejects.toThrow()
    const after = await concentrationRecords(fixture)
    expect(after.run?.version).toBe(before.run!.version + 1)
    expect(
      await fixture.owner.caller.query(api.encounters.projectionReads.get, {
        encounterId: fixture.run.id
      })
    ).toEqual(committed.projection)
    expect(after.character?.streamVersion).toBe(
      before.character!.streamVersion + (outcome === 'SAVE_FAILURE' ? 2 : 1)
    )
    expect(after.actors.map((actor) => checksumCanonicalJson(JSON.parse(actor.stateJson)))).toEqual(
      plan.concentration.actors.map((actor) => checksumCanonicalJson(actor))
    )
    expect(after.states.some((state) => state.id === seeded.state.id)).toBe(
      outcome === 'SAVE_SUCCESS'
    )
    expect(after.effects.some((effect) => effect.id === seeded.dependent.id)).toBe(
      outcome === 'SAVE_SUCCESS'
    )
    expect(after.effects.map((effect) => effect.id)).toContain(seeded.independent.id)
    const child = plan.concentration.completed[0]!
    const receipt = after.receipts.find((entry) => entry.commandId === child.commandId)
    expect(
      receipt && storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    ).toEqual(child.result)
    expect(after.completed.some((entry) => entry.id === plan.occurrenceId)).toBe(true)
  },
  60_000
)
