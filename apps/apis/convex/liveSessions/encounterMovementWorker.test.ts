// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { liveSessionCharacterRulesInputSchema } from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import type {
  LiveSessionMovementCommitInput,
  LiveSessionMovementPrepareInput
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { CampaignSceneState } from '@artificer-toolkit/shared/vtt'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createNativeLiveRulesRuntime } from '../../../session-worker/src/nativeRulesRuntime'
import { concentrationCommandId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_CONCENTRATION_DEFINITIONS,
  SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/concentration.js'
import { prepareNativeLiveMovement } from '../../../session-worker/src/nativeEncounterMovement'
import { setupAutomaticCharacterMovement } from '../../tests/fixtures/automaticCharacterMovement'
import { readBundleAndSeparateCaptures } from '../../tests/fixtures/captureBundleParity'
import { refreshMovementSaveVision } from '../../tests/fixtures/automaticSceneMovement'
import { grantFixtureActorControl } from '../../tests/fixtures/spatialPreparation'
import { seedConcentration } from '../../tests/fixtures/concentration'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { sourceImportBatches } from '../content/importBatches'
import { internal } from '../_generated/api'
import { readRunActors, readRunState } from '../encounters/documents'
import { persistLiveMovementReaction } from './encounterMovementReactionCommit'
import { persistLiveMovementConcentration } from './encounterMovementConcentrationCommit'
import { commitLiveMovement } from './encounterMovementCommit'
import { readCurrentEntities } from '../scenes/currentEntities'
import { readLiveScene } from '../scenes/liveDocuments'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import {
  expectedMovementScene,
  insertActiveLiveAuthority,
  nextExternalAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'

const workerSecret = 'private-movement-worker-test-secret-at-least-32-bytes'
const authSecret = 'private-movement-continuation-test-secret-at-least-32-bytes'
const environment = workerEnvironment(workerSecret)
const stage = makeFunctionReference<
  'mutation',
  LiveSessionMovementPrepareInput,
  SceneSpatialPreparation
>('liveSessions/encounterMovement:prepare')
const observe = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')
type SceneMovementRequest = ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
const prepareRoot = makeFunctionReference<
  'mutation',
  SceneMovementRequest,
  SceneSpatialPreparation
>('scenes/spatialPreparation:prepare')
const finishRoot = makeFunctionReference<
  'mutation',
  SceneMovementRequest,
  SceneGeometryCommandResult
>('scenes/geometryCommands:finish')

const concentrationAdvantageFeature = {
  id: '00000000-0000-4000-8000-000000000c30',
  label: 'Focused Concentration',
  description: 'You have advantage on Constitution saving throws to maintain Concentration.',
  availableAtLevel: 1,
  order: 0,
  grants: {
    modifiers: [
      {
        id: '00000000-0000-4000-8000-000000000c31',
        grantKind: 'MODIFIER_GRANT' as const,
        valueDomainCode: 'SAVING_THROW_MODIFIER' as const,
        domain: {
          ability: 'CONSTITUTION' as const,
          ruleDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
        },
        modifierKind: 'ADVANTAGE' as const,
        scope: 'GLOBAL' as const,
        selectionKind: 'GRANTED' as const,
        order: 0
      }
    ]
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it.each([
  { withSuffix: false, asPlayer: false },
  { withSuffix: true, asPlayer: false },
  { withSuffix: false, asPlayer: true }
])(
  'prepares a used automatic reaction and failed Concentration with spatial suffix $withSuffix as PLAYER $asPlayer',
  async ({ withSuffix, asPlayer }) => {
    const value = await setupAutomaticCharacterMovement(
      ['AUTOMATIC'],
      false,
      {
        features: [concentrationAdvantageFeature]
      },
      asPlayer
    )
    // Assisted play offers the authored automatic reaction to its controller as Use/Decline; the
    // controller (the GM, or a player the GM granted the reactor) answers it through the Worker.
    const initiator = asPlayer ? value.additionalPlayer : value.owner
    if (!initiator) throw new Error('Additional movement Player is unavailable.')
    const reactor = value.base.reactors[0]
    if (!reactor) throw new Error('Movement reactor is unavailable.')
    const setReactorControl = (controllerUserIds: string[]) =>
      value.base.t.run((ctx) =>
        grantFixtureActorControl(ctx, {
          encounterId: value.base.run.id,
          actorId: reactor.id,
          controllerUserIds
        })
      )
    if (asPlayer) await setReactorControl([initiator.userId])
    for (const definitions of sourceImportBatches(SRD_CONCENTRATION_DEFINITIONS))
      await value.base.t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions
      })
    const seeded = await seedConcentration({
      t: value.base.t,
      run: value.base.run,
      target: value.base.mover,
      character: value.base.character
    })
    vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
    const oneShot = withSuffix
      ? await seedSpatialEffect({ ...value.base, sceneId: value.sceneId }, { x: 375, y: 50 }, 5)
      : null
    const epoch = crypto.randomUUID()
    await value.base.t.run(async (ctx) => {
      if (withSuffix) {
        const rootSave = await ctx.db
          .query('sceneGeometrySaves')
          .withIndex('by_publicId', (q) => q.eq('id', value.saveId))
          .unique()
        if (!rootSave) throw new Error('Fixture geometry save is unavailable.')
        const input = { ...value.rootInput, path: [value.rootInput.path[0]!, { x: 450, y: 50 }] }
        await ctx.db.patch(rootSave._id, { input, inputChecksum: checksumCanonicalJson(input) })
      }
      await insertActiveLiveAuthority(ctx, {
        campaignId: value.base.campaign.id,
        epoch,
        createdAt: value.base.campaign.createdAt
      })
    })
    await refreshMovementSaveVision(value)
    await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
    await value.owner.caller.mutation(prepareRoot, value.request)
    const choice = (await value.owner.caller.mutation(finishRoot, value.request)).occurrence
      ?.pending
    if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
      throw new Error('Expected the Assisted Use/Decline reaction choice.')
    const responseCommandId = crypto.randomUUID()
    const useCommand: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: responseCommandId,
      encounterId: value.base.run.id,
      expectedVersion: choice.encounterVersion,
      occurrenceId: choice.occurrenceId,
      expectedOccurrenceVersion: choice.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
    }
    const requests: string[] = []
    vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
    stubLiveSessionFetch((pathname, init) => {
      if (
        ![
          '/live-sessions/encounter-rules',
          '/live-sessions/character-rules',
          '/live-sessions/encounter-movement-begin',
          '/live-sessions/encounter-movement-prepare',
          '/live-sessions/encounter-movement'
        ].includes(pathname)
      )
        throw new Error(`Unexpected private movement request: ${pathname}`)
      if (
        new Headers(init?.headers).get('authorization') !== 'Bearer fixture-access-token' ||
        new Headers(init?.headers).get('x-artificer-live-session-secret') !== workerSecret
      )
        throw new Error('Private movement client credentials are missing.')
      if (typeof init?.body !== 'string') throw new Error('Private movement body is missing.')
      if (pathname === '/live-sessions/encounter-rules')
        requests.push(
          liveSessionEncounterRulesInputSchema.parse(JSON.parse(init.body)).request.kind
        )
      if (pathname === '/live-sessions/character-rules')
        requests.push(
          liveSessionCharacterRulesInputSchema.parse(JSON.parse(init.body)).request.kind
        )
      return initiator.caller.fetch(pathname, init)
    })
    const staged = await callLiveSessionRoute(
      environment,
      'fixture-access-token',
      'encounterMovementBegin',
      {
        campaignId: value.base.campaign.id,
        authorityEpoch: epoch,
        expectedUserId: initiator.userId,
        expectedRole: asPlayer ? 'PLAYER' : 'OWNER',
        command: useCommand
      }
    )
    if (staged.kind !== 'READY') throw new Error('Expected a private receiving geometry save.')
    const scene = await initiator.caller.run(async (ctx): Promise<CampaignSceneState> => {
      const { header } = await readLiveScene(ctx, value.sceneId, 'MEMBER')
      if (
        ['annotations', 'barriers', 'darknessZones', 'lights'].some(
          (collection) =>
            header.currentCounts[
              collection as 'annotations' | 'barriers' | 'darknessZones' | 'lights'
            ] !== 0
        )
      )
        throw new Error('Automatic fixture has unexpected Scene geometry.')
      const tokens: CampaignSceneState['tokens'] = []
      let next: { phase: 'BASE' | 'APPENDED'; afterOrdinal: number | null } | null = {
        phase: 'BASE',
        afterOrdinal: null
      }
      while (next) {
        const page = await readCurrentEntities(
          ctx,
          {
            sceneId: header.id,
            expectedVersion: header.version,
            definitionSaveId: header.definitionSaveId,
            collection: 'tokens',
            numItems: 8,
            ...next
          },
          'MEMBER'
        )
        tokens.push(
          ...page.page.flatMap((entry) =>
            entry.value.collection === 'tokens' ? [entry.value.entity] : []
          )
        )
        next = page.next
      }
      if (tokens.length !== header.currentCounts.tokens)
        throw new Error('Automatic fixture tokens are incomplete.')
      return {
        ...header,
        annotations: [],
        barriers: [],
        darknessZones: [],
        doorStates: {},
        fogLayers: [],
        lights: [],
        measurements: [],
        tokens
      }
    })
    const scope: Omit<LiveSessionEncounterRulesInput, 'request' | 'concentrationResponse'> & {
      movement: NonNullable<LiveSessionEncounterRulesInput['movement']>
    } = {
      campaignId: value.base.campaign.id,
      authorityEpoch: epoch,
      expectedUserId: initiator.userId,
      expectedRole: asPlayer ? 'PLAYER' : 'OWNER',
      encounterId: value.base.run.id,
      expectedVersion: choice.encounterVersion,
      movement: { encounterId: value.base.run.id, saveId: staged.saveId, baseTokenOrdinal: 1 }
    }
    // The room's own runtime: it reads no definition itself, so eligibility must use the capture.
    const runtime = await createNativeLiveRulesRuntime(process.env.RULES_CONTINUATION_SECRET ?? '')
    const records = () =>
      value.base.t.run(async (ctx) => ({
        run: await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
          .unique(),
        actors: await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
          .collect(),
        character: await ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', value.base.character.id))
          .unique(),
        maintained: await ctx.db
          .query('encounterMaintainedEffectStates')
          .withIndex('by_encounter_owner_definition_order', (q) =>
            q.eq('encounterId', value.base.run.id)
          )
          .collect(),
        effects: await ctx.db
          .query('characterActiveRuleEffects')
          .withIndex('by_characterId_createdOrdinal_id', (q) =>
            q.eq('characterId', value.base.character.id)
          )
          .collect(),
        spatialEffects: await ctx.db
          .query('encounterSpatialRuleEffects')
          .withIndex('by_encounterId_sceneId_createdOrdinal_id', (q) =>
            q.eq('encounterId', value.base.run.id).eq('sceneId', value.sceneId)
          )
          .collect(),
        receipts: await ctx.db
          .query('encounterRuleReceipts')
          .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', value.base.run.id))
          .collect(),
        characterReceipts: await ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) =>
            q.eq('characterId', value.base.character.id)
          )
          .collect(),
        occurrences: await ctx.db
          .query('encounterRuleOccurrences')
          .withIndex('by_encounterId_state', (q) => q.eq('encounterId', value.base.run.id))
          .collect(),
        sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
        sceneStates: await ctx.db.query('sceneLiveStates').collect()
      }))
    const before = await records()
    let roll = 0
    // The Use response continues the paused movement occurrence.
    const occurrenceId = choice.occurrenceId
    const occurredAt = '2026-09-24T00:00:00.000Z'
    const prepared = await prepareNativeLiveMovement({
      environment,
      accessToken: 'fixture-access-token',
      scope,
      scene,
      occurrenceId,
      occurredAt,
      runtime,
      random: (maximum) => {
        expect(maximum).toBeGreaterThan(0)
        return roll++ === 0 ? 14 : 0
      }
    })
    expect(prepared.outcome.kind).toBe('TERMINAL')
    if (prepared.outcome.kind !== 'TERMINAL') throw new Error('Expected terminal movement.')
    const kinds = withSuffix
      ? ['REACTION', 'CONCENTRATION', 'SPATIAL']
      : ['REACTION', 'CONCENTRATION']
    expect(prepared.settlements.map((entry) => entry.kind)).toEqual(kinds)
    expect(prepared.settlementInputs.map((entry) => entry.kind)).toEqual(kinds)
    const reaction = prepared.outcome.result.reactionExecutions[0]
    const concentration = reaction?.concentrationChecks?.[0]
    if (!concentration) throw new Error('Expected reaction Concentration evidence.')
    if (reaction.application.kind !== 'CHARACTER_MECHANICS_BATCH')
      throw new Error('Expected a Character movement reaction target.')
    const spatial =
      prepared.outcome.result.status === 'BATCH_COMPLETE' ? prepared.outcome.result.executions : []
    if (withSuffix) {
      if (!oneShot) throw new Error('Expected the one-shot spatial fixture.')
      expect(spatial).toHaveLength(1)
      expect(spatial[0]?.candidate.candidate.effectId).toBe(oneShot.id)
      expect(spatial[0]?.candidate.candidate.targetActorId).toBe(value.base.mover.id)
      expect(spatial[0]!.candidate.candidate.pathDistance).toBeGreaterThan(
        reaction.option.candidate.pathDistance
      )
      expect(prepared.settlementInputs[2]).toMatchObject({
        kind: 'SPATIAL',
        executions: [spatial[0]],
        transitions: [{ effectId: oneShot.id, transition: { kind: 'DELETE' } }]
      })
    } else expect(spatial).toHaveLength(0)
    expect(concentration.result.applicationOutputs).toMatchObject({
      outcome: 'SAVE_FAILURE',
      d20: { rawFaces: [1, 1], rollMode: 'ADVANTAGE', dc: 10, modifier: 1 },
      cleanup: {
        maintainedStateId: seeded.state.id,
        removedDependentEffectIds: expect.arrayContaining([seeded.dependent.id])
      }
    })
    expect(concentration.ownerTransitions).toMatchObject([
      {
        characterId: value.base.character.id,
        targetActorId: value.base.mover.id,
        after: { conditionIds: expect.arrayContaining([seeded.poisoned.id]) }
      }
    ])
    expect(concentration.ownerTransitions[0]?.after.conditionIds).not.toContain(seeded.blinded.id)
    expect(prepared.settlements[1]).toMatchObject({
      kind: 'CONCENTRATION',
      plan: { execution: concentration }
    })
    const { concentrationChecks: _checks, ...reactionWithoutConcentration } = reaction
    expect(prepared.settlementInputs[0]).toEqual({
      kind: 'REACTION',
      execution: reactionWithoutConcentration,
      resourceConsumption: null,
      createdEffects: [],
      maintainedState: null
    })
    expect(prepared.settlementInputs[1]).toEqual({
      kind: 'CONCENTRATION',
      execution: concentration
    })
    expect(requests).toContain('MOVEMENT_INPUTS')
    expect(requests).toContain('INPUTS')
    expect(roll).toBe(3)
    const after = await records()
    expect(after).toEqual(before)
    expect(before.maintained.map((entry) => entry.id)).toContain(seeded.state.id)
    expect(before.effects.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([seeded.dependent.id, seeded.independent.id])
    )
    expect(before.spatialEffects.map((entry) => entry.id)).toEqual(oneShot ? [oneShot.id] : [])
    const preparation: SceneSpatialPreparation = {
      encounterId: value.base.run.id,
      expectedEncounterVersion: choice.encounterVersion,
      occurrenceId,
      occurredAt,
      outcome: prepared.outcome
    }
    const stageInput: LiveSessionMovementPrepareInput = {
      campaignId: scope.campaignId,
      authorityEpoch: scope.authorityEpoch,
      expectedUserId: scope.expectedUserId,
      expectedRole: scope.expectedRole,
      movement: scope.movement,
      preparation,
      revisions: prepared.revisions(),
      maintenanceOwners: prepared.dependencies.flatMap(({ request }) =>
        request.kind === 'MAINTENANCE_OWNER' ? [request] : []
      )
    }
    const persistedAuthority = () =>
      value.base.t.run(async (ctx) => {
        const row = await ctx.db
          .query('campaignLiveAuthorities')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', value.base.campaign.id))
          .unique()
        return { sequence: row?.persistedSequence, checksum: row?.persistedStateChecksum }
      })
    const geometrySave = () =>
      value.base.t.run((ctx) =>
        ctx.db
          .query('sceneGeometrySaves')
          .withIndex('by_publicId', (q) => q.eq('id', staged.saveId))
          .unique()
      )
    const privatePost = (path: string, body: unknown, secret: string | null, identity: boolean) => {
      const request: RequestInit = {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(secret === null ? {} : { 'x-artificer-live-session-secret': secret })
        },
        body: JSON.stringify(body)
      }
      return identity ? initiator.caller.fetch(path, request) : value.base.t.fetch(path, request)
    }
    if (!withSuffix && !asPlayer) {
      const receivingSave = await geometrySave()
      for (const denial of [
        { secret: null, identity: true, input: stageInput, status: 401 },
        { secret: 'wrong-worker-secret', identity: true, input: stageInput, status: 401 },
        { secret: workerSecret, identity: false, input: stageInput, status: 401 },
        {
          secret: workerSecret,
          identity: true,
          input: { ...stageInput, expectedUserId: crypto.randomUUID() },
          status: 409
        },
        {
          secret: workerSecret,
          identity: true,
          input: { ...stageInput, authorityEpoch: crypto.randomUUID() },
          status: 409
        }
      ]) {
        expect(
          (
            await privatePost(
              '/live-sessions/encounter-movement-prepare',
              denial.input,
              denial.secret,
              denial.identity
            )
          ).status
        ).toBe(denial.status)
        expect(await records()).toEqual(before)
        expect(await geometrySave()).toEqual(receivingSave)
      }
    }
    expect(
      await callLiveSessionRoute(
        environment,
        'fixture-access-token',
        'encounterMovementPrepare',
        stageInput
      )
    ).toEqual(preparation)
    expect(await records()).toEqual(before)
    expect(
      await callLiveSessionRoute(
        environment,
        'fixture-access-token',
        'encounterMovementPrepare',
        stageInput
      )
    ).toEqual(preparation)
    const frozen = await value.base.t.run((ctx) =>
      ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_publicId', (q) => q.eq('id', staged.saveId))
        .unique()
    )
    if (!frozen?.spatialPreparationJson)
      throw new Error('Private movement preparation was not stored.')
    expect(JSON.parse(frozen.spatialPreparationJson)).toEqual(preparation)
    expect(frozen.spatialPreparationChecksum).toBe(checksumCanonicalJson(preparation))
    await expect(
      initiator.caller.mutation(stage, {
        ...stageInput,
        preparation: { ...preparation, occurredAt: '2026-09-24T00:00:01.000Z' }
      })
    ).rejects.toThrow('Spatial preparation cannot replace previously frozen evidence.')
    const afterRejected = await value.base.t.run((ctx) =>
      ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_publicId', (q) => q.eq('id', staged.saveId))
        .unique()
    )
    expect(afterRejected?.spatialPreparationJson).toBe(frozen?.spatialPreparationJson)
    expect(afterRejected?.spatialPreparationChecksum).toBe(frozen?.spatialPreparationChecksum)
    expect(await records()).toEqual(before)

    const reactionStep = prepared.settlementInputs[0]
    const concentrationStep = prepared.settlementInputs[1]
    if (reactionStep?.kind !== 'REACTION' || concentrationStep?.kind !== 'CONCENTRATION')
      throw new Error('Expected closed movement settlement order.')
    if (!asPlayer) {
      const commitPrepared = async (changedConcentration = concentrationStep.execution) =>
        initiator.caller.run(async (ctx) => {
          const row = await ctx.db
            .query('encounterRuns')
            .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
            .unique()
          if (!row) throw new Error('Movement Run is unavailable.')
          const state = readRunState(row)
          const actors = await readRunActors(ctx, state)
          const authorizedCharacterIds = new Set(
            actors.flatMap((actor) =>
              actor.kind === 'CHARACTER' && actor.sourceId ? [actor.sourceId] : []
            )
          )
          const afterReaction = await persistLiveMovementReaction(ctx, {
            state,
            actors,
            step: reactionStep,
            occurrenceId,
            sourceCommandId: responseCommandId,
            occurredAt,
            authorizedCharacterIds
          })
          return persistLiveMovementConcentration(ctx, {
            state: { ...state, version: state.version + 1 },
            actors: afterReaction,
            execution: changedConcentration,
            parentOccurrenceId: occurrenceId,
            sourceCommandId: responseCommandId,
            userId: initiator.userId,
            authorizedCharacterIds,
            occurredAt
          })
        })
      const altered = {
        ...concentrationStep.execution,
        ownerTransitions: concentrationStep.execution.ownerTransitions.map((transition, index) =>
          index === 0
            ? {
                ...transition,
                after: {
                  ...transition.after,
                  conditionIds: [...transition.after.conditionIds, seeded.blinded.id]
                }
              }
            : transition
        )
      }
      await expect(commitPrepared(altered)).rejects.toThrow(
        'Live Session movement Concentration cleanup differs from its plan.'
      )
      expect(await records()).toEqual(before)
    }

    expect(
      await initiator.caller.mutation(observe, {
        saveId: staged.saveId,
        characterRevisions: []
      })
    ).toEqual({ saveId: staged.saveId })
    const observedSave = await geometrySave()
    expect(observedSave?.status).toBe('RECEIVING')
    expect(observedSave?.characterRevisions).toEqual([])
    expect(await records()).toEqual(before)
    if (!prepared.rules) throw new Error('Expected automatic Encounter actor rules.')
    const [authority, expectedScene] = await value.base.t.run(async (ctx) =>
      Promise.all([
        nextExternalAuthority(ctx, value.base.campaign.id),
        expectedMovementScene(ctx, staged.saveId, prepared.outcome)
      ])
    )
    const commitInput: LiveSessionMovementCommitInput = {
      ...stageInput,
      finish: { ...value.request, saveId: staged.saveId },
      authority,
      expectedScene,
      rules: prepared.rules,
      settlements: prepared.settlementInputs
    }
    if (!withSuffix && !asPlayer) {
      for (const denial of [
        { secret: null, identity: true, input: commitInput, status: 401 },
        { secret: 'wrong-worker-secret', identity: true, input: commitInput, status: 401 },
        { secret: workerSecret, identity: false, input: commitInput, status: 401 },
        {
          secret: workerSecret,
          identity: true,
          input: { ...commitInput, expectedUserId: crypto.randomUUID() },
          status: 409
        },
        {
          secret: workerSecret,
          identity: true,
          input: { ...commitInput, authorityEpoch: crypto.randomUUID() },
          status: 409
        }
      ]) {
        expect(
          (
            await privatePost(
              '/live-sessions/encounter-movement',
              denial.input,
              denial.secret,
              denial.identity
            )
          ).status
        ).toBe(denial.status)
        expect(await records()).toEqual(before)
        expect(await geometrySave()).toEqual(observedSave)
      }
    }
    const publish = (input: LiveSessionMovementCommitInput) =>
      initiator.caller.run((ctx) => commitLiveMovement(ctx, input))
    if (!asPlayer) {
      await expect(
        publish({
          ...commitInput,
          settlements: commitInput.settlements.slice(0, 1)
        })
      ).rejects.toThrow('Movement settlement is incomplete.')
      expect(await records()).toEqual(before)
      expect(await geometrySave()).toEqual(observedSave)
      await expect(
        publish({
          ...commitInput,
          settlements: [...commitInput.settlements, reactionStep]
        })
      ).rejects.toThrow('Movement reaction settlement differs from its retained receipt.')
      expect(await records()).toEqual(before)
      expect(await geometrySave()).toEqual(observedSave)
      if (withSuffix) {
        const suffix = commitInput.settlements[2]
        if (suffix?.kind !== 'SPATIAL') throw new Error('Expected a closed spatial suffix.')
        await expect(
          publish({
            ...commitInput,
            settlements: [suffix, reactionStep, concentrationStep]
          })
        ).rejects.toThrow('Spatial Character source pin is stale.')
        expect(await records()).toEqual(before)
        expect(await geometrySave()).toEqual(observedSave)
      }
      await expect(
        publish({
          ...commitInput,
          rules: { ...prepared.rules, actors: [] }
        })
      ).rejects.toThrow('Movement actor rule output scope mismatch.')
      expect(await records()).toEqual(before)
      expect(await geometrySave()).toEqual(observedSave)
      // The room's sequence fence and Scene prediction roll the whole commit back (D27).
      await expect(
        publish({ ...commitInput, authority: { ...authority, sequence: authority.sequence + 1 } })
      ).rejects.toThrow('Live Session authority sequence is stale.')
      await expect(
        publish({
          ...commitInput,
          expectedScene: { ...expectedScene, version: expectedScene.version + 1 }
        })
      ).rejects.toThrow('Live Scene publication differs from the room prediction.')
      expect(await records()).toEqual(before)
      expect(await geometrySave()).toEqual(observedSave)
      expect(await persistedAuthority()).toEqual({ sequence: 0, checksum: '0'.repeat(64) })
    }

    if (asPlayer) {
      await setReactorControl([])
      const revoked = await records()
      await expect(
        callLiveSessionRoute(
          environment,
          'fixture-access-token',
          'encounterMovementCommit',
          commitInput
        )
      ).rejects.toMatchObject({ status: 422, rejection: { reason: 'NOT_ACTOR_CONTROLLER' } })
      expect(await records()).toEqual(revoked)
      expect(await geometrySave()).toEqual(observedSave)
      await setReactorControl([initiator.userId])
      expect(await records()).toEqual(before)
      expect(await geometrySave()).toEqual(observedSave)
    }
    const published = await callLiveSessionRoute(
      environment,
      'fixture-access-token',
      'encounterMovementCommit',
      commitInput
    )
    const committed = await records()
    expect(published.scene.replayed).toBe(false)
    // The commit advanced the room's authority in the same transaction.
    expect(await persistedAuthority()).toEqual({
      sequence: authority.sequence,
      checksum: authority.stateChecksum
    })
    // A decision answer returns its Encounter result for the member.
    expect(published.encounter?.occurrence).toMatchObject({ occurrenceId, status: 'COMPLETE' })
    expect(committed.run?.version).toBe(before.run!.version + 1)
    expect(committed.sceneCommands).toHaveLength(before.sceneCommands.length + 1)
    const publishedSave = await geometrySave()
    expect(publishedSave?.status).toBe('PUBLISHED')
    const sceneAfter = await initiator.caller.run((ctx) =>
      readLiveScene(ctx, value.sceneId, 'MEMBER')
    )
    expect(sceneAfter.header.version).toBe(scene.version + 1)
    expect(published.scene.version).toBe(sceneAfter.header.version)
    expect(published.scene).toMatchObject({
      version: expectedScene.version,
      delta: expectedScene.delta
    })
    const settledActors = await initiator.caller.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
        .unique()
      if (!run) throw new Error('Published movement Run is unavailable.')
      return readRunActors(ctx, readRunState(run))
    })
    const sourceActor = settledActors.find(
      (actor) => actor.id === reaction.option.candidate.reactorActorId
    )
    const targetActor = settledActors.find((actor) => actor.id === value.base.mover.id)
    expect(
      sourceActor && encounterRuleUsageUsed(sourceActor, reaction.allowance.definitionId)
    ).toBe(reaction.allowance.afterUsed)
    expect(targetActor?.kind).toBe('CHARACTER')
    expect(committed.character?.streamVersion).toBe(
      before.character!.streamVersion + (withSuffix ? 3 : 2)
    )
    const priorCharacterReceiptIds = new Set(before.characterReceipts.map((entry) => entry.id))
    const movementCharacterReceipts = committed.characterReceipts.filter(
      (entry) => !priorCharacterReceiptIds.has(entry.id)
    )
    expect(movementCharacterReceipts.length).toBeGreaterThan(0)
    expect(movementCharacterReceipts.every((entry) => entry.actorId === initiator.userId)).toBe(
      true
    )
    if (!committed.character) throw new Error('Settled Character is unavailable.')
    const character = characterAuthoredDtoSchema.parse(JSON.parse(committed.character.documentJson))
    expect(character.state.hitpoints.current).toBe(
      withSuffix
        ? spatial.at(-1)!.targetTransition.after.currentHitPoints
        : reaction.application.targetTransition.after.currentHitPoints
    )
    expect((character.state.conditions ?? []).map((entry) => entry.conditionTypeId)).toContain(
      seeded.poisoned.id
    )
    expect((character.state.conditions ?? []).map((entry) => entry.conditionTypeId)).not.toContain(
      seeded.blinded.id
    )
    expect(committed.maintained.map((entry) => entry.id)).not.toContain(seeded.state.id)
    expect(committed.effects.map((entry) => entry.id)).toEqual([seeded.independent.id])
    expect(committed.spatialEffects.map((entry) => entry.id)).toEqual([])
    const child = committed.receipts.find(
      (entry) => entry.commandId === concentrationCommandId(concentration.result.occurrenceId)
    )
    if (!child) throw new Error('Movement Concentration receipt is unavailable.')
    expect(child.actorUserId).toBe(initiator.userId)
    expect(storedRuleExecutionResultDtoSchema.parse(JSON.parse(child.resultJson))).toEqual(
      concentration.result
    )
    const rootReceipt = committed.receipts.find((entry) => entry.commandId === responseCommandId)
    if (!rootReceipt) throw new Error('Published movement response receipt is unavailable.')
    expect(rootReceipt.actorUserId).toBe(initiator.userId)
    const rootResult = storedRuleExecutionResultDtoSchema.parse(JSON.parse(rootReceipt.resultJson))
    expect(rootResult).toEqual(prepared.outcome.result)
    expect(rootResult).toMatchObject({
      reactionExecutions: [{ concentrationChecks: [concentration] }]
    })
    const replay = await callLiveSessionRoute(
      environment,
      'fixture-access-token',
      'encounterMovementCommit',
      commitInput
    )
    expect(replay.scene).toEqual({ ...published.scene, replayed: true })
    expect(await records()).toEqual(committed)
    // A replay of the published save does not advance the authority again.
    expect(await persistedAuthority()).toEqual({
      sequence: authority.sequence,
      checksum: authority.stateChecksum
    })
    expect(await geometrySave()).toEqual(publishedSave)
  },
  120_000
)

it('bundles exactly the parts of a Character mover response the separate captures return', async () => {
  // The GM answers a reaction to a bound Character's move, with a second Character in the Run.
  const value = await setupAutomaticCharacterMovement(['CHOICE'], false, {}, true)
  if (!value.additionalCharacterActor) throw new Error('Expected the second Character actor.')
  const epoch = crypto.randomUUID()
  await value.base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: value.base.campaign.id,
      epoch,
      createdAt: value.base.campaign.createdAt
    })
  )
  await refreshMovementSaveVision(value)
  await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
  await value.owner.caller.mutation(prepareRoot, value.request)
  const choice = (await value.owner.caller.mutation(finishRoot, value.request)).occurrence?.pending
  if (choice?.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected the reaction choice.')
  vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
  stubLiveSessionFetch((pathname, init) => value.owner.caller.fetch(pathname, init))
  const scope = {
    campaignId: value.base.campaign.id,
    authorityEpoch: epoch,
    expectedUserId: value.owner.userId,
    expectedRole: 'OWNER' as const
  }
  const staged = await callLiveSessionRoute(
    environment,
    'fixture-access-token',
    'encounterMovementBegin',
    {
      ...scope,
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: crypto.randomUUID(),
        encounterId: value.base.run.id,
        expectedVersion: choice.encounterVersion,
        occurrenceId: choice.occurrenceId,
        expectedOccurrenceVersion: choice.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
      }
    }
  )
  if (staged.kind !== 'READY') throw new Error('Expected a receiving geometry save.')
  const { bundle, separate } = await value.owner.caller.run((ctx) =>
    readBundleAndSeparateCaptures(
      ctx,
      {
        ...scope,
        encounterId: value.base.run.id,
        expectedVersion: choice.encounterVersion,
        movement: { encounterId: value.base.run.id, saveId: staged.saveId, baseTokenOrdinal: 1 },
        request: { kind: 'MOVEMENT_INPUTS' }
      },
      value.base.run.actors
    )
  )
  expect(bundle.encounter[0]).toMatchObject({ kind: 'MOVEMENT_INPUTS' })
  // Each Character is admitted under its own movement scope; both INPUTS are bundled.
  expect(bundle.characters.map(({ character }) => character.id).sort()).toEqual(
    [value.base.character.id, value.additionalCharacter!.id].sort()
  )
  expect(bundle).toEqual(separate)
})
