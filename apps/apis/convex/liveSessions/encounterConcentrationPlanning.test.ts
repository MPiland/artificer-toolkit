// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey,
  evaluateInstalledEncounterActors
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  nativeConcentrationDamageApplications,
  nativeConcentrationDamageSourceLabels
} from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { encounterActionSourceLabel } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { buildEncounterActionStoredExecution } from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import { projectNativeActionEffectTransitions } from '@artificer-toolkit/rules-runtime/encounterActionEffectReceipts'
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
import { seedActiveInitiative } from '../../tests/fixtures/activeInitiative'
import { readRunActors, readRunState } from '../encounters/documents'
import { loadMovementTargets } from '../encounters/movementTargets'
import { prepareNativeEncounterActionMechanics } from '../encounters/actionMechanicsPreparation'
import { prepareNativeActionMaintenance } from '../encounters/actionMaintenance'
import { prepareNativeActionEffects } from '../encounters/actionEffects'
import { settleNativeEncounterActionMechanics } from '../encounters/actionMechanics'
import { executeNativeEncounterAction } from '../encounters/actionCommands'
import { consumeNativeActionEconomy } from '../encounters/actionEconomyPersistence'
import { startNativeConcentrationChecks } from '../encounters/concentration'
import { createActiveRuleEffectStore } from '../rules/effectStore'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: vi.fn(() => 19) }))

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
  'plans $rolls concentration $outcome against native settlement',
  async ({ rolls, face, outcome }) => {
    const fixture = await setupConcentration(rolls)
    const seeded = await seedConcentration(fixture)
    await fixture.t.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (query) => query.eq('id', fixture.run.id))
        .unique()
      if (!run) throw new Error('Concentration fixture Run is unavailable.')
      await seedActiveInitiative(ctx, readRunState(run), [fixture.actor.id, fixture.target.id])
      await insertActiveLiveAuthority(ctx, {
        campaignId: fixture.campaign.id,
        epoch: fixture.run.id,
        createdAt: fixture.campaign.createdAt
      })
    })
    vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
    vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
    stubLiveSessionFetch((pathname, init) => fixture.owner.caller.fetch(pathname, init))
    const command = concentrationAction(fixture)
    const before = await concentrationRecords(fixture)
    const planned = await planNativeLiveEncounterAction(
      workerEnvironment(workerSecret),
      'fixture-access-token',
      {
        campaignId: fixture.campaign.id,
        authorityEpoch: fixture.run.id,
        expectedUserId: fixture.owner.userId,
        expectedRole: 'OWNER',
        encounterId: fixture.run.id,
        expectedVersion: fixture.run.version
      },
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
    const random = await import('../lib/rollRandom')
    vi.mocked(random.nextRollInt).mockReturnValueOnce(face - 1)
    await fixture.owner.caller.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (query) => query.eq('id', fixture.run.id))
        .unique()
      if (!row) throw new Error('Concentration Run is unavailable.')
      const state = readRunState(row)
      const actors = await readRunActors(ctx, state)
      const source = actors.find((actor) => actor.id === fixture.actor.id)
      const target = actors.find((actor) => actor.id === fixture.target.id)
      if (!source || !target) throw new Error('Concentration actors are unavailable.')
      const prepared = await prepareNativeEncounterActionMechanics(ctx, {
        state,
        actors,
        actor: source,
        target,
        actionId: command.actionId,
        wieldConflictAcceptance: { kind: 'UNPROMPTED' },
        overridable: true,
        campaignOwnerUserId: fixture.owner.userId
      })
      const maintenance = await prepareNativeActionMaintenance(ctx, prepared, fixture.owner.userId)
      const effects = await prepareNativeActionEffects(ctx, {
        prepared,
        execution: planned.execution,
        occurrenceId: planned.occurrenceId,
        commandId: command.commandId
      })
      expect(maintenance).toBeNull()
      expect(effects).toEqual(planned.preparedEffects)
      const settled = await settleNativeEncounterActionMechanics(ctx, {
        prepared,
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        occurrenceId: planned.occurrenceId,
        sourceCommandId: command.commandId,
        commandId: command.commandId,
        occurredAt: planned.occurredAt,
        applications: [
          ...planned.execution.applications,
          ...effects.relationshipConditionApplications
        ],
        forceTargetVersionAdvance: false
      })
      expect(settled.mechanics.updatedActor).toEqual(planned.mechanics.mechanics.updatedActor)
      expect(planned.storedExecution).toEqual(
        buildEncounterActionStoredExecution({
          prepared,
          execution: planned.execution,
          occurrenceId: planned.occurrenceId,
          occurrenceVersion: 0,
          settled,
          effects: projectNativeActionEffectTransitions({
            state: null,
            recurring: null,
            targetActorId: target.id
          }),
          maintainedState: null,
          maintenanceTransition: null,
          actionEconomy: planned.actionEconomy
        })
      )
      const economyActor = planned.actionEconomy
        ? await consumeNativeActionEconomy(ctx, {
            actor: settled.settledSource,
            consumption: planned.actionEconomy,
            overridden: false
          })
        : settled.settledSource
      const nextActors = actors.map((actor) =>
        actor.id === settled.mechanics.updatedActor.id
          ? economyActor.id === actor.id
            ? economyActor
            : settled.mechanics.updatedActor
          : economyActor.id === actor.id
            ? economyActor
            : actor
      )
      expect(nextActors).toEqual(planned.settlement.actors)
      const nextState = encounterRunStateSchema.parse({
        ...state,
        version: state.version + 1,
        updatedAt: planned.occurredAt
      })
      const damage = [
        {
          targetActorId: target.id,
          applications: settled.mechanics.receiptApplications,
          sourceLabel: encounterActionSourceLabel(prepared.source)
        }
      ]
      const applications = nativeConcentrationDamageApplications(damage, true)
      expect(applications).not.toEqual([])
      const native = await startNativeConcentrationChecks(ctx, {
        state: nextState,
        readVersion: state.version,
        actors: nextActors,
        parentOccurrenceId: planned.occurrenceId,
        parentCommandFingerprint: planned.fingerprint,
        applications,
        sourceLabels: nativeConcentrationDamageSourceLabels(damage, true),
        userId: fixture.owner.userId,
        autoRollByActorId: { [target.id]: rolls === 'AUTO_ROLL' },
        occurredAt: planned.occurredAt
      })
      expect(native.pending).toBe(outcome === 'PENDING')
      expect(native.actors).toEqual(concentration.actors)
      const nextFacts = buildEncounterActorRuleFacts({ actors: native.actors })
      const nextRules = reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: nextFacts }),
        nextFacts,
        { output: prepared.actorRules }
      )
      expect(planned.nextState).toEqual(nextState)
      expect(planned.nextRules).toEqual(nextRules)
      const store = createActiveRuleEffectStore(ctx)
      const effectsAfter = await store.list({
        kind: 'CHARACTER',
        characterId: fixture.character.id
      })
      expect(effectsAfter).toEqual(concentration.activeEffectsByActorId.get(target.id))
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
        targetActorIds: [source.id, target.id],
        includeReactionSources: true
      })
      for (const [actorId, projected] of concentration.projectedTargets) {
        const actual = actualTargets.get(actorId)
        expect({ ...actual, characterFacts: null }).toEqual({ ...projected, characterFacts: null })
        expect(actual?.characterFacts?.character).toEqual(projected.characterFacts?.character)
        expect(actual?.characterFacts?.sheetState).toEqual(projected.characterFacts?.sheetState)
        expect(actual?.characterFacts?.active?.id).toEqual(projected.characterFacts?.active?.id)
        expect(actual?.characterFacts?.active?.checksum).toEqual(
          projected.characterFacts?.active?.checksum
        )
        expect(actual?.characterFacts?.active?.streamVersion).toEqual(
          projected.characterFacts?.active?.streamVersion
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
      expect(after.receipts).toEqual(before.receipts)
    } else {
      const child = concentration.completed[0]!
      const receipt = after.receipts.find((entry) => entry.commandId === child.commandId)
      if (!receipt) throw new Error('Native concentration receipt is unavailable.')
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
    expect(after.run).toEqual(before.run)
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
    await fixture.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.run.id))
        .unique()
      if (!row) throw new Error('Concentration fixture Run is unavailable.')
      await seedActiveInitiative(ctx, readRunState(row), [fixture.actor.id, fixture.target.id])
      await insertActiveLiveAuthority(ctx, {
        campaignId: fixture.campaign.id,
        epoch: fixture.run.id,
        createdAt: fixture.campaign.createdAt
      })
    })
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

    const probe: { result?: Awaited<ReturnType<typeof executeNativeEncounterAction>> } = {}
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(plan.occurredAt))
    const uuid = vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(occurrenceId)
    try {
      const random = await import('../lib/rollRandom')
      vi.mocked(random.nextRollInt).mockReturnValue(face - 1)
      await expect(
        fixture.owner.caller.run(async (ctx) => {
          probe.result = await executeNativeEncounterAction(ctx, command, fixture.owner.userId)
          throw new Error('Roll back native terminal parity probe.')
        })
      ).rejects.toThrow('Roll back native terminal parity probe.')
    } finally {
      uuid.mockRestore()
      vi.useRealTimers()
    }
    const nativeResult = probe.result
    if (!nativeResult) throw new Error('Native terminal parity probe did not complete.')
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
    expect(committed).toEqual(nativeResult)
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
    expect(JSON.parse(after.run!.projectionJson!)).toEqual(committed.projection)
    expect(after.run?.projectionChecksum).toBe(checksumCanonicalJson(committed.projection))
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
