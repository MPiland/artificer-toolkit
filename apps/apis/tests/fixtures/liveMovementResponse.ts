import { makeFunctionReference } from 'convex/server'
import { vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  LiveSessionMovementCommitInput,
  LiveSessionMovementPrepareInput
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type { sceneGeometryFinishInputSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { CampaignSceneState } from '@artificer-toolkit/shared/vtt'
import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { prepareNativeLiveMovement } from '../../../session-worker/src/nativeEncounterMovement'
import { readCurrentEntities } from '../../convex/scenes/currentEntities'
import { readLiveScene } from '../../convex/scenes/liveDocuments'
import type { setupAutomaticCharacterMovement } from './automaticCharacterMovement'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import {
  expectedMovementScene,
  nextExternalAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from './liveSessionWorker'

export const privateMovementWorkerSecret = 'private-movement-child-worker-secret-at-least-32-bytes'
export const privateMovementEnvironment = workerEnvironment(privateMovementWorkerSecret)

type AutomaticFixture = Awaited<ReturnType<typeof setupAutomaticCharacterMovement>>
type MovementFixture = {
  base: Pick<AutomaticFixture['base'], 't' | 'campaign' | 'run'>
  sceneId: string
  request: ReturnType<typeof sceneGeometryFinishInputSchema.parse>
}
type Caller = AutomaticFixture['owner']['caller']
const capture = makeFunctionReference<
  'query',
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
>('liveSessions/encounterRulesCapture:capture')

export async function preparePrivateMovementResponse(input: {
  value: MovementFixture
  caller: Caller
  userId: string
  role: 'OWNER' | 'PLAYER'
  epoch: string
  authSecret: string
  command: ResolveRuleOccurrenceInputDto
}) {
  const { value, caller, userId, role, epoch, authSecret, command } = input
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', privateMovementWorkerSecret)
  vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
  stubLiveSessionFetch((pathname, init) => {
    if (
      ![
        '/live-sessions/encounter-rules',
        '/live-sessions/character-rules',
        '/live-sessions/encounter-movement-stage',
        '/live-sessions/encounter-movement'
      ].includes(pathname)
    )
      throw new Error(`Unexpected private movement response request: ${pathname}`)
    if (
      new Headers(init?.headers).get('authorization') !== 'Bearer fixture-access-token' ||
      new Headers(init?.headers).get('x-artificer-live-session-secret') !==
        privateMovementWorkerSecret
    )
      throw new Error('Private movement response credentials are missing.')
    return caller.fetch(pathname, init)
  })
  const common = {
    campaignId: value.base.campaign.id,
    authorityEpoch: epoch,
    expectedUserId: userId,
    expectedRole: role
  }
  const staged = await callLiveSessionRoute(
    privateMovementEnvironment,
    'fixture-access-token',
    'encounterMovementStage',
    {
      ...common,
      command,
      characterRevisions: [],
      tokenOrdinals: value.request.tokenOrdinals ?? [],
      maintenanceDefinitionIds: []
    }
  )
  if (staged.kind !== 'STAGED') throw new Error('Expected private movement response staging.')
  const scene = await caller.run(async (ctx): Promise<CampaignSceneState> => {
    const { header } = await readLiveScene(ctx, value.sceneId, 'MEMBER')
    if (
      ['annotations', 'barriers', 'darknessZones', 'lights'].some(
        (collection) =>
          header.currentCounts[
            collection as 'annotations' | 'barriers' | 'darknessZones' | 'lights'
          ] !== 0
      )
    )
      throw new Error('Movement response fixture has unexpected Scene geometry.')
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
      throw new Error('Movement response Scene tokens are incomplete.')
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
    ...common,
    encounterId: value.base.run.id,
    expectedVersion: command.expectedVersion,
    movement: { encounterId: value.base.run.id, saveId: staged.saveId, baseTokenOrdinal: 1 }
  }
  const runtime = createPlatformRulesRuntime({
    continuationIntegrityKey: await deriveRulesContinuationKey(
      process.env.RULES_CONTINUATION_SECRET
    ),
    definitions: {
      async requireCurrent(definitionId: string) {
        const response = await caller.query(capture, {
          ...scope,
          request: { kind: 'DEFINITION', definitionId }
        })
        if (response.kind !== 'DEFINITION' || !response.definition)
          throw new Error('Movement response definition is unavailable.')
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
  const occurredAt = '2026-09-24T00:00:00.000Z'
  const planned = await prepareNativeLiveMovement({
    environment: privateMovementEnvironment,
    accessToken: 'fixture-access-token',
    scope,
    scene,
    occurrenceId: command.occurrenceId,
    occurredAt,
    runtime,
    random: (maximum) => {
      if (maximum <= 0) throw new Error('Invalid private movement roll bound.')
      return 0
    }
  })
  const preparation: SceneSpatialPreparation = {
    encounterId: value.base.run.id,
    expectedEncounterVersion: command.expectedVersion,
    occurrenceId: command.occurrenceId,
    occurredAt,
    outcome: planned.outcome
  }
  const planInput: LiveSessionMovementPrepareInput = {
    ...common,
    movement: scope.movement,
    preparation,
    revisions: planned.revisions(),
    maintenanceOwners: planned.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER' ? [request] : []
    )
  }
  const commitInput: LiveSessionMovementCommitInput = {
    ...planInput,
    finish: { ...value.request, saveId: staged.saveId },
    ...(await value.base.t.run(async (ctx) => ({
      authority: await nextExternalAuthority(ctx, value.base.campaign.id),
      expectedScene: await expectedMovementScene(ctx, staged.saveId, planned.outcome)
    }))),
    rules: planned.rules,
    settlements: planned.settlementInputs,
    fogLayers: []
  }
  return { planned, commitInput }
}
