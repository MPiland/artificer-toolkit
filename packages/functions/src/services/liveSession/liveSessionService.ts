import {
  createCampaignRepository,
  createCampaignCollaborationRepository,
  createCharacterRepository,
  createEncounterRepository,
  LiveMaximumHitPointPolicyContextError,
  createLiveSessionCommandLeaseRepository,
  createRuleOccurrenceRepository,
  createVttSceneRepository,
  withTransaction,
  type DBLike,
  type RuleOccurrenceRecord
} from '@artificer-toolkit/db'
import {
  liveSessionJoinOptionsDtoSchema,
  type LiveSessionAggregateVersionDto,
  type LiveSessionCommandDto,
  type LiveSessionCoordinatorSnapshotDto,
  type LiveSessionEncounterRuleOccurrenceBindingUpdateDto,
  type LiveSessionJoinOptionsDto,
  type LiveSessionRejectedDto,
  type LiveSessionSceneVisionContextDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { EncounterCurrentProjection } from '@artificer-toolkit/schema/projections/encounter'

import {
  assertCampaignWritable,
  resolveCampaignAuthority,
  CampaignAccessError
} from '../campaign/campaignService.js'
import {
  claimLiveSessionCommandAuthority,
  releaseLiveSessionCommandAuthority,
  renewLiveSessionCommandAuthority
} from '../campaign/liveSessionCommandAuthority.js'
import {
  executeCompactLiveCharacterHitPointCommand,
  executeCompactLiveMaximumHitPointModifierCommand,
  executeCharacterSheetCommandWithRuleEvaluation,
  type CharacterSheetCommittedRuleSnapshot,
  type CharacterSheetCommandExecutionResult,
  type CharacterSheetCommandServiceTiming
} from '../character/sheetService.js'
import {
  loadCharacterRuleSnapshotForLiveSessionCampaign,
  loadCharacterSceneVisionForLiveSessionCampaign
} from '../character/characterLiveSessionSnapshot.js'
import {
  executeEncounterCommandWithRuleSnapshot,
  type EncounterCommandServiceTiming
} from '../encounter/encounterService.js'
import type { EncounterActorRuleSnapshot } from '../encounter/encounterActorRuleEvaluation.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import {
  bindEncounterToPresentedScene,
  executeEncounterSceneActorTokenBindingCommand,
  setCampaignLiveScenePresentation,
  executeEncounterSceneCommandWithState
} from '../encounter/vttSceneService.js'
import type { CampaignSceneState, SceneCharacterVision } from '@artificer-toolkit/shared/vtt'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/rulesExecution'

export class LiveSessionAuthorityError extends Error {
  constructor() {
    super('Live-session authority is invalid.')
    this.name = 'LiveSessionAuthorityError'
  }
}

export function classifyLiveSessionCommandError(error: unknown): LiveSessionRejectedDto['code'] {
  const name = error instanceof Error ? error.name : ''
  if (
    name === 'CharacterSheetCommandError' ||
    name === 'EncounterNotFoundError' ||
    name === 'EncounterValidationError'
  ) {
    return 'INVALID_COMMAND'
  }
  if (
    name === 'CampaignAccessError' ||
    name === 'CampaignNotFoundError' ||
    name === 'LiveSessionAuthorityError'
  ) {
    return 'UNAUTHORIZED'
  }
  if (
    name === 'ConcurrencyError' ||
    name === 'EncounterConflictError' ||
    name === 'LiveSessionCommandAuthorityError'
  ) {
    return 'STALE_VERSION'
  }
  return 'COMMAND_FAILED'
}

export type LiveSessionMembershipRole = 'OWNER' | 'PLAYER'

export interface LiveSessionAdmission {
  options: LiveSessionJoinOptionsDto
  role: LiveSessionMembershipRole
  campaign: {
    id: string
    attunementSlotOverride: number | null
    version: number
  }
}

async function requireOpenSession(db: DBLike, options: LiveSessionJoinOptionsDto) {
  const session = (
    await createCampaignCollaborationRepository(db).listCampaignSessions(options.campaignId)
  ).find((candidate) => candidate.id === options.sessionId)
  if (!session || session.status !== 'OPEN') throw new CampaignAccessError()
  return session
}

async function authorizeLiveSessionAdmissionForOptions(
  db: DBLike,
  userId: string,
  options: LiveSessionJoinOptionsDto
): Promise<LiveSessionAdmission> {
  const authority = await resolveCampaignAuthority(db, options.campaignId, userId)
  assertCampaignWritable(authority)
  await requireOpenSession(db, options)
  return {
    options,
    role: authority.membership.role,
    campaign: {
      id: authority.campaign.id,
      attunementSlotOverride: authority.campaign.attunementSlotOverride,
      version: authority.campaign.version
    }
  }
}

export async function authorizeLiveSessionAdmission(
  db: DBLike,
  userId: string,
  rawOptions: unknown
): Promise<LiveSessionAdmission> {
  const options = liveSessionJoinOptionsDtoSchema.parse(rawOptions)
  return authorizeLiveSessionAdmissionForOptions(db, userId, options)
}

function liveSessionAuthority(options: LiveSessionJoinOptionsDto, authorityId: string) {
  const normalizedAuthorityId = authorityId.trim()
  if (!normalizedAuthorityId || normalizedAuthorityId.length > 128) {
    throw new LiveSessionAuthorityError()
  }
  return { sessionId: options.sessionId, authorityId: normalizedAuthorityId }
}

export async function claimLiveSessionRoomCommandAuthority(
  db: DBLike,
  userId: string,
  rawOptions: unknown,
  authorityId: string
): Promise<void> {
  const options = liveSessionJoinOptionsDtoSchema.parse(rawOptions)
  await withTransaction(db, async (trx) => {
    if (
      !(await createLiveSessionCommandLeaseRepository(trx).lockCampaignForCommand(
        options.campaignId
      ))
    ) {
      throw new CampaignAccessError()
    }
    const admission = await authorizeLiveSessionAdmissionForOptions(trx, userId, options)
    await claimLiveSessionCommandAuthority(
      trx,
      liveSessionAuthority(admission.options, authorityId)
    )
  })
}

export async function renewLiveSessionRoomCommandAuthority(
  db: DBLike,
  userId: string,
  rawOptions: unknown,
  authorityId: string
): Promise<{
  aggregateVersions: LiveSessionAggregateVersionDto[]
  memberships: Array<{ userId: string; role: LiveSessionMembershipRole }>
}> {
  const options = liveSessionJoinOptionsDtoSchema.parse(rawOptions)
  return withTransaction(db, async (trx) => {
    if (
      !(await createLiveSessionCommandLeaseRepository(trx).lockCampaignForCommand(
        options.campaignId
      ))
    ) {
      throw new CampaignAccessError()
    }
    const admission = await authorizeLiveSessionAdmissionForOptions(trx, userId, options)
    await renewLiveSessionCommandAuthority(
      trx,
      liveSessionAuthority(admission.options, authorityId)
    )
    const memberships = (
      await createCampaignRepository(trx).listActiveMemberships(admission.options.campaignId)
    ).map(({ role, userId }) => ({ role, userId }))
    const aggregateVersions = await loadLiveSessionAggregateVersionsForOptions(
      trx,
      admission.options,
      admission.campaign.version
    )
    return { aggregateVersions, memberships }
  })
}

export async function releaseLiveSessionRoomCommandAuthority(
  db: DBLike,
  rawOptions: unknown,
  authorityId: string
): Promise<void> {
  const options = liveSessionJoinOptionsDtoSchema.parse(rawOptions)
  await releaseLiveSessionCommandAuthority(db, liveSessionAuthority(options, authorityId))
}

export async function loadLiveSessionAggregateVersions(
  db: DBLike,
  userId: string,
  rawOptions: unknown
): Promise<LiveSessionAggregateVersionDto[]> {
  const options = liveSessionJoinOptionsDtoSchema.parse(rawOptions)
  return withTransaction(db, async (trx) => {
    if (
      !(await createLiveSessionCommandLeaseRepository(trx).lockCampaignForCommand(
        options.campaignId
      ))
    ) {
      throw new CampaignAccessError()
    }
    const admission = await authorizeLiveSessionAdmissionForOptions(trx, userId, options)
    return loadLiveSessionAggregateVersionsForOptions(
      trx,
      admission.options,
      admission.campaign.version
    )
  })
}

async function loadLiveSessionAggregateVersionsForOptions(
  db: DBLike,
  options: LiveSessionJoinOptionsDto,
  campaignVersion: number
): Promise<LiveSessionAggregateVersionDto[]> {
  const attendance = await createCampaignCollaborationRepository(db).listSessionAttendance(
    options.sessionId
  )
  const presentCharacterIds = attendance
    .filter((entry) => entry.present)
    .map((entry) => entry.characterId)
    .sort()
  const characterVersions = await Promise.all(
    presentCharacterIds.map(async (characterId) => {
      const character = await createCharacterRepository(db).findById(characterId)
      if (!character) throw new CampaignAccessError()
      return {
        aggregateKind: 'CHARACTER' as const,
        aggregateId: characterId,
        version: character.stream_version
      }
    })
  )
  const encounterVersions = (
    await createEncounterRepository(db).listVersionMetadataForSession(
      options.campaignId,
      options.sessionId
    )
  )
    .map((encounter) => ({
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: encounter.id,
      version: encounter.version
    }))
    .sort((left, right) => left.aggregateId.localeCompare(right.aggregateId))
  const presentation = await createVttSceneRepository(db).findSessionPresentation(options.sessionId)
  const scene =
    presentation?.sceneId === null || presentation?.sceneId === undefined
      ? null
      : await createVttSceneRepository(db).findLiveScene(presentation.sceneId)
  const sceneVersion =
    scene?.state.campaignId === options.campaignId
      ? {
          aggregateKind: 'SCENE' as const,
          aggregateId: scene.state.id,
          version: scene.state.version
        }
      : null
  return [
    {
      aggregateKind: 'CAMPAIGN',
      aggregateId: options.campaignId,
      version: campaignVersion
    },
    ...characterVersions,
    ...encounterVersions,
    ...(presentation
      ? [
          {
            aggregateKind: 'SESSION' as const,
            aggregateId: options.sessionId,
            version: presentation.version
          }
        ]
      : []),
    ...(sceneVersion ? [sceneVersion] : [])
  ]
}

export interface LiveSessionRoomSnapshot {
  aggregateVersions: LiveSessionAggregateVersionDto[]
  characterRuleSnapshots: Array<{
    characterId: string
    snapshot: CharacterSheetCommittedRuleSnapshot
  }>
  characterVisions: SceneCharacterVision[]
  encounterRuleSnapshots: Array<{
    encounterId: string
    snapshot: EncounterActorRuleSnapshot
  }>
  encounterActorTokenBindings: LiveSessionCoordinatorSnapshotDto['encounterActorTokenBindings']
  encounterCharacterBindings: LiveSessionCoordinatorSnapshotDto['encounterCharacterBindings']
  encounterRuleOccurrenceBindings: LiveSessionCoordinatorSnapshotDto['encounterRuleOccurrenceBindings']
  encounterSceneBindings: LiveSessionCoordinatorSnapshotDto['encounterSceneBindings']
  sceneStates: CampaignSceneState[]
}

type SpatialTerminalResult = Extract<
  StoredRuleExecutionResultDto,
  | { status: 'MOVEMENT_COMPLETE' }
  | { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
>

export interface LiveSessionSpatialRefresh {
  characterRuleSnapshots: Array<{
    characterId: string
    snapshot: CharacterSheetCommittedRuleSnapshot
  }>
  characterVisions: SceneCharacterVision[]
  encounterRuleSnapshot?: EncounterActorRuleSnapshot
  sceneState: CampaignSceneState
}

async function loadSpatialCharacterRuleSnapshots(
  db: DBLike,
  campaign: { id: string; attunementSlotOverride: number | null },
  changedAggregates: readonly LiveSessionAggregateVersionDto[]
): Promise<LiveSessionSpatialRefresh['characterRuleSnapshots']> {
  return Promise.all(
    changedAggregates
      .filter((transition) => transition.aggregateKind === 'CHARACTER')
      .map(async (transition) => {
        const snapshot = await loadCharacterRuleSnapshotForLiveSessionCampaign(
          db,
          transition.aggregateId,
          campaign
        )
        if (!snapshot || snapshot.streamVersion !== transition.version) {
          throw new Error('Spatial Character state changed before live-session refresh.')
        }
        return { characterId: transition.aggregateId, snapshot }
      })
  )
}

async function loadSpatialTerminalRefresh(
  db: DBLike,
  campaign: { id: string; attunementSlotOverride: number | null },
  result: SpatialTerminalResult,
  changedAggregates: readonly LiveSessionAggregateVersionDto[]
): Promise<LiveSessionSpatialRefresh> {
  const characterRuleSnapshots = await loadSpatialCharacterRuleSnapshots(
    db,
    campaign,
    changedAggregates
  )
  const projection = await createEncounterRepository(db).requireCurrentProjection({
    encounterId: result.encounterId,
    expectedStreamVersion: result.encounterVersion
  })
  const scene = await createVttSceneRepository(db).findLiveScene(result.sceneId)
  if (!scene || scene.state.id !== result.sceneId || scene.state.version !== result.sceneVersion) {
    throw new Error('Spatial Scene state changed before live-session refresh.')
  }
  return {
    characterRuleSnapshots,
    characterVisions: characterRuleSnapshots.map(({ characterId, snapshot }) =>
      deriveLiveSessionCharacterVision(characterId, snapshot)
    ),
    encounterRuleSnapshot: projection.ruleSnapshot,
    sceneState: scene.state
  }
}

export function deriveLiveSessionCharacterVision(
  characterId: string,
  snapshot: Pick<CharacterSheetCommittedRuleSnapshot, 'effectiveSceneVision'>
): SceneCharacterVision {
  return { ...snapshot.effectiveSceneVision, characterId }
}

async function loadLiveSessionEncounterCurrentProjections(
  db: DBLike,
  aggregateVersions: readonly LiveSessionAggregateVersionDto[]
): Promise<EncounterCurrentProjection[]> {
  return Promise.all(
    aggregateVersions
      .filter((version) => version.aggregateKind === 'ENCOUNTER')
      .map(({ aggregateId, version }) =>
        createEncounterRepository(db).requireCurrentProjection({
          encounterId: aggregateId,
          expectedStreamVersion: version
        })
      )
  )
}

async function loadLiveSessionEncounterBindings(
  db: DBLike,
  projections: readonly EncounterCurrentProjection[]
): Promise<
  Pick<
    LiveSessionCoordinatorSnapshotDto,
    'encounterActorTokenBindings' | 'encounterCharacterBindings' | 'encounterSceneBindings'
  >
> {
  const bindingsByEncounter = await Promise.all(
    projections.map(async (projection) => {
      const repository = createVttSceneRepository(db)
      const [sceneBinding, actorTokenBindings] = await Promise.all([
        repository.findEncounterBinding(projection.encounterId),
        repository.listActorTokenBindings(projection.encounterId)
      ])
      const tokenIdByActorId = new Map(
        actorTokenBindings.map((binding) => [binding.actorId, binding.tokenId])
      )
      const encounterCharacterBindings = projection.projection.actors.flatMap((actor) => {
        const tokenId = tokenIdByActorId.get(actor.id)
        return actor.kind === 'CHARACTER' && actor.sourceId && tokenId
          ? [
              {
                actorId: actor.id,
                characterId: actor.sourceId,
                encounterId: projection.encounterId,
                tokenId
              }
            ]
          : []
      })
      return {
        encounterActorTokenBindings: sceneBinding
          ? actorTokenBindings.map((binding) => ({
              ...binding,
              encounterId: projection.encounterId,
              sceneId: sceneBinding.sceneId
            }))
          : [],
        encounterCharacterBindings,
        encounterSceneBinding: sceneBinding
          ? { encounterId: projection.encounterId, sceneId: sceneBinding.sceneId }
          : null
      }
    })
  )
  return {
    encounterActorTokenBindings: bindingsByEncounter.flatMap(
      (binding) => binding.encounterActorTokenBindings
    ),
    encounterCharacterBindings: bindingsByEncounter.flatMap(
      (binding) => binding.encounterCharacterBindings
    ),
    encounterSceneBindings: bindingsByEncounter.flatMap((binding) =>
      binding.encounterSceneBinding ? [binding.encounterSceneBinding] : []
    )
  }
}

function loadLiveSessionEncounterRuleOccurrenceBindings(
  occurrences: readonly RuleOccurrenceRecord[]
): LiveSessionCoordinatorSnapshotDto['encounterRuleOccurrenceBindings'] {
  return occurrences.map((occurrence) => {
    const context = occurrence.pendingSnapshot?.applicationContext
    if (!context) throw new Error('A pending Encounter occurrence requires its sealed snapshot.')
    return context.kind === 'ENCOUNTER_SPATIAL_MOVEMENT' ||
      context.kind === 'ENCOUNTER_MOVEMENT_REACTION'
      ? {
          encounterId: occurrence.aggregateId,
          executionKind: 'SPATIAL' as const,
          occurrenceId: occurrence.id,
          sceneId: context.root.sceneId
        }
      : {
          encounterId: occurrence.aggregateId,
          executionKind: 'NON_SPATIAL' as const,
          occurrenceId: occurrence.id,
          sceneId: null
        }
  })
}

async function loadCurrentEncounterRuleOccurrenceBindingUpdate(
  db: DBLike,
  encounterId: string
): Promise<LiveSessionEncounterRuleOccurrenceBindingUpdateDto> {
  const occurrences = await createRuleOccurrenceRepository(db).listPendingEncounters([encounterId])
  if (occurrences.length > 1) {
    throw new Error('An Encounter cannot have multiple pending rule occurrences.')
  }
  return {
    encounterId,
    binding: loadLiveSessionEncounterRuleOccurrenceBindings(occurrences)[0] ?? null
  }
}

interface LiveSessionCoordinatorState extends LiveSessionCoordinatorSnapshotDto {
  characterRuleSnapshots: LiveSessionRoomSnapshot['characterRuleSnapshots']
  encounterRuleSnapshots: LiveSessionRoomSnapshot['encounterRuleSnapshots']
}

async function loadLiveSessionCoordinatorState(
  db: DBLike,
  userId: string,
  rawOptions: unknown,
  includeCharacterRuleSnapshots: boolean
): Promise<LiveSessionCoordinatorState> {
  const options = liveSessionJoinOptionsDtoSchema.parse(rawOptions)
  return withTransaction(db, async (trx) => {
    if (
      !(await createLiveSessionCommandLeaseRepository(trx).lockCampaignForCommand(
        options.campaignId
      ))
    ) {
      throw new CampaignAccessError()
    }
    const admission = await authorizeLiveSessionAdmissionForOptions(trx, userId, options)
    const aggregateVersions = await loadLiveSessionAggregateVersionsForOptions(
      trx,
      admission.options,
      admission.campaign.version
    )
    const encounterIds = aggregateVersions
      .filter((version) => version.aggregateKind === 'ENCOUNTER')
      .map((version) => version.aggregateId)
    const [
      encounterCurrentProjections,
      characterStates,
      presentation,
      pendingEncounterOccurrences
    ] = await Promise.all([
      loadLiveSessionEncounterCurrentProjections(trx, aggregateVersions),
      Promise.all(
        aggregateVersions
          .filter((version) => version.aggregateKind === 'CHARACTER')
          .map(async ({ aggregateId }) => {
            if (includeCharacterRuleSnapshots) {
              const snapshot = await loadCharacterRuleSnapshotForLiveSessionCampaign(
                trx,
                aggregateId,
                admission.campaign
              )
              if (!snapshot) throw new CampaignAccessError()
              return { characterId: aggregateId, kind: 'RULE_SNAPSHOT' as const, snapshot }
            }
            const vision = await loadCharacterSceneVisionForLiveSessionCampaign(
              trx,
              aggregateId,
              admission.campaign
            )
            if (!vision) throw new CampaignAccessError()
            return { characterId: aggregateId, kind: 'SCENE_VISION' as const, vision }
          })
      ),
      createVttSceneRepository(trx).findSessionPresentation(admission.options.sessionId),
      createRuleOccurrenceRepository(trx).listPendingEncounters(encounterIds)
    ])
    const presentedScene =
      presentation?.sceneId === null || presentation?.sceneId === undefined
        ? null
        : await createVttSceneRepository(trx).findLiveScene(presentation.sceneId)
    const sceneStates =
      presentedScene?.state.campaignId === admission.options.campaignId
        ? [presentedScene.state]
        : []
    const encounterBindings = await loadLiveSessionEncounterBindings(
      trx,
      encounterCurrentProjections
    )
    const versionByCharacterId = new Map(
      characterStates.map((state) => [
        state.characterId,
        state.kind === 'RULE_SNAPSHOT' ? state.snapshot.streamVersion : state.vision.streamVersion
      ])
    )
    const characterRuleSnapshots = characterStates.flatMap((state) =>
      state.kind === 'RULE_SNAPSHOT'
        ? [{ characterId: state.characterId, snapshot: state.snapshot }]
        : []
    )
    return {
      aggregateVersions: aggregateVersions.map((aggregateVersion) =>
        aggregateVersion.aggregateKind === 'CHARACTER'
          ? {
              ...aggregateVersion,
              version:
                versionByCharacterId.get(aggregateVersion.aggregateId) ?? aggregateVersion.version
            }
          : aggregateVersion
      ),
      characterRuleSnapshots,
      characterVisions: characterStates.map((state) => {
        if (state.kind === 'RULE_SNAPSHOT') {
          return deriveLiveSessionCharacterVision(state.characterId, state.snapshot)
        }
        return {
          characterId: state.characterId,
          dimRange:
            state.vision.dimRangeFeet !== null && state.vision.dimRangeFeet > 0
              ? { amount: state.vision.dimRangeFeet, unit: 'FEET' as const }
              : null
        }
      }),
      ...encounterBindings,
      encounterRuleOccurrenceBindings: loadLiveSessionEncounterRuleOccurrenceBindings(
        pendingEncounterOccurrences
      ),
      encounterRuleSnapshots: encounterCurrentProjections.map((projection) => ({
        encounterId: projection.encounterId,
        snapshot: projection.ruleSnapshot
      })),
      sceneStates
    }
  })
}

export async function loadLiveSessionCoordinatorSnapshot(
  db: DBLike,
  userId: string,
  rawOptions: unknown
): Promise<LiveSessionCoordinatorSnapshotDto> {
  const {
    characterRuleSnapshots: _characterRuleSnapshots,
    encounterRuleSnapshots: _encounterRuleSnapshots,
    ...snapshot
  } = await loadLiveSessionCoordinatorState(db, userId, rawOptions, false)
  return snapshot
}

export async function loadLiveSessionRoomSnapshot(
  db: DBLike,
  userId: string,
  rawOptions: unknown
): Promise<LiveSessionRoomSnapshot> {
  return loadLiveSessionCoordinatorState(db, userId, rawOptions, true)
}

export type LiveSessionCommandExecution =
  | {
      aggregateKind: 'CHARACTER'
      aggregateId: string
      commandId: string
      changedAggregates: LiveSessionAggregateVersionDto[]
      replayed: boolean
      version: number
      characterVision: SceneCharacterVision
      response: CharacterSheetCommandExecutionResult['response'] | null
      ruleSnapshot?: CharacterSheetCommittedRuleSnapshot
      ruleEvaluationLane?: 'CHARACTER_POLICY'
      spatialRefresh?: LiveSessionSpatialRefresh
    }
  | {
      aggregateKind: 'ENCOUNTER'
      aggregateId: string
      commandId: string
      changedAggregates: LiveSessionAggregateVersionDto[]
      replayed: boolean
      version: number
      response:
        | Awaited<ReturnType<typeof executeEncounterCommandWithRuleSnapshot>>['response']
        | Awaited<ReturnType<typeof bindEncounterToPresentedScene>>
      bindingRefresh?: {
        encounterActorTokenBindings: LiveSessionCoordinatorSnapshotDto['encounterActorTokenBindings']
        encounterCharacterBindings: LiveSessionCoordinatorSnapshotDto['encounterCharacterBindings']
        encounterId: string
        encounterSceneBinding:
          | LiveSessionCoordinatorSnapshotDto['encounterSceneBindings'][number]
          | null
      }
      occurrenceBindingUpdate?: LiveSessionEncounterRuleOccurrenceBindingUpdateDto
      ruleSnapshot?: EncounterActorRuleSnapshot
      spatialRefresh?: LiveSessionSpatialRefresh
    }
  | {
      aggregateKind: 'SCENE'
      aggregateId: string
      commandId: string
      changedAggregates: LiveSessionAggregateVersionDto[]
      replayed: boolean
      response: Awaited<ReturnType<typeof executeEncounterSceneCommandWithState>>['result'] | null
      occurrenceBindingUpdate?: LiveSessionEncounterRuleOccurrenceBindingUpdateDto
      state: CampaignSceneState
      version: number
      spatialRefresh?: LiveSessionSpatialRefresh
    }
  | {
      aggregateKind: 'SESSION'
      aggregateId: string
      commandId: string
      changedAggregates: LiveSessionAggregateVersionDto[]
      replayed: boolean
      response: Awaited<ReturnType<typeof setCampaignLiveScenePresentation>>
      sceneState: CampaignSceneState | null
      version: number
      ruleSnapshot?: undefined
      spatialRefresh?: undefined
    }

export async function executeLiveSessionCommand(
  db: DBLike,
  userId: string,
  rawOptions: unknown,
  command: LiveSessionCommandDto,
  authorityId: string,
  sceneVisionContext: LiveSessionSceneVisionContextDto,
  committedRuleSnapshot?: CharacterSheetCommittedRuleSnapshot,
  onCharacterTiming?: (timing: CharacterSheetCommandServiceTiming) => void,
  committedEncounterRuleSnapshot?: EncounterActorRuleSnapshot,
  onEncounterTiming?: (timing: EncounterCommandServiceTiming) => void,
  rulesRuntime?: RulesRuntimeService
): Promise<LiveSessionCommandExecution> {
  const options = liveSessionJoinOptionsDtoSchema.parse(rawOptions)
  const commandAuthority = liveSessionAuthority(options, authorityId)
  if (command.aggregateKind === 'CHARACTER') {
    if (
      (command.command.type === 'UPSERT_SHEET_ADJUSTMENT' &&
        command.command.adjustment.family === 'HIT_POINTS' &&
        command.command.adjustment.field === 'MAXIMUM_MODIFIER' &&
        typeof command.command.adjustment.value === 'number') ||
      command.command.type === 'REMOVE_SHEET_ADJUSTMENT'
    ) {
      let execution: Awaited<ReturnType<typeof executeCompactLiveMaximumHitPointModifierCommand>>
      try {
        execution = await executeCompactLiveMaximumHitPointModifierCommand({
          db,
          campaignId: options.campaignId,
          characterId: command.characterId,
          command: command.command,
          userId,
          liveSessionAuthority: commandAuthority
        })
      } catch (error) {
        if (error instanceof LiveMaximumHitPointPolicyContextError && error.reason === 'ACCESS') {
          throw new CampaignAccessError()
        }
        throw error
      }
      if (execution) {
        return {
          aggregateKind: 'CHARACTER',
          aggregateId: command.characterId,
          changedAggregates: [
            {
              aggregateKind: 'CHARACTER',
              aggregateId: command.characterId,
              version: execution.version
            }
          ],
          commandId: command.command.commandId,
          replayed: execution.replayed,
          version: execution.version,
          response: null,
          characterVision: execution.characterVision,
          ...(execution.replayed ? {} : { ruleEvaluationLane: 'CHARACTER_POLICY' as const })
        }
      }
    }
    await authorizeLiveSessionAdmissionForOptions(db, userId, options)
    const attendance = await createCampaignCollaborationRepository(db).listSessionAttendance(
      options.sessionId
    )
    if (!attendance.some((entry) => entry.characterId === command.characterId && entry.present)) {
      throw new CampaignAccessError()
    }
    if (command.command.type === 'ADJUST_HIT_POINTS') {
      const execution = await executeCompactLiveCharacterHitPointCommand({
        db,
        characterId: command.characterId,
        command: command.command,
        committedRuleSnapshot,
        userId,
        liveSessionAuthority: commandAuthority
      })
      return {
        aggregateKind: 'CHARACTER',
        aggregateId: command.characterId,
        changedAggregates: [
          {
            aggregateKind: 'CHARACTER',
            aggregateId: command.characterId,
            version: execution.version
          }
        ],
        commandId: command.command.commandId,
        replayed: execution.replayed,
        version: execution.version,
        response: null,
        characterVision: execution.characterVision,
        ruleSnapshot: execution.ruleSnapshot
      }
    }
    const execution = await executeCharacterSheetCommandWithRuleEvaluation({
      db,
      characterId: command.characterId,
      command: command.command,
      userId,
      committedRuleSnapshot,
      onTiming: onCharacterTiming,
      liveSessionAuthority: commandAuthority
    })
    return {
      aggregateKind: 'CHARACTER',
      aggregateId: command.characterId,
      changedAggregates: [
        {
          aggregateKind: 'CHARACTER',
          aggregateId: command.characterId,
          version: execution.response.streamVersion
        }
      ],
      commandId: command.command.commandId,
      replayed: execution.replayed,
      version: execution.response.streamVersion,
      response: execution.response,
      characterVision: deriveLiveSessionCharacterVision(
        command.characterId,
        execution.ruleSnapshot
      ),
      ruleSnapshot: execution.ruleSnapshot
    }
  }

  if (command.aggregateKind === 'SESSION') {
    await authorizeLiveSessionAdmissionForOptions(db, userId, options)
    const execution = await setCampaignLiveScenePresentation(db, userId, command.command, {
      liveSessionAuthority: commandAuthority
    })
    const scene = execution.sceneId
      ? await createVttSceneRepository(db).findLiveScene(execution.sceneId)
      : null
    if (scene && scene.state.campaignId !== options.campaignId) throw new CampaignAccessError()
    return {
      aggregateKind: 'SESSION',
      aggregateId: command.command.sessionId,
      changedAggregates: [
        {
          aggregateKind: 'SESSION',
          aggregateId: command.command.sessionId,
          version: execution.version
        }
      ],
      commandId: execution.commandId,
      replayed: execution.replayed,
      response: execution,
      sceneState: scene?.state ?? null,
      version: execution.version
    }
  }

  if (command.aggregateKind === 'SCENE') {
    const expectedEncounterVersion =
      command.command.type === 'MOVE_SCENE_TOKEN' &&
      command.command.expectedEncounterVersion !== null
        ? command.command.expectedEncounterVersion
        : null
    const mechanicsEncounter =
      expectedEncounterVersion === null
        ? null
        : await createEncounterRepository(db).findActiveForCampaign(options.campaignId)
    if (
      mechanicsEncounter &&
      (mechanicsEncounter.sessionId !== options.sessionId ||
        mechanicsEncounter.version !== expectedEncounterVersion ||
        (await createVttSceneRepository(db).findEncounterBinding(mechanicsEncounter.id))
          ?.sceneId !== command.command.sceneId)
    ) {
      throw new CampaignAccessError()
    }
    if (expectedEncounterVersion !== null && !mechanicsEncounter) {
      throw new CampaignAccessError()
    }
    const execution = await executeEncounterSceneCommandWithState(db, userId, command.command, {
      liveSceneContext: {
        authorityId: commandAuthority.authorityId,
        campaignId: options.campaignId,
        sessionId: options.sessionId
      },
      liveSessionAuthority: commandAuthority,
      rulesRuntime,
      sceneVisionContext,
      ...(mechanicsEncounter ? { encounterId: mechanicsEncounter.id } : {})
    })
    const spatialChangedAggregates = execution.spatialChangedAggregates
      ? execution.spatialChangedAggregates
      : execution.result.occurrence &&
          execution.result.version === command.command.expectedSceneVersion
        ? []
        : [
            {
              aggregateKind: 'SCENE' as const,
              aggregateId: execution.state.id,
              version: execution.result.version
            }
          ]
    const spatialRefresh =
      execution.spatialTerminalResult && !execution.result.replayed
        ? await loadSpatialTerminalRefresh(
            db,
            (await resolveCampaignAuthority(db, options.campaignId, userId)).campaign,
            execution.spatialTerminalResult,
            spatialChangedAggregates
          )
        : undefined
    const occurrenceBindingUpdate = mechanicsEncounter
      ? await loadCurrentEncounterRuleOccurrenceBindingUpdate(db, mechanicsEncounter.id)
      : undefined
    return {
      aggregateKind: 'SCENE',
      aggregateId: execution.state.id,
      changedAggregates: spatialChangedAggregates,
      commandId: execution.result.commandId,
      replayed: execution.result.replayed,
      response: execution.result,
      state: execution.state,
      version: execution.result.version,
      ...(occurrenceBindingUpdate ? { occurrenceBindingUpdate } : {}),
      ...(spatialRefresh ? { spatialRefresh } : {})
    }
  }

  await authorizeLiveSessionAdmissionForOptions(db, userId, options)
  const encounter = await createEncounterRepository(db).find(command.command.encounterId)
  if (
    !encounter ||
    encounter.campaignId !== options.campaignId ||
    encounter.sessionId !== options.sessionId
  ) {
    throw new CampaignAccessError()
  }
  if (command.command.type === 'BIND_ENCOUNTER_TO_PRESENTED_SCENE') {
    const execution = await bindEncounterToPresentedScene(db, userId, command.command, {
      liveSessionAuthority: commandAuthority
    })
    const projection = await createEncounterRepository(db).requireCurrentProjection({
      encounterId: encounter.id,
      expectedStreamVersion: encounter.version
    })
    const bindings = await loadLiveSessionEncounterBindings(db, [projection])
    return {
      aggregateKind: 'ENCOUNTER',
      aggregateId: encounter.id,
      changedAggregates: [],
      commandId: execution.commandId,
      bindingRefresh: {
        encounterActorTokenBindings: bindings.encounterActorTokenBindings,
        encounterCharacterBindings: bindings.encounterCharacterBindings,
        encounterId: encounter.id,
        encounterSceneBinding: bindings.encounterSceneBindings[0] ?? null
      },
      replayed: execution.replayed,
      response: execution,
      version: encounter.version
    }
  }
  if (
    command.command.type === 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING' ||
    command.command.type === 'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
  ) {
    const execution = await executeEncounterSceneActorTokenBindingCommand(
      db,
      userId,
      command.command,
      { liveSessionAuthority: commandAuthority }
    )
    const projection = await createEncounterRepository(db).requireCurrentProjection({
      encounterId: encounter.id,
      expectedStreamVersion: execution.response.projection.version
    })
    const bindings = await loadLiveSessionEncounterBindings(db, [projection])
    return {
      aggregateKind: 'ENCOUNTER',
      aggregateId: encounter.id,
      changedAggregates: [
        {
          aggregateKind: 'ENCOUNTER',
          aggregateId: encounter.id,
          version: execution.response.projection.version
        }
      ],
      bindingRefresh: {
        encounterActorTokenBindings: bindings.encounterActorTokenBindings,
        encounterCharacterBindings: bindings.encounterCharacterBindings,
        encounterId: encounter.id,
        encounterSceneBinding: bindings.encounterSceneBindings[0] ?? null
      },
      commandId: command.command.commandId,
      replayed: execution.replayed,
      response: execution.response,
      version: execution.response.projection.version
    }
  }
  const execution = await executeEncounterCommandWithRuleSnapshot(db, userId, command.command, {
    committedRuleSnapshot: committedEncounterRuleSnapshot,
    onTiming: onEncounterTiming,
    liveSessionAuthority: commandAuthority,
    rulesRuntime,
    sceneVisionContext
  })
  const spatialChangedAggregates = execution.spatialChangedAggregates ?? [
    {
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: command.command.encounterId,
      version: execution.response.projection.version
    }
  ]
  const spatialRefresh =
    execution.spatialTerminalBatch && !execution.replayed
      ? await loadSpatialTerminalRefresh(
          db,
          (await resolveCampaignAuthority(db, options.campaignId, userId)).campaign,
          execution.spatialTerminalBatch,
          spatialChangedAggregates
        )
      : execution.spatialSceneState && !execution.replayed
        ? await (async () => {
            const characterRuleSnapshots = await loadSpatialCharacterRuleSnapshots(
              db,
              (await resolveCampaignAuthority(db, options.campaignId, userId)).campaign,
              spatialChangedAggregates
            )
            return {
              characterRuleSnapshots,
              characterVisions: characterRuleSnapshots.map(({ characterId, snapshot }) =>
                deriveLiveSessionCharacterVision(characterId, snapshot)
              ),
              sceneState: execution.spatialSceneState!
            }
          })()
        : undefined
  const occurrenceBindingUpdate = await loadCurrentEncounterRuleOccurrenceBindingUpdate(
    db,
    command.command.encounterId
  )
  return {
    aggregateKind: 'ENCOUNTER',
    aggregateId: command.command.encounterId,
    changedAggregates: spatialChangedAggregates,
    commandId: command.command.commandId,
    replayed: execution.replayed,
    version: execution.response.projection.version,
    response: execution.response,
    occurrenceBindingUpdate,
    ...(execution.ruleSnapshot ? { ruleSnapshot: execution.ruleSnapshot } : {}),
    ...(spatialRefresh ? { spatialRefresh } : {})
  }
}
