// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { liveSessionCharacterRulesInputSchema } from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import type {
  LiveSessionMovementCommitInput,
  LiveSessionMovementPrepareInput
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { CampaignSceneState } from '@artificer-toolkit/shared/vtt'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { concentrationCommandId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_CONCENTRATION_DEFINITIONS,
  SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/concentration.js'
import { prepareNativeLiveMovement } from '../../../session-worker/src/nativeEncounterMovement'
import {
  beginNativeLiveMovement,
  stageNativeLiveMovement,
  commitNativeLiveMovement
} from '../../../session-worker/src/nativeEncounterMovementCommit'
import { setupAutomaticCharacterMovement } from '../../tests/fixtures/automaticCharacterMovement'
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

const workerSecret = 'private-movement-worker-test-secret-at-least-32-bytes'
const authSecret = 'private-movement-continuation-test-secret-at-least-32-bytes'
const environment = {
  CONVEX_SITE_URL: 'https://convex.example.test',
  LIVE_SESSION_WORKER_SECRET: workerSecret
}
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
  'prepares an automatic reaction and failed Concentration with spatial suffix $withSuffix as PLAYER $asPlayer',
  async ({ withSuffix, asPlayer }) => {
    const value = await setupAutomaticCharacterMovement(
      ['AUTOMATIC'],
      false,
      {
        features: [concentrationAdvantageFeature]
      },
      asPlayer
    )
    const initiator = asPlayer ? value.additionalPlayer : value.owner
    if (!initiator) throw new Error('Additional movement Player is unavailable.')
    const setMoverControl = (controlledByUserIds: string[]) =>
      value.base.t.run(async (ctx) => {
        const scene = await ctx.db
          .query('campaignScenes')
          .withIndex('by_publicId', (q) => q.eq('id', value.sceneId))
          .unique()
        if (!scene) throw new Error('Movement Scene is unavailable.')
        const row = await ctx.db
          .query('sceneDefinitionEntities')
          .withIndex('by_saveId_collection_entityId', (q) =>
            q
              .eq('saveId', scene.definitionSaveId)
              .eq('value.collection', 'tokens')
              .eq('entityId', value.moverTokenId)
          )
          .unique()
        if (!row || row.value.collection !== 'tokens')
          throw new Error('Mover token definition is unavailable.')
        const controlled = {
          collection: 'tokens' as const,
          entity: { ...row.value.entity, controlledByUserIds }
        }
        await ctx.db.patch(row._id, {
          value: controlled,
          checksum: checksumCanonicalJson(controlled)
        })
        return controlled.entity
      })
    if (asPlayer) {
      const token = await setMoverControl([initiator.userId])
      expect(token.controlledByUserIds).toEqual([initiator.userId])
    }
    for (const definitions of sourceImportBatches(SRD_CONCENTRATION_DEFINITIONS))
      await value.base.t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions
      })
    const seeded = await seedConcentration({
      t: value.base.t,
      run: value.base.run,
      target: value.base.mover,
      character: value.base.character,
      characterActor: value.base.mover
    })
    vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
    const oneShot = withSuffix
      ? await seedSpatialEffect({ ...value.base, sceneId: value.sceneId }, { x: 375, y: 50 }, 5)
      : null
    const movementCommand = withSuffix
      ? { ...value.rootInput, path: [value.rootInput.path[0]!, { x: 450, y: 50 }] }
      : value.rootInput
    const epoch = crypto.randomUUID()
    const session = await initiator.caller.run((ctx) =>
      ctx.db
        .query('campaignSessions')
        .withIndex('by_publicId', (q) => q.eq('id', value.base.run.sessionId))
        .unique()
    )
    if (!session) throw new Error('Movement Session is unavailable.')
    await value.base.t.run(async (ctx) => {
      const oldSave = await ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_publicId', (q) => q.eq('id', value.saveId))
        .unique()
      if (!oldSave) throw new Error('Fixture geometry save is unavailable.')
      await ctx.db.delete(oldSave._id)
      await ctx.db.insert('campaignLiveAuthorities', {
        campaignId: value.base.campaign.id,
        sessionId: session.id,
        epoch,
        phase: 'DO_ACTIVE',
        activationFingerprint: '0'.repeat(64),
        persistedSequence: 0,
        persistedStateChecksum: '0'.repeat(64),
        createdAt: value.base.campaign.createdAt,
        updatedAt: value.base.campaign.createdAt
      })
    })
    const sessionScope = {
      sessionId: session.id,
      expectedSessionVersion: session.version,
      expectedPresentationVersion: 0
    }
    const requests: string[] = []
    vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL | Request, init?: RequestInit) => {
        const pathname = new URL(url instanceof Request ? url.url : url.toString()).pathname
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
    )
    const staged = await beginNativeLiveMovement(environment, 'fixture-access-token', {
      campaignId: value.base.campaign.id,
      sessionId: session.id,
      authorityEpoch: epoch,
      expectedUserId: initiator.userId,
      expectedRole: asPlayer ? 'PLAYER' : 'OWNER',
      command: movementCommand,
      session: sessionScope
    })
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
      sessionId: session.id,
      authorityEpoch: epoch,
      expectedUserId: initiator.userId,
      expectedRole: asPlayer ? 'PLAYER' : 'OWNER',
      encounterId: value.base.run.id,
      expectedVersion: value.rootInput.expectedEncounterVersion!,
      movement: { encounterId: value.base.run.id, saveId: staged.saveId, baseTokenOrdinal: 1 }
    }
    const runtime = createPlatformRulesRuntime({
      continuationIntegrityKey: await deriveRulesContinuationKey(
        process.env.RULES_CONTINUATION_SECRET
      ),
      definitions: {
        async requireCurrent(definitionId: string) {
          const response: LiveSessionEncounterRulesResponse = await initiator.caller.query(
            makeFunctionReference<
              'query',
              LiveSessionEncounterRulesInput,
              LiveSessionEncounterRulesResponse
            >('liveSessions/encounterRulesCapture:capture'),
            { ...scope, request: { kind: 'DEFINITION', definitionId } }
          )
          if (response.kind !== 'DEFINITION' || !response.definition)
            throw new Error('Captured movement definition is unavailable.')
          return serverPublishedRuleDefinitionDtoSchema.parse({
            id: response.definition.id,
            gameSystemId: response.definition.gameSystemId,
            definitionFamilyKey: response.definition.definitionFamilyKey,
            checksum: response.definition.checksum,
            definition: response.definition.document
          })
        }
      }
    })
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
    const occurrenceId = crypto.randomUUID()
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
      expectedEncounterVersion: value.rootInput.expectedEncounterVersion!,
      occurrenceId,
      occurredAt,
      outcome: prepared.outcome
    }
    const stageInput: LiveSessionMovementPrepareInput = {
      campaignId: scope.campaignId,
      sessionId: scope.sessionId,
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
    expect(await stageNativeLiveMovement(environment, 'fixture-access-token', stageInput)).toEqual(
      preparation
    )
    expect(await records()).toEqual(before)
    expect(await stageNativeLiveMovement(environment, 'fixture-access-token', stageInput)).toEqual(
      preparation
    )
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
            sourceCommandId: value.rootInput.commandId,
            occurredAt,
            authorizedCharacterIds
          })
          return persistLiveMovementConcentration(ctx, {
            state: { ...state, version: state.version + 1 },
            actors: afterReaction,
            execution: changedConcentration,
            parentOccurrenceId: occurrenceId,
            sourceCommandId: value.rootInput.commandId,
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
    const commitInput: LiveSessionMovementCommitInput = {
      ...stageInput,
      finish: { ...value.request, saveId: staged.saveId },
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
    }

    if (asPlayer) {
      expect((await setMoverControl([])).controlledByUserIds).toEqual([])
      expect(await records()).toEqual(before)
      expect(await geometrySave()).toEqual(observedSave)
      await expect(
        commitNativeLiveMovement(environment, 'fixture-access-token', commitInput)
      ).rejects.toMatchObject({ status: 409 })
      expect(await records()).toEqual(before)
      expect(await geometrySave()).toEqual(observedSave)
      expect((await setMoverControl([initiator.userId])).controlledByUserIds).toEqual([
        initiator.userId
      ])
      expect(await records()).toEqual(before)
      expect(await geometrySave()).toEqual(observedSave)
    }
    const published = await commitNativeLiveMovement(
      environment,
      'fixture-access-token',
      commitInput
    )
    const committed = await records()
    expect(published.replayed).toBe(false)
    expect(committed.run?.version).toBe(before.run!.version + 1)
    expect(committed.sceneCommands).toHaveLength(before.sceneCommands.length + 1)
    const publishedSave = await geometrySave()
    expect(publishedSave?.status).toBe('PUBLISHED')
    const sceneAfter = await initiator.caller.run((ctx) =>
      readLiveScene(ctx, value.sceneId, 'MEMBER')
    )
    expect(sceneAfter.header.version).toBe(scene.version + 1)
    expect(published.version).toBe(sceneAfter.header.version)
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
    expect(targetActor?.currentHitPoints).toBe(
      withSuffix
        ? spatial.at(-1)!.targetTransition.after.currentHitPoints
        : reaction.application.targetTransition.after.currentHitPoints
    )
    expect(targetActor?.sourceRevision).toBe(committed.character?.streamVersion)
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
    const rootReceipt = committed.receipts.find(
      (entry) => entry.commandId === value.rootInput.commandId
    )
    if (!rootReceipt) throw new Error('Published movement root receipt is unavailable.')
    expect(rootReceipt.actorUserId).toBe(initiator.userId)
    const rootResult = storedRuleExecutionResultDtoSchema.parse(JSON.parse(rootReceipt.resultJson))
    expect(rootResult).toEqual(prepared.outcome.result)
    expect(rootResult).toMatchObject({
      reactionExecutions: [{ concentrationChecks: [concentration] }]
    })
    const replay = await commitNativeLiveMovement(environment, 'fixture-access-token', commitInput)
    expect(replay).toEqual({ ...published, replayed: true })
    expect(await records()).toEqual(committed)
    expect(await geometrySave()).toEqual(publishedSave)
  },
  120_000
)
